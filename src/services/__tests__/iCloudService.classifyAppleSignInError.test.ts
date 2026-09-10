import { describe, it, expect } from 'vitest';
import { classifyAppleSignInError } from '../iCloudService';

// CloudKit JS wraps the ck-auth popup's `{ errorMessage }` as a CKError:
// { ckErrorCode: 'SIGN_IN_FAILED', reason: 'Error in sign in popup: <errorMessage>' }
const ckError = (errorMessage: string) => ({
  ckErrorCode: 'SIGN_IN_FAILED',
  reason: `Error in sign in popup: ${errorMessage}`,
});

describe('classifyAppleSignInError', () => {
  it('maps the "iCloud Data Web Access is Off" popup page to web-access-off', () => {
    expect(classifyAppleSignInError(ckError('accessError'))).toBe('web-access-off');
  });

  it('treats a closed popup as cancelled, not as a failure', () => {
    expect(classifyAppleSignInError(ckError('window closed'))).toBe('cancelled');
  });

  it("maps Apple's generic Authentication Error page to failed", () => {
    expect(classifyAppleSignInError(ckError('unknownError'))).toBe('failed');
  });

  it('falls back to failed for anything that is not a SIGN_IN_FAILED popup result', () => {
    expect(classifyAppleSignInError({ ckErrorCode: 'UNKNOWN_ERROR' })).toBe('failed');
    expect(classifyAppleSignInError(new Error('accessError'))).toBe('failed');
    expect(classifyAppleSignInError(undefined)).toBe('failed');
  });
});
