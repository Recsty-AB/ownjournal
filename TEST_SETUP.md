# Test Setup Instructions

## Package.json Scripts

The following scripts are already in `package.json`:

```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest --coverage"
```

## Test Configuration

All test configuration is already set up:
- ✅ `vitest.config.ts` - Vitest configuration with React and path aliases
- ✅ `src/test/setup.ts` - Test environment setup with mocks
- ✅ Test files created in `src/services/__tests__/` and `src/utils/__tests__/`

## Dependencies Installed

The following test dependencies have been added:
- `vitest` - Fast Vite-native test runner
- `@vitest/ui` - Interactive UI for viewing test results
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom Jest matchers for DOM
- `jsdom` - DOM implementation for Node.js

## Running Tests

Run:

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on changes)
npm test -- --watch

# Open interactive UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## What's Tested

### Phase 1 (Critical Utilities) ✅

#### Validation
- **Validation Utilities** (`src/utils/__tests__/validation.test.ts`)
  - Journal entry schema validation (title, body, tags, mood, date)
  - Tag validation with character restrictions
  - Email and password validation
  - Auth credentials validation
  - Error messages and field constraints
  - Whitespace trimming

#### Credential Storage
- **Cloud Credential Storage** (`src/utils/__tests__/cloudCredentialStorage.test.ts`)
  - Encrypted storage for all cloud providers (Nextcloud, Google Drive, Dropbox)
  - Save/load/remove operations with master key encryption
  - Error handling and cleanup on decryption failures
  - Provider-specific credential management
  - Verification of credential removal

- **Local Credential Storage** (`src/utils/__tests__/localCredentialStorage.test.ts`)
  - Legacy compatibility layer for Nextcloud
  - Migration from legacy to new storage system
  - Automatic cleanup of legacy storage
  - Error handling and fallback logic

#### State Management
- **Transfer State** (`src/utils/__tests__/transferState.test.ts`)
  - Transfer/migration state persistence
  - Progress tracking with timestamps
  - Error handling for storage failures

- **AI Mode Storage** (`src/utils/__tests__/aiModeStorage.test.ts`)
  - AI mode preference (local vs cloud)
  - Cloud consent management
  - Preload settings
  - Default values and state isolation
  - Integration between mode, consent, and preload

- **AI Permissions** (`src/utils/__tests__/aiPermissions.test.ts`)
  - PRO subscription status checking
  - Local AI loading requirements
  - Multi-condition validation (mode, preload, subscription)
  - Error handling for auth and database failures
  - Proper logging of permission decisions

### P1 (High Priority - Core Features) ✅

#### Cloud Storage Services
- **Google Drive Service** (`src/services/__tests__/googleDriveService.test.ts`)
  - Token refresh and expiration handling
  - OAuth 401 error recovery
  - Concurrent request handling
  - File operations (upload, download, list, delete)
  - Error handling

- **Dropbox Service** (`src/services/__tests__/dropboxService.test.ts`)
  - Token refresh and expiration handling
  - OAuth 401 error recovery
  - Concurrent request handling
  - File operations (upload, download, list, delete)
  - Error handling

#### Integration Tests
- **Auth Service Platform Flows** (`src/services/__tests__/authService.integration.test.ts`)
  - Web OAuth with PKCE flow
  - Capacitor iOS/Android deep linking
  - Electron OAuth handling
  - Token exchange and callback processing
  - Error handling and rate limiting

- **Cloud Storage Service Abstraction** (`src/services/__tests__/cloudStorageService.integration.test.ts`)
  - Multi-provider discovery and caching
  - Upload/download/delete operations across all providers
  - Path normalization
  - Provider failover
  - Performance and caching

- **Transfer Service** (`src/services/__tests__/transferService.integration.test.ts`)
  - Data transfer and migration flows
  - Progress tracking and persistence
  - Error handling and retries

- **Connection Monitoring** (`src/services/__tests__/connectionMonitor.integration.test.ts`)
  - Health tracking per provider
  - Failure detection and counting
  - Circuit breaker pattern
  - Recovery workflows
  - State persistence

### P2 (Medium Priority - Advanced Features) ✅

#### Conflict Resolution
- **Conflict Resolution Service** (`src/services/__tests__/conflictResolution.integration.test.ts`)
  - Version vector conflict detection
  - Last-Write-Wins (LWW) resolution
  - Merge strategies
  - Multi-device scenarios
  - Conflict logging

