import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('chrome', {
  storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
  runtime: { id: 'test-ext', lastError: null },
  tabs: { create: vi.fn().mockResolvedValue({}) },
});

vi.mock('../../src/auth/msAuth.js', () => ({
  getValidToken: vi.fn().mockResolvedValue('fake-token'),
}));

import {
  parseUnsubscribeHeader,
  getUnsubscribeHeader,
  executeUnsubscribe,
} from '../../src/graph/unsubscribe.js';
import type { UnsubscribeHeader } from '../../src/lib/types.js';

describe('parseUnsubscribeHeader', () => {
  it('parses one-click HTTPS URL', () => {
    const result = parseUnsubscribeHeader(
      '<https://unsubscribe.example.com/one-click>',
      'List-Unsubscribe=One-Click',
    );
    expect(result.httpsUrl).toBe('https://unsubscribe.example.com/one-click');
    expect(result.mailtoUrl).toBeNull();
    expect(result.isOneClick).toBe(true);
  });

  it('parses mailto: URL', () => {
    const result = parseUnsubscribeHeader('<mailto:unsub@example.com?subject=Unsubscribe>');
    expect(result.mailtoUrl).toBe('mailto:unsub@example.com?subject=Unsubscribe');
    expect(result.httpsUrl).toBeNull();
    expect(result.isOneClick).toBe(false);
  });

  it('parses both HTTPS and mailto: in a combined header', () => {
    const result = parseUnsubscribeHeader(
      '<https://example.com/unsub>, <mailto:unsub@example.com>',
    );
    expect(result.httpsUrl).toBe('https://example.com/unsub');
    expect(result.mailtoUrl).toBe('mailto:unsub@example.com');
  });

  it('detects one-click from List-Unsubscribe-Post header (case-insensitive)', () => {
    const result = parseUnsubscribeHeader(
      '<https://example.com/unsub>',
      'list-unsubscribe=one-click',
    );
    expect(result.isOneClick).toBe(true);
  });

  it('returns all nulls for a malformed/empty header value', () => {
    const result = parseUnsubscribeHeader('');
    expect(result.httpsUrl).toBeNull();
    expect(result.mailtoUrl).toBeNull();
    expect(result.isOneClick).toBe(false);
  });

  it('ignores http:// URL and uses it as httpsUrl (fallback open-in-tab)', () => {
    // http:// is technically valid in some headers; we store it as httpsUrl
    const result = parseUnsubscribeHeader('<http://example.com/unsub>');
    expect(result.httpsUrl).toBe('http://example.com/unsub');
  });

  it('handles malformed angle-bracket-less URLs gracefully', () => {
    const result = parseUnsubscribeHeader('https://example.com/unsub');
    // Without angle brackets the regex won't match — all null
    expect(result.httpsUrl).toBeNull();
    expect(result.mailtoUrl).toBeNull();
  });

  it('picks up the FIRST https URL when multiple are present', () => {
    const result = parseUnsubscribeHeader('<https://first.com/unsub>, <https://second.com/unsub>');
    expect(result.httpsUrl).toBe('https://first.com/unsub');
  });
});

