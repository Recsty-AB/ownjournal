import Foundation
import Capacitor
import CloudKit

/// Native CloudKit plugin for Capacitor 8.
/// Uses CKDatabase (private database) with the device's iCloud account —
/// no sign-in popup needed. Replaces CloudKit JS on native iOS.
///
/// Record format (compatible with existing CloudKit JS records):
///   Record type: "JournalEntry"
///   Record name: "journal_{fileName with dots replaced by underscores}"
///   Fields: fileName (String), content (String), modifiedAt (String, ISO8601)
@objc(CloudKitPlugin)
public class CloudKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudKitPlugin"
    public let jsName = "CloudKitPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkAccountStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "upload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "download", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exists", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
    ]

    private let defaultContainerId = "iCloud.app.ownjournal"
    private let recordType = "JournalEntry"

    private func container(for call: CAPPluginCall) -> CKContainer {
        let id = call.getString("containerId") ?? defaultContainerId
        return CKContainer(identifier: id)
    }

    private func database(for call: CAPPluginCall) -> CKDatabase {
        return container(for: call).privateCloudDatabase
    }

    private func recordName(for fileName: String) -> String {
        return "journal_" + fileName.replacingOccurrences(of: ".", with: "_")
    }

    // MARK: - checkAccountStatus

    @objc func checkAccountStatus(_ call: CAPPluginCall) {
        let ckContainer = container(for: call)
        ckContainer.accountStatus { status, error in
            if let error = error {
                call.reject("Failed to check account status: \(error.localizedDescription)")
                return
            }
            let statusString: String
            switch status {
            case .available:
                statusString = "available"
            case .noAccount:
                statusString = "noAccount"
            case .restricted:
                statusString = "restricted"
            case .couldNotDetermine:
                statusString = "couldNotDetermine"
            case .temporarilyUnavailable:
                statusString = "temporarilyUnavailable"
            @unknown default:
                statusString = "unknown"
            }
            call.resolve(["status": statusString])
        }
    }

    // MARK: - upload

    @objc func upload(_ call: CAPPluginCall) {
        guard let fileName = call.getString("fileName") else {
            call.reject("Missing required parameter: fileName")
            return
        }
        guard let content = call.getString("content") else {
            call.reject("Missing required parameter: content")
            return
        }

        let db = database(for: call)
        let recName = recordName(for: fileName)
        let recordID = CKRecord.ID(recordName: recName)

        // Try to fetch existing record first for conflict-safe update
        db.fetch(withRecordID: recordID) { existingRecord, fetchError in
            let record: CKRecord
            if let existing = existingRecord {
                // Update existing record
                record = existing
            } else {
                // Create new record
                record = CKRecord(recordType: self.recordType, recordID: recordID)
            }

            record["fileName"] = fileName as CKRecordValue
            record["content"] = content as CKRecordValue
            record["modifiedAt"] = ISO8601DateFormatter().string(from: Date()) as CKRecordValue

            let operation = CKModifyRecordsOperation(recordsToSave: [record], recordIDsToDelete: nil)
            operation.savePolicy = .changedKeys
            operation.modifyRecordsResultBlock = { result in
                switch result {
                case .success:
                    call.resolve()
                case .failure(let error):
                    self.handleCKError(error, call: call, context: "upload")
                }
            }
            db.add(operation)
        }
    }

    // MARK: - download

    @objc func download(_ call: CAPPluginCall) {
        guard let fileName = call.getString("fileName") else {
            call.reject("Missing required parameter: fileName")
            return
        }

        let db = database(for: call)
        let recName = recordName(for: fileName)
        let recordID = CKRecord.ID(recordName: recName)

        db.fetch(withRecordID: recordID) { record, error in
            if let error = error {
                let ckError = error as? CKError
                if ckError?.code == .unknownItem {
                    call.resolve(["content": NSNull()])
                    return
                }
                self.handleCKError(error, call: call, context: "download")
                return
            }

            guard let record = record else {
                call.resolve(["content": NSNull()])
                return
            }

            let content = record["content"] as? String
            call.resolve(["content": content ?? NSNull()])
        }
    }

    // MARK: - listFiles

    @objc func listFiles(_ call: CAPPluginCall) {
        let db = database(for: call)
        let predicate = NSPredicate(value: true)
        let query = CKQuery(recordType: recordType, predicate: predicate)

        var allRecords: [CKRecord] = []

        func fetchBatch(cursor: CKQueryOperation.Cursor?) {
            let operation: CKQueryOperation
            if let cursor = cursor {
                operation = CKQueryOperation(cursor: cursor)
            } else {
                operation = CKQueryOperation(query: query)
            }
            operation.resultsLimit = 200

            operation.recordMatchedBlock = { _, result in
                if case .success(let record) = result {
                    allRecords.append(record)
                }
            }

            operation.queryResultBlock = { result in
                switch result {
                case .success(let nextCursor):
                    if let nextCursor = nextCursor {
                        // More records to fetch
                        fetchBatch(cursor: nextCursor)
                    } else {
                        // All done — build response
                        let files = allRecords.compactMap { record -> [String: Any]? in
                            guard let fileName = record["fileName"] as? String else { return nil }
                            let modifiedAtStr = record["modifiedAt"] as? String ?? ISO8601DateFormatter().string(from: record.modificationDate ?? Date())
                            let content = record["content"] as? String ?? ""
                            return [
                                "name": fileName,
                                "path": self.mapFilePath(fileName: fileName),
                                "modifiedAt": modifiedAtStr,
                                "size": content.count,
                            ]
                        }
                        call.resolve(["files": files])
                    }
                case .failure(let error):
                    self.handleCKError(error, call: call, context: "listFiles")
                }
            }

            db.add(operation)
        }

        fetchBatch(cursor: nil)
    }

    // MARK: - deleteRecord

    @objc func deleteRecord(_ call: CAPPluginCall) {
        guard let fileName = call.getString("fileName") else {
            call.reject("Missing required parameter: fileName")
            return
        }

        let db = database(for: call)
        let recName = recordName(for: fileName)
        let recordID = CKRecord.ID(recordName: recName)

        let operation = CKModifyRecordsOperation(recordsToSave: nil, recordIDsToDelete: [recordID])
        operation.modifyRecordsResultBlock = { result in
            switch result {
            case .success:
                call.resolve()
            case .failure(let error):
                let ckError = error as? CKError
                // Not found is a no-op for delete
                if ckError?.code == .unknownItem {
                    call.resolve()
                    return
                }
                self.handleCKError(error, call: call, context: "deleteRecord")
            }
        }
        db.add(operation)
    }

    // MARK: - exists

    @objc func exists(_ call: CAPPluginCall) {
        guard let fileName = call.getString("fileName") else {
            call.reject("Missing required parameter: fileName")
            return
        }

        let db = database(for: call)
        let recName = recordName(for: fileName)
        let recordID = CKRecord.ID(recordName: recName)

        db.fetch(withRecordID: recordID) { record, error in
            if let error = error {
                let ckError = error as? CKError
                if ckError?.code == .unknownItem {
                    call.resolve(["exists": false])
                    return
                }
                self.handleCKError(error, call: call, context: "exists")
                return
            }
            call.resolve(["exists": record != nil])
        }
    }

    // MARK: - openSettings

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Try to open Apple Account / iCloud settings directly
            let urls = [
                "App-prefs:APPLE_ACCOUNT",
                "App-prefs:CASTLE",
                UIApplication.openSettingsURLString
            ]
            for urlString in urls {
                if let url = URL(string: urlString), UIApplication.shared.canOpenURL(url) {
                    UIApplication.shared.open(url) { success in
                        call.resolve(["opened": urlString])
                    }
                    return
                }
            }
            call.reject("Failed to open Settings")
        }
    }

    // MARK: - Helpers

    /// Map a fileName to its virtual path (same convention as CloudKit JS service)
    private func mapFilePath(fileName: String) -> String {
        if fileName == "encryption-key.json" {
            return "/OwnJournal/encryption-key.json"
        } else if fileName.hasPrefix("trend_analysis") {
            return "/OwnJournal/analysis/\(fileName)"
        } else if fileName.hasPrefix("entry-") && fileName.hasSuffix(".json") {
            return "/OwnJournal/entries/\(fileName)"
        } else {
            return "/OwnJournal/\(fileName)"
        }
    }

    /// Handle CloudKit errors with structured error codes for the TS layer
    private func handleCKError(_ error: Error, call: CAPPluginCall, context: String) {
        let ckError = error as? CKError

        switch ckError?.code {
        case .requestRateLimited, .serviceUnavailable:
            let retryAfter = ckError?.userInfo[CKErrorRetryAfterKey] as? Double ?? 3.0
            call.reject("RATE_LIMITED", "RATE_LIMITED", error, ["retryAfter": retryAfter])

        case .notAuthenticated:
            call.reject("NOT_AUTHENTICATED", "NOT_AUTHENTICATED", error)

        case .serverRecordChanged:
            // Conflict — the TS layer should not see this for upload (handled internally),
            // but surface it for other contexts
            call.reject("CONFLICT", "CONFLICT", error)

        case .unknownItem:
            call.reject("NOT_FOUND", "NOT_FOUND", error)

        case .networkUnavailable, .networkFailure:
            call.reject("NETWORK_ERROR", "NETWORK_ERROR", error)

        case .quotaExceeded:
            call.reject("QUOTA_EXCEEDED", "QUOTA_EXCEEDED", error)

        default:
            call.reject("CloudKit \(context) failed: \(error.localizedDescription)", nil, error)
        }
    }
}