#### Sync Workflows
- **Sync Workflow Orchestration** (`src/services/__tests__/syncWorkflow.integration.test.ts`)
  - Bidirectional sync (local ↔ cloud)
  - Conflict detection and resolution
  - Version vector management
  - Retry logic and error handling
  - Offline-first workflows

#### Security
- **Encryption Operations** (`src/utils/__tests__/encryption.integration.test.ts`)
  - Master key generation and lifecycle
  - Password-based key derivation (PBKDF2)
  - AES-GCM encryption/decryption
  - End-to-end encryption workflows
  - Password change scenarios
  - Security properties validation

### P3 (Nice to Have - Utilities and UI) ✅

#### Platform Utilities
- **Platform Detection** (`src/utils/__tests__/platformDetection.test.ts`)
  - Web, Capacitor (iOS/Android), Electron detection
  - Device ID generation and persistence
  - Platform capabilities and display names
  - Edge cases and error handling
  
- **Platform Capabilities** (`src/utils/__tests__/platformCapabilities.test.ts`)
  - Storage, network, UI, OAuth capabilities per platform
  - Cross-platform scenarios
  - Capability queries and validation

#### UI Components
- **Language Switcher** (`src/components/__tests__/LanguageSwitcher.test.tsx`)
  - Component rendering and i18n integration
  
- **Sync Status Indicator** (`src/components/__tests__/SyncStatusIndicator.test.tsx`)
  - Status display (idle, syncing, error, success)
  - Connected providers information
  - Accessibility

### Utilities
- **Cloud Retry** (`src/utils/__tests__/cloudRetry.test.ts`)
  - Exponential backoff with jitter
  - Retry on 5xx and 429 errors
  - File name sanitization

- **OAuth Utilities** (`src/utils/__tests__/oauth.test.ts`)
  - PKCE flow implementation
  - State parameter generation

- **Encryption Utilities** (`src/utils/__tests__/encryption.test.ts`)
  - Cryptographic operations
  - Key management

## Test Coverage Goals

Target: **>80%** coverage for all critical services

Current P1 & P2 coverage:
- ✅ All public API methods
- ✅ Error paths and edge cases
- ✅ Token refresh scenarios
- ✅ Network failure handling
- ✅ Concurrent operation handling
- ✅ Platform-specific OAuth flows
- ✅ Multi-provider sync operations
- ✅ Conflict detection and resolution
- ✅ Version vector management
- ✅ End-to-end encryption workflows
- ✅ Migration and data integrity

### Test Statistics
- **Total test files**: 30+ (see `src/utils/__tests__/` and `src/services/__tests__/`)
- **Utils** (`src/utils/__tests__/`): validation, credential storage, transfer state, AI mode/permissions, encryption, OAuth, platform detection/capabilities, cloud retry, PWA, etc.
- **Services** (`src/services/__tests__/`): auth, cloud storage, connection monitor, transfer service, conflict resolution, sync workflow, storageServiceV2, Google Drive, Dropbox, Nextcloud, AI cache/preloader/localAI, upload queue. See `src/services/__tests__/README.md` for details.

## CI/CD Integration

Tests are designed for CI/CD pipelines:
- No external dependencies required
- Fast execution (< 30 seconds for all tests)
- Deterministic results
- Proper cleanup between tests

Example GitHub Actions:
```yaml
- name: Run tests
  run: npm test -- --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests not running
- Ensure `test`, `test:ui`, and `test:coverage` scripts are present in package.json
- Run `npm install` to ensure dependencies are installed
- Check that vitest.config.ts exists in project root

### Mock errors
- Verify `src/test/setup.ts` is properly configured
- Check that environment variables are mocked correctly

### Coverage not generating
- Install `@vitest/coverage-v8`: `npm install -D @vitest/coverage-v8`
- Run with `--coverage` flag

## Next Steps

### Completed ✅
1. ✅ P1 (High Priority): Core features fully tested
   - Auth service platform flows
   - Cloud storage service abstraction
   - Migration service
   - Connection monitoring
   
2. ✅ P2 (Medium Priority): Advanced features fully tested
   - Conflict resolution service
   - Sync workflow orchestration
   - Encryption operations

### Recommended Next Actions
1. Run the test suite: `npm test`
2. Review coverage: `npm run test:coverage`
3. Add P3 tests if needed:
   - AI service integration
   - Export functionality (PDF, DOCX)
   - UI component testing
4. Set up automated CI/CD testing
