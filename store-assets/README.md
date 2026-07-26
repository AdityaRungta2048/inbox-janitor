# Chrome Web Store Assets

Ready-to-upload listing assets for Inbox Janitor.

| File | Size | Where it goes in the Developer Dashboard |
|---|---|---|
| `01-signed-out.png` | 1280×800 | Screenshot 1 |
| `02-sender-list.png` | 1280×800 | Screenshot 2 |
| `03-select-and-act.png` | 1280×800 | Screenshot 3 |
| `04-safe-confirm.png` | 1280×800 | Screenshot 4 |
| `promo-small-440x280.png` | 440×280 | Small promo tile |
| `promo-marquee-1400x560.png` | 1400×560 | Marquee promo tile (optional, for featuring) |

## How these were made

The four screenshots are the **real extension UI** rendered from the built `dist/`, seeded with
**demo data** (generic sender names — no real brands), then composited onto a branded 1280×800
canvas. No real mailbox or account was used. Regenerate any time after a UI change with the
generator kept alongside the project (`gen-store-assets.mjs`), or replace them with real captures
from a live account if you prefer.

The demo sender list uses an Outlook account in the header; the signed-out screen shows both the
Microsoft and Google sign-in buttons. All copy matches `STORE_LISTING.md`.

> Note: these are marketing compositions. If you'd rather show literal, un-composited screenshots,
> capture the side panel directly against a throwaway account once your OAuth client IDs are set.
