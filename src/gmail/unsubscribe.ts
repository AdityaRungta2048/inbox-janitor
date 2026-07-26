import { gmailGet } from './client.js';
import { parseUnsubscribeHeader } from '../graph/unsubscribe.js';
import type { UnsubscribeHeader } from '../lib/types.js';

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessageDetail {
  payload?: {
    headers?: GmailHeader[];
  };
}

export async function getGmailUnsubscribeHeader(
  messageId: string,
): Promise<UnsubscribeHeader | null> {
  try {
    const msg = await gmailGet<GmailMessageDetail>(
      `/users/me/messages/${messageId}?format=metadata&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`,
    );
    const headers = msg.payload?.headers ?? [];
    const unsub = headers.find((h) => h.name.toLowerCase() === 'list-unsubscribe');
    const post = headers.find((h) => h.name.toLowerCase() === 'list-unsubscribe-post');

    if (!unsub?.value) return null;
    return parseUnsubscribeHeader(unsub.value, post?.value);
  } catch {
    return null;
  }
}
