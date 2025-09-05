/**
 * Short-lived flag used during sign-out so storage/OAuth error handlers
 * can suppress toasts (e.g. "Google Drive authentication failed") when
 * the failure is due to connections being torn down during sign-out.
 */

let _signingOut = false;

export function setSigningOut(value: boolean): void {
  _signingOut = value;
}

export function isSigningOut(): boolean {
  return _signingOut;
}
