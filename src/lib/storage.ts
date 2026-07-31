import type { AuthTokens, SenderCache, Prefs } from './types.js';

const KEYS = {
  AUTH: 'ij_auth',
  CACHE: 'ij_cache',
  PREFS: 'ij_prefs',
} as const;

function get<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve((result[key] as T | undefined) ?? null);
    });
  });
}

function set(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

function remove(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, resolve);
  });
}

export const storage = {
  getTokens: () => get<AuthTokens>(KEYS.AUTH),
  setTokens: (tokens: AuthTokens) => set(KEYS.AUTH, tokens),
  clearTokens: () => remove(KEYS.AUTH),

  getCache: () => get<SenderCache>(KEYS.CACHE),
  setCache: (cache: SenderCache) => set(KEYS.CACHE, cache),
  clearCache: () => remove(KEYS.CACHE),

  // UI preferences — deliberately survive sign-out (not user data).
  getPrefs: () => get<Prefs>(KEYS.PREFS),
  setPrefs: (prefs: Prefs) => set(KEYS.PREFS, prefs),

  clearAll: async () => {
    await remove(KEYS.AUTH);
    await remove(KEYS.CACHE);
  },
};
