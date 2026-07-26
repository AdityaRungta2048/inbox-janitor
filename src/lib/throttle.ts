export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function jitter(maxMs = 1000): number {
  return Math.random() * maxMs;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const { maxAttempts = 5, baseDelayMs = 1000 } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) + jitter();
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  const queue = [...tasks];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) {
        results.push(await task());
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
