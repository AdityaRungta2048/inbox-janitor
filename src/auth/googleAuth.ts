import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '../config.js';
import { storage } from '../lib/storage.js';
import type { AuthTokens } from '../lib/types.js';
import { generateState } from './pkce.js';

// Google sign-in uses chrome.identity.launchWebAuthFlow with the OAuth 2.0
// implicit flow (response_type=token). The access token comes back directly in
// the redirect URL fragment, so there is NO token-endpoint call and NO client
// secret to bundle. launchWebAuthFlow opens Google's real sign-in page, so the
// user picks which Google account to use (prompt=select_account).
//
// Implicit tokens are short-lived and have no refresh token; getValidGoogleToken
// silently re-runs the flow (prompt=none) when the token expires and falls back
// to interactive sign-in if the silent attempt fails.

const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const REVOKE_ENDPOINT = 'https://accounts.google.com/o/oauth2/revoke';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

function buildAuthUrl(state: string, interactive: boolean): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: 'token',
    redirect_uri: REDIRECT_URI,
    scope: GOOGLE_SCOPES.join(' '),
    state,
    include_granted_scopes: 'true',
    // Interactive sign-in shows the account chooser; silent renewal shows nothing.
    prompt: interactive ? 'select_account' : 'none',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

function parseFragment(
  url: string,
): { accessToken: string; expiresIn: number; state: string } | null {
  try {
    const params = new URLSearchParams(new URL(url).hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    if (!accessToken) return null;
    return {
      accessToken,
      expiresIn: parseInt(params.get('expires_in') ?? '3600', 10),
      state: params.get('state') ?? '',
    };
  } catch {
    return null;
  }
}

// Until Google finishes reviewing the Gmail permission, only test users get
// through. Everyone else sees Google's "Access blocked" page and closes it, which
// reaches us as "The user did not approve access." Say what probably happened.
const GOOGLE_STOPPED =
  'Gmail sign-in did not finish. If Google said "Access blocked" or "app not verified", ' +
  "Gmail access is still waiting for Google's review. Outlook, Hotmail and Live accounts work now.";

function launchFlow(url: string, interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive }, (responseUrl) => {
      const message = chrome.runtime.lastError?.message;
      if (!message && responseUrl && !/[#&]error=access_denied/.test(responseUrl)) {
        resolve(responseUrl);
        return;
      }
      const stopped = !message || /did not approve/i.test(message);
      reject(
        new Error(
          interactive && stopped ? GOOGLE_STOPPED : (message ?? 'Google sign-in was cancelled'),
        ),
      );
    });
  });
}

async function runFlow(interactive: boolean): Promise<{ accessToken: string; expiresAt: number }> {
  const state = generateState();
  const responseUrl = await launchFlow(buildAuthUrl(state, interactive), interactive);
  const parsed = parseFragment(responseUrl);
  if (!parsed) throw new Error('No access token returned from Google');
  if (parsed.state !== state) throw new Error('State mismatch — possible CSRF');
  return {
    accessToken: parsed.accessToken,
    expiresAt: Date.now() + parsed.expiresIn * 1000 - 60_000,
  };
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
  const { accessToken, expiresAt } = await runFlow(true);
  const profile = await fetchGoogleUserProfile(accessToken);

  const tokens: AuthTokens = {
    provider: 'google',
    accessToken,
    refreshToken: '', // implicit flow issues no refresh token
    expiresAt,
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

  if (Date.now() < tokens.expiresAt) return tokens.accessToken;

  // Expired — try a silent renewal; fall back to a fresh sign-in if it fails.
  try {
    const { accessToken, expiresAt } = await runFlow(false);
    await storage.setTokens({ ...tokens, accessToken, expiresAt });
    return accessToken;
  } catch {
    await storage.clearAll();
    throw new Error('Session expired — please sign in again');
  }
}

export async function clearGoogleToken(token: string): Promise<void> {
  // Revoke at Google so the next sign-in re-prompts the account chooser.
  try {
    if (token) {
      await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: 'POST' });
    }
  } catch {
    // Non-fatal — proceed with local sign-out regardless.
  }
}
