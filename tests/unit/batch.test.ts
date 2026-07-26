import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome global for tests
vi.stubGlobal('chrome', {
  storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
  runtime: { id: 'test-extension-id', lastError: null },
});

// Mock auth to return a fake token
vi.mock('../../src/auth/msAuth.js', () => ({
  getValidToken: vi.fn().mockResolvedValue('fake-token'),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { graphBatch } from '../../src/graph/client.js';

describe('graphBatch — $batch chunking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a single batch for 20 or fewer requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          responses: Array.from({ length: 5 }, (_, i) => ({ id: String(i), status: 204 })),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const requests = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      method: 'DELETE',
      url: `/me/messages/msg${i}`,
    }));

    await graphBatch(requests);
    // Should hit $batch exactly once
    expect(fetchSpy).toHaveBeenCalledOnce();
    const firstCallUrl = fetchSpy.mock.calls[0]?.[0];
    expect(String(firstCallUrl ?? '')).toContain('/$batch');
  });

  it('splits 45 requests into 3 batch calls (chunks of 20)', async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/$batch')) {
        callCount++;
        const callArgs = fetchSpy.mock.calls[callCount - 1];
        const body = JSON.parse((callArgs?.[1]?.body ?? '{}') as string) as {
          requests: { id: string }[];
        };
        return Promise.resolve(
          new Response(
            JSON.stringify({
              responses: body.requests.map((r) => ({ id: r.id, status: 204 })),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    const requests = Array.from({ length: 45 }, (_, i) => ({
      id: String(i),
      method: 'DELETE',
      url: `/me/messages/msg${i}`,
    }));

    const results = await graphBatch(requests);
    expect(callCount).toBe(3); // 20 + 20 + 5
    expect(results).toHaveLength(45);
  });

  it('calls onProgress callback correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          responses: Array.from({ length: 20 }, (_, i) => ({ id: String(i), status: 204 })),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const progressCalls: Array<[number, number]> = [];
    const requests = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      method: 'DELETE',
      url: `/me/messages/msg${i}`,
    }));

    await graphBatch(requests, (done, total) => {
      progressCalls.push([done, total]);
    });

    expect(progressCalls.length).toBeGreaterThan(0);
    const lastCall = progressCalls[progressCalls.length - 1] ?? [0, 0];
    const [lastDone, lastTotal] = lastCall;
    expect(lastDone).toBe(20);
    expect(lastTotal).toBe(20);
  });

  it('handles 429 throttling with Retry-After', async () => {
    let attempt = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '0' } }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ responses: [{ id: '0', status: 204 }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    // Patch sleep so test doesn't wait
    const sleepSpy = vi
      .spyOn(await import('../../src/lib/throttle.js'), 'sleep')
      .mockResolvedValue();

    const requests = [{ id: '0', method: 'DELETE', url: '/me/messages/m1' }];
    const results = await graphBatch(requests);
    expect(results).toHaveLength(1);
    expect(attempt).toBe(2);

    sleepSpy.mockRestore();
  });
});
