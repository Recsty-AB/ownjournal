# Android App Links – assetlinks.json

This directory contains `assetlinks.json` for Android App Links (HTTPS deep links) on `app.ownjournal.app`. Google Play verifies domain ownership by fetching:

**https://app.ownjournal.app/.well-known/assetlinks.json**

## 1. Use the correct SHA-256 fingerprint from Play Console

Google validates using the **App signing key certificate** (Play App Signing), not only your upload key.

1. Open **Google Play Console** → Your app (OwnJournal) → **Setup** → **App signing**.
2. Under **App signing key certificate**, copy the **SHA-256 certificate fingerprint**.
3. Open `assetlinks.json` and ensure that fingerprint is in the `sha256_cert_fingerprints` array.
4. You can keep both the Play App Signing fingerprint and your upload key fingerprint in the array; at least the **App signing key certificate** one must be present.

## 2. Confirm the file is live and correct

After deploying:

- Open: **https://app.ownjournal.app/.well-known/assetlinks.json**
- It must return **HTTP 200** with the exact JSON (same package name and fingerprints).
- Response header must be: `Content-Type: application/json` (or `application/json; charset=utf-8`). If it is `text/plain` or missing, fix your host config (see project root for `vercel.json` / Netlify headers).

To check from the terminal:

```bash
curl -sI https://app.ownjournal.app/.well-known/assetlinks.json
```

Look for `Content-Type: application/json` and `HTTP/2 200` (or `HTTP/1.1 200`).

## 3. Deployment

The file is in `public/.well-known/assetlinks.json`. Vite copies `public/` to the build output, so the built site has `/.well-known/assetlinks.json`. Ensure your host does not rewrite `/.well-known/*` to the SPA; static file config is in the project root (`vercel.json`, Netlify `_headers` / `netlify.toml`) so this path is served with the correct Content-Type.

## 4. Re-run verification in Play Console

After updating the file and/or hosting:

1. In **Play Console** → **Grow** → **Deep links** (Djuplänkar).
2. Open the domain or link and trigger verification again.
3. If it still fails, use the [Statement List Tester](https://developers.google.com/digital-asset-links/tools/generator) and [asset links checker](https://developers.google.com/digital-asset-links/tools/generator#asset-links-checker) to validate URL, JSON, and fingerprint.
