import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleep, jitter, withRetry, chunk, runConcurrent } from '../../src/lib/throttle.js';

vi.useFakeTimers();

describe('sleep', () => {
  it('resolves after the specified delay', async () => {
    const p = sleep(500);
    vi.advanceTimersByTime(499);
    let done = false;
    void p.then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    vi.advanceTimersByTime(1);
    await p;
    expect(done).toBe(true);
  });
});

describe('jitter', () => {
  it('returns a number between 0 and maxMs', () => {
    for (let i = 0; i < 100; i++) {
      const j = jitter(500);
      expect(j).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThan(500);
    }
  });

  it('defaults to 1000ms max', () => {
    for (let i = 0; i < 50; i++) {
      expect(jitter()).toBeLessThan(1000);
    }
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useRealTimers(); // withRetry uses real sleep
  });
  afterEach(() => {
    vi.useFakeTimers();
  });

  it('returns immediately when the function succeeds on the first try', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { baseDelayMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxAttempts on failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('succeeds on a later attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');
    const result = await withRetry(fn, { maxAttempts: 5, baseDelayMs: 0 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error after exhausting retries', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('error A'))
      .mockRejectedValue(new Error('error B'));
    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 0 })).rejects.toThrow('error B');
  });
});

describe('chunk', () => {
  it('splits an array into chunks of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('handles an empty array', () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it('handles a chunk size larger than array', () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it('handles chunk size of 1', () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it('creates chunks of exactly BATCH_SIZE (20)', () => {
    const arr = Array.from({ length: 55 }, (_, i) => i);
    const chunks = chunk(arr, 20);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(20);
    expect(chunks[1]).toHaveLength(20);
    expect(chunks[2]).toHaveLength(15);
  });
});

describe('runConcurrent', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.useFakeTimers());

  it('runs all tasks and returns results', async () => {
    const tasks = [1, 2, 3].map((n) => async () => n * 2);
    const results = await runConcurrent(tasks, 2);
    expect(results.sort()).toEqual([2, 4, 6]);
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;
    const tasks = Array.from({ length: 6 }, () => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((r) => setTimeout(r, 5));
      active--;
      return active;
    });
    await runConcurrent(tasks, 3);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('handles empty task list', async () => {
    const results = await runConcurrent([], 5);
    expect(results).toEqual([]);
  });
});