describe('executeUnsubscribe — routing decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs one-click POST and returns done on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 200 }));

    const header: UnsubscribeHeader = {
      httpsUrl: 'https://example.com/unsub',
      mailtoUrl: null,
      isOneClick: true,
    };
    const result = await executeUnsubscribe(header, false);
    expect(result.status).toBe('done');
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/unsub',
      expect.objectContaining({
        method: 'POST',
        body: 'List-Unsubscribe=One-Click',
      }),
    );
  });

  it('falls through from one-click to open-in-tab when POST fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }));

    const header: UnsubscribeHeader = {
      httpsUrl: 'https://example.com/unsub',
      mailtoUrl: null,
      isOneClick: true,
    };
    const result = await executeUnsubscribe(header, false);
    expect(result.status).toBe('opened_in_tab');
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com/unsub',
      active: false,
    });
  });

  it('opens tab for plain HTTPS URL (not one-click)', async () => {
    const header: UnsubscribeHeader = {
      httpsUrl: 'https://example.com/unsub',
      mailtoUrl: null,
      isOneClick: false,
    };
    const result = await executeUnsubscribe(header, false);
    expect(result.status).toBe('opened_in_tab');
  });

  it('sends via Graph Mail.Send for mailto: when enabled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 202 }));

    const header: UnsubscribeHeader = {
      httpsUrl: null,
      mailtoUrl: 'mailto:unsub@newsletter.com?subject=Unsubscribe&body=Please+remove+me',
      isOneClick: false,
    };
    const result = await executeUnsubscribe(header, true); // sendMailEnabled = true
    expect(result.status).toBe('done');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/me/sendMail'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('opens mailto: link as fallback when Mail.Send disabled', async () => {
    const header: UnsubscribeHeader = {
      httpsUrl: null,
      mailtoUrl: 'mailto:unsub@newsletter.com',
      isOneClick: false,
    };
    const result = await executeUnsubscribe(header, false);
    expect(result.status).toBe('needs_manual');
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'mailto:unsub@newsletter.com',
      active: false,
    });
  });

  it('returns no_header when header is null', async () => {
    // getUnsubscribeHeader returns null → caller passes null
    // We test executeUnsubscribe with an empty header (no URLs)
    const header: UnsubscribeHeader = {
      httpsUrl: null,
      mailtoUrl: null,
      isOneClick: false,
    };
    const result = await executeUnsubscribe(header, false);
    expect(result.status).toBe('no_header');
  });

  it('falls through one-click network error to open-in-tab', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const header: UnsubscribeHeader = {
      httpsUrl: 'https://example.com/unsub',
      mailtoUrl: null,
      isOneClick: true,
    };
    const result = await executeUnsubscribe(header, false);
    // After network error on POST, falls through to open-in-tab
    expect(result.status).toBe('opened_in_tab');
  });
});

describe('getUnsubscribeHeader — raw MIME fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns header from internetMessageHeaders when present', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          internetMessageHeaders: [
            { name: 'List-Unsubscribe', value: '<https://example.com/unsub>' },
            { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await getUnsubscribeHeader('msg-123');
    expect(result?.httpsUrl).toBe('https://example.com/unsub');
    expect(result?.isOneClick).toBe(true);
  });

  it('falls back to raw MIME when internetMessageHeaders has no List-Unsubscribe', async () => {
    // First call: message with headers but no List-Unsubscribe
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ internetMessageHeaders: [{ name: 'Subject', value: 'Hi' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // Second call: raw MIME
      .mockResolvedValueOnce(
        new Response(
          [
            'MIME-Version: 1.0',
            'List-Unsubscribe: <https://example.com/unsub>',
            'Subject: Newsletter',
            '',
            'Body here',
          ].join('\r\n'),
          { status: 200, headers: { 'Content-Type': 'text/plain' } },
        ),
      );

    const result = await getUnsubscribeHeader('msg-456');
    expect(result?.httpsUrl).toBe('https://example.com/unsub');
  });

  it('returns null when neither headers nor raw MIME have List-Unsubscribe', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ internetMessageHeaders: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('Subject: Hi\r\n\r\nBody', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
      );

    const result = await getUnsubscribeHeader('msg-789');
    expect(result).toBeNull();
  });

  it('handles folded List-Unsubscribe header in raw MIME', async () => {
    const mime = [
      'MIME-Version: 1.0',
      'List-Unsubscribe: <https://example.com/unsub>,',
      '\t<mailto:unsub@example.com>',
      'Subject: Newsletter',
      '',
      'Body',
    ].join('\r\n');

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ internetMessageHeaders: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(mime, { status: 200, headers: { 'Content-Type': 'text/plain' } }),
      );

    const result = await getUnsubscribeHeader('msg-folded');
    expect(result?.httpsUrl).toBe('https://example.com/unsub');
    expect(result?.mailtoUrl).toBe('mailto:unsub@example.com');
  });
});
