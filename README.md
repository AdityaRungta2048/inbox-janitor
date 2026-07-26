# Inbox Janitor

A Manifest V3 Chrome extension that helps Gmail, Outlook, and Microsoft 365 users bulk-unsubscribe from senders and clean up their inbox.

## Quick Start (Development)

```bash
npm install
cp src/config.example.ts src/config.ts   # already exists; edit the client IDs
npm run build
# Load dist/ as an unpacked extension in Chrome
```

The extension supports **two providers**. You only need to configure the one(s) you want to test:

- **Microsoft / Outlook** — Azure AD app (§1). Uses OAuth PKCE, no client secret.
- **Google / Gmail** — Google Cloud OAuth client (§1b). See the important note there about the client secret and restricted-scope verification.

## [HUMAN SETUP] — Required before live testing

These steps require manual action and cannot be automated:

### 1. Register an Azure AD Application

1. Go to [https://portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App registrations** → **New registration**
2. **Name:** Inbox Janitor (or any name you like)
3. **Supported account types:** Select **"Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"**
   - This enables both personal Outlook (outlook.com/live/hotmail) AND corporate M365 accounts
4. **Redirect URI:** Add a **Single-page application (SPA)** platform with the redirect URI:
   ```
   https://<EXTENSION_ID>.chromiumapp.org/
   ```
   See "Pinning your Extension ID" below for how to find `<EXTENSION_ID>`.
5. Click **Register**
6. Under **API permissions**, add these **Delegated** Microsoft Graph permissions:
   - `openid`
   - `profile`
   - `email`
   - `offline_access`
   - `User.Read`
   - `Mail.ReadWrite`
7. Copy the **Application (client) ID** (a GUID) — you'll need it next.

### 1b. Register a Google Cloud OAuth Client (for Gmail)

Only needed if you want the Gmail provider. Skip if shipping Outlook-only first.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create (or select) a project.
2. **APIs & Services → Library →** enable the **Gmail API**.
3. **APIs & Services → OAuth consent screen:**
   - User type: **External**
   - Fill in app name, user support email, developer contact, and an **app homepage** + **privacy policy URL** (Google requires these for verification)
   - Add scopes: `openid`, `email`, `profile`, and `.../auth/gmail.modify`
   - Add yourself (and any testers) under **Test users** — until the app is verified, only test users can sign in (max 100)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID:**
   - Application type: **Web application**
   - Authorized redirect URI: `https://<EXTENSION_ID>.chromiumapp.org/` (same ID as Azure — see §3)
   - Copy the **Client ID** and **Client secret**.

> ⚠️ **Two Google-specific gotchas you must plan for before publishing the Gmail path:**
>
> 1. **The client secret.** Google (unlike Microsoft) requires a `client_secret` to exchange the
>    auth code for a refresh token — PKCE alone will not work. A "Web application" secret is meant to
>    be confidential, but anything you build into the extension ships in the public bundle. Decide how
>    you'll handle this (see `DECISIONS.md → D10`). Never commit the secret to git — use the `.env`
>    below, which is git-ignored.
> 2. **Restricted-scope verification.** `gmail.modify` is a Google *restricted* scope. Public use
>    requires Google's OAuth app verification (brand review, demo video, privacy policy, homepage) and
>    possibly an annual CASA security assessment. This can take **weeks**. Budget for it, or launch
>    Outlook-only first and add Gmail once verified. See `PERMISSIONS_JUSTIFICATION.md`.

### 2. Set your Client ID(s)

Create a `.env` file in the project root (never commit this — it's git-ignored):
```bash
# Microsoft / Outlook
VITE_MS_CLIENT_ID=your-azure-client-id-here
VITE_MS_TENANT=common

# Google / Gmail (only if using the Gmail provider)
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

Or edit `src/config.ts` directly (Microsoft example):
```typescript
export const MS_CLIENT_ID = 'your-azure-client-id-here';
```

Then rebuild:
```bash
npm run build
```

### 3. Pinning your Extension ID

The OAuth redirect URI requires a stable extension ID. The `manifest.json` includes a `"key"` field to pin the ID for development. Here's how to find your extension ID:

1. Load the unpacked extension in Chrome (see below)
2. Go to `chrome://extensions/`
3. Find "Inbox Janitor" and copy the **ID** shown (32-character lowercase string)
4. Your redirect URI is: `https://<THAT_ID>.chromiumapp.org/`
5. Add this URI in Azure Portal → your app → **Authentication** → **Single-page application** → **Redirect URIs**

**Using the manifest key for a stable ID:**
The `"key"` in `manifest.json` pins the extension ID across Chrome profiles. The current key produces a specific ID. To generate your own key pair:
```bash
# Generate key pair
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out private.pem
openssl rsa -in private.pem -pubout -outform DER | openssl base64 -A
```
Put the base64 output as `"key"` in manifest.json, then your ID is fixed.

### 4. Load the Extension in Chrome

1. Run `npm run build` (builds to `dist/`)
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select the `dist/` folder
5. The extension should appear with the 📬 icon in your toolbar

### 5. Live-Account Manual Test Checklist

Before submitting to the Chrome Web Store, test these on a **throwaway Outlook inbox**:

- [ ] Click toolbar icon → side panel opens
- [ ] "Sign in with Microsoft" → Microsoft consent screen appears
- [ ] After consent → your name/email shows in the header
- [ ] Sender list populates (may take a moment for large inboxes)
- [ ] Search filters sender list correctly
- [ ] Sort by count / date / A–Z works
- [ ] Select 1+ senders → "Archive" → confirmation modal shows correct count → confirm → progress bar runs → senders disappear from list
- [ ] Select 1+ senders → "Delete" → confirmation modal → confirm → messages moved to Deleted Items (verify in Outlook)
- [ ] Select a known newsletter sender → "Unsubscribe" → status shows Done / Opened in tab / Needs manual
- [ ] "Sign out" → clears everything, returns to signed-out state
- [ ] Re-open extension after sign-out → signed-out state (no persisted tokens)
- [ ] Throttling: extension handles 429 gracefully (may need a large inbox to trigger)

### 6. Corporate M365 Note

Some Microsoft 365 organizational tenants block third-party OAuth apps by default. If a user sees **"Need admin approval"**, the organization's IT administrator must grant admin consent for the app in Azure Portal → Enterprise applications → your app → Permissions → Grant admin consent.

### 7. Chrome Web Store Submission

1. Pay the one-time $5 developer registration fee at [https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
2. Host `PRIVACY_POLICY.html` at a public URL (GitHub Pages works well)
3. Run `npm run package` to produce `inbox-janitor.zip`
4. Upload the zip in the Developer Dashboard
5. Fill in the listing details from `STORE_LISTING.md`
6. Paste the privacy policy URL
7. Capture screenshots (see `STORE_LISTING.md` for what to capture)
8. Submit for review (typically 1-3 business days)

## Development Scripts

```bash
npm run build          # Full production build → dist/
npm run build:watch    # Watch mode for UI (hot reload in side panel)
npm run typecheck      # TypeScript strict check (no emit)
npm run lint           # ESLint + Prettier check
npm run lint:fix       # Auto-fix lint/format issues
npm run test           # Vitest unit tests (Graph fully mocked)
npm run test:smoke     # Puppeteer smoke test (requires dist/ to exist)
npm run package        # Build + zip → inbox-janitor.zip
npm run ci             # Full CI gate: build + typecheck + lint + test
```

## Project Structure

```
src/
  auth/
    pkce.ts         PKCE code verifier/challenge generation
    msAuth.ts       OAuth flow, token storage, refresh
  graph/
    client.ts       Fetch wrapper: auth header, 429 backoff, $batch
    messages.ts     Sender grouping, delete, archive
    unsubscribe.ts  Header parsing + unsubscribe execution
  background/
    service-worker.ts  Minimal SW: side panel registration
  sidepanel/
    index.html
    main.ts
    App.tsx         Main Preact UI
    style.css
  popup/
    index.html
    main.ts
  lib/
    types.ts
    storage.ts      chrome.storage.local wrapper
    throttle.ts     sleep, jitter, withRetry, chunk, runConcurrent
  config.ts         VITE_MS_CLIENT_ID, scopes, constants

tests/
  unit/             Vitest (Graph fully mocked)
  smoke/            Puppeteer (network intercepted, no real API calls)

scripts/
  build-sw.mjs      esbuild service worker bundler
  postbuild.mjs     Verify dist/ structure
  package.mjs       Zip dist/ → inbox-janitor.zip
  gen-icons.mjs     Generate placeholder PNG icons
```

## Tech Stack

- **Manifest V3** Chrome Extension
- **TypeScript** (strict mode)
- **Vite** + **esbuild** for bundling
- **Preact** for the side panel UI
- **OAuth 2.0 PKCE** — manual implementation, no MSAL/client-secret
- **Microsoft Graph API** — all email operations
- **Vitest** — unit tests
- **Puppeteer** — smoke tests
- **ESLint** + **Prettier** — code quality

See `DECISIONS.md` for architecture rationale.
