# Chrome Web Store Listing — Inbox Janitor (v1.0, Outlook-only)

> **Launch scope:** v1.0 ships Microsoft/Outlook only. The Gmail additions for the v1.1 listing
> (extra bullets, "works with Gmail", Google data-handling answers) live in
> `docs/ENABLE_GMAIL_V1.1.md` — do **not** mention Gmail in the v1.0 submission, since the v1.0 build
> requests no Google permissions.

## Name
Inbox Janitor

## Short Description (max 132 characters)
Bulk unsubscribe and clean up your Outlook / Microsoft 365 inbox — group senders, archive, delete, or unsubscribe in a click.

*(Current: 124 characters — within limit)*

## Category
Productivity

## Single-Purpose Statement
Inbox Janitor has a single purpose: to help Outlook and Microsoft 365 users unsubscribe from unwanted senders and bulk-archive or delete email from their inbox.

## Detailed Description

```
📬 Clean your Outlook inbox in minutes, not hours.

Inbox Janitor connects to your Microsoft account and groups your email by sender so you can see at a glance who's filling your inbox. Then clean up with one click.

✅ FEATURES

• Sender grouping — scan your inbox and see every sender ranked by how many emails they've sent you
• Bulk unsubscribe — select senders and unsubscribe automatically where supported (one-click RFC 8058), or open the unsubscribe page for you
• Bulk archive or delete — select multiple senders and archive or move to Deleted Items in one action, with a live progress bar
• Fast and safe — confirmation step shows the exact count before any action; archive is the default (recoverable); "delete" moves to Deleted Items, never a permanent purge
• Search and sort — filter by name/email, sort by message count, most recent, or A–Z

🔒 PRIVACY FIRST

• Processes email metadata locally in your browser — no email content ever leaves your device to a third-party server
• Communicates only with the official Microsoft Graph API using your own secure OAuth token
• No analytics, no tracking, no ads
• Sign out clears all stored tokens and cached data instantly

📥 WORKS WITH

• Personal Outlook (outlook.com, live.com, hotmail.com)
• Microsoft 365 work and school accounts

Note: Some corporate M365 tenants require an IT admin to grant consent for third-party apps. If you see an "Admin approval required" screen, ask your IT administrator to approve Inbox Janitor.

⚙️ HOW IT WORKS

1. Click the Inbox Janitor toolbar button to open the side panel
2. Sign in with your Microsoft account
3. See your senders grouped and ranked
4. Select senders to unsubscribe, archive, or delete
5. Done — your inbox is cleaner
```

## Single-Purpose Statement (store form field)
"Help Outlook and Microsoft 365 users unsubscribe from unwanted senders and bulk-clean their inbox."

## Data Handling Answers (Chrome Web Store form)

**Does your extension collect or use any personal or sensitive user data?**
Yes — the extension requests access to the user's Microsoft email account via OAuth. It reads email metadata (sender addresses, dates) to build a sender list, and performs actions (archive, delete, unsubscribe) at the user's explicit request.

**What data does your extension collect or transmit?**
The extension accesses email metadata (sender address, display name, message date, message IDs) and email headers (for unsubscribe parsing). This data is processed locally in the browser. It is not transmitted to any developer-controlled server.

**How is the data used?**
Solely to display the sender list in the extension UI and to perform the email-management actions the user requests. No other use. (See the Microsoft Graph Limited Use disclosure in the privacy policy.)

**How is the data stored?**
OAuth tokens and a sender-grouping cache are stored in `chrome.storage.local` — local browser storage that is never accessible to the developer. All stored data is cleared on sign-out.

**Do you share the data with third parties?**
No. The extension communicates only with Microsoft's Graph API and authentication endpoints, which the user is already trusting as their email provider.

## Screenshots (in `store-assets/`)

| # | File | Shows |
|---|---|---|
| 1 | `01-signed-out.png` | Signed-out — "Sign in with Microsoft" |
| 2 | `02-sender-list.png` | Sender list, ranked by message count |
| 3 | `03-select-and-act.png` | Multiple senders selected, action bar visible |
| 4 | `04-safe-confirm.png` | Archive confirmation modal — exact message count |

All are 1280×800. (Chrome requires 1–5 screenshots.)

## Promo Tiles (in `store-assets/`)

- Small promo tile — `promo-small-440x280.png` (440×280, required)
- Marquee promo tile — `promo-marquee-1400x560.png` (1400×560, optional, for featuring)

## Privacy Policy URL
Host `PRIVACY_POLICY.html` / `docs/index.html` on GitHub Pages and paste the URL here, e.g.
`https://adityarungta2048.github.io/inbox-janitor/`
