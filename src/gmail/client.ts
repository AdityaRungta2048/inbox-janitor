import { getValidGoogleToken } from '../auth/googleAuth.js';
import { sleep, jitter } from '../lib/throttle.js';

export const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1';

const MAX_RETRIES = 5;

export async function gmailFetch(
  path: string,
  options: RequestInit = {},
  attempt = 0,
): Promise<Response> {
  const token = await getValidGoogleToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${GMAIL_BASE}${path}`, { ...options, headers });

  if (res.status === 429 || res.status === 503) {
    if (attempt >= MAX_RETRIES) throw new Error(`Gmail throttled after ${MAX_RETRIES} retries`);
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '2', 10);
    await sleep(retryAfter * 1000 + jitter());
    return gmailFetch(path, options, attempt + 1);
  }

  return res;
}

export async function gmailGet<T>(path: string): Promise<T> {
  const res = await gmailFetch(path);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function gmailPost(path: string, body: unknown): Promise<Response> {
  const res = await gmailFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail POST ${path} failed (${res.status}): ${text}`);
  }
  return res;
}
