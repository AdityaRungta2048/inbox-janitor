# Google OAuth Verification Kit — Inbox Janitor

Everything you need to submit `gmail.modify` (a **restricted** scope) for Google's OAuth app
verification. Copy the text blocks straight into the Google Cloud Console forms.

Reference: [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

---

## 0. Before you submit — prerequisites

- [ ] Gmail API enabled in the project
- [ ] A **public homepage** on a domain you can verify (see §4)
- [ ] A **public privacy policy** URL (you have `docs/privacy.html` → GitHub Pages)
- [ ] Homepage + privacy policy on the **same domain**, and that domain **verified in
      [Google Search Console](https://search.google.com/search-console)** and added under
      OAuth consent screen → *Authorized domains*
- [ ] The OAuth client is type **Chrome Extension**, item ID = your extension ID
      (`npm run check:config` prints it)
- [ ] App works end-to-end for a **test user** first (verification reviewers replicate this)

---

## 1. OAuth consent screen — field values

| Field | Value |
|---|---|
| App name | `Inbox Janitor` |
| User support email | `adityarungta2048@gmail.com` |
| App logo | `store-assets/source-icon.jpg` (120×120+, <1 MB) |
| Application home page | `https://adityarungta2048.github.io/inbox-janitor/` |
| Application privacy policy | `https://adityarungta2048.github.io/inbox-janitor/privacy.html` |
| Authorized domains | `github.io` (or your custom domain) |
| Developer contact | `adityarungta2048@gmail.com` |
| User type | External |

**Scopes to add:** `openid`, `email`, `profile`, and
`https://www.googleapis.com/auth/gmail.modify`.

---

## 2. Scope justification (paste into "How will the scopes be used?")

> Inbox Janitor uses the `gmail.modify` scope solely to help the signed-in user clean up their own
> inbox, entirely on their device. Specifically:
>
> 1. **Read message metadata** via `users.messages.list` and `users.messages.get` with
>    `format=metadata` (headers `From`, `Date`, `List-Unsubscribe` only) to group the inbox by
>    sender and to detect one-click unsubscribe links (RFC 8058).
> 2. **Modify labels** via `users.messages.batchModify` to **archive** (remove the `INBOX` label)
>    and to **move to Trash** (add the `TRASH` label) for senders the user explicitly selects and
>    confirms.
>
> Inbox Janitor never reads message bodies, never sends mail, and never permanently deletes mail
> (Trash is recoverable by the user). No Gmail data is transmitted to or stored on any
> developer-controlled server — all processing happens in the browser, and OAuth is handled by
> Chrome's `identity.getAuthToken`. `gmail.modify` is the narrowest scope that allows these label
> changes; the broader `https://mail.google.com/` scope is intentionally not requested.

**Why not a narrower scope?** `gmail.readonly` cannot archive or trash; the metadata-only scope
cannot modify labels. `gmail.modify` without permanent-delete is the minimum that supports the
feature set.

---

## 3. Demo video — shot list

Google requires a video (an **unlisted YouTube link** is fine) that shows the OAuth client ID / app
name, the full consent grant, and how each restricted scope is used. Record ~2–3 minutes:

1. **Identity match** — show `chrome://extensions/` with Inbox Janitor's ID visible; state that this
   ID matches the OAuth client's item ID.
2. **Start sign-in** — open the side panel, click **Sign in with Google**.
3. **Consent screen** — show the Google account picker, then the consent screen **with the
   `gmail.modify` scope description visible**, and grant access. (Narrate: "the app requests
   gmail.modify to archive and trash mail.")
4. **Read metadata** — show the sender list populating (this is the metadata read: senders grouped
   by volume).
5. **Modify labels — archive** — select 1–2 senders → **Archive** → confirm the count → show the
   progress complete, then show in Gmail that those messages left the Inbox.
6. **Modify labels — trash** — select a sender → **Delete** → confirm → show the messages now in
   Gmail's Trash (emphasize: recoverable, not permanent).
7. **Unsubscribe** — select a newsletter → **Unsubscribe** → show the results modal.
8. **Sign out** — click **Sign out**; state that all local tokens/cache are cleared and no data was
   sent to any server.

Use a throwaway Google account with a few newsletters so the list looks real.

---

## 4. Homepage requirement

Google needs a public **home page** describing the app, on the **same verified domain** as the
privacy policy. Cheapest option that reuses what you have:

- The GitHub Pages site already provides a **homepage** (`docs/index.html`) and a distinct
  **privacy policy** (`docs/privacy.html`) on `adityarungta2048.github.io` — both requirements met.
- Verify `github.io` ownership in Search Console (HTML-file method: drop the verification file in
  `docs/`), then list it under *Authorized domains*.

---

## 5. Meanwhile — ship in Testing mode

While verification is pending (weeks), keep the consent screen in **Testing** status and add users
under **Test users** (max 100). Those users can use Gmail immediately; they'll see a
"Google hasn't verified this app" screen and click **Advanced → Go to Inbox Janitor**. Outlook is
unaffected and fully public. When verification clears, switch publishing status to **In production** —
no code or Web Store changes needed.

---

## 6. CASA security assessment — how to answer

If Google routes you to a [CASA](https://appdefensealliance.dev/casa) assessment (annual, ~$500–$3k),
answer the questionnaire from the app's real architecture:

- **Data storage:** none server-side. Tokens + a sender cache live only in `chrome.storage.local`.
- **Data transmission:** Gmail data goes only between the user's browser and Google's own APIs.
- **Servers handling restricted data:** none — there is no developer backend.

Because no restricted-scope data is transmitted to or accessible from a developer-controlled server,
you can request that the security assessment requirement not apply. Be prepared, though: reviewers
may still require Tier 2 for any app using `gmail.modify`.
