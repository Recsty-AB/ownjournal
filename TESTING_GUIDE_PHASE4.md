# Phase 4 Conflict Detection Testing Guide

## Overview
Phase 4 implements version vector-based conflict detection with Last-Write-Wins (LWW) resolution. This guide helps you test the conflict detection and resolution system.

## Automated Testing

### Running Unit Tests

Comprehensive automated tests for cloud storage services verify token refresh, retry logic, and error handling:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

The automated test suite covers:
- ✅ **Token Refresh**: Automatic refresh when expired, 401 handling, concurrent requests
- ✅ **Retry Logic**: Exponential backoff, 5xx/429 retries, max attempts
- ✅ **Error Handling**: JSON/text error extraction, network failures, 404/409 handling
- ✅ **File Operations**: Upload, download, list, delete, exists checks
- ✅ **Path Sanitization**: Security validation for file names

See `src/services/__tests__/README.md` for detailed test documentation.

### Test Results Interpretation

- **All passing**: Cloud storage integration is production-ready
- **Token refresh failures**: Check OAuth configuration
- **Retry logic failures**: Review network error handling
- **File operation failures**: Verify API compatibility

---

## What Gets Tested
1. **Version Vectors**: Track which device made which changes
2. **Conflict Detection**: Identify concurrent edits on different devices
3. **LWW Resolution**: Automatically resolve conflicts by timestamp
4. **Conflict Log**: Record all conflicts for review and restore
5. **Restore Capability**: Recover discarded versions from conflicts

## Testing Method 1: Two Browser Tabs (Easier)

### Prerequisites
- Cloud storage connected (Google Drive, Dropbox, Nextcloud, or iCloud)
- Journal password set
- DevTools console open (F12) in both tabs

### Steps

1. **Setup: Open Two Tabs**
   ```
   Tab A (Device A): http://localhost:8080
   Tab B (Device B): http://localhost:8080
   ```

2. **Tab A: Create Initial Entry**
   - Create a new journal entry with title "Test Conflict Entry"
   - Body: "Original content from Device A"
   - Save the entry
   - **IMPORTANT**: Note the Entry ID from console logs
     - Look for: `✅ Entry synced to cloud immediately after save`
     - Entry ID format: `entry-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`

3. **Tab B: Wait for Sync**
   - Wait ~5 seconds for auto-sync
   - Verify the entry appears in Tab B
   - Open the entry to view it

4. **Tab B: Edit the Entry**
   - Modify title to "Test Conflict Entry - DEVICE B"
   - Change body to "Modified on Device B at [current time]"
   - Save
   - Check console for: `✅ Entry synced to cloud immediately after save`

5. **Tab A: Edit the Same Entry (Creates Conflict)**
   - Edit the SAME entry
   - Change title to "Test Conflict Entry - DEVICE A"  
   - Change body to "Modified on Device A at [current time]"
   - Save
   - Check console for: `✅ Entry synced to cloud immediately after save`

6. **Trigger Conflict Detection**
   - Go to Settings → Click "Sync Now" in Tab A
   - Watch console for: `⚠️ Conflict detected for entry [ID]`
   - The conflict should be auto-resolved by LWW

7. **Verify Conflict Log**
   - Go to Settings → Conflicts tab
   - You should see a new conflict entry showing:
     - Winner: The version with the later timestamp
     - Loser: The earlier version (now available for restore)
     - Reason: "Concurrent edits detected..."

8. **Test Restore**
   - In Conflicts tab, click "Show Details" on the conflict
   - Review the discarded version's full content
   - Click "Restore This Version"
   - Verify the discarded version is now restored

### Expected Console Logs

**Device A (when conflict detected):**
```
🔄 Starting full sync...
...
⚠️ Conflict detected for entry [ID]
⚠️ [Conflict] Concurrent edits detected. Using [winner] version (edited [time]) over [loser] version (edited [time])
...
✅ Sync completed successfully
```

**Diagnostics Tab:**
```
- Operation: reconcileEntries (attempt 1)
- Success: Operation succeeded
```

**Conflicts Tab:**
```
Conflict Log Entry:
- Winner (Kept): Device [A/B], timestamp [time]
- Loser (Discarded): Device [A/B], timestamp [time]
- Status: Resolved by LWW
```

## Testing Method 2: Testing Tool (Simulated)

1. **Setup**
   - Go to Settings → Testing tab
   - Read the instructions on the Conflict Testing Tool

