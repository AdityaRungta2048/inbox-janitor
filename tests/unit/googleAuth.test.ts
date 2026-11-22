import { describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, writable: true });

type FlowCallback = (responseUrl?: string) => void;
const launchWebAuthFlow = vi.fn();
const runtime: { id: string; lastError: { message: string } | null } = {
  id: 'test-ext',
  lastError: null,
};
vi.stubGlobal('chrome', {
  storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
  runtime,
  identity: { launchWebAuthFlow },
});

// Imported after the stub: the module reads chrome.runtime.id when it loads.
const { googleSignIn } = await import('../../src/auth/googleAuth.js');

// Until Google finishes reviewing the Gmail permission, people who are not test
// users get Google's "Access blocked" page. They close it, and Chrome reports
// "The user did not approve access." That must not be what they read.
describe('googleSignIn when Google stops the sign-in', () => {
  it('explains a closed sign-in window and points to Outlook', async () => {
    launchWebAuthFlow.mockImplementation((_opts: { url: string }, cb: FlowCallback) => {
      runtime.lastError = { message: 'The user did not approve access.' };
      cb(undefined);
      runtime.lastError = null;
    });
    await expect(googleSignIn()).rejects.toThrow(/Access blocked.*Outlook/s);
  });

  it('explains an access_denied redirect the same way', async () => {
    launchWebAuthFlow.mockImplementation((opts: { url: string }, cb: FlowCallback) => {
      const state = new URL(opts.url).searchParams.get('state');
      cb(`https://test-ext.chromiumapp.org/#error=access_denied&state=${state}`);
    });
    await expect(googleSignIn()).rejects.toThrow(/Access blocked.*Outlook/s);
  });
});
