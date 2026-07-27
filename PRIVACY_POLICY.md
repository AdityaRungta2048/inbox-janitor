# Privacy Policy — Inbox Janitor Chrome Extension

**Last updated:** July 2026

## Overview

Inbox Janitor is a Chrome browser extension that helps Microsoft Outlook / Microsoft 365 and Google Gmail users manage their email inbox by grouping senders, bulk-unsubscribing, and archiving or moving unwanted messages to Trash / Deleted Items.

## Data Collection

**Inbox Janitor does not collect, store, or transmit your personal data to any server controlled by the developer.**

Specifically:

- **No email content is ever read or stored by the developer.** The extension processes email metadata (sender addresses, message counts, dates) and message headers locally within your browser.
- **No analytics, telemetry, or tracking** of any kind is implemented in this extension.
- **No third-party SDKs** that collect user data are included.

## Data Processing

All data processing happens client-side, entirely within your browser:

1. **OAuth tokens** (your provider's access token and, where applicable, refresh token) are stored in `chrome.storage.local` — a storage area local to your browser and never transmitted to the developer.
2. **Sender grouping data** (sender email addresses, names, message counts) is cached in `chrome.storage.local` to avoid redundant API calls. This cache is cleared when you sign out.
3. **Email metadata** is fetched directly from your email provider's API using your own OAuth token. The extension communicates exclusively with your provider's official endpoints:
   - **Microsoft accounts:**
     - `https://graph.microsoft.com` — Microsoft's official Graph API, using your credentials
     - `https://login.microsoftonline.com` — Microsoft's authentication service
   - **Google accounts:**
     - `https://gmail.googleapis.com` — Google's official Gmail API, using your credentials
     - `https://www.googleapis.com` — Google's user-profile endpoint (name/email for the signed-in account)
     - `https://accounts.google.com` — Google's authentication service; sign-in itself is handled by Chrome's built-in identity API, and this host is also used to revoke the token when you sign out
4. **Unsubscribe actions** are performed directly by your browser — either via an HTTP POST to the sender's unsubscribe URL, via your provider's send-mail API (if you enable that feature), or by opening a tab — never through a developer-controlled proxy.

## Permissions Used

| Permission | Purpose |
|---|---|
| `identity` | Initiate the OAuth 2.0 sign-in flow with Microsoft or Google |
| `storage` | Store your OAuth tokens and sender cache locally in your browser |
| `sidePanel` | Display the Inbox Janitor panel in Chrome's side panel |
| `https://graph.microsoft.com/*` | Make authorized requests to the Microsoft Graph API on your behalf |
| `https://login.microsoftonline.com/*` | Perform the OAuth token exchange with Microsoft |
| `https://gmail.googleapis.com/*` | Make authorized requests to the Gmail API on your behalf |
| `https://www.googleapis.com/*` | Read your Google profile (name/email) for the signed-in account |
| `https://accounts.google.com/*` | Revoke the Google token when you sign out |

## Data Retention and Deletion

- All locally stored data (tokens, cache) is deleted immediately when you click **Sign out** within the extension.
- You can also clear all extension data by uninstalling Inbox Janitor from Chrome.
- No data is retained on any developer-controlled server because none is collected.
- To revoke the extension's access entirely, you can also remove it from your account security settings: [Microsoft account apps](https://account.live.com/consent/Manage) or [Google account permissions](https://myaccount.google.com/permissions).

## Google API Services — Limited Use Disclosure

Inbox Janitor's use and transfer of information received from Google APIs to any other app will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the **Limited Use** requirements.

Specifically, data accessed through the Gmail API is used **only** to:

1. Display sender information within the extension UI, and
2. Perform the email-management actions you explicitly request (archive, move to Trash, unsubscribe).

Inbox Janitor requests the `gmail.modify` scope so it can list message metadata, remove the `INBOX` label (archive), and add the `TRASH` label (move to Trash — recoverable). It **does not** permanently delete mail, does not use humans to read your mail, does not use Gmail data to train generalized AI/ML models, and does not transfer or sell this data to third parties.

## Microsoft Graph — Limited Use Disclosure

Inbox Janitor's use of data obtained from the Microsoft Graph API is limited to:

1. Displaying sender information within the extension UI
2. Performing actions you explicitly request (move to Deleted Items, archive, unsubscribe)
3. Caching sender grouping results locally to improve performance

This data is **not** used for any purpose other than the extension's core email-management functionality. It is not transferred to third parties, not used for advertising, and not used for any purpose unrelated to the service you request.

## Third-Party Services

The extension communicates only with Microsoft's and Google's official services (their email/Graph APIs and authentication endpoints). No other third-party services receive any data.

## Children's Privacy

This extension is not directed at children under 13 and does not knowingly collect information from children.

## Changes to This Policy

If this policy is updated, the new version will be posted at the same URL and the "Last updated" date above will change.

## Contact

For questions about this privacy policy, contact: adityarungta2048@gmail.com
