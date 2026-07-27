/**
 * Generate Chrome Web Store assets into ../store-assets/:
 *   - 4 listing screenshots (1280x800): the REAL extension UI seeded with demo
 *     data (no live account / no real OAuth), composited onto a branded canvas.
 *   - Small promo tile (440x280) and marquee (1400x560).
 *
 * Prereq: `npm run build` (needs dist/). Then: `node scripts/gen-store-assets.mjs`.
 */
import puppeteer from 'puppeteer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const OUT = resolve(ROOT, 'store-assets');
mkdirSync(OUT, { recursive: true });

const ICON_URI = `data:image/png;base64,${readFileSync(resolve(ROOT, 'icons/icon128.png')).toString('base64')}`;

// Mirror the app's Gmail feature flag so assets never over-promise a hidden feature.
const GMAIL_ENABLED = /GMAIL_ENABLED\s*=\s*true/.test(readFileSync(resolve(ROOT, 'src/config.ts'), 'utf8'));
const PROVIDERS = GMAIL_ENABLED ? ['Gmail', 'Outlook', 'Microsoft 365'] : ['Outlook', 'Microsoft 365'];
const BADGES = PROVIDERS.map((p) => `<span class="badge">${p}</span>`).join('');
const DELETE_TARGET = GMAIL_ENABLED ? 'Trash / Deleted Items' : 'Deleted Items';
const PROMO_SUB_SHORT = GMAIL_ENABLED ? 'Gmail or Outlook' : 'Outlook';

const USER = { userName: 'Alex Morgan', userEmail: 'alex.morgan@outlook.com' };
const GROUPS = [
  ['Weekly Digest', 'digest@newsletters.example', 128, 0],
  ['Deals & Offers', 'offers@shopmail.example', 96, 1],
  ['Social Notifications', 'no-reply@social.example', 74, 2],
  ['Travel Alerts', 'alerts@flywithus.example', 51, 3],
  ['Product Updates', 'updates@saasapp.example', 43, 6],
  ['Community Forum', 'forum@devhub.example', 37, 8],
  ['Billing Statements', 'billing@utility.example', 29, 11],
  ['Event Invites', 'events@meetups.example', 22, 14],
  ['Job Matches', 'jobs@careers.example', 18, 18],
  ['Book Club', 'hello@readers.example', 12, 25],
  ['Fitness Tips', 'coach@wellness.example', 9, 30],
  ['Photo Prints', 'orders@printlab.example', 6, 40],
].map(([name, email, count, daysAgo]) => ({
  name,
  email,
  count,
  latestDate: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  representativeMessageId: `demo-${email}`,
}));

const PANEL_W = 384;
const PANEL_H = 720;

function seed(provider) {
  return {
    tokens: {
      provider,
      accessToken: 'demo-token',
      refreshToken: 'demo-refresh',
      expiresAt: Date.now() + 3600_000,
      userId: 'demo-user',
      ...USER,
    },
    cache: { provider, groups: GROUPS, fetchedAt: Date.now(), totalFetched: 2000, isPartial: false },
  };
}

async function seedAndReload(page, provider) {
  const { tokens, cache } = seed(provider);
  await page.evaluate(
    async (t, c) => new Promise((r) => chrome.storage.local.set({ ij_auth: t, ij_cache: c }, r)),
    tokens,
    cache,
  );
  await page.reload({ waitUntil: 'networkidle2' });
}

async function clearStorage(page) {
  await page.evaluate(async () => new Promise((r) => chrome.storage.local.clear(r)));
  await page.reload({ waitUntil: 'networkidle2' });
}

