# Publishing Inbox Janitor — Launch Runbook (v1.0, Outlook-only)

The single, ordered checklist to get the extension live on the Chrome Web Store. Everything is built
and tested; what remains is hosting the privacy policy, filling the dashboard, and submitting.

**Critical path:** host privacy policy → upload package → fill 3 dashboard tabs → submit.

---

## ✅ Already done
- Code complete; Outlook sign-in tested and working; all gates green (`npm run ci`)
- Real Azure client ID wired in (`.env`) and baked into the build
- Manifest requests only the two Microsoft hosts (no unused/Gmail permissions)
- Icons, 4 screenshots (1280×800), promo tiles (440×280, 1400×560) → `store-assets/`
- Listing copy → `STORE_LISTING.md`; permission text → `PERMISSIONS_JUSTIFICATION.md`
- Landing page → `docs/index.html`; privacy policy → `docs/privacy.html`; package → `inbox-janitor.zip`
- $5 developer fee + 2FA

## ⛳ Account prerequisites (confirm once)
- [ ] Developer account contact email **verified** (Console → Account)
- [ ] 2-Step Verification on the account ✓

---

## Step 1 — Host the site (do this first; nothing else works without the URL)
1. GitHub → repo → **Settings → Pages**
2. **Deploy from a branch** → branch `master` → folder **`/docs`** → Save
3. After ~1 min it's live:
   - Landing page (homepage): **`https://adityarungta2048.github.io/inbox-janitor/`**
   - Privacy policy: **`https://adityarungta2048.github.io/inbox-janitor/privacy.html`**

## Step 2 — Create the item
1. Go to <https://chrome.google.com/webstore/devconsole>
2. **Add new item** → upload **`inbox-janitor.zip`** (built with your real client ID)

> Rebuild the zip any time with: `npm run check:config && npm run package`
> (`check:config` must show green — it confirms `VITE_MS_CLIENT_ID` is set in `.env`.)

## Step 3 — Store listing tab  *(copy from `STORE_LISTING.md`)*
- [ ] **Name:** `Inbox Janitor`
- [ ] **Summary (≤132):** `Bulk unsubscribe and clean up your Outlook / Microsoft 365 inbox — group senders, archive, delete, or unsubscribe in a click.`
- [ ] **Description:** the detailed block in `STORE_LISTING.md`
- [ ] **Category:** Productivity   ·   **Language:** English
- [ ] **Store icon:** 128×128 (already in the package)
- [ ] **Screenshots:** upload `store-assets/01`–`04` (all 1280×800)
- [ ] **Small promo tile:** `store-assets/promo-small-440x280.png`
- [ ] **Marquee tile (optional):** `store-assets/promo-marquee-1400x560.png`
- [ ] **Support email:** your contact email

## Step 4 — Privacy practices tab  *(copy from `PERMISSIONS_JUSTIFICATION.md`)*
- [ ] **Single purpose:** `Help Outlook and Microsoft 365 users unsubscribe from unwanted senders and bulk-clean their inbox.`
- [ ] **Permission justifications:**
  - `identity` — Initiates the OAuth 2.0 + PKCE sign-in with Microsoft via `chrome.identity.launchWebAuthFlow`; without it users can't authenticate.
  - `storage` — Persists the OAuth token and sender cache in `chrome.storage.local` so users stay signed in across the ephemeral MV3 service worker; cleared on sign-out.
  - `sidePanel` — Registers/opens the Chrome side panel, the extension's primary UI.
- [ ] **Host permission justification:**
  - `https://graph.microsoft.com/*` — All email operations (list, group by sender, archive, delete, fetch unsubscribe headers) call Microsoft Graph here.
  - `https://login.microsoftonline.com/*` — The OAuth token endpoint here exchanges the auth code and refreshes tokens.
- [ ] **Remote code:** "No, I am not using remote code" (everything is bundled)
- [ ] **Data collection — declare:**
  - **Personal communications** — email metadata (sender, date, subject, message IDs, `List-Unsubscribe` headers)
  - **Authentication information** — the OAuth token
- [ ] **Certify (3 boxes):** not selling data · using it only for the single purpose · not for creditworthiness/lending
- [ ] **Privacy policy URL:** `https://adityarungta2048.github.io/inbox-janitor/privacy.html`

## Step 5 — Distribution tab
- [ ] **Visibility:** Public   ·   **Regions:** All   ·   **Price:** Free

## Step 6 — Submit for review
- [ ] Click **Submit for review**
- Timeline: usually a few days; email-access extensions can take 1–2 weeks. Answer reviewer questions promptly.

---

## Optional — before you lean on work/school (M365) users
Your Azure app shows an "unverified publisher" notice. Microsoft 365 *work/school* accounts from other
orgs can't consent to an unverified multitenant app. Personal Outlook users are unaffected (not a
launch blocker). To reach the M365 audience, complete
[publisher verification](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview)
(add an MPN ID in Partner Center).

## Later — turning on Gmail (v1.1)
Gmail is fully built behind a feature flag. When ready: run Google restricted-scope verification
(`docs/GOOGLE_VERIFICATION.md`), then follow `docs/ENABLE_GMAIL_V1.1.md` to flip the flag and ship an
update. It does not affect the live Outlook listing.

---

## Command reference
```bash
npm run check:config   # confirm client ID is set (green) before packaging
npm run ci             # build + typecheck + lint + test
npm run package        # produce inbox-janitor.zip for upload
node scripts/gen-store-assets.mjs   # regenerate screenshots/promo tiles
```
