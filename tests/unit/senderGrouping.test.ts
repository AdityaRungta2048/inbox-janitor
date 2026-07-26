import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome and storage
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn((_key: string, cb: (r: Record<string, unknown>) => void) => cb({})),
      set: vi.fn((_obj: Record<string, unknown>, cb?: () => void) => cb?.()),
      remove: vi.fn((_key: string, cb?: () => void) => cb?.()),
    },
  },
  runtime: { id: 'test-extension-id', lastError: null },
});

vi.mock('../../src/auth/msAuth.js', () => ({
  getValidToken: vi.fn().mockResolvedValue('fake-token'),
}));

import { fetchSenderGroups } from '../../src/graph/messages.js';

function makeMessage(id: string, email: string, name: string, date: string) {
  return {
    id,
    from: { emailAddress: { address: email, name } },
    receivedDateTime: date,
  };
}

describe('sender grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups messages by sender email (case-insensitive)', async () => {
    const messages = [
      makeMessage('1', 'Newsletter@Example.com', 'Newsletter', '2024-01-03T10:00:00Z'),
      makeMessage('2', 'newsletter@example.com', 'Newsletter', '2024-01-02T10:00:00Z'),
      makeMessage('3', 'other@example.com', 'Other', '2024-01-01T10:00:00Z'),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ value: messages }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const cache = await fetchSenderGroups();
    const newsletter = cache.groups.find((g) => g.email === 'newsletter@example.com');
    expect(newsletter).toBeDefined();
    expect(newsletter?.count).toBe(2);
  });

  it('tracks the latest message date per sender', async () => {
    const messages = [
      makeMessage('1', 'a@b.com', 'A', '2024-01-01T10:00:00Z'),
      makeMessage('2', 'a@b.com', 'A', '2024-01-03T10:00:00Z'),
      makeMessage('3', 'a@b.com', 'A', '2024-01-02T10:00:00Z'),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ value: messages }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const cache = await fetchSenderGroups();
    const sender = cache.groups.find((g) => g.email === 'a@b.com');
    expect(sender?.latestDate).toBe('2024-01-03T10:00:00Z');
    // representativeMessageId should be the most recent
    expect(sender?.representativeMessageId).toBe('2');
  });

  it('sorts by count descending by default', async () => {
    const messages = [
      makeMessage('1', 'rare@x.com', 'Rare', '2024-01-01T00:00:00Z'),
      makeMessage('2', 'frequent@x.com', 'Frequent', '2024-01-01T00:00:00Z'),
      makeMessage('3', 'frequent@x.com', 'Frequent', '2024-01-02T00:00:00Z'),
      makeMessage('4', 'frequent@x.com', 'Frequent', '2024-01-03T00:00:00Z'),
      makeMessage('5', 'medium@x.com', 'Medium', '2024-01-01T00:00:00Z'),
      makeMessage('6', 'medium@x.com', 'Medium', '2024-01-02T00:00:00Z'),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ value: messages }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const cache = await fetchSenderGroups();
    const counts = cache.groups.map((g) => g.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('skips messages with no sender email', async () => {
    const messages = [
      { id: '1', from: { emailAddress: {} }, receivedDateTime: '2024-01-01T00:00:00Z' },
      { id: '2', receivedDateTime: '2024-01-01T00:00:00Z' },
      makeMessage('3', 'real@sender.com', 'Real', '2024-01-01T00:00:00Z'),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ value: messages }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const cache = await fetchSenderGroups();
    expect(cache.groups).toHaveLength(1);
    expect(cache.groups[0]?.email).toBe('real@sender.com');
  });

  it('follows @odata.nextLink for pagination', async () => {
    const page1 = {
      value: [makeMessage('1', 'a@b.com', 'A', '2024-01-01T00:00:00Z')],
      '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/messages?$top=100&$skip=100',
    };
    const page2 = {
      value: [makeMessage('2', 'a@b.com', 'A', '2024-01-02T00:00:00Z')],
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page1), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const cache = await fetchSenderGroups();
    expect(cache.totalFetched).toBe(2);
    expect(cache.groups[0]?.count).toBe(2);
  });

  it('marks cache as partial when 2000 message limit is hit', async () => {
    // Return 2000 messages in one page (to trigger the limit)
    const messages = Array.from({ length: 2000 }, (_, i) =>
      makeMessage(String(i), `s${i % 50}@x.com`, `Sender${i % 50}`, '2024-01-01T00:00:00Z'),
    );
    const page = {
      value: messages,
      '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/messages?$skip=2000',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(page), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const cache = await fetchSenderGroups();
    expect(cache.isPartial).toBe(true);
    expect(cache.totalFetched).toBe(2000);
  });

  it('stores result in chrome.storage.local', async () => {
    const setCalled: unknown[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.storage.local.set as any).mockImplementation((obj: unknown, cb?: () => void) => {
      setCalled.push(obj);
      cb?.();
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ value: [makeMessage('1', 'a@b.com', 'A', '2024-01-01T00:00:00Z')] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await fetchSenderGroups();
    expect(setCalled.length).toBeGreaterThan(0);
  });
});
