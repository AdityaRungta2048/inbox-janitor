function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function generateCodeVerifier(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Promise.resolve(base64urlEncode(array.buffer));
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(hash);
}

export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64urlEncode(array.buffer);
}

export function parseCallbackUrl(url: string): { code: string; state: string } | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    const state = parsed.searchParams.get('state');
    if (!code || !state) return null;
    return { code, state };
  } catch {
    return null;
  }
}
