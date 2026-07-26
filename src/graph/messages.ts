import { PAGE_SIZE } from '../config.js';
import { graphGet, graphBatch } from './client.js';
import { storage } from '../lib/storage.js';
import type {
  SenderGroup,
  SenderCache,
  GraphMessage,
  GraphListResponse,
  BatchResult,
} from '../lib/types.js';

export type ProgressCallback = (fetched: number, done: number, total: number) => void;

export async function fetchSenderGroups(
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<SenderCache> {
  const groups = new Map<
    string,
    { name: string; count: number; latestDate: string; representativeMessageId: string }
  >();

  let nextLink: string | undefined =
    `/me/messages?$select=id,from,receivedDateTime&$top=${PAGE_SIZE}&$orderby=receivedDateTime desc`;
  let totalFetched = 0;

  while (nextLink) {
    if (signal?.aborted) break;

    const path: string = nextLink.startsWith('https://')
      ? nextLink.replace(/.*\/v1\.0/, '')
      : nextLink;
    const page: GraphListResponse<GraphMessage> =
      await graphGet<GraphListResponse<GraphMessage>>(path);

    for (const msg of page.value) {
      const email = msg.from?.emailAddress?.address?.toLowerCase() ?? '';
      const name = msg.from?.emailAddress?.name ?? email;
      const date = msg.receivedDateTime ?? '';
      const id = msg.id ?? '';

      if (!email) continue;

      const existing = groups.get(email);
      if (!existing) {
        groups.set(email, { name, count: 1, latestDate: date, representativeMessageId: id });
      } else {
        existing.count++;
        if (date > existing.latestDate) {
          existing.latestDate = date;
          existing.representativeMessageId = id;
        }
      }
    }

    totalFetched += page.value.length;
    onProgress?.(totalFetched, 0, totalFetched);

    nextLink = page['@odata.nextLink'];

    // Stop at 2000 messages for perf; user can refresh for more
    if (totalFetched >= 2000) break;
  }

  const senderGroups: SenderGroup[] = Array.from(groups.entries()).map(([email, data]) => ({
    email,
    name: data.name,
    count: data.count,
    latestDate: data.latestDate,
    representativeMessageId: data.representativeMessageId,
  }));

  senderGroups.sort((a, b) => b.count - a.count);

  const cache: SenderCache = {
    provider: 'microsoft',
    groups: senderGroups,
    fetchedAt: Date.now(),
    totalFetched,
    isPartial: totalFetched >= 2000,
  };

  await storage.setCache(cache);
  return cache;
}

export async function getMessageIdsBySender(senderEmail: string): Promise<string[]> {
  const ids: string[] = [];
  let nextLink: string | undefined =
    `/me/messages?$select=id&$filter=from/emailAddress/address eq '${senderEmail}'&$top=${PAGE_SIZE}`;

  while (nextLink) {
    const path: string = nextLink.startsWith('https://')
      ? nextLink.replace(/.*\/v1\.0/, '')
      : nextLink;
    const page: GraphListResponse<GraphMessage> =
      await graphGet<GraphListResponse<GraphMessage>>(path);
    ids.push(...page.value.map((m) => m.id ?? '').filter(Boolean));
    nextLink = page['@odata.nextLink'];
  }

  return ids;
}

export async function deleteMessages(
  messageIds: string[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<BatchResult[]> {
  if (signal?.aborted) return [];

  const requests = messageIds.map((id, i) => ({
    id: String(i),
    method: 'DELETE',
    url: `/me/messages/${id}`,
  }));

  return graphBatch(requests, onProgress);
}

export async function archiveMessages(
  messageIds: string[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<BatchResult[]> {
  if (signal?.aborted) return [];

  const requests = messageIds.map((id, i) => ({
    id: String(i),
    method: 'POST',
    url: `/me/messages/${id}/move`,
    headers: { 'Content-Type': 'application/json' },
    body: { destinationId: 'archive' },
  }));

  return graphBatch(requests, onProgress);
}
