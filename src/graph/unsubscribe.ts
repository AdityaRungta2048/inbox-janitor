import { graphGet, graphGetRaw, graphFetch } from './client.js';
import type { UnsubscribeHeader, UnsubscribeResult, GraphMessage } from '../lib/types.js';

// Parse List-Unsubscribe header value into structured form.
// RFC 2369 format: <https://url>, <mailto:addr?subject=...>
export function parseUnsubscribeHeader(
  headerValue: string,
  postHeader?: string,
): UnsubscribeHeader {
  const uris = [...headerValue.matchAll(/<([^>]+)>/g)].map((m) => m[1] ?? '');

  let httpsUrl: string | null = null;
  let mailtoUrl: string | null = null;

  for (const uri of uris) {
    if (uri.startsWith('https://') || uri.startsWith('http://')) {
      httpsUrl ??= uri;
    } else if (uri.startsWith('mailto:')) {
      mailtoUrl ??= uri;
    }
  }

  const isOneClick = (postHeader ?? '').toLowerCase().includes('list-unsubscribe=one-click');

  return { httpsUrl, mailtoUrl, isOneClick };
}

async function getUnsubscribeHeaderFromMessageHeaders(
  messageId: string,
): Promise<UnsubscribeHeader | null> {
  try {
    const msg = await graphGet<GraphMessage>(
      `/me/messages/${messageId}?$select=internetMessageHeaders`,
    );
    const headers = msg.internetMessageHeaders ?? [];
    const unsub = headers.find((h) => h.name.toLowerCase() === 'list-unsubscribe');
    const post = headers.find((h) => h.name.toLowerCase() === 'list-unsubscribe-post');

    if (!unsub?.value) return null;
    return parseUnsubscribeHeader(unsub.value, post?.value);
  } catch {
    return null;
  }
}

async function getUnsubscribeHeaderFromRawMime(
  messageId: string,
): Promise<UnsubscribeHeader | null> {
  try {
    const raw = await graphGetRaw(`/me/messages/${messageId}/$value`);

    // Extract headers (everything before the first blank line)
    const headerSection = raw.split(/\r?\n\r?\n/)[0] ?? '';

    // Unfold RFC 2822 header continuations (lines starting with whitespace)
    const unfolded = headerSection.replace(/\r?\n([ \t])/g, ' ');

    let unsubValue: string | null = null;
    let postValue: string | null = null;

    for (const line of unfolded.split(/\r?\n/)) {
      const lower = line.toLowerCase();
      if (lower.startsWith('list-unsubscribe-post:')) {
        postValue = line.slice(line.indexOf(':') + 1).trim();
      } else if (lower.startsWith('list-unsubscribe:')) {
        unsubValue = line.slice(line.indexOf(':') + 1).trim();
      }
    }

    if (!unsubValue) return null;
    return parseUnsubscribeHeader(unsubValue, postValue ?? undefined);
  } catch {
    return null;
  }
}

export async function getUnsubscribeHeader(messageId: string): Promise<UnsubscribeHeader | null> {
  // Try internetMessageHeaders first (faster, no full body download)
  const fromHeaders = await getUnsubscribeHeaderFromMessageHeaders(messageId);
  if (fromHeaders) return fromHeaders;

  // Fallback: fetch raw MIME and parse
  return getUnsubscribeHeaderFromRawMime(messageId);
}

export async function executeUnsubscribe(
  header: UnsubscribeHeader,
  sendMailEnabled: boolean,
): Promise<UnsubscribeResult & { email: string }> {
  // Placeholder — email is set by caller; this returns partial result
  const base = { email: '' };

  // Path 1: One-click HTTPS POST — cleanest, fully automatic
  if (header.isOneClick && header.httpsUrl) {
    try {
      const res = await fetch(header.httpsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      });
      if (res.ok) {
        return { ...base, status: 'done', message: 'One-click unsubscribe sent.' };
      }
      // If server returns error, fall through to next path
    } catch {
      // Network error — fall through
    }
  }

  // Path 2: mailto: unsubscribe via Graph Mail.Send (if enabled)
  if (header.mailtoUrl && sendMailEnabled) {
    try {
      const url = new URL(header.mailtoUrl);
      const to = url.pathname;
      const subject = url.searchParams.get('subject') ?? 'Unsubscribe';
      const body = url.searchParams.get('body') ?? '';

      const message = {
        message: {
          subject,
          body: { contentType: 'Text', content: body || 'Unsubscribe' },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      };

      const res = await graphFetch('/me/sendMail', {
        method: 'POST',
        body: JSON.stringify(message),
      });

      if (res.ok) {
        return { ...base, status: 'done', message: 'Unsubscribe email sent.' };
      }
    } catch {
      // Fall through
    }
  }

  // Path 3: Plain HTTPS link — open in tab for user
  if (header.httpsUrl) {
    await chrome.tabs.create({ url: header.httpsUrl, active: false });
    return {
      ...base,
      status: 'opened_in_tab',
      message: 'Unsubscribe page opened in a new tab. Complete it there.',
    };
  }

  // Path 4: mailto: only, Mail.Send disabled — open prefilled mailto
  if (header.mailtoUrl) {
    await chrome.tabs.create({ url: header.mailtoUrl, active: false });
    return {
      ...base,
      status: 'needs_manual',
      message: 'Opened your email client to send the unsubscribe request.',
    };
  }

  return { ...base, status: 'no_header', message: 'No unsubscribe link found.' };
}
