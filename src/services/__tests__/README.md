# Cloud Storage Service Tests

Comprehensive test suite for cloud storage providers (Google Drive, Dropbox, Nextcloud), authentication flows, conflict resolution, sync workflows, and encryption operations.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (automatically re-run on changes)
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- googleDriveService.test.ts

# Run tests matching a pattern
npm test -- --grep "token refresh"
```

## Test Coverage

### P1 (High Priority - Core Features)

#### Platform Integration Tests

**authService.integration.test.ts** (472 lines)
- ✅ Web OAuth with PKCE flow
- ✅ Capacitor iOS/Android deep linking
- ✅ Electron OAuth handling
- ✅ Token exchange and callbacks
- ✅ Error handling and rate limiting

**cloudStorageService.integration.test.ts** (337 lines)
- ✅ Multi-provider discovery and caching
- ✅ Upload/download/delete operations
- ✅ Path normalization
- ✅ Provider failover
- ✅ Performance optimization

**migrationService.integration.test.ts** (329 lines)
- ✅ Provider-to-provider migration
- ✅ Conflict handling during migration
- ✅ Checksum verification
- ✅ Progress tracking and persistence

**connectionMonitor.integration.test.ts** (343 lines)
- ✅ Health tracking per provider
- ✅ Failure detection and counting
- ✅ Circuit breaker pattern
- ✅ Recovery workflows

#### Provider-Specific Tests

**googleDriveService.test.ts**
- ✅ Automatic token refresh when expired (5 min buffer)
- ✅ Token refresh on 401 unauthorized errors
- ✅ Concurrent request handling
- ✅ Token refresh failure handling
- ✅ File operations (upload, download, list, delete)

**dropboxService.test.ts**
- ✅ Token refresh and expiration handling
- ✅ OAuth 401 error recovery
- ✅ Concurrent request handling
- ✅ File operations

**nextcloudDirectService.test.ts**
- ✅ WebDAV authentication
- ✅ File operations
- ✅ Error handling

### P2 (Medium Priority - Advanced Features)

**conflictResolution.integration.test.ts** (413 lines)
- ✅ Version vector conflict detection
- ✅ Two-device concurrent edits
- ✅ Three-way conflicts
- ✅ Last-Write-Wins (LWW) resolution
- ✅ Device ID tiebreaker
- ✅ Offline editing and sync conflicts
- ✅ Cascading conflicts
- ✅ Performance with large version vectors

**syncWorkflow.integration.test.ts** (714 lines)
- ✅ Full sync workflow (local ↔ cloud)
- ✅ Download new entries from cloud
- ✅ Concurrent edit conflict detection
- ✅ Version vector management and merging
- ✅ Conflict log creation and management
- ✅ Edge cases (corrupted data, deleted entries)
- ✅ Large dataset performance
- ✅ Concurrent operations handling

**encryption.integration.test.ts** (481 lines) - NEW
- ✅ Master key generation and lifecycle
- ✅ Password-based key derivation (PBKDF2, 100k iterations)
- ✅ AES-GCM encryption/decryption
- ✅ End-to-end encryption workflows
- ✅ Password change scenarios
- ✅ Security properties (tampering detection)
- ✅ Unicode and large data handling
- ✅ Performance benchmarks

### Utility Tests

**cloudRetry.test.ts**
- ✅ Exponential backoff with jitter
- ✅ Retry on 5xx server errors
- ✅ Retry on 429 rate limit errors
- ✅ No retry on 4xx client errors (except 429)
- ✅ Custom retry conditions
- ✅ Max attempts enforcement

**oauth.test.ts**
- ✅ PKCE flow implementation
- ✅ State parameter generation
- ✅ Token validation

**encryption.test.ts**
- ✅ Cryptographic operations
- ✅ Key management

## Test Structure

```
src/
├── services/
│   ├── __tests__/
│   │   ├── authService.integration.test.ts           # P1: OAuth flows (472 lines)
│   │   ├── cloudStorageService.integration.test.ts  # P1: Multi-provider (337 lines)
│   │   ├── migrationService.integration.test.ts     # P1: Data migration (329 lines)
│   │   ├── connectionMonitor.integration.test.ts    # P1: Health monitoring (343 lines)
│   │   ├── conflictResolution.integration.test.ts   # P2: Conflict resolution (413 lines)
│   │   ├── syncWorkflow.integration.test.ts         # P2: Sync workflows (714 lines)
│   │   ├── googleDriveService.test.ts               # P1: Google Drive API
│   │   ├── dropboxService.test.ts                   # P1: Dropbox API
│   │   └── nextcloudDirectService.test.ts           # P1: Nextcloud/WebDAV API
│   ├── authService.ts
│   ├── cloudStorageService.ts
│   ├── migrationService.ts
│   └── storageServiceV2.ts
├── utils/
│   ├── __tests__/
│   │   ├── encryption.integration.test.ts           # P2: Encryption (481 lines) - NEW
│   │   ├── cloudRetry.test.ts                       # Retry logic
│   │   ├── oauth.test.ts                            # OAuth utilities
│   │   ├── encryption.test.ts                       # Encryption utilities
│   │   └── connectionMonitor.ts
│   ├── encryption.ts
│   ├── cloudRetry.ts
│   └── oauth.ts
└── test/
    └── setup.ts                                      # Test configuration
```

## Mocking

Tests use comprehensive mocks for:
- **Fetch API**: All HTTP requests are mocked
- **Crypto API**: Encryption operations are mocked
- **LocalStorage**: In-memory storage for credential tests
- **Environment**: OAuth client IDs and secrets

## Coverage Goals

Target coverage: **>80%** for all cloud storage services, sync workflows, and security operations

Current coverage includes:
- ✅ All public API methods (100%)
- ✅ Complete sync workflow (local → cloud, cloud → local)
- ✅ Conflict detection and resolution paths
- ✅ Version vector management
- ✅ Platform-specific OAuth flows (Web, Capacitor, Electron)
- ✅ End-to-end encryption workflows
- ✅ Error paths and edge cases
- ✅ Concurrent operations handling
- ✅ Large dataset performance
- ✅ Integration between services and utilities
- ✅ Security properties and tampering detection

### Test Statistics
- **Total test files**: 11
- **Total test lines**: ~3,500 lines
- **P1 tests**: 7 files (core platform and provider features)
- **P2 tests**: 3 files (advanced workflows and security)
- **Utility tests**: 3 files (supporting utilities)

## Adding New Tests

When adding a new cloud storage provider:

1. Create a new test file: `src/services/__tests__/newProviderService.test.ts`
2. Follow the existing test structure
3. Test all CloudProvider interface methods
4. Include token refresh tests if using OAuth
5. Test retry logic for network failures
6. Verify error handling for all error codes

Example test template:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewProviderService } from '../newProviderService';

describe('NewProviderService', () => {
  let service: NewProviderService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new NewProviderService();
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
  });

  describe('connect', () => {
    it('should connect with valid credentials', async () => {
      // Test implementation
    });
  });

  // Add more test suites...
});
```

## Debugging Tests

To debug a specific test:

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run single test
npm test -- -t "should refresh token when expired"

# Enable console output
npm test -- --silent=false
```

## CI/CD Integration

Tests are designed to run in CI/CD pipelines:
- No external dependencies
- Fast execution (< 5 seconds)
- Deterministic results
- Proper cleanup after each test

Example GitHub Actions workflow:

```yaml
- name: Run tests
  run: npm test -- --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```
