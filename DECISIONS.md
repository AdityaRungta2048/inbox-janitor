# Architecture Decisions — Inbox Janitor

## D1 — Build tooling: Vite (UI) + esbuild (service worker)

**Decision:** Use Vite with `@preact/preset-vite` for the side panel and popup HTML entry points.
Use esbuild directly (via `scripts/build-sw.mjs`) for the service worker.

**Rationale:** `@crxjs/vite-plugin` has known stability issues with Vite 5 and MV3 service workers.
A split build avoids those issues: Vite handles HTML/CSS/JS bundling cleanly, and esbuild produces a
single-file ESM service worker (required by MV3's `"type": "module"` background declaration).
The extra build step is minimal and fully automated in the `npm run build` script.

## D2 — Auth: Manual PKCE (no MSAL browser)

**Decision:** Implement PKCE manually (~120 lines in `src/auth/pkce.ts` + `src/auth/msAuth.ts`).

**Rationale:** `@azure/msal-browser` has a footprint of ~600 KB and was designed for SPAs, not
Chrome extension service workers. It relies on `window` and `localStorage` in ways that conflict
with MV3 contexts. The manual PKCE implementation is straightforward, fully auditable, and has zero
transitive dependencies — important for a security-sensitive extension.

## D3 — Where Graph calls run: Side panel (not service worker)

**Decision:** All Microsoft Graph API calls are made from the side panel's JavaScript context,
not from the service worker.

**Rationale:** MV3 service workers are ephemeral and can be terminated mid-request. The side panel
is a persistent window (open as long as the user keeps it open), making it a more reliable context
for long-running operations like paginated message fetching and batch deletes. The service worker is
kept minimal (open-side-panel registration, keepalive handler).

## D4 — UI framework: Preact

**Decision:** Use Preact (3 KB gzipped) for the side panel UI.

**Rationale:** The side panel has significant state complexity (auth state, loading states, sender
list, selection, modals, progress bars). Plain DOM manipulation would be brittle at this scale.
Preact provides React-compatible component model at minimal size cost, avoiding the 40 KB+ overhead
of React. No framework is used in the popup (which is intentionally minimal).

## D5 — Unsubscribe strategy: Header-first, MIME fallback

**Decision:** For each unsubscribe action, first attempt `?$select=internetMessageHeaders` on
the representative message. If `List-Unsubscribe` is absent from the response, fall back to fetching
the raw MIME via `/$value` and parsing headers manually.

**Rationale:** Microsoft Graph's `internetMessageHeaders` field is documented as available but has
historically been inconsistent for certain message types (e.g., messages synced from older stores).
The MIME fallback guarantees correct header parsing per RFC 2369/8058, at the cost of a larger
payload for that one message (fetched only on demand, never during the bulk scan).

## D6 — Message fetch limit: 2000

**Decision:** Cap the initial sender-grouping fetch at 2000 messages. Cache is marked `isPartial`
and the user sees a "Load more" prompt.

**Rationale:** A 2000-message scan already covers most active inboxes meaningfully. Fetching tens
of thousands of messages on first open would be slow, expensive in Graph quota, and overwhelming
in UI. Users with larger inboxes can trigger additional fetches explicitly.

## D7 — Archive vs Delete: Archive as default

**Decision:** "Archive" is the primary action (blue button). "Delete" is clearly secondary (red).
Both use recoverable operations: archive moves to the Archive folder; delete moves to Deleted Items
(not permanent hard-delete). Hard delete is not implemented in v1.

**Rationale:** Irreversible actions carry significant risk. A user who accidentally selects the
wrong sender has recourse from both Deleted Items and Archive. This is also important for Chrome
Web Store approval — reviewers are sensitive to destructive-action UX in email extensions.

## D8 — Token storage: chrome.storage.local

**Decision:** Store OAuth tokens in `chrome.storage.local`, not `sessionStorage` or
`chrome.storage.session`.

**Rationale:** `chrome.storage.session` (available in MV3) is cleared when the browser closes,
which would force re-authentication every browser restart — poor UX. `chrome.storage.local` persists
tokens across sessions, consistent with how users expect "stay signed in" to work. The refresh
token allows silent re-auth when the access token expires.

## D9 — Extension ID pinning

**Decision:** Include a hard-coded `"key"` in `manifest.json` to produce a stable extension ID
during development.

**Rationale:** The OAuth redirect URI is `https://<EXTENSION_ID>.chromiumapp.org/`. Without a
pinned key, the extension ID changes every time it's loaded unpacked in a new Chrome profile,
requiring the Azure AD app's redirect URI to be updated each time. The key is NOT a secret — it's
the public key half of an RSA key pair and is safe to commit.

## D10 — Google OAuth client secret handling (OPEN — decision required)

**Context:** Microsoft's PKCE flow needs no client secret (public client). Google is different:
its token endpoint **requires** a `client_secret` to exchange an auth code for a refresh token, and
PKCE cannot substitute for it (confirmed against Google's OAuth docs — a token request without
`client_secret` returns `invalid_request: client_secret is missing`). The current code
(`src/auth/googleAuth.ts`) sends `GOOGLE_CLIENT_SECRET` from `config.ts`, which means the secret is
built into the public extension bundle — extractable by anyone who unzips it.

**Options:**

| Option | Removes secret exposure? | Trade-off |
|---|---|---|
| **A. `chrome.identity.getAuthToken`** | ✅ Yes — no secret at all | Chrome-account-bound (only the account signed into Chrome); no stored refresh token (Chrome refreshes internally); Chrome-only. Requires a "Chrome Extension" OAuth client type. Refactor of `googleAuth.ts` + `manifest.json` (`oauth2` key). |
| **B. Backend token-exchange proxy** | ✅ Yes — secret stays server-side | Adds server infrastructure + hosting cost; auth codes/tokens transit a developer server, which weakens the "nothing touches our servers" privacy claim and likely pushes toward full CASA. |
| **C. Keep secret in bundle (status quo)** | ❌ No | Works today; common in practice; but a "Web application" secret is meant to be confidential and a reviewer/security-conscious user may flag it. |

**Status:** Undecided — pending product owner input. Recommendation: **Option A** for a Chrome-first
extension (secret-free, Google-recommended for extensions), accepting the single-Chrome-account
limitation. Revisit if multi-account Gmail support becomes a requirement.

## Future Work (v1.1 and beyond — do NOT build now)

- **v1.1:** Optional server-side auto-delete rule using `POST /me/mailFolders/inbox/messageRules`
  (requires `MailboxSettings.ReadWrite` scope, incremental consent).
- **v1.1:** Incremental consent for `Mail.Send` when user enables mailto unsubscribe.
- **v2:** Monetization via external license check + Stripe for "pro" tier (unlimited senders,
  auto-rules). Chrome's in-app payments is deprecated; do not use.
- **v2:** Yahoo/generic IMAP would require a native messaging host or companion web app —
  impossible within an MV3 extension's fetch-only network model.
- **v2:** Per-sender "block future mail" using server-side rules (blocked by `MailboxSettings.ReadWrite` scope needing admin consent in some tenants).
