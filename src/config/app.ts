/**
 * App identity constants.
 *
 * Open-source forks: update these values along with capacitor.config.ts,
 * index.html (trampoline script), ios/App/App/Info.plist,
 * android/app/src/main/AndroidManifest.xml, and electron/main.js.
 */
export const APP_SCHEME = 'ownjournal';
export const APP_DOMAIN = 'app.ownjournal.app';

/** Build a native deep link URL (e.g. ownjournal://storage-callback?code=xxx) */
export function buildDeepLink(path: string, search: string = ''): string {
  return `${APP_SCHEME}:/${path}${search}`;
}

/** Build an HTTPS app link URL (e.g. https://app.ownjournal.app/storage-callback) */
export function buildAppLink(path: string = ''): string {
  return `https://${APP_DOMAIN}${path}`;
}
