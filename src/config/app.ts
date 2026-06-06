/**
 * App identity constants.
 *
 * Open-source forks: update these values along with capacitor.config.ts,
 * index.html (trampoline script), ios/App/App/Info.plist,
 * android/app/src/main/AndroidManifest.xml, and electron/main.js.
 */
export const APP_SCHEME = 'ownjournal';
export const APP_DOMAIN = 'app.ownjournal.app';

/**
 * Public Google Play store listing, built from the package id. Used to route
 * users in IAP-only (UK VAT / NETP) regions to the store instead of Stripe —
 * see `@/config/iapOnlyCountries`.
 *
 * TODO: add APP_STORE_URL (`https://apps.apple.com/app/id<numeric App ID>`)
 * and surface an App Store button once the iOS listing / App ID is live.
 */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.ownjournal';

/** Build a native deep link URL (e.g. ownjournal://storage-callback?code=xxx) */
export function buildDeepLink(path: string, search: string = ''): string {
  return `${APP_SCHEME}:/${path}${search}`;
}

/** Build an HTTPS app link URL (e.g. https://app.ownjournal.app/storage-callback) */
export function buildAppLink(path: string = ''): string {
  return `https://${APP_DOMAIN}${path}`;
}
