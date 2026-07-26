import { describe, it, expect } from 'vitest';

// We need crypto.subtle in Node test env
import { webcrypto } from 'crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, writable: true });

import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  parseCallbackUrl,
} from '../../src/auth/pkce.js';

describe('PKCE helpers', () => {
  describe('generateCodeVerifier', () => {
    it('returns a base64url string of length 43 (256 bits / 6)', async () => {
      const v = await generateCodeVerifier();
      // 32 bytes → 43 base64url chars
      expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
      expect(v.length).toBe(43);
    });

    it('generates unique values each call', async () => {
      const a = await generateCodeVerifier();
      const b = await generateCodeVerifier();
      expect(a).not.toBe(b);
    });
  });

  describe('generateCodeChallenge', () => {
    it('produces a non-empty base64url string', async () => {
      const v = await generateCodeVerifier();
      const c = await generateCodeChallenge(v);
      expect(c).toMatch(/^[A-Za-z0-9\-_]+$/);
      expect(c.length).toBeGreaterThan(0);
    });

    it('is deterministic for a given verifier', async () => {
      const v = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const c1 = await generateCodeChallenge(v);
      const c2 = await generateCodeChallenge(v);
      expect(c1).toBe(c2);
    });

    it('produces the correct SHA-256 base64url for a known verifier', async () => {
      // RFC 7636 appendix B: verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
      // → challenge "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toBe(expected);
    });

    it('different verifiers produce different challenges', async () => {
      const v1 = await generateCodeVerifier();
      const v2 = await generateCodeVerifier();
      const c1 = await generateCodeChallenge(v1);
      const c2 = await generateCodeChallenge(v2);
      expect(c1).not.toBe(c2);
    });
  });

  describe('generateState', () => {
    it('returns a non-empty base64url string', () => {
      const s = generateState();
      expect(s).toMatch(/^[A-Za-z0-9\-_]+$/);
      expect(s.length).toBeGreaterThan(0);
    });

    it('generates unique values', () => {
      const states = Array.from({ length: 10 }, () => generateState());
      const unique = new Set(states);
      expect(unique.size).toBe(10);
    });
  });

  describe('parseCallbackUrl', () => {
    it('extracts code and state from a valid callback URL', () => {
      const url = 'https://abc.chromiumapp.org/?code=auth_code_123&state=xyz';
      const result = parseCallbackUrl(url);
      expect(result).toEqual({ code: 'auth_code_123', state: 'xyz' });
    });

    it('returns null when code is missing', () => {
      const url = 'https://abc.chromiumapp.org/?state=xyz';
      expect(parseCallbackUrl(url)).toBeNull();
    });

    it('returns null when state is missing', () => {
      const url = 'https://abc.chromiumapp.org/?code=auth_code_123';
      expect(parseCallbackUrl(url)).toBeNull();
    });

    it('returns null for a malformed URL', () => {
      expect(parseCallbackUrl('not a url')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseCallbackUrl('')).toBeNull();
    });
  });
});
