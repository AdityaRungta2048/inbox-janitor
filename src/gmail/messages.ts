import { gmailGet, gmailPost } from './client.js';
import { storage } from '../lib/storage.js';
import { chunk, runConcurrent } from '../lib/throttle.js';
import { MAX_CONCURRENT_BATCHES } from '../config.js';
import type { SenderGroup, SenderCache } from '../lib/types.js';

const GMAIL_MAX_MESSAGES = 500;
const GMAIL_PAGE_SIZE = 500;
const GMAIL_META_BATCH = 20;
const GMAIL_MODIFY_CHUNK = 1000;

interface GmailListResponse {
  messages?: Array<{ id: string }>;
  nextPageToken?: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessageDetail {
  id: string;
  payload?: {
    headers?: GmailHeader[];
  };
}

function parseFromHeader(from: string): { name: string; email: string } {
  const match = /^(.*?)\s*<([^>]+)>$/.exec(from);
  if (match) {
    const rawName = (match[1] ?? '').replace(/^["']|["']$/g, '').trim();
    return { name: rawName || (match[2] ?? from), email: (match[2] ?? from).toLowerCase() };
  }
  return { name: from, email: from.toLowerCase() };
}

export type GmailProgressCallback = (fetched: number) => void;

export async function fetchGmailSenderGroups(
  onProgress?: GmailProgressCallback,
  signal?: AbortSignal,
): Promise<SenderCache> {
  // Phase 1: collect message IDs
  const messageIds: string[] = [];
  let pageToken: string | undefined;

  while (messageIds.length < GMAIL_MAX_MESSAGES) {
    if (signal?.aborted) break;

    const params = new URLSearchParams({
      maxResults: String(GMAIL_PAGE_SIZE),
      fields: 'messages(id),nextPageToken',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const page: GmailListResponse = await gmailGet(`/users/me/messages?${params.toString()}`);

    for (const m of page.messages ?? []) {
      messageIds.push(m.id);
      if (messageIds.length >= GMAIL_MAX_MESSAGES) break;
    }

    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }

  // Phase 2: fetch metadata in parallel batches
  const groups = new Map<
    string,
    { name: string; count: number; latestDate: string; representativeMessageId: string }
  >();

  const batches = chunk(messageIds, GMAIL_META_BATCH);
  let fetched = 0;

  const tasks = batches.map((batch) => async () => {
    if (signal?.aborted) return;

    const results = await Promise.allSettled(
      batch.map((id) =>
        gmailGet<GmailMessageDetail>(
          `/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Date`,
        ),
      ),
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const msg = result.value;
      const headers = msg.payload?.headers ?? [];

      const fromHeader = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
      const dateHeader = headers.find((h) => h.name.toLowerCase() === 'date')?.value ?? '';

      if (!fromHeader) continue;

      const { name, email } = parseFromHeader(fromHeader);
      if (!email) continue;

      let isoDate = '';
      try {
        isoDate = new Date(dateHeader).toISOString();
      } catch {
        isoDate = '';
      }

      const existing = groups.get(email);
      if (!existing) {
        groups.set(email, { name, count: 1, latestDate: isoDate, representativeMessageId: msg.id });
      } else {
        existing.count++;
        if (isoDate > existing.latestDate) {
          existing.latestDate = isoDate;
          existing.representativeMessageId = msg.id;
        }
      }
    }

    fetched += batch.length;
    onProgress?.(fetched);
  });

  await runConcurrent(tasks, MAX_CONCURRENT_BATCHES);

  const senderGroups: SenderGroup[] = Array.from(groups.entries()).map(([email, data]) => ({
    email,
    name: data.name,
    count: data.count,
    latestDate: data.latestDate,
    representativeMessageId: data.representativeMessageId,
  }));

  senderGroups.sort((a, b) => b.count - a.count);

  const cache: SenderCache = {
    provider: 'google',
    groups: senderGroups,
    fetchedAt: Date.now(),
    totalFetched: messageIds.length,
    isPartial: messageIds.length >= GMAIL_MAX_MESSAGES,
  };

  await storage.setCache(cache);
  return cache;
}

export async function getGmailMessageIdsBySender(senderEmail: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `from:${senderEmail}`,
      maxResults: '500',
      fields: 'messages(id),nextPageToken',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const page: GmailListResponse = await gmailGet(`/users/me/messages?${params.toString()}`);
    for (const m of page.messages ?? []) ids.push(m.id);

    pageToken = page.nextPageToken;
  } while (pageToken);

  return ids;
}

export async function archiveGmailMessages(
  messageIds: string[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted || messageIds.length === 0) return;

  const chunks = chunk(messageIds, GMAIL_MODIFY_CHUNK);
  let done = 0;

  for (const ch of chunks) {
    if (signal?.aborted) break;
    await gmailPost('/users/me/messages/batchModify', {
      ids: ch,
      removeLabelIds: ['INBOX'],
    });
    done += ch.length;
    onProgress?.(done, messageIds.length);
  }
}

export async function trashGmailMessages(
  messageIds: string[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted || messageIds.length === 0) return;

  const chunks = chunk(messageIds, GMAIL_MODIFY_CHUNK);
  let done = 0;

  for (const ch of chunks) {
    if (signal?.aborted) break;
    await gmailPost('/users/me/messages/batchModify', {
      ids: ch,
      addLabelIds: ['TRASH'],
      removeLabelIds: ['INBOX'],
    });
    done += ch.length;
    onProgress?.(done, messageIds.length);
  }
}
