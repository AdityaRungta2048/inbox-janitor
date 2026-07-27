# Enabling Gmail — v1.1 Playbook

v1.0 ships Outlook-only. Gmail is fully coded and tested but hidden behind a flag, because
`gmail.modify` is a Google **restricted** scope that can't serve the public until Google's OAuth
verification is approved. Once it is, turning Gmail on is a ~10-minute mechanical change — no rewrite.

**Prerequisite:** Google restricted-scope verification approved (see `docs/GOOGLE_VERIFICATION.md`)
and your **Chrome Extension** OAuth client ID in hand.

---

## 1. Flip the feature flag

`src/config.ts`:
```diff
-export const GMAIL_ENABLED = false;
+export const GMAIL_ENABLED = true;
```
This un-hides the "Sign in with Google" button and updates the sign-in copy automatically.

## 2. Add the Google entries back to `manifest.json`

**Recommended — as _optional_ permissions**, so existing Outlook users are **not** disrupted (adding
*required* host permissions in an update disables the extension until each user re-accepts; optional
permissions are requested only when someone actually clicks "Sign in with Google").

Add the `oauth2` key and an `optional_host_permissions` block (leave `host_permissions` as the two
Microsoft hosts):
```jsonc
"optional_host_permissions": [
  "https://gmail.googleapis.com/*",
  "https://www.googleapis.com/*",
  "https://accounts.google.com/*"
],
"oauth2": {
  "client_id": "YOUR_REAL_ID.apps.googleusercontent.com",
  "scopes": ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.modify"]
}
```

Also re-add Gmail to the manifest `description`:
```diff
-"description": "Bulk unsubscribe, group senders, and clean up your Outlook or Microsoft 365 inbox in one click.",
+"description": "Bulk unsubscribe, group senders, and clean up your Outlook or Gmail inbox in one click.",
```

## 3. Request the optional permissions at sign-in

Because the Gmail hosts are now *optional*, grant them at runtime from the button's user gesture.
In `src/sidepanel/App.tsx`, at the top of `handleGoogleSignIn`, before `googleSignIn()`:
```ts
const granted = await chrome.permissions.request({
  origins: [
    'https://gmail.googleapis.com/*',
    'https://www.googleapis.com/*',
    'https://accounts.google.com/*',
  ],
});
if (!granted) {
  setError('Gmail access was not granted.');
  setLoading(false);
  return;
}
```
(If you'd rather keep it simple and you have few users at v1.1 time, you can instead move the three
hosts into the regular `host_permissions` and skip this step — but expect existing users to get a
re-approval prompt on update.)

## 4. Bump the version

`manifest.json` and `package.json`:
```diff
-"version": "1.0.0"
+"version": "1.1.0"
```

## 5. Verify, regenerate assets, package

```bash
npm run check:config     # now requires the Google client ID too — should be green
npm run ci               # build + typecheck + lint + test
node scripts/gen-store-assets.mjs   # screenshots/promo auto-restore the Gmail badge + copy
npm run package
```

## 6. Update the store listing

Switch `STORE_LISTING.md` back to the dual-provider copy (Gmail + Outlook). The exact text to restore:

- **Short description:** `Bulk unsubscribe and clean up your Gmail or Outlook inbox. Group senders, then archive, delete, and unsubscribe in one click.`
- **Detailed description:** re-add the "Google Gmail (personal and Google Workspace accounts)" line under **WORKS WITH**, change the opener to "Clean your Gmail or Outlook inbox", and "Sign in with your Google or Microsoft account".
- **Data-handling answers:** re-add Google/Gmail alongside Microsoft (the extension now reads Gmail metadata and modifies labels via `gmail.modify`).
- Set the Google publishing status to **In production** once verification is approved.

## 7. Submit the update

Upload the new zip. The update is re-reviewed (adding Google permissions triggers a permissions
review), but the Outlook functionality is unchanged. Existing users keep working; Gmail becomes
available to everyone.
