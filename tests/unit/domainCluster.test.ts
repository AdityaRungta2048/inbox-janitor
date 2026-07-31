import { describe, it, expect } from 'vitest';
import {
  emailDomain,
  registrableDomain,
  isClusterable,
  clusterByDomain,
  asSingles,
} from '../../src/lib/domain.js';
import type { SenderGroup, DisplayGroup } from '../../src/lib/types.js';

/** First row, asserting it exists — keeps tests free of non-null assertions. */
function first(list: DisplayGroup[]): DisplayGroup {
  const [head] = list;
  if (!head) throw new Error('expected at least one group');
  return head;
}

function g(email: string, name: string, count: number, date = '2026-01-01T00:00:00Z'): SenderGroup {
  return {
    email,
    name,
    count,
    latestDate: date,
    representativeMessageId: `msg-${email}`,
  };
}

describe('emailDomain', () => {
  it('extracts and lowercases the host', () => {
    expect(emailDomain('No-Reply@Binance.com')).toBe('binance.com');
  });

  it('uses the last @ so display-name noise cannot fool it', () => {
    expect(emailDomain('weird@name@binance.com')).toBe('binance.com');
  });

  it('returns empty string for malformed addresses', () => {
    expect(emailDomain('not-an-email')).toBe('');
    expect(emailDomain('trailing@')).toBe('');
  });
});

describe('registrableDomain', () => {
  it('strips subdomains', () => {
    expect(registrableDomain('post.binance.com')).toBe('binance.com');
    expect(registrableDomain('mail.news.binance.com')).toBe('binance.com');
  });

  it('keeps two-part domains as-is', () => {
    expect(registrableDomain('binance.com')).toBe('binance.com');
  });

  it('handles multi-part public suffixes', () => {
    expect(registrableDomain('news.binance.co.uk')).toBe('binance.co.uk');
    expect(registrableDomain('binance.co.in')).toBe('binance.co.in');
    expect(registrableDomain('mail.shop.com.au')).toBe('shop.com.au');
  });
});

describe('isClusterable', () => {
  it('refuses consumer mailbox providers', () => {
    expect(isClusterable('gmail.com')).toBe(false);
    expect(isClusterable('outlook.com')).toBe(false);
    expect(isClusterable('yahoo.com')).toBe(false);
  });

  it('refuses shared sending infrastructure', () => {
    expect(isClusterable('sendgrid.net')).toBe(false);
    expect(isClusterable('amazonses.com')).toBe(false);
  });

  it('allows ordinary brand domains', () => {
    expect(isClusterable('binance.com')).toBe(true);
  });

  it('refuses empty domains', () => {
    expect(isClusterable('')).toBe(false);
  });
});

describe('clusterByDomain', () => {
  it('merges every address on one domain into a single row', () => {
    const out = clusterByDomain([
      g('no-reply@binance.com', 'Binance', 40, '2026-01-05T00:00:00Z'),
      g('news@binance.com', 'Binance News', 12, '2026-01-09T00:00:00Z'),
      g('marketing@post.binance.com', 'Binance Marketing', 8, '2026-01-02T00:00:00Z'),
    ]);

    expect(out).toHaveLength(1);
    const cluster = first(out);
    expect(cluster.key).toBe('binance.com');
    expect(cluster.isCluster).toBe(true);
    expect(cluster.count).toBe(60); // 40 + 12 + 8
    expect(cluster.addresses).toHaveLength(3);
    expect(cluster.latestDate).toBe('2026-01-09T00:00:00Z'); // newest across members
    expect(cluster.name).toBe('Binance'); // most prolific member supplies the name
    expect(cluster.sublabel).toBe('binance.com');
  });

  it('keeps every representative message id, most prolific first', () => {
    const out = clusterByDomain([
      g('small@acme.com', 'Acme Small', 2),
      g('big@acme.com', 'Acme Big', 90),
    ]);

    expect(first(out).representativeMessageIds).toEqual(['msg-big@acme.com', 'msg-small@acme.com']);
  });

  it('does not merge consumer mailbox providers', () => {
    const out = clusterByDomain([g('alice@gmail.com', 'Alice', 5), g('bob@gmail.com', 'Bob', 7)]);

    expect(out).toHaveLength(2);
    expect(out.every((x) => x.isCluster === false)).toBe(true);
    expect(out.map((x) => x.key).sort()).toEqual(['alice@gmail.com', 'bob@gmail.com']);
  });

  it('leaves a lone address on a domain as a plain row', () => {
    const out = clusterByDomain([g('hello@solo.com', 'Solo', 3)]);

    expect(out).toHaveLength(1);
    expect(first(out).isCluster).toBe(false);
    expect(first(out).key).toBe('hello@solo.com');
    expect(first(out).sublabel).toBe('hello@solo.com');
  });

  it('separates different domains', () => {
    const out = clusterByDomain([
      g('a@binance.com', 'Binance', 5),
      g('b@binance.com', 'Binance', 5),
      g('a@coinbase.com', 'Coinbase', 3),
      g('b@coinbase.com', 'Coinbase', 3),
    ]);

    expect(out).toHaveLength(2);
    expect(out.map((x) => x.key).sort()).toEqual(['binance.com', 'coinbase.com']);
    expect(out.every((x) => x.count === 10 || x.count === 6)).toBe(true);
  });

  it('falls back to the domain when the sender has no display name', () => {
    const out = clusterByDomain([g('a@acme.com', '', 9), g('b@acme.com', '', 4)]);
    expect(first(out).name).toBe('acme.com');
  });

  it('handles malformed addresses without clustering them', () => {
    const out = clusterByDomain([g('broken-address', 'Broken', 1)]);
    expect(out).toHaveLength(1);
    expect(first(out).isCluster).toBe(false);
  });
});

describe('asSingles', () => {
  it('maps each sender to its own row', () => {
    const out = asSingles([g('a@binance.com', 'A', 1), g('b@binance.com', 'B', 2)]);
    expect(out).toHaveLength(2);
    expect(out.every((x) => x.isCluster === false)).toBe(true);
    expect(first(out).addresses).toEqual(['a@binance.com']);
  });
});
