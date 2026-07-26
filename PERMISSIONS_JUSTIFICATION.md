# Permissions Justification — Inbox Janitor

This document explains each permission and host permission requested by Inbox Janitor, as required
by the Chrome Web Store review process.

## Extension Permissions

| Permission | Justification |
|---|---|
| `identity` | Required to initiate the OAuth 2.0 Authorization Code + PKCE flow via `chrome.identity.launchWebAuthFlow`. This opens the Microsoft sign-in page and returns the authorization code. Without this permission, the extension cannot authenticate users. |
| `storage` | Required to persist the OAuth access token, refresh token, and sender-grouping cache in `chrome.storage.local`. Tokens must survive the extension being restarted (MV3 service workers are ephemeral). Without storage, users would need to sign in on every browser session. |
| `sidePanel` | Required to register and open the Chrome Side Panel, which is the primary UI surface of Inbox Janitor. The side panel provides a persistent, non-intrusive panel alongside the user's browser content. |

## Host Permissions

| Host Permission | Justification |
|---|---|
| `https://graph.microsoft.com/*` | All email management operations (listing messages, grouping by sender, deleting, archiving, fetching unsubscribe headers) use the Microsoft Graph API at this host. The wildcard `/*` is required because API endpoints include path segments for individual messages (e.g., `/v1.0/me/messages/{id}`). |
| `https://login.microsoftonline.com/*` | The OAuth 2.0 token endpoint (`/oauth2/v2.0/token`) at this host is called directly by the extension to exchange the authorization code for tokens and to refresh tokens. The wildcard is needed because the path includes the tenant segment (`/common/` or a specific tenant ID). |

## Scopes (Microsoft Graph)

| Scope | Justification |
|---|---|
| `openid` | Standard OpenID Connect scope; enables the ID token in the auth response for user identification. |
| `profile` | Provides access to basic profile claims (display name) shown in the extension header. |
| `email` | Provides the user's email address shown in the extension header. |
| `offline_access` | Enables the refresh token so the extension can silently refresh access without re-prompting the user on every browser session. |
| `User.Read` | Fetches the signed-in user's profile (`GET /me`) to display their name and email in the UI. |
| `Mail.ReadWrite` | Lists messages (`GET /me/messages`) for sender grouping, moves messages to Deleted Items (`DELETE /me/messages/{id}`), and archives messages (`POST /me/messages/{id}/move`). Both read and write are required because the core functionality includes destructive actions. |

## Incremental / Feature-Flagged Scopes (not requested at startup)

| Scope | When Requested | Justification |
|---|---|---|
| `Mail.Send` | Only if user enables "Send unsubscribe email via Graph" feature | Allows sending an unsubscribe email via `POST /me/sendMail` for `mailto:` unsubscribe links. Not requested by default; the fallback opens the user's mail client instead. |

## What Is NOT Requested and Why

- **`<all_urls>`** — Not needed; the extension only communicates with Microsoft's APIs.
- **`tabs`** — Not a declared permission; the extension opens new tabs via `chrome.tabs.create` only for unsubscribe links, but this API is available without a declared permission in MV3.
- **`webRequest` / `declarativeNetRequest`** — Not needed; the extension does not inspect or modify web requests from other sites.
- **`history`, `bookmarks`, `cookies`, `geolocation`** — None of these are used.
- **Client secret** — The extension uses PKCE (public client), so no client secret is embedded. This is the correct, secure approach for distributed browser extensions.