2. **Simulate Conflict**
   - Create an entry and copy its ID from console
   - Paste the ID into the testing tool
   - Click "Simulate Conflict"
   - Open the same entry and edit it with different content
   - Trigger sync

3. **Verify**
   - Check Conflicts tab for the simulated conflict
   - Diagnostics tab should show the conflict resolution

## Testing Method 3: Real Multi-Device (Production-Ready Test)

### Prerequisites
- Two physical devices (phone + laptop, or two laptops)
- Same cloud storage account on both
- Same journal password on both

### Steps

1. **Device A: Create Entry**
   - Create entry "Multi-Device Test"
   - Wait for sync to complete
   - Keep app open

2. **Device B: Verify Sync**
   - Wait for auto-sync
   - Verify "Multi-Device Test" appears
   - Open it to confirm content

3. **Device B: Go Offline**
   - Turn on Airplane Mode / Disconnect WiFi
   - Edit the entry: "Edited offline on Device B"
   - Save (goes to pending operations)

4. **Device A: Edit While B is Offline**
   - Edit the SAME entry: "Edited online on Device A"
   - Save and sync
   - Cloud now has Device A's version

5. **Device B: Come Back Online**
   - Turn off Airplane Mode / Connect WiFi
   - App will auto-sync
   - **CONFLICT DETECTED**
   - LWW resolution kicks in
   - Check Conflicts tab

6. **Verify Resolution**
   - Winner: Device with later timestamp
   - Loser: Saved in conflict log
   - Entry shows winner's content
   - Loser can be restored from Conflicts tab

## What to Look For

### ✅ Success Indicators

1. **Console Logs**
   - `⚠️ Conflict detected for entry [ID]`
   - `⚠️ [Conflict] Concurrent edits detected...`
   - No errors during sync

2. **Conflict Log**
   - New entry in Conflicts tab
   - Winner and Loser clearly identified
   - Full content of loser preserved
   - Timestamps accurate

3. **Restore Works**
   - Restore button functional
   - Discarded version becomes current
   - No data loss

### ❌ Failure Indicators

1. **No Conflict Detected**
   - One version simply overwrites the other without logging
   - No entry in Conflicts tab
   - Console shows no conflict warning

2. **Version Vectors Not Working**
   - Console shows `versionVector` as `undefined` or `{}`
   - Conflict detection doesn't trigger when it should

3. **Data Loss**
   - One version disappears completely
   - Conflict log empty when conflict occurred
   - Restore doesn't work

## Debugging Tips

1. **Check Version Vectors**
   ```javascript
   // In console:
   const entry = await storageServiceV2.getEntry('[ENTRY_ID]');
   console.log('Version Vector:', entry.versionVector);
   ```

2. **View Diagnostics**
   - Settings → Diagnostics tab
   - Look for retry operations
   - Check circuit breaker status

3. **View Conflict Log**
   - Settings → Conflicts tab
   - Review all recent conflicts
   - Check timestamps and device IDs

4. **Check Operation Log**
   - Console logs show operation IDs
   - Format: `op-[deviceId]-[timestamp]-[counter]`
   - Verify operations are being logged

## Common Issues

### Issue: No Conflict Detected
**Cause**: Version vectors not being updated
**Fix**: Check that `saveEntry` is updating version vectors

### Issue: Wrong Winner Selected
**Cause**: Timestamps may be identical or clock skew
**Fix**: Device ID tiebreaker should kick in

### Issue: Restore Doesn't Work
**Cause**: Full entry not saved in conflict log
**Fix**: Verify `loser.fullEntry` is populated

### Issue: Conflicts Not Logged
**Cause**: `addConflictLogEntry` not being called
**Fix**: Check `detectConflict` function is working

## Performance Metrics

Expected performance for conflict resolution:
- Conflict detection: < 100ms
- LWW resolution: < 50ms  
- Conflict log entry: < 10ms
- Total sync with conflict: < 2 seconds

## Next Steps After Testing

Once Phase 4 is verified:
1. Test with larger datasets (100+ entries)
2. Test with rapid edits (< 1 second apart)
3. Test with 3+ devices simultaneously
4. Test conflict log with 50+ conflicts
5. Test restore functionality extensively
6. Test clock skew scenarios (device time different by hours)

## Support

If you encounter issues:
1. Check console for error messages
2. Review Diagnostics tab for failures
3. Verify cloud storage connection
4. Check that version vectors are present in entries
5. Ensure both devices have synced at least once
