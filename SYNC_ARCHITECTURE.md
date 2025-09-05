# Sync Architecture: Lossless Multi-Device Journal Sync

This document describes the architecture of the cloud sync system: how entries and deletions are stored, how conflicts are resolved, and how compaction preserves delete information without data loss.

## Overview

Sync is **cloud-first**: entry files in cloud storage are the source of truth for content. Version vectors (stored inside entry files) enable conflict detection when multiple devices edit the same entry. Deletions are recorded in an operation log; a **state snapshot** ensures deletion information is never lost when old operation files are compacted.

## Cloud Storage Layout

| Path | Purpose |
|------|---------|
| `entries/entry-{id}.json` | One file per journal entry. Contains full encrypted content, metadata, and version vector. |
| `operations/op-{deviceId}-{timestamp}-{random}.json` | One file per operation (create/update/delete). Metadata only; no entry content. |
| `operations/state-snapshot.json` | Permanent tombstones from compaction. Never deleted; updated when old op files are folded in. |
| `sync-state.json` | Last sync timestamp and device ID (metadata for sync flow). |
| `encryption-key.json` | E2E master key material (when E2E is enabled). |
| `analysis/trend_analysis*.json` | Cached trend analysis (optional). |

## Data Channels

### Entry files (content and version vectors)

- **Create/update**: When the user saves an entry, the app writes the full entry (encrypted or plain) to IndexedDB and uploads `entries/entry-{id}.json` to cloud. The entry file includes a **version vector**: a map of `deviceId -> lastOperationId` for that device. Conflict resolution uses these vectors; they are **not** reconstructed from operation files.
- **Delete**: The app removes the entry from local storage and records a delete operation. It also attempts to delete the entry file from cloud (**best-effort**). If that fails (offline, rate limit, etc.), the operation log is the only record that the entry was deleted.

### Operation files (audit trail and delete tracking)

- Each operation (create, update, delete) is written as a separate file: `operations/op-{id}.json`. The file contains only `{ id, entryId, type, timestamp, deviceId }` — no entry content.
- **readOperationLog()** (during sync) builds the current state by:
  1. Reading **state-snapshot.json** (if present) and initializing the **deleted** set from `deletedEntryIds`.
  2. Listing and replaying all **op-*.json** files, merging into the deleted set (delete adds, create/update removes).
  3. Merging **pending local operations** (queued while offline).
- The result is a **deleted** set (entry IDs that must be treated as deleted) and a **lastOperation** map (used for audit; not used for conflict resolution).

## Why Only Deletes Are Affected by Compaction

| Operation | Source of truth for content | Affected by compaction? |
|----------|----------------------------|--------------------------|
| Create   | Entry file                 | No                       |
| Update   | Entry file + version vector| No                       |
| Delete   | Operation log (and snapshot) | Yes, if snapshot is missing |

- **Edits**: The entry file holds the current content and version vector. Conflict resolution uses vectors from entry files. Operation files for edits are metadata only; compacting them does not change correctness.
- **Deletes**: The only record of a deletion is the op file (and, after compaction, the state snapshot). If the entry file was never removed and the op file is deleted without being folded into the snapshot, the entry can reappear.

## Snapshot-Based Compaction

**Principle**: Compaction compresses information; it never discards delete information.

1. **state-snapshot.json**  
   - Contains: `version`, `deletedEntryIds[]`, `snapshotTimestamp`, `coveredUpTo`, `createdBy`.  
   - This file is **never deleted** — only overwritten with merged data.

2. **compactOperationLog()** (runs in background after full sync):
   - Lists op files in `operations/` and selects those older than **OPERATION_COMPACTION_DAYS** (180).
   - Reads existing **state-snapshot.json** (if any).
   - Downloads each old op file, parses it, and collects every `entryId` where `type === 'delete'`. Tracks the latest `timestamp` as `coveredUpTo`.
   - Merges existing `deletedEntryIds` with newly found delete IDs (union).
   - Writes updated **state-snapshot.json** to cloud.
   - Deletes **only** the op files that were successfully read (so unreadable files are retried later).
   - **Orphan cleanup**: For each ID in the merged deleted set, attempts to delete `entries/entry-{id}.json` from cloud (best-effort).

3. **readOperationLog()**  
   - Starts with `deleted = snapshot.deletedEntryIds` (or empty).  
   - Replays all op-*.json files and pending ops into `deleted` and `lastOperation`.  
   - So even if all op files have been compacted, the snapshot preserves historical deletes.

## Conflict Resolution

- **Detection**: For each entry that exists both locally and in cloud, the app compares **version vectors**. A conflict exists when neither vector is a subset of the other (each side has operations the other has not seen).
- **Resolution**: Last-write-wins (LWW) using `metadata.updatedAt`; if equal, device ID is used as tiebreaker. The winning version is kept; version vectors are merged so the conflict does not repeat.
- **False conflicts**: If content is identical (e.g. after provider transfer), vectors are merged without logging a conflict.

## Long-Offline Devices

- **Device offline > 180 days with pending delete**: When it comes back, it uploads its pending operations. The snapshot (written by another device’s compaction) may already contain that delete. readOperationLog merges snapshot + ops + pending, so the entry stays deleted.
- **Device offline with local edits**: Entry files and version vectors are in cloud. When the device syncs, conflict detection uses those vectors; LWW resolves any real conflicts. No operation log history is required for correctness.

## Multi-Device Snapshot Writes

If two devices run compaction at the same time, both may write **state-snapshot.json**. The deleted set is append-only (IDs are only added). Compaction always **reads the existing snapshot first** and merges (union) before writing. So any ordering of writes yields a correct superset of deletes; the next compaction or sync will still see all tombstones.

## File Transfer Between Providers

When transferring data (e.g. Google Drive → Nextcloud):

- **transferService** lists all source files (including `OwnJournal/operations/` and **state-snapshot.json**).
- **normalizePathForTarget** ensures `state-snapshot.json` lives under `OwnJournal/operations/` on the target. If the source had it under the wrong path, it is corrected.
- So the snapshot is transferred and remains valid on the new provider.

## Key Code Locations

- **storageServiceV2.ts**: `readStateSnapshot`, `writeStateSnapshot`, `readOperationLog`, `compactOperationLog`, `reconcileEntries` / `doReconcileEntries`, version vector merge and conflict detection.
- **googleDriveService.ts**: `listFiles` maps `state-snapshot.json` and `op-device-*.json` to `OwnJournal/operations/`.
- **transferService.ts**: `normalizePathForTarget` fixes `state-snapshot.json` and op paths; `listAllFiles` includes `OwnJournal/operations` in known dirs.

## Summary

- **Entry files** = source of truth for content and version vectors; **operation files** = audit trail and delete tracking.
- **state-snapshot.json** = permanent tombstones; compaction folds old op files into it before deleting them, so delete information is never lost.
- **Conflict resolution** uses only entry-file data (version vectors and timestamps); long offline and compaction remain safe for both edits and deletes.
