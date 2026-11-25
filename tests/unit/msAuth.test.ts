import { describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, writable: true });

type FlowCallback = (responseUrl?: string) => void;
const launchWebAuthFlow = vi.fn();
vi.stubGlobal('chrome', {
  storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
  runtime: { id: 'test-ext', lastError: null },
  identity: { launchWebAuthFlow },
});

// Imported after the stub: the module reads chrome.runtime.id when it loads.
const { signIn } = await import('../../src/auth/msAuth.js');

function redirectWith(params: Record<string, string>) {
  launchWebAuthFlow.mockImplementation((opts: { url: string }, cb: FlowCallback) => {
    const state = new URL(opts.url).searchParams.get('state') ?? '';
    cb(`https://test-ext.chromiumapp.org/?${new URLSearchParams({ ...params, state }).toString()}`);
  });
}

// Microsoft sends refusals back as ?error=…&error_description=AADSTS…; people used to
// see "Invalid callback URL from auth flow", which tells them nothing.
describe('Microsoft sign-in refusals', () => {
  it('explains that a work account needs IT admin approval', async () => {
    redirectWith({
      error: 'access_denied',
      error_description:
        'AADSTS65001: The user or administrator has not consented to use the application.',
    });
    await expect(signIn()).rejects.toThrow(/IT admin/);
  });

  it('explains a cancelled consent screen', async () => {
    redirectWith({
      error: 'access_denied',
      error_description: 'AADSTS65004: User declined to consent.',
    });
    await expect(signIn()).rejects.toThrow(/Accept/);
  });

  it('passes on any other reason Microsoft gives instead of a generic error', async () => {
    redirectWith({
      error: 'server_error',
      error_description:
        'AADSTS50020: User account from identity provider does not exist in tenant.',
    });
    await expect(signIn()).rejects.toThrow(/AADSTS50020/);
  });
});
