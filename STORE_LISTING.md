# Chrome Web Store Listing — Inbox Janitor

## Name
Inbox Janitor

## Short Description (max 132 characters)
Bulk unsubscribe and clean up your Gmail or Outlook inbox. Group senders, then archive, delete, and unsubscribe in one click.

*(Current: 125 characters — within limit)*

## Category
Productivity

## Single-Purpose Statement
Inbox Janitor has a single purpose: to help Gmail, Outlook, and Microsoft 365 users unsubscribe from unwanted senders and bulk-archive or delete email from their inbox.

## Detailed Description

```
📬 Clean your Gmail or Outlook inbox in minutes, not hours.

Inbox Janitor connects to your Google or Microsoft account and groups your email by sender so you can see at a glance who's filling your inbox. Then clean up with one click.

✅ FEATURES

• Sender grouping — scan your inbox and see every sender ranked by how many emails they've sent you
• Bulk unsubscribe — select senders and unsubscribe automatically where supported (one-click RFC 8058), or open the unsubscribe page for you
• Bulk archive or delete — select multiple senders and archive or move to Trash / Deleted Items in one action, with a live progress bar
• Fast and safe — confirmation step shows the exact count before any action; archive is the default (recoverable); "delete" moves to Trash / Deleted Items, never a permanent purge
• Search and sort — filter by name/email, sort by message count, most recent, or A–Z

🔒 PRIVACY FIRST

• Processes email metadata locally in your browser — no email content ever leaves your device to a third-party server
• Communicates only with the official Gmail API or Microsoft Graph API using your own secure OAuth token
• No analytics, no tracking, no ads
• Sign out clears all stored tokens and cached data instantly

📥 WORKS WITH

• Google Gmail (personal and Google Workspace accounts)
• Personal Outlook (outlook.com, live.com, hotmail.com)
• Microsoft 365 work and school accounts

Note: Some corporate M365 or Google Workspace tenants require an admin to grant consent for third-party apps. If you see an "Admin approval required" screen, ask your IT administrator to approve Inbox Janitor.

⚙️ HOW IT WORKS

1. Click the Inbox Janitor toolbar button to open the side panel
2. Sign in with your Google or Microsoft account
3. See your senders grouped and ranked
4. Select senders to unsubscribe, archive, or delete
5. Done — your inbox is cleaner
```

## Single-Purpose Statement (store form field)
"Help Gmail, Outlook, and Microsoft 365 users unsubscribe from unwanted senders and bulk-clean their inbox."

## Data Handling Answers (Chrome Web Store form)

**Does your extension collect or use any personal or sensitive user data?**
Yes — the extension requests access to the user's Google or Microsoft email account via OAuth. It reads email metadata (sender addresses, dates) to build a sender list, and performs actions (archive, delete/trash, unsubscribe) at the user's explicit request.

**What data does your extension collect or transmit?**
The extension accesses email metadata (sender address, display name, message date, message IDs) and email headers (`From`, `Date`, `List-Unsubscribe` — for unsubscribe parsing). This data is processed locally in the browser. It is not transmitted to any developer-controlled server.

**How is the data used?**
Solely to display the sender list in the extension UI and to perform the email-management actions the user requests. No other use. (See the Google API Services Limited Use and Microsoft Graph Limited Use disclosures in the privacy policy.)

**How is the data stored?**
OAuth tokens and a sender-grouping cache are stored in `chrome.storage.local` — local browser storage that is never accessible to the developer. All stored data is cleared on sign-out.

**Do you share the data with third parties?**
No. The extension communicates only with Google's Gmail API / Microsoft's Graph API and their respective authentication endpoints, which the user is already trusting as their email provider.

## Screenshots Required (capture these before submission)

| # | Description | Recommended size |
|---|---|---|
| 1 | Signed-out state — "Sign in with Microsoft" button | 1280×800 |
| 2 | Sender list — showing 10+ senders, ranked by count | 1280×800 |
| 3 | Multiple senders selected, action bar visible | 1280×800 |
| 4 | Archive confirmation modal — shows total message count | 1280×800 |
| 5 | Progress bar during bulk operation | 1280×800 |

## Promo Tile Required

- Small promo tile: 440×280 pixels (required for listing)
- Large promo tile: 920×680 pixels (optional, for featuring)

Content suggestion: extension name + tagline "Clean your Outlook inbox in minutes" on a clean, light background with the envelope/inbox icon.

## Privacy Policy URL
[HUMAN SETUP] — Host PRIVACY_POLICY.html at a public URL and paste it here.
Suggestion: GitHub Pages or your personal domain.
