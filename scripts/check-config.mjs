/**
 * Pre-submission config check for the OAuth wiring (Points B & C).
 *
 * Computes your extension ID from the manifest "key", prints the exact values
 * to register in Azure / Google Cloud, and flags any client IDs still left as
 * placeholders. Run after you've pasted your real IDs:
 *
 *   node scripts/check-config.mjs     (or: npm run check:config)
 *
 * Exits non-zero if anything is still a placeholder, so it can gate a release.
 */
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

/** Chrome derives the extension ID from the SHA-256 of the public key (DER),
 *  taking the first 128 bits and mapping each hex nibble 0-f → a-p. */
function extensionIdFromKey(keyB64) {
  const der = Buffer.from(keyB64, 'base64');
  const hash = createHash('sha256').update(der).digest();
  let id = '';
  for (const byte of hash.subarray(0, 16)) {
    id += String.fromCharCode(97 + (byte >> 4));
    id += String.fromCharCode(97 + (byte & 0x0f));
  }
  return id;
}

function parseEnv() {
  const out = {};
  if (existsSync(resolve(ROOT, '.env'))) {
    for (const line of read('.env').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return out;
}

const manifest = JSON.parse(read('manifest.json'));
const env = parseEnv();

// ── Extension identity ───────────────────────────────────────────────────────
const hasKey = typeof manifest.key === 'string' && manifest.key.length > 0;
const extId = hasKey ? extensionIdFromKey(manifest.key) : null;
const redirectUri = extId ? `https://${extId}.chromiumapp.org/` : '(unknown — no manifest key)';

// ── Microsoft (Point B) ──────────────────────────────────────────────────────
const msFromEnv = env.VITE_MS_CLIENT_ID;
const msFromConfig = (/'([^']*)'/.exec(
  (/MS_CLIENT_ID[^]*?\?\?\s*[^]*?(['"][^'"]*['"])/.exec(read('src/config.ts')) || [])[1] || '',
) || [])[1];
const msClientId = msFromEnv || msFromConfig || '';
const msOk = msClientId && !/mock|your[-_ ]?azure|xxxx/i.test(msClientId);

// ── Google (Point C) ─────────────────────────────────────────────────────────
const googleClientId = manifest.oauth2?.client_id ?? '';
const googleOk =
  googleClientId &&
  !/YOUR_GOOGLE|placeholder/i.test(googleClientId) &&
  googleClientId.endsWith('.apps.googleusercontent.com');

// ── Report ───────────────────────────────────────────────────────────────────
const ok = (b) => (b ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m');
console.log('\n  Inbox Janitor — OAuth config check\n  ' + '─'.repeat(46));
console.log(`  ${ok(hasKey)} Extension ID   ${extId ?? '(no manifest key — ID is unstable)'}`);
console.log(`      ↳ Microsoft redirect URI to register (SPA):`);
console.log(`        ${redirectUri}`);
console.log('');
console.log('  Point B — Microsoft / Outlook');
console.log(`  ${ok(msOk)} VITE_MS_CLIENT_ID   ${msOk ? msClientId : `${msClientId || '(unset)'}  ← still a placeholder`}`);
console.log(`      source: ${msFromEnv ? '.env' : 'src/config.ts fallback'}`);
console.log('');
console.log('  Point C — Google / Gmail');
console.log(`  ${ok(googleOk)} manifest oauth2.client_id   ${googleOk ? googleClientId : `${googleClientId || '(unset)'}  ← still a placeholder`}`);
console.log(`      scopes: ${(manifest.oauth2?.scopes ?? []).join(', ') || '(none)'}`);
console.log('  ' + '─'.repeat(46));

if (msOk && googleOk) {
  console.log('  \x1b[32mReady.\x1b[0m Both client IDs are set. Run `npm run package` and upload.\n');
  process.exit(0);
} else {
  console.log('  \x1b[33mNot ready.\x1b[0m Set the placeholder(s) above, then rebuild:');
  if (!msOk) console.log('    • Microsoft: put your Azure client ID in .env as VITE_MS_CLIENT_ID (README §1)');
  if (!googleOk) console.log('    • Google: put your Chrome-Extension OAuth client ID in manifest.json "oauth2.client_id" (README §1b)');
  console.log('    • Register the redirect URI above in Azure (SPA platform).');
  console.log('    • In Google Cloud, the OAuth client\'s item ID must equal the Extension ID above.\n');
  process.exit(1);
}
