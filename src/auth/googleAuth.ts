import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_SCOPES } from '../config.js';
import { storage } from '../lib/storage.js';
import type { AuthTokens } from '../lib/types.js';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  parseCallbackUrl,
} from './pkce.js';

const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

function buildAuthUrl(codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: GOOGLE_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'select_account consent', // always show account picker + consent for refresh token
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

async function exchangeCode(code: string, verifier: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<GoogleTokenResponse>;
}

async function refreshGoogleTokens(refreshToken: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<GoogleTokenResponse>;
}

async function fetchGoogleUserProfile(
  accessToken: string,
): Promise<{ id: string; email: string; name: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`);
  const data = (await res.json()) as { sub: string; email: string; name: string };
  return { id: data.sub, email: data.email, name: data.name };
}

export async function googleSignIn(): Promise<AuthTokens> {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  const authUrl = buildAuthUrl(challenge, state);

  const redirectUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        reject(new Error(chrome.runtime.lastError?.message ?? 'Auth flow cancelled'));
      } else {
        resolve(responseUrl);
      }
    });
  });

  const parsed = parseCallbackUrl(redirectUrl);
  if (!parsed) throw new Error('Invalid callback URL from auth flow');
  if (parsed.state !== state) throw new Error('State mismatch — possible CSRF');

  const tokenData = await exchangeCode(parsed.code, verifier);

  if (!tokenData.scope?.includes('gmail.modify')) {
    throw new Error(
      'Gmail access was not granted. Please sign in again and tick the Gmail checkbox.',
    );
  }

  const profile = await fetchGoogleUserProfile(tokenData.access_token);

  const tokens: AuthTokens = {
    provider: 'google',
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? '',
    expiresAt: Date.now() + tokenData.expires_in * 1000 - 60_000,
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

  if (Date.now() < tokens.expiresAt) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    await storage.clearAll();
    throw new Error('Session expired — please sign in again');
  }

  const refreshed = await refreshGoogleTokens(tokens.refreshToken);
  const updated: AuthTokens = {
    ...tokens,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + refreshed.expires_in * 1000 - 60_000,
  };
  await storage.setTokens(updated);
  return updated.accessToken;
}

export async function clearGoogleToken(token: string): Promise<void> {
  // Revoke at Google so re-sign-in always shows account picker
  try {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: 'POST' });
  } catch {
    // Non-fatal — proceed with local sign-out regardless
  }
}
