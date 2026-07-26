# Build Report — Inbox Janitor v1.0.0

Generated: 2026-06-29

## What Was Built

A production-ready, store-ready Manifest V3 Chrome extension that helps Outlook / Microsoft 365
users clean up their inbox via:

- **OAuth 2.0 PKCE sign-in** with Microsoft (manual implementation, no MSAL)
- **Sender grouping** — paginated Microsoft Graph scan, grouped by sender email, sorted/filterable
- **Bulk unsubscribe** — RFC 8058 one-click HTTPS, Graph Mail.Send (mailto), tab fallback, MIME fallback
- **Bulk archive / delete** — batched via Graph `$batch` (20 per call, 4 concurrent), with progress bar and cancel
- **Safety** — confirmation modal with exact message count; archive is default; delete moves to Deleted Items (recoverable)
- **Caching** — sender groups cached in `chrome.storage.local` with 30-minute TTL
- **Throttling** — 429/503 Retry-After backoff with jitter; exponential retry up to 5 attempts
- **Partial results** — 2000-message cap with "Load more" prompt

## Key Architecture Decisions

| Decision | Choice |
|---|---|
| Build tool | Vite (UI) + esbuild (service worker) — @crxjs avoided due to MV3 instability |
| Auth | Manual PKCE (~100 lines) — no MSAL; zero extra deps; fully auditable |
| Graph calls | From side panel directly (not via service worker messages) — more reliable |
| UI framework | Preact (3 KB) — sufficient for complex state, minimal footprint |
| Unsubscribe | `internetMessageHeaders` first; raw MIME `/$value` fallback (RFC 2369/8058) |
| Message limit | 2000 per scan; partial flag + user-triggered refresh for larger inboxes |
| Archive default | Archive is primary action; delete is clearly secondary/red |

See `DECISIONS.md` for full rationale.

## Automated Gate Results

| Gate | Status | Details |
|---|---|---|
| **Build** | ✅ PASS | `vite build` + `esbuild` SW + `copy-statics` + `postbuild` — 0 errors |
| **Typecheck** | ✅ PASS | `tsc --noEmit` (strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) — 0 errors |
| **Lint** | ✅ PASS | ESLint + Prettier — 0 errors, 0 warnings |
| **Unit Tests** | ✅ PASS | 58 tests across 5 test files — 100% pass |
| **Smoke Test** | ✅ PASS | Puppeteer loads unpacked extension, asserts signed-out UI, Sign In button, app root, header — all pass |

## Unit Test Coverage Summary

| Test File | Tests | What's Covered |
|---|---|---|
| `pkce.test.ts` | 13 | Code verifier generation, SHA-256 challenge (RFC 7636 known vector), state generation, callback URL parsing |
| `backoff.test.ts` | 15 | `sleep`, `jitter`, `withRetry` (success, retries, exhaustion), `chunk` (BATCH_SIZE=20), `runConcurrent` (concurrency limit) |
| `batch.test.ts` | 4 | Single batch call, 45-request → 3 batch chunks, `onProgress` callback, 429 Retry-After backoff |
| `senderGrouping.test.ts` | 7 | Case-insensitive grouping, latest-date tracking, sort order, skips empty senders, pagination (nextLink), 2000-msg partial cap, storage write |
| `unsubscribe.test.ts` | 19 | Parse one-click HTTPS, mailto:, combined, case-insensitive, empty/malformed, HTTP fallback, first-URL priority; executeUnsubscribe routing for all 4 paths; getUnsubscribeHeader from headers, MIME fallback, MIME folded headers |

**Total: 58 tests / 58 passing**

## Package

```
inbox-janitor.zip — 19,456 bytes
dist/ contents:
  manifest.json
  service-worker.js
  sidepanel/index.html
  popup/index.html
  assets/sidepanel-*.js    (32 KB — Preact + app logic)
  assets/sidepanel-*.css   (8 KB — styles)
  assets/popup-*.js        (0.25 KB)
  assets/modulepreload-polyfill-*.js
  icons/icon{16,32,48,128}.png
```

## What the Automated Gates CAN and CANNOT Verify

### ✅ Automated — verified green above
- TypeScript compilation (strict mode)
- ESLint + Prettier formatting
- All unit-tested business logic (PKCE, backoff, batching, sender grouping, unsubscribe routing) — Graph API **fully mocked**
- Extension loads in Chromium without errors
- Signed-out UI renders correctly
- Sign In button is present and visible

### ❌ NOT automatable — requires your manual live-account test
- **Real OAuth consent flow** against a live Microsoft account (requires your Azure client ID)
- **Real Graph API calls** returning real mail data
- **Real one-click unsubscribe POSTs** to actual newsletter servers
- **Real bulk delete/archive** on a throwaway Outlook inbox
- **Throttling behavior** at scale (needs a large mailbox to trigger 429)
- **Corporate M365 admin consent** flow (requires an M365 org tenant)
- **Side panel chrome UI** (Puppeteer tests the HTML directly; the actual `chrome.sidePanel` chrome UI requires manual verification)

**This extension is: all automated gates green; pending manual live-account validation.**

## Manual Steps Required Before Chrome Web Store Submission

1. **Register Azure AD app** — see `README.md → [HUMAN SETUP]` for exact steps
2. **Set `VITE_MS_CLIENT_ID`** in `.env` and rebuild
3. **Add redirect URI** in Azure Portal: `https://<EXTENSION_ID>.chromiumapp.org/`
4. **Load unpacked extension** in Chrome, verify extension ID matches redirect URI
5. **Manual live-account test** — full checklist in `README.md`
6. **Host privacy policy** at a public URL; paste into store listing
7. **Capture screenshots** — 5 screenshots listed in `STORE_LISTING.md`
8. **Create promo tiles** — 440×280 small, 920×680 large
9. **Pay $5** Chrome Web Store developer registration (one-time)
10. **Replace placeholder icons** — current icons are solid-blue placeholders; replace with branded assets before publishing
11. **Upload `inbox-janitor.zip`** to Chrome Web Store Developer Dashboard

## Files Ready for Submission

- `dist/` — complete built extension
- `inbox-janitor.zip` — store-ready package
- `PRIVACY_POLICY.md` / `PRIVACY_POLICY.html` — host at a public URL
- `PERMISSIONS_JUSTIFICATION.md` — for the store review form
- `STORE_LISTING.md` — listing copy, screenshot list, data-handling answers
- `DECISIONS.md` — architecture decisions
- `README.md` — setup guide with `[HUMAN SETUP]` checklist
