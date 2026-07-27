import { GOOGLE_SCOPES } from '../config.js';
import { storage } from '../lib/storage.js';
import type { AuthTokens } from '../lib/types.js';

// Google sign-in uses chrome.identity.getAuthToken rather than a manual
// launchWebAuthFlow + PKCE exchange. Google requires a client_secret to
// exchange an auth code for a refresh token (PKCE cannot substitute for it),
// and a distributed extension cannot hold a secret safely. getAuthToken avoids
// the secret entirely: Chrome performs the OAuth flow, caches the access token,
// and refreshes it internally. The client_id and scopes are declared in
// manifest.json under the "oauth2" key (mirrored by GOOGLE_SCOPES here).
//
// Trade-off: getAuthToken only authorizes the Google account the user is signed
// into Chrome with — there is no arbitrary-account picker — and it is
// Chrome-only. See DECISIONS.md → D10.

const REVOKE_ENDPOINT = 'https://accounts.google.com/o/oauth2/revoke';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * Request an OAuth access token from Chrome. `interactive: true` shows the
 * account/consent UI; `interactive: false` returns a cached or silently
 * refreshed token and rejects if the user has not signed in.
 */
function requestToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive, scopes: GOOGLE_SCOPES }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message ?? 'Google sign-in failed'));
      } else if (!token) {
        reject(new Error('Google sign-in returned no token'));
      } else {
        resolve(token);
      }
    });
  });
}

function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

async function fetchGoogleUserProfile(
  accessToken: string,
): Promise<{ id: string; email: string; name: string }> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`);
  const data = (await res.json()) as { sub: string; email: string; name: string };
  return { id: data.sub, email: data.email, name: data.name };
}

export async function googleSignIn(): Promise<AuthTokens> {
  const accessToken = await requestToken(true);
  const profile = await fetchGoogleUserProfile(accessToken);

  const tokens: AuthTokens = {
    provider: 'google',
    accessToken,
    refreshToken: '', // Chrome owns the refresh token for getAuthToken flows
    expiresAt: 0, // unused for Google — getValidGoogleToken always re-requests via getAuthToken
    userId: profile.id,
    userEmail: profile.email,
    userName: profile.name,
  };

  await storage.setTokens(tokens);
  return tokens;
}

export async function getValidGoogleToken(): Promise<string> {
  const tokens = await storage.getTokens();
  if (!tokens || tokens.provider !== 'google') throw new Error('Not signed in with Google');

  // Chrome returns a cached token or silently refreshes it. A rejection here
  // means the grant is gone (revoked/expired) — force a fresh sign-in.
  try {
    return await requestToken(false);
  } catch {
    await storage.clearAll();
    throw new Error('Session expired — please sign in again');
  }
}

export async function clearGoogleToken(token: string): Promise<void> {
  // Clear both the token captured at sign-in and whatever Chrome currently has
  // cached (it may have refreshed since), then revoke so re-sign-in shows the
  // account picker. All steps are best-effort — never block local sign-out.
  const tokensToClear = new Set<string>();
  if (token) tokensToClear.add(token);
  const current = await requestToken(false).catch(() => null);
  if (current) tokensToClear.add(current);

  for (const t of tokensToClear) {
    await removeCachedToken(t);
    try {
      await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(t)}`, { method: 'POST' });
    } catch {
      // Non-fatal — proceed with local sign-out regardless.
    }
  }
}
