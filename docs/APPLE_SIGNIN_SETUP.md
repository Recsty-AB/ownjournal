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

Supabase needs a **client secret** that you generate from your Key (.p8), Key ID, Team ID, and Client ID (Services ID).

1. Open Supabase’s Apple secret generator:  
   [Generate Apple client secret](https://supabase.com/docs/guides/auth/social-login/auth-apple#configuration) (or search “Supabase Apple secret generator”).
2. Or use a JWT generator that can sign with ES256 and the following claims:
   - **iss**: Your Team ID  
   - **iat**: Current time (seconds)  
   - **exp**: e.g. iat + 15777000 (about 6 months; Apple allows max 6 months)  
   - **aud**: `https://appleid.apple.com`  
   - **sub**: Your **Services ID** (e.g. `app.ownjournal.service`)
3. Sign the JWT with your **.p8** private key (ES256). The resulting JWT is the **client secret** you paste into Supabase.

Supabase’s docs link to a generator that does this in the browser (no keys leave your machine if you use their tool).

---

## Part 3: Supabase Dashboard – Apple provider and URLs

### 3.1 Enable Apple and set credentials

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **Providers**.
3. Find **Apple** and enable it.
4. Fill in:
   - **Client ID (Services ID)**: Your Services ID from 1.2 (e.g. `app.ownjournal.service`).
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

Apple requires generating a **new client secret** (new JWT) at least every 6 months when using the OAuth flow. Use the same process as Part 2 and update the **Secret Key** in Supabase → Authentication → Providers → Apple.
