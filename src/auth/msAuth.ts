import { MS_CLIENT_ID, MS_AUTHORITY, CORE_SCOPES } from '../config.js';
import { storage } from '../lib/storage.js';
import type { AuthTokens } from '../lib/types.js';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  parseCallbackUrl,
} from './pkce.js';

const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;

const TOKEN_ENDPOINT = `${MS_AUTHORITY}/oauth2/v2.0/token`;

function buildAuthUrl(codeChallenge: string, state: string, scopes: string[]): string {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    response_mode: 'query',
    prompt: 'select_account',
  });
  return `${MS_AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}

async function exchangeCode(code: string, verifier: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    scope: CORE_SCOPES.join(' '),
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

  return res.json() as Promise<TokenResponse>;
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: CORE_SCOPES.join(' '),
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

  return res.json() as Promise<TokenResponse>;
}

async function fetchUserProfile(accessToken: string): Promise<{
  id: string;
  mail: string | null;
  userPrincipalName: string;
  displayName: string;
}> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`);
  return res.json() as Promise<{
    id: string;
    mail: string | null;
    userPrincipalName: string;
    displayName: string;
  }>;
}

export async function signIn(): Promise<AuthTokens> {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  const authUrl = buildAuthUrl(challenge, state, CORE_SCOPES);

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
  const profile = await fetchUserProfile(tokenData.access_token);

  const tokens: AuthTokens = {
    provider: 'microsoft',
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? '',
    expiresAt: Date.now() + tokenData.expires_in * 1000 - 60_000, // 1-min buffer
    userId: profile.id,
    userEmail: profile.mail ?? profile.userPrincipalName,
    userName: profile.displayName,
  };

  await storage.setTokens(tokens);
  return tokens;
}

export async function getValidToken(): Promise<string> {
  const tokens = await storage.getTokens();
  if (!tokens) throw new Error('Not signed in');

  if (Date.now() < tokens.expiresAt) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    await storage.clearTokens();
    throw new Error('Session expired — please sign in again');
  }

  const refreshed = await refreshTokens(tokens.refreshToken);
  const updated: AuthTokens = {
    ...tokens,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + refreshed.expires_in * 1000 - 60_000,
  };
  await storage.setTokens(updated);
  return updated.accessToken;
}

export async function signOut(): Promise<void> {
  await storage.clearAll();
}
