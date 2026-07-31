import type { SenderGroup, DisplayGroup } from './types.js';

// Multi-part public suffixes, so "news.binance.co.uk" registers as "binance.co.uk"
// rather than the meaningless "co.uk". Not exhaustive — covers the common cases.
const MULTI_PART_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'me.uk',
  'co.in',
  'net.in',
  'org.in',
  'co.jp',
  'or.jp',
  'ne.jp',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'com.br',
  'com.mx',
  'com.ar',
  'com.sg',
  'com.hk',
  'com.cn',
  'com.tr',
  'com.tw',
  'co.kr',
  'co.za',
  'co.il',
  'com.my',
  'com.ph',
  'com.vn',
  'com.pk',
  'com.sa',
  'co.id',
]);

// Domains where clustering would be wrong: consumer mailbox providers (every
// personal contact would collapse into one "gmail.com" row) and shared sending
// infrastructure (unrelated companies share the domain).
const NEVER_CLUSTER = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'ymail.com',
  'rocketmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'zoho.com',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'mail.ru',
  'yandex.com',
  'yandex.ru',
  'rediffmail.com',
  'fastmail.com',
  'tutanota.com',
  'hey.com',
  // Shared sending infrastructure
  'sendgrid.net',
  'mailgun.org',
  'amazonses.com',
  'sparkpostmail.com',
  'mcsv.net',
  'mcdlv.net',
  'sendinblue.com',
  'mailchimpapp.net',
]);

/** Host part of an email address, lowercased. Empty string when malformed. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return '';
  return email
    .slice(at + 1)
    .toLowerCase()
    .trim();
}

/**
 * Registrable domain for a host — strips subdomains so that
 * `post.binance.com` and `mail.binance.com` both yield `binance.com`.
 */
export function registrableDomain(host: string): string {
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');

  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/** True when senders on this domain should be merged into a single row. */
export function isClusterable(domain: string): boolean {
  return domain !== '' && !NEVER_CLUSTER.has(domain);
}

function toSingle(group: SenderGroup): DisplayGroup {
  return {
    key: group.email,
    name: group.name || group.email,
    sublabel: group.email,
    count: group.count,
    latestDate: group.latestDate,
    addresses: [group.email],
    representativeMessageIds: [group.representativeMessageId],
    isCluster: false,
  };
}

/**
 * Merge per-address sender groups into per-domain groups, so every address on
 * (say) binance.com becomes one row that acts as a unit. Domains in
 * NEVER_CLUSTER, and domains with only one address, are left as-is.
 */
export function clusterByDomain(groups: SenderGroup[]): DisplayGroup[] {
  const byDomain = new Map<string, SenderGroup[]>();
  const singles: DisplayGroup[] = [];

  for (const group of groups) {
    const domain = registrableDomain(emailDomain(group.email));
    if (!isClusterable(domain)) {
      singles.push(toSingle(group));
      continue;
    }
    const bucket = byDomain.get(domain);
    if (bucket) bucket.push(group);
    else byDomain.set(domain, [group]);
  }

  const clustered: DisplayGroup[] = [];

  for (const [domain, members] of byDomain) {
    const first = members[0];
    if (!first) continue;

    if (members.length === 1) {
      clustered.push(toSingle(first));
      continue;
    }

    // Most prolific address supplies the display name and leads the
    // representative-message list (used for unsubscribe attempts).
    const ranked = [...members].sort((a, b) => b.count - a.count);
    const lead = ranked[0] ?? first;

    clustered.push({
      key: domain,
      name: lead.name || domain,
      sublabel: domain, // the address count is shown as a badge next to the name
      count: members.reduce((sum, m) => sum + m.count, 0),
      latestDate: members.reduce(
        (latest, m) => (m.latestDate > latest ? m.latestDate : latest),
        '',
      ),
      addresses: ranked.map((m) => m.email),
      representativeMessageIds: ranked.map((m) => m.representativeMessageId).filter(Boolean),
      isCluster: true,
    });
  }

  return [...clustered, ...singles];
}

/** Flat per-address view, used when domain grouping is switched off. */
export function asSingles(groups: SenderGroup[]): DisplayGroup[] {
  return groups.map(toSingle);
}
