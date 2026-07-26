# Permissions Justification — Inbox Janitor

This document explains each permission and host permission requested by Inbox Janitor, as required
by the Chrome Web Store review process.

## Extension Permissions

| Permission | Justification |
|---|---|
| `identity` | Required to authenticate users. For Microsoft, it initiates the OAuth 2.0 Authorization Code + PKCE flow via `chrome.identity.launchWebAuthFlow`. For Google, it performs sign-in via `chrome.identity.getAuthToken`, where Chrome manages the token exchange and refresh (no client secret is bundled). Without this permission, the extension cannot authenticate users. |
| `storage` | Required to persist the OAuth access token, refresh token, and sender-grouping cache in `chrome.storage.local`. Tokens must survive the extension being restarted (MV3 service workers are ephemeral). Without storage, users would need to sign in on every browser session. |
| `sidePanel` | Required to register and open the Chrome Side Panel, which is the primary UI surface of Inbox Janitor. The side panel provides a persistent, non-intrusive panel alongside the user's browser content. |

## Host Permissions

### Microsoft

| Host Permission | Justification |
|---|---|
| `https://graph.microsoft.com/*` | All Microsoft email management operations (listing messages, grouping by sender, deleting, archiving, fetching unsubscribe headers) use the Microsoft Graph API at this host. The wildcard `/*` is required because API endpoints include path segments for individual messages (e.g., `/v1.0/me/messages/{id}`). |
| `https://login.microsoftonline.com/*` | The OAuth 2.0 token endpoint (`/oauth2/v2.0/token`) at this host is called directly by the extension to exchange the authorization code for tokens and to refresh tokens. The wildcard is needed because the path includes the tenant segment (`/common/` or a specific tenant ID). |

### Google

Google sign-in uses `chrome.identity.getAuthToken`, so the OAuth authorization and token exchange
are handled internally by Chrome and require no host permission. The Google hosts below are only for
the direct `fetch` calls the extension makes with the resulting token.

| Host Permission | Justification |
|---|---|
| `https://gmail.googleapis.com/*` | All Google email management operations (listing message IDs, fetching `From`/`Date`/`List-Unsubscribe` metadata, `batchModify` to archive by removing the `INBOX` label or move to Trash by adding the `TRASH` label) use the Gmail API at this host. The wildcard `/*` is required because endpoints include per-message path segments (e.g., `/gmail/v1/users/me/messages/{id}`). |
| `https://www.googleapis.com/*` | The OpenID Connect userinfo endpoint (`/oauth2/v3/userinfo`) at this host is called to display the signed-in user's name and email in the UI. |
| `https://accounts.google.com/*` | The OAuth 2.0 revocation endpoint (`/o/oauth2/revoke`) at this host is called on sign-out to revoke the token, so the next sign-in shows the account picker. |

## Scopes (Microsoft Graph)

| Scope | Justification |
|---|---|
| `openid` | Standard OpenID Connect scope; enables the ID token in the auth response for user identification. |
| `profile` | Provides access to basic profile claims (display name) shown in the extension header. |
| `email` | Provides the user's email address shown in the extension header. |
| `offline_access` | Enables the refresh token so the extension can silently refresh access without re-prompting the user on every browser session. |
| `User.Read` | Fetches the signed-in user's profile (`GET /me`) to display their name and email in the UI. |
| `Mail.ReadWrite` | Lists messages (`GET /me/messages`) for sender grouping, moves messages to Deleted Items (`DELETE /me/messages/{id}`), and archives messages (`POST /me/messages/{id}/move`). Both read and write are required because the core functionality includes destructive actions. |

## Scopes (Google / Gmail)

| Scope | Justification |
|---|---|
| `openid` | Standard OpenID Connect scope; identifies the signed-in Google account. |
| `email` | Provides the user's email address shown in the extension header. |
| `profile` | Provides basic profile claims (display name) shown in the extension header. |
| `https://www.googleapis.com/auth/gmail.modify` | Core functionality. Read-only listing of message IDs and `From`/`Date`/`List-Unsubscribe` metadata headers for sender grouping and unsubscribe parsing; `batchModify` to **archive** (remove the `INBOX` label) and to **move to Trash** (add the `TRASH` label). `gmail.modify` is the narrowest scope that supports these label mutations. The broader `https://mail.google.com/` scope is deliberately **not** requested because Inbox Janitor never permanently deletes mail — moving to Trash is recoverable. |

> **Note (Google restricted-scope verification):** `gmail.modify` is a *restricted* scope. Before the
> Gmail path can be used by the general public, the Google Cloud project must complete Google's OAuth
> app verification (brand review, demo video, published privacy policy, homepage), and — if any
> restricted-scope data is ever handled by a developer-controlled server — an annual CASA security
> assessment. Inbox Janitor keeps all data client-side, but verification is still required. Until it
> is granted, only test users added to the OAuth consent screen (up to 100) can use Gmail sign-in.

## Incremental / Feature-Flagged Scopes (not requested at startup)

| Scope | When Requested | Justification |
|---|---|---|
| `Mail.Send` | Only if user enables "Send unsubscribe email via Graph" feature | Allows sending an unsubscribe email via `POST /me/sendMail` for `mailto:` unsubscribe links. Not requested by default; the fallback opens the user's mail client instead. |

## What Is NOT Requested and Why

- **`<all_urls>`** — Not needed; the extension only communicates with Microsoft's APIs.
- **`tabs`** — Not a declared permission; the extension opens new tabs via `chrome.tabs.create` only for unsubscribe links, but this API is available without a declared permission in MV3.
- **`webRequest` / `declarativeNetRequest`** — Not needed; the extension does not inspect or modify web requests from other sites.
- **`history`, `bookmarks`, `cookies`, `geolocation`** — None of these are used.
- **Client secret** — No client secret is embedded for either provider. Microsoft uses PKCE (public client); Google uses `chrome.identity.getAuthToken`, where Chrome performs the token exchange, so no secret is needed. This is the correct, secure approach for distributed browser extensions.
