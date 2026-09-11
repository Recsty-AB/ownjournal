# Sign in with Apple – Step-by-step fix for "This page isn't working"

When you see **"This page isn't working"** and **"appleid.apple.com didn't send any data and closed the connection"**, it is almost always due to Apple Developer or Supabase configuration. Follow these steps in order.

---

## Prerequisites

- Apple Developer account (you have this)
- Access to [Supabase Dashboard](https://supabase.com/dashboard) for your project
- Your Supabase project URL: `https://mbftigtdxkkzcqoepwke.supabase.co` (from `src/config/supabase.ts`)

---

## Part 1: Apple Developer – App ID and Services ID

### 1.1 Ensure App ID has Sign in with Apple

1. Go to [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list).
2. Open your **App ID** (e.g. `app.ownjournal`).
3. Under **Capabilities**, ensure **Sign in with Apple** is enabled. Save if you changed it.

### 1.2 Create a Services ID (for web/OAuth)

1. In [Identifiers](https://developer.apple.com/account/resources/identifiers/list), click **+** to add a new identifier.
2. Select **Services IDs** → Continue.
3. Fill in:
   - **Description**: e.g. `OwnJournal Web`
   - **Identifier**: e.g. `app.ownjournal.service` (reverse-domain style; this is your **Services ID** / Client ID for Supabase).
4. Check **Sign in with Apple** and click **Configure**.
5. In the configuration:
   - **Primary App ID**: Select your app (e.g. `app.ownjournal`).
   - **Domains and Subdomains**: Add **one** line:
     - `mbftigtdxkkzcqoepwke.supabase.co`
   - **Return URLs**: Add **exactly** this URL (use your real Supabase project ref if different):
     - `https://mbftigtdxkkzcqoepwke.supabase.co/auth/v1/callback`
6. Click **Save**, then **Continue** → **Register**.

Important: The Return URL must be exactly the Supabase auth callback. No typo, no trailing slash difference, no `http` instead of `https`.

### 1.3 Create a Key for Sign in with Apple (for client secret)

1. Go to [Keys](https://developer.apple.com/account/resources/authkeys/list) in the Apple Developer sidebar.
2. Click **+** to create a new key.
3. **Key Name**: e.g. `OwnJournal Apple Sign In`.
4. Check **Sign in with Apple** and click **Configure** → select your **Primary App ID** (e.g. `app.ownjournal`) → Save.
5. Click **Continue** → **Register**.
6. **Download the `.p8` file once.** You cannot download it again. Keep it secure.
7. Note:
   - **Key ID** (e.g. `ABC123DEF4`)
   - Your **Team ID** (top right in Apple Developer, e.g. `2ZV26999P6`)
   - Your **Services ID** (e.g. `app.ownjournal.service`)
   - Your **App ID / Bundle ID** (e.g. `app.ownjournal`)

You will need the `.p8` contents, Key ID, Team ID, and Services ID in Part 2.

---

## Part 2: Generate Apple client secret (for Supabase)

Supabase needs a **client secret**: an ES256 JWT signed with your `.p8` key, carrying
`iss` = Team ID, `sub` = Services ID, `aud` = `https://appleid.apple.com`, and an
`exp` at most 6 months after `iat`. Apple rejects longer lifetimes, so the secret
must be regenerated periodically (see "Secret key rotation" below).

### Where to find each value

| Value | Where |
|-------|-------|
| **Team ID** | [developer.apple.com/account](https://developer.apple.com/account) → **Membership details** (also shown top-right). 10 characters, e.g. `2ZV26999P6`. |
| **Key ID** | [Certificates, Identifiers & Profiles → Keys](https://developer.apple.com/account/resources/authkeys/list) → click the Sign in with Apple key. 10 characters. It is also in the downloaded filename: `AuthKey_<KEY_ID>.p8`. |
| **Services ID** | [Identifiers](https://developer.apple.com/account/resources/identifiers/list) → filter dropdown (top-right) → **Services IDs** → the **Identifier** column, e.g. `app.ownjournal.service`. This is the Supabase "Client ID", *not* the App ID / bundle ID. |
| **.p8 key** | Downloaded once when the key was created. If it is lost, create a new key (Keys → +), download the new `.p8`, and use its new Key ID. Apple allows two Sign in with Apple keys at a time, so you can rotate without downtime. |

### Generate with the repo script (no dependencies)

Put the values in `.env` (gitignored) or export them in your shell:

```env
APPLE_TEAM_ID=2ZV26999P6
APPLE_KEY_ID=ABC123DEF4
APPLE_SERVICES_ID=app.ownjournal.service
APPLE_BUNDLE_ID=app.ownjournal
APPLE_SIGNIN_P8_PATH=/secure/path/AuthKey_ABC123DEF4.p8
```

`--push` reads the current Apple **Client IDs** list from Supabase and merges it (Services ID
first, then `APPLE_BUNDLE_ID`, then whatever was already there) before writing the new secret.
It never removes an ID. See 3.1 for why both IDs must be present.

Then:

```bash
npm run apple:secret          # prints the JWT; paste it into Supabase → Auth → Providers → Apple → Secret Key
npm run apple:secret:push     # generates AND writes it to Supabase via the Management API
```

`--push` additionally needs `SUPABASE_ACCESS_TOKEN` (create one at
[supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens))
and `VITE_SUPABASE_PROJECT_ID` (already in `.env`). Never commit the `.p8` file; `*.p8` is gitignored.

## Part 3: Supabase Dashboard – Apple provider and URLs

### 3.1 Enable Apple and set credentials

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **Providers**.
3. Find **Apple** and enable it.
4. Fill in:
   - **Client IDs**: Both IDs, comma-separated, Services ID first:
     `app.ownjournal.service,app.ownjournal`. The web app signs in through OAuth with the
     Services ID; the iOS/macOS apps sign in natively with an `id_token` whose audience is the
     bundle ID. If the bundle ID is missing, native sign-in fails with
     `Unacceptable audience in id_token: [app.ownjournal]` while the web app keeps working.
   - **Secret Key**: The client secret you generated in Part 2 (the long JWT string).
5. Save.

### 3.2 Redirect URLs (so Supabase can send users back to your app)

1. In the same project, go to **Authentication** → **URL Configuration**.
2. **Site URL**: For local dev you can set `http://localhost:3000` (or your app URL).
3. **Redirect URLs**: Add **every** URL where your app can receive the redirect after login. For example:
   - `http://localhost:3000/**`
   - `http://localhost:3000/web-oauth-callback`
   - If you have a production URL later: `https://yourdomain.com/**`
4. Save.

Your app uses `redirectTo: `${window.location.origin}/web-oauth-callback`` for web, so `http://localhost:3000/web-oauth-callback` (or with wildcard above) must be allowed.

---

## Part 4: Optional – `.env` (if your app reads it)

If your app uses `VITE_APPLE_CLIENT_ID` for anything, set it to your **Services ID** (same as in Supabase):

```env
VITE_APPLE_CLIENT_ID=app.ownjournal.service
```

(Replace with your actual Services ID.)

---

## Checklist

- [ ] App ID has **Sign in with Apple** capability.
- [ ] **Services ID** created (e.g. `app.ownjournal.service`).
- [ ] Under Services ID → **Sign in with Apple**:
  - Domain: `mbftigtdxkkzcqoepwke.supabase.co`
  - Return URL: `https://mbftigtdxkkzcqoepwke.supabase.co/auth/v1/callback`
- [ ] **Key** created for Sign in with Apple, `.p8` downloaded and stored safely.
- [ ] **Client secret** generated (JWT from Key ID, Team ID, Services ID, .p8).
- [ ] **Supabase** → Authentication → Providers → **Apple**: enabled, Client ID = Services ID, Secret Key = client secret.
- [ ] **Supabase** → Authentication → URL Configuration: Redirect URLs include `http://localhost:3000/**` or `http://localhost:3000/web-oauth-callback`.

---

## After fixing

1. Restart your dev server (`npm run dev`).
2. Hard refresh the app (e.g. Ctrl+Shift+R) or use an incognito window.
3. Try **Continue with Apple** again.

If it still fails:

- Double-check the **Return URL** in Apple Developer matches **exactly** (including `https`, no trailing slash):  
  `https://mbftigtdxkkzcqoepwke.supabase.co/auth/v1/callback`
- Confirm the **domain** under the Services ID is exactly:  
  `mbftigtdxkkzcqoepwke.supabase.co`
- In Supabase, confirm Apple is enabled and the Client ID is the Services ID (not the App ID).
- Try another browser or incognito to rule out cache/cookies.

---

## Secret key rotation (maintenance)

Apple caps the client secret at **6 months**. If it expires, "Continue with Apple" breaks for every
user with an `invalid_client` error, so rotation is automated.

### Automatic (GitHub Actions)

`.github/workflows/rotate-apple-secret.yml` runs `npm run apple:secret:push` on the 1st of
**January, June and November** (gaps of 5, 5 and 2 months, always inside Apple's 6-month limit) and
can also be triggered manually from the **Actions** tab. Each run signs a fresh 180-day JWT and
writes it to Supabase's Apple provider config; nothing is printed to the log.

One-time setup, in GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `APPLE_TEAM_ID` | Team ID |
| `APPLE_KEY_ID` | Key ID of the Sign in with Apple key |
| `APPLE_SERVICES_ID` | Services ID (`app.ownjournal.service`) |
| `APPLE_SIGNIN_P8` | Full contents of the `.p8` file, including the `BEGIN/END PRIVATE KEY` lines |
| `SUPABASE_ACCESS_TOKEN` | Personal access token from the Supabase dashboard (account → Access Tokens) |
| `VITE_SUPABASE_PROJECT_ID` | Already present for CI |

After adding the secrets, run the workflow once by hand (**Actions → Rotate Apple client secret → Run workflow**)
and confirm the summary shows the new expiry date, then test "Continue with Apple".

### Manual fallback

Run `npm run apple:secret` locally (see Part 2) and paste the output into
Supabase → Authentication → Providers → Apple → **Secret Key**.
