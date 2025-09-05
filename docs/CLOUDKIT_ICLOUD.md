# iCloud (CloudKit) – Troubleshooting

**No "JournalEntry" under Schema?** → See [Creating the JournalEntry record type](#creating-the-journalentry-record-type) below.

---

## 401 Unauthorized / "Authentication failed... correct API Token for this container"

CloudKit JS requires the user to **sign in with Apple ID** (`container.setUpAuth()`) before any database operations work — even on the public database. The app now calls `setUpAuth()` during `connect()`, which opens an Apple ID sign-in popup. The session is persisted via cookie. If you see 401:

1. Ensure you are on the **latest code** (the `setUpAuth()` call was added).
2. When you click "Connect to iCloud", an **Apple ID sign-in popup** should open. Complete the sign-in.
3. After sign-in, the app uses the **private database** (per-user, no scoping needed).

## 421 Misdirected Request from api.apple-cloudkit.com

If the browser console shows:

```text
Failed to load resource: the server responded with a status of 421 (Misdirected Request)
```

CloudKit is rejecting the request because the **origin** of your app is not allowed by the API token.

**Fix:**

1. Open [CloudKit Dashboard](https://icloud.developer.apple.com/) → your container (e.g. `iCloud.app.ownjournal`) → **Settings** or **API Tokens**.
2. Edit the API token you use for the app.
3. Under **Allowed Origins**:
   - Either choose **Any Domain** (simplest for dev and if you’re okay with any origin using the token), or
   - Choose **Only the following domain(s)** and add **each** origin your app runs on, for example:
     - `http://localhost:3000` (local dev)
     - `https://app.ownjournal.app` (production)
4. Save and try again. No code changes needed.

Until the token allows your current origin (e.g. localhost), CloudKit will keep returning 421 and sync will not work.

---

## Creating the JournalEntry record type

There is no "JournalEntry" under Schema until it exists. You can create it in one of two ways.

### Option A: Let the app create it (recommended in Development)

In the **Development** environment, CloudKit uses "just-in-time" schema: the first time the app **saves** a record, CloudKit creates the record type and the fields you used.

1. In the app: **sign in** (so the current user is set), then open **Settings** → **Cloud Storage** and **connect iCloud** (use the same container ID and API token as in your CloudKit Dashboard).
2. After connecting, the app will try to sync (e.g. create `sync-state.json`). That first successful save creates the **JournalEntry** record type and the fields **ownerId**, **fileName**, **content**, **modifiedAt** in the **public** database.
3. In [CloudKit Dashboard](https://icloud.developer.apple.com/dashboard):
   - Select your container (e.g. `iCloud.app.ownjournal`).
   - Ensure **Development** is selected (top bar or environment switcher).
   - Open **Schema** (or **Data** → **Record Types**).
   - You should now see **JournalEntry** in the list. Click it to see the fields and add indexes if needed (see below).

If you still get 401, the code must be using the **public** database and a valid API token; fix that first, then retry this flow.

### Option B: Create the record type in the Dashboard (if your UI allows it)

Some CloudKit Dashboard UIs let you add a new record type manually.

1. Go to [CloudKit Dashboard](https://icloud.developer.apple.com/dashboard) and select your container (e.g. `iCloud.app.ownjournal`).
2. Select the **Development** environment.
3. Open **Schema** (left sidebar). If you see **Record Types** under **Data** instead, use that.
4. Look for a **"+ New"**, **"Add Record Type"**, or **"Create"** button (often near the Record Types list or at the top). If you don’t see any way to add a new type, use **Option A** instead.
5. Create a new record type with **Type Name**: `JournalEntry` (exact spelling).
6. Add these **fields** (name and type must match):

   | Field name   | Type      |
   |-------------|-----------|
   | `fileName`  | String    |
   | `content`   | String    |
   | `modifiedAt`| Date/Time |

7. **Indexes** (recommended so queries work well):
   - **modifiedAt**: add index type **Sortable** (so we can sort by `modifiedAt`).
8. Save the record type.

### Schema reference (for Option A or B)

The app uses the **private** database (after Apple ID sign-in via `setUpAuth()`) and the record type **JournalEntry** with:

- **fileName** (String)
- **content** (String)
- **modifiedAt** (Date/Time)

The private database is per-user so no extra scoping fields are needed.

For **Production**, create this record type (and indexes) in the Dashboard before deploying, or deploy your Development schema to Production from the Dashboard when ready.
