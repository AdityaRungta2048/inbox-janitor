import { GRAPH_BASE, BATCH_SIZE, MAX_CONCURRENT_BATCHES } from '../config.js';
import { getValidToken } from '../auth/msAuth.js';
import { sleep, jitter, chunk, runConcurrent } from '../lib/throttle.js';
import type { BatchResult } from '../lib/types.js';

const MAX_RETRIES = 5;

export async function graphFetch(
  path: string,
  options: RequestInit = {},
  attempt = 0,
): Promise<Response> {
  const token = await getValidToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${GRAPH_BASE}${path}`, { ...options, headers });

  if (res.status === 429 || res.status === 503) {
    if (attempt >= MAX_RETRIES) throw new Error(`Graph throttled after ${MAX_RETRIES} retries`);
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '2', 10);
    await sleep(retryAfter * 1000 + jitter());
    return graphFetch(path, options, attempt + 1);
  }

  return res;
}

export async function graphGet<T>(path: string): Promise<T> {
  const res = await graphFetch(path);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function graphGetRaw(path: string): Promise<string> {
  const res = await graphFetch(path, { headers: { Accept: 'text/plain' } });
  if (!res.ok) throw new Error(`Graph raw GET ${path} failed (${res.status})`);
  return res.text();
}

interface BatchRequest {
  id: string;
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface BatchResponse {
  responses: BatchResult[];
}

async function executeBatch(requests: BatchRequest[]): Promise<BatchResult[]> {
  const res = await graphFetch('/$batch', {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Batch failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as BatchResponse;
  return data.responses;
}

export async function graphBatch(
  requests: BatchRequest[],
  onProgress?: (done: number, total: number) => void,
): Promise<BatchResult[]> {
  const chunks = chunk(requests, BATCH_SIZE);
  const total = requests.length;
  let done = 0;
  const allResults: BatchResult[] = [];

  const tasks = chunks.map((ch) => async () => {
    const results = await executeBatch(ch);
    done += ch.length;
    onProgress?.(done, total);
    return results;
  });

  const chunkResults = await runConcurrent(tasks, MAX_CONCURRENT_BATCHES);
  for (const r of chunkResults) {
    allResults.push(...r);
  }

  return allResults;
}
