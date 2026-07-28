// Azure AD Application (client) ID (public OAuth 2.0 + PKCE client — not a secret; ships in the
// See README.md → [HUMAN SETUP] section for registration steps.
export const MS_CLIENT_ID: string =
  (import.meta.env.VITE_MS_CLIENT_ID as string | undefined) ??
  'b32dffaf-d698-4ebc-815a-516cbefb4c7e';

// 'common' supports both personal Microsoft accounts (Outlook.com/Live/Hotmail)
// and Microsoft 365 work/school accounts in any tenant.
export const MS_TENANT: string = (import.meta.env.VITE_MS_TENANT as string | undefined) ?? 'common';

export const MS_AUTHORITY = `https://login.microsoftonline.com/${MS_TENANT}`;

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Feature flag: Gmail / Google sign-in.
// OFF for the Outlook-only v1.0 public launch — Gmail's `gmail.modify` is a Google
// restricted scope and cannot serve the public until Google verification is approved.
// Flip to `true` for v1.1 once verified; full re-enable steps in docs/ENABLE_GMAIL_V1.1.md.
export const GMAIL_ENABLED = true;

// Core scopes — requested at sign-in. Mail.Send is incremental (requested on demand).
export const CORE_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Mail.ReadWrite',
];

// Google / Gmail sign-in uses chrome.identity.getAuthToken (see src/auth/googleAuth.ts).
// The OAuth client ID is declared in manifest.json under "oauth2" — there is NO client
// secret and none is bundled. These scopes must match manifest.json "oauth2.scopes".
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
];

// Max messages per Graph page fetch
export const PAGE_SIZE = 100;

// Batch API limits
export const BATCH_SIZE = 20;
export const MAX_CONCURRENT_BATCHES = 4;

// Sender-group cache TTL (ms): 30 minutes
export const CACHE_TTL_MS = 30 * 60 * 1000;