function compositeHtml(panelDataUri, headline, sub) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:1280px;height:800px;overflow:hidden;font-family:'Segoe UI',-apple-system,Roboto,Helvetica,Arial,sans-serif}
    .stage{width:1280px;height:800px;display:flex;align-items:center;background:linear-gradient(135deg,#eaf3fc 0%,#dceafb 45%,#eef6ff 100%);position:relative}
    .stage::before{content:'';position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,#0078d4 0%,rgba(0,120,212,0) 70%);opacity:.16;top:-120px;left:-120px}
    .left{width:600px;padding:0 40px 0 80px}
    .brand{display:flex;align-items:center;gap:12px;margin-bottom:28px}
    .brand img{width:44px;height:44px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.14)}
    .brand span{font-size:20px;font-weight:700;color:#0b3c66}
    h1{font-size:46px;line-height:1.1;font-weight:800;color:#0b2a4a;letter-spacing:-.5px}
    p.sub{margin-top:18px;font-size:20px;line-height:1.5;color:#3f5a75;max-width:440px}
    .badges{margin-top:26px;display:flex;gap:10px}
    .badge{font-size:13px;font-weight:600;color:#0b3c66;background:rgba(255,255,255,.72);border:1px solid rgba(11,60,102,.14);padding:6px 12px;border-radius:20px}
    .right{flex:1;display:flex;align-items:center;justify-content:center}
    .device{width:${PANEL_W}px;height:${PANEL_H}px;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 24px 60px rgba(11,42,74,.28),0 4px 12px rgba(11,42,74,.16);border:1px solid rgba(11,42,74,.10)}
    .device img{width:${PANEL_W}px;height:${PANEL_H}px;display:block}
  </style></head><body><div class="stage">
    <div class="left"><div class="brand"><img src="${ICON_URI}"/><span>Inbox Janitor</span></div>
    <h1>${headline}</h1><p class="sub">${sub}</p>
    <div class="badges">${BADGES}</div></div>
    <div class="right"><div class="device"><img src="${panelDataUri}"/></div></div>
  </div></body></html>`;
}

function promoHtml(w, h, o) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${w}px;height:${h}px;overflow:hidden;font-family:'Segoe UI',-apple-system,Roboto,Helvetica,Arial,sans-serif}
    .tile{width:${w}px;height:${h}px;display:flex;align-items:center;gap:${o.gap}px;padding:0 ${o.pad}px;background:linear-gradient(135deg,#0a4c86 0%,#0078d4 55%,#28a1f0 100%);position:relative;overflow:hidden}
    .tile::after{content:'';position:absolute;right:-80px;bottom:-120px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.20),rgba(255,255,255,0) 70%)}
    .logo{width:${o.icon}px;height:${o.icon}px;border-radius:${Math.round(o.icon * 0.22)}px;flex-shrink:0;background:#fff;padding:${Math.round(o.icon * 0.08)}px;box-shadow:0 6px 20px rgba(0,0,0,.25)}
    .logo img{width:100%;height:100%;display:block}
    .txt{color:#fff;z-index:1}
    .txt h1{font-size:${o.titleSize}px;font-weight:800;letter-spacing:-.5px;line-height:1.05}
    .txt p{margin-top:${o.gapText}px;font-size:${o.subSize}px;font-weight:500;color:#e6f2ff;line-height:1.35}
  </style></head><body><div class="tile">
    <div class="logo"><img src="${ICON_URI}"/></div>
    <div class="txt"><h1>Inbox Janitor</h1><p>${o.sub}</p></div>
  </div></body></html>`;
}

async function renderHtmlToPng(browser, html, w, h, outPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath });
  await page.close();
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('dist/ not found — run `npm run build` first');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      `--load-extension=${DIST}`,
      `--disable-extensions-except=${DIST}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
  });

  let extensionId = null;
  for (let i = 0; i < 10 && !extensionId; i++) {
    for (const t of browser.targets()) {
      const url = t.url();
      if (url.startsWith('chrome-extension://')) {
        extensionId = url.split('/')[2];
        break;
      }
    }
    if (!extensionId) await new Promise((r) => setTimeout(r, 500));
  }
  if (!extensionId) throw new Error('Could not resolve extension ID');

  const page = await browser.newPage();
  await page.setViewport({ width: PANEL_W, height: PANEL_H, deviceScaleFactor: 2 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('graph.microsoft.com') || url.includes('googleapis.com')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ value: Array.from({ length: 15 }, (_, i) => ({ id: `m${i}` })) }),
      });
      return;
    }
    req.continue();
  });
  await page.goto(`chrome-extension://${extensionId}/sidepanel/index.html`, {
    waitUntil: 'networkidle2',
  });

  const shots = {};
  await clearStorage(page);
  await page.waitForSelector('[data-testid="signed-out-view"]');
  shots.signedOut = await page.screenshot({ encoding: 'base64' });

  await seedAndReload(page, 'microsoft');
  await page.waitForSelector('[data-testid="sender-list"] .sender-item');
  shots.list = await page.screenshot({ encoding: 'base64' });

  await page.evaluate(() => {
    document.querySelectorAll('[data-testid="sender-list"] .sender-item').forEach((el, i) => {
      if ([0, 1, 3].includes(i)) el.click();
    });
  });
  await new Promise((r) => setTimeout(r, 150));
  shots.selected = await page.screenshot({ encoding: 'base64' });

  await page.click('[data-testid="archive-btn"]');
  await page.waitForSelector('.modal', { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 150));
  shots.modal = await page.screenshot({ encoding: 'base64' });

  const specs = [
    ['01-signed-out.png', shots.signedOut, 'One click to a cleaner inbox',
      'Connect your account and clean up unwanted mail in minutes — not hours.'],
    ['02-sender-list.png', shots.list, 'See who’s filling your inbox',
      'Every sender, grouped and ranked by how much mail they send you.'],
    ['03-select-and-act.png', shots.selected, 'Select senders, act in bulk',
      'Archive, delete, or unsubscribe from many senders at once with a live progress bar.'],
    ['04-safe-confirm.png', shots.modal, 'Safe by default',
      `A confirmation shows the exact message count first. “Delete” only moves to ${DELETE_TARGET} — never a permanent purge.`],
  ];
  for (const [file, b64, headline, sub] of specs) {
    await renderHtmlToPng(browser, compositeHtml(`data:image/png;base64,${b64}`, headline, sub), 1280, 800, resolve(OUT, file));
    console.log('wrote', file);
  }

  await renderHtmlToPng(browser, promoHtml(440, 280, {
    gap: 22, pad: 34, icon: 104, titleSize: 34, subSize: 15, gapText: 8,
    sub: `Bulk unsubscribe &amp; clean up your ${PROMO_SUB_SHORT} inbox.`,
  }), 440, 280, resolve(OUT, 'promo-small-440x280.png'));
  console.log('wrote promo-small-440x280.png');

  await renderHtmlToPng(browser, promoHtml(1400, 560, {
    gap: 60, pad: 100, icon: 200, titleSize: 76, subSize: 30, gapText: 18,
    sub: 'Bulk unsubscribe, group senders, and clean up your inbox in one click.',
  }), 1400, 560, resolve(OUT, 'promo-marquee-1400x560.png'));
  console.log('wrote promo-marquee-1400x560.png');

  await browser.close();
  console.log('\nAll assets written to', OUT);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
