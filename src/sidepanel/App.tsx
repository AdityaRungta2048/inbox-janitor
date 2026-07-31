// h and Fragment are provided by the automatic JSX transform (jsxImportSource: "preact")
import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import { signIn, signOut, getValidToken } from '../auth/msAuth.js';
import { googleSignIn, clearGoogleToken } from '../auth/googleAuth.js';
import { storage } from '../lib/storage.js';
import {
  fetchSenderGroups,
  getMessageIdsBySender,
  deleteMessages,
  archiveMessages,
} from '../graph/messages.js';
import {
  fetchGmailSenderGroups,
  getGmailMessageIdsBySender,
  archiveGmailMessages,
  trashGmailMessages,
} from '../gmail/messages.js';
import { getUnsubscribeHeader, executeUnsubscribe } from '../graph/unsubscribe.js';
import { getGmailUnsubscribeHeader } from '../gmail/unsubscribe.js';
import { CACHE_TTL_MS, GMAIL_ENABLED } from '../config.js';
import { clusterByDomain, asSingles } from '../lib/domain.js';
import type {
  AuthTokens,
  DisplayGroup,
  SenderCache,
  SortKey,
  UnsubscribeResult,
} from '../lib/types.js';

// ── Helper ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ProgressProps {
  done: number;
  total: number;
  label: string;
  onCancel: () => void;
}

function ProgressBar({ done, total, label, onCancel }: ProgressProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div class="progress-container">
      <div class="progress-label">
        <span>
          {label} — {done} / {total}
        </span>
        <button class="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  action: 'archive' | 'delete';
  provider: 'microsoft' | 'google';
  senderCount: number;
  totalMessages: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  action,
  provider,
  senderCount,
  totalMessages,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const isDelete = action === 'delete';
  const deleteTarget = provider === 'google' ? 'Trash' : 'Deleted Items';
  return (
    <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">{isDelete ? '🗑 Delete messages?' : '📦 Archive messages?'}</div>
        <div class="modal-body">
          <p>
            This will {isDelete ? `move to ${deleteTarget}` : 'archive'}{' '}
            <strong>{plural(totalMessages, 'message')}</strong> from{' '}
            <strong>{plural(senderCount, 'sender')}</strong>.
          </p>
          {isDelete && (
            <p style={{ marginTop: 8, color: 'var(--text-subtle)' }}>
              Messages go to {deleteTarget} and can be recovered from there.
            </p>
          )}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            class={isDelete ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
            onClick={onConfirm}
            data-testid="confirm-action-btn"
          >
            {isDelete ? 'Delete' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface UnsubResultsModalProps {
  results: UnsubscribeResult[];
  onClose: () => void;
}

function UnsubResultsModal({ results, onClose }: UnsubResultsModalProps) {
  return (
    <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">Unsubscribe Results</div>
        <div class="modal-body">
          <ul class="unsub-list">
            {results.map((r) => (
              <li key={r.email}>
                <span class="unsub-email" title={r.email}>
                  {r.email}
                </span>
                <span class={`status-tag ${statusClass(r.status)}`}>{statusLabel(r.status)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function statusClass(status: UnsubscribeResult['status']): string {
  switch (status) {
    case 'done':
      return 'status-done';
    case 'opened_in_tab':
      return 'status-tab';
    case 'needs_manual':
      return 'status-manual';
    default:
      return 'status-failed';
  }
}

function statusLabel(status: UnsubscribeResult['status']): string {
  switch (status) {
    case 'done':
      return '✓ Done';
    case 'opened_in_tab':
      return '↗ Tab opened';
    case 'needs_manual':
      return '⚠ Manual';
    case 'no_header':
      return '— No link';
    default:
      return '✗ Failed';
  }
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [cache, setCache] = useState<SenderCache | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [selected, setSelected] = useState(new Set<string>());
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<'archive' | 'delete' | null>(null);
  const [confirmTotal, setConfirmTotal] = useState(0);
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [unsubResults, setUnsubResults] = useState<UnsubscribeResult[] | null>(null);
  const [isThrottled, setIsThrottled] = useState(false);
  const [groupByDomain, setGroupByDomain] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // Load the domain-grouping preference (persists across sign-out)
  useEffect(() => {
    void (async () => {
      const prefs = await storage.getPrefs();
      if (prefs) setGroupByDomain(prefs.groupByDomain);
    })();
  }, []);

  const toggleGroupByDomain = useCallback(() => {
    setGroupByDomain((prev) => {
      const next = !prev;
      void storage.setPrefs({ groupByDomain: next });
      return next;
    });
    setSelected(new Set()); // keys change meaning between modes
  }, []);

  // Load tokens from storage on mount
  useEffect(() => {
    void (async () => {
      const stored = await storage.getTokens();
      setTokens(stored);
      if (stored) {
        const cached = await storage.getCache();
        if (
          cached &&
          cached.provider === stored.provider &&
          Date.now() - cached.fetchedAt < CACHE_TTL_MS
        ) {
          setCache(cached);
        } else {
          void loadSenders();
        }
      }
    })();
  }, []);

  const handleMicrosoftSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadingMsg('Signing in…');
    try {
      const t = await signIn();
      setTokens(t);
      void loadSenders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setLoading(false);
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setError(null);
    // Gmail hosts are optional permissions — request them from this click (a user
    // gesture) so existing Outlook users are never prompted for Google access.
    const granted = await chrome.permissions.request({
      origins: [
        'https://gmail.googleapis.com/*',
        'https://www.googleapis.com/*',
        'https://accounts.google.com/*',
      ],
    });
    if (!granted) {
      setError('Gmail access was not granted.');
      return;
    }
    setLoading(true);
    setLoadingMsg('Signing in…');
    try {
      const t = await googleSignIn();
      setTokens(t);
      void loadSenders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    if (tokens?.provider === 'google' && tokens.accessToken) {
      await clearGoogleToken(tokens.accessToken);
    }
    await signOut();
    setTokens(null);
    setCache(null);
    setSelected(new Set());
    setError(null);
  }, [tokens]);

  const loadSenders = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadingMsg('Loading your mailbox…');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const stored = await storage.getTokens();
      if (!stored) throw new Error('Not signed in');

      let result: SenderCache;
      if (stored.provider === 'google') {
        result = await fetchGmailSenderGroups((f) => {
          setLoadingMsg(`Scanning messages… (${f} so far)`);
        }, controller.signal);
      } else {
        await getValidToken();
        result = await fetchSenderGroups((f) => {
          setLoadingMsg(`Scanning messages… (${f} so far)`);
        }, controller.signal);
      }

      setCache(result);
    } catch (e) {
      if (!controller.signal.aborted) {
        const msg = e instanceof Error ? e.message : 'Failed to load messages';
        setIsThrottled(msg.toLowerCase().includes('throttl') || msg.includes('429'));
        setError(msg);
      }
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setProgress(null);
    setLoading(false);
  }, []);

  // Sorted + filtered sender list, optionally clustered by sending domain
  const displayedGroups = useMemo<DisplayGroup[]>(() => {
    if (!cache) return [];
    let groups = groupByDomain ? clusterByDomain(cache.groups) : asSingles(cache.groups);

    const q = search.toLowerCase().trim();
    if (q) {
      groups = groups.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.key.toLowerCase().includes(q) ||
          g.addresses.some((a) => a.includes(q)),
      );
    }

    switch (sortKey) {
      case 'count':
        groups.sort((a, b) => b.count - a.count);
        break;
      case 'date':
        groups.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
        break;
      case 'alpha':
        groups.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return groups;
  }, [cache, search, sortKey, groupByDomain]);

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const visible = new Set(displayedGroups.map((g) => g.key));
    setSelected((prev) => {
      const allSelected = [...visible].every((k) => prev.has(k));
      if (allSelected) {
        return new Set([...prev].filter((k) => !visible.has(k)));
      }
      return new Set([...prev, ...visible]);
    });
  }, [displayedGroups]);

  const selectedGroups = useMemo(
    () => displayedGroups.filter((g) => selected.has(g.key)),
    [displayedGroups, selected],
  );

  // A cluster stands for several addresses — every action fans out across them.
  const selectedAddressCount = useMemo(
    () => selectedGroups.reduce((n, g) => n + g.addresses.length, 0),
    [selectedGroups],
  );

  const handleBulkAction = useCallback(
    async (action: 'archive' | 'delete') => {
      if (selectedGroups.length === 0) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      setLoadingMsg('Counting messages…');

      try {
        const stored = await storage.getTokens();
        const isGoogle = stored?.provider === 'google';

        // Fan out across every address in each group (a domain cluster holds several)
        const seen = new Set<string>();
        for (const g of selectedGroups) {
          for (const address of g.addresses) {
            if (controller.signal.aborted) return;
            const ids = isGoogle
              ? await getGmailMessageIdsBySender(address)
              : await getMessageIdsBySender(address);
            for (const id of ids) seen.add(id);
          }
        }

        if (!controller.signal.aborted) {
          const allIds = [...seen];
          setPendingIds(allIds);
          setConfirmTotal(allIds.length);
          setConfirmAction(action);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to count messages');
      } finally {
        setLoading(false);
        setLoadingMsg('');
      }
    },
    [selectedGroups],
  );

  const handleConfirm = useCallback(async () => {
    if (!confirmAction || !pendingIds) return;

    const allIds = pendingIds;
    const action = confirmAction;
    setConfirmAction(null);
    setPendingIds(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const stored = await storage.getTokens();
    const isGoogle = stored?.provider === 'google';

    setProgress({
      done: 0,
      total: allIds.length,
      label: action === 'delete' ? 'Deleting' : 'Archiving',
    });

    try {
      const onProg = (done: number, total: number) => {
        setProgress({ done, total, label: action === 'delete' ? 'Deleting' : 'Archiving' });
      };

      if (action === 'delete') {
        if (isGoogle) {
          await trashGmailMessages(allIds, onProg, controller.signal);
        } else {
          await deleteMessages(allIds, onProg, controller.signal);
        }
      } else {
        if (isGoogle) {
          await archiveGmailMessages(allIds, onProg, controller.signal);
        } else {
          await archiveMessages(allIds, onProg, controller.signal);
        }
      }

      if (cache) {
        const removedEmails = new Set(selectedGroups.flatMap((g) => g.addresses));
        const updated: SenderCache = {
          ...cache,
          groups: cache.groups.filter((g) => !removedEmails.has(g.email)),
        };
        setCache(updated);
        await storage.setCache(updated);
      }
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setProgress(null);
    }
  }, [confirmAction, pendingIds, selectedGroups, cache]);

  const handleUnsubscribe = useCallback(async () => {
    if (selectedGroups.length === 0) return;

    const stored = await storage.getTokens();
    const isGoogle = stored?.provider === 'google';

    const controller = new AbortController();
    abortRef.current = controller;

    const results: UnsubscribeResult[] = [];
    setProgress({ done: 0, total: selectedGroups.length, label: 'Unsubscribing' });

    // Best outcome wins when a cluster's addresses unsubscribe differently.
    const RANK: UnsubscribeResult['status'][] = [
      'done',
      'opened_in_tab',
      'needs_manual',
      'no_header',
      'failed',
    ];

    for (let i = 0; i < selectedGroups.length; i++) {
      if (controller.signal.aborted) break;
      const g = selectedGroups[i];
      if (!g) continue;

      // Each address in a domain cluster can be on its own mailing list, so
      // attempt every one rather than stopping at the first.
      const statuses: UnsubscribeResult['status'][] = [];
      let note = '';

      for (const messageId of g.representativeMessageIds) {
        if (controller.signal.aborted) break;
        try {
          const header = isGoogle
            ? await getGmailUnsubscribeHeader(messageId)
            : await getUnsubscribeHeader(messageId);

          if (!header) {
            statuses.push('no_header');
          } else {
            const r = await executeUnsubscribe(header, false);
            statuses.push(r.status);
          }
        } catch (e) {
          statuses.push('failed');
          if (!note) note = e instanceof Error ? e.message : 'Unknown error';
        }
      }

      const best = RANK.find((s) => statuses.includes(s)) ?? 'failed';
      const succeeded = statuses.filter((s) => s === 'done').length;
      const detail =
        g.addresses.length > 1
          ? `${succeeded}/${g.addresses.length} addresses unsubscribed`
          : note || undefined;

      results.push({
        email: g.isCluster ? `${g.name} (${g.key})` : g.key,
        status: best,
        ...(detail ? { message: detail } : {}),
      });
      setProgress({ done: i + 1, total: selectedGroups.length, label: 'Unsubscribing' });
    }

    setProgress(null);
    setUnsubResults(results);
  }, [selectedGroups]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!tokens) {
    return (
      <div id="app">
        <div class="header">
          <div class="header-title">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
            Inbox Janitor
          </div>
        </div>
        <div class="signed-out" data-testid="signed-out-view">
          <div class="signed-out-icon">📬</div>
          <h2>Clean up your inbox</h2>
          <p>
            Sign in with your {GMAIL_ENABLED ? 'Microsoft or Google' : 'Microsoft'} account to
            unsubscribe from senders and bulk-clean unwanted mail.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              width: '100%',
              maxWidth: 240,
            }}
          >
            <button
              class="btn btn-primary"
              onClick={() => void handleMicrosoftSignIn()}
              disabled={loading}
              data-testid="sign-in-btn"
            >
              {loading ? 'Signing in…' : 'Sign in with Microsoft'}
            </button>
            {GMAIL_ENABLED && (
              <button
                class="btn btn-secondary"
                onClick={() => void handleGoogleSignIn()}
                disabled={loading}
                data-testid="sign-in-google-btn"
              >
                {loading ? 'Signing in…' : 'Sign in with Google'}
              </button>
            )}
          </div>
          {error && (
            <div class="error-banner" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="app">
      <div class="header">
        <div class="header-title">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
          <div>
            Inbox Janitor
            {cache && (
              <div class="header-sender-count">
                {displayedGroups.length} sender{displayedGroups.length === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>
        <div class="header-user">
          <strong>{tokens.userName}</strong>
          {tokens.userEmail}
          <button
            class="btn btn-ghost btn-sm sign-out-btn"
            onClick={() => void handleSignOut()}
            style={{ display: 'block', marginTop: 2, marginLeft: 'auto', width: 'fit-content' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {isThrottled && <div class="throttle-notice">Rate limit hit — retrying automatically…</div>}

      {error && (
        <div class="error-banner" role="alert">
          {error}
        </div>
      )}

      {loading && !progress ? (
        <div class="loading">
          <div class="spinner" />
          <span>{loadingMsg}</span>
          <button class="btn btn-ghost btn-sm" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      ) : cache ? (
        <>
          <div class="toolbar">
            <input
              class="toolbar-search"
              type="search"
              placeholder="Search senders…"
              value={search}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              aria-label="Search senders"
            />
            <select
              class="sort-select"
              value={sortKey}
              onChange={(e) => setSortKey((e.target as HTMLSelectElement).value as SortKey)}
              aria-label="Sort by"
            >
              <option value="count">Most mail</option>
              <option value="date">Most recent</option>
              <option value="alpha">A–Z</option>
            </select>
            <button class="btn btn-ghost btn-sm" onClick={() => void loadSenders()} title="Refresh">
              ↺
            </button>
            <label
              class="toolbar-toggle"
              title="Merge every address from the same domain into one row (e.g. all binance.com senders)"
            >
              <input
                type="checkbox"
                checked={groupByDomain}
                onChange={toggleGroupByDomain}
                data-testid="group-by-domain"
              />
              Group by domain
            </label>
          </div>

          {cache.isPartial && (
            <div class="notice">
              Showing {cache.groups.length} senders from first {cache.totalFetched} messages.{' '}
              <button class="btn btn-ghost btn-sm" onClick={() => void loadSenders()}>
                Load more
              </button>
            </div>
          )}

          <div class="sender-list-container" data-testid="sender-list">
            {displayedGroups.length === 0 ? (
              <div class="empty-state">
                {search ? 'No senders match your search.' : 'No senders found.'}
              </div>
            ) : (
              displayedGroups.map((g) => (
                <div
                  key={g.key}
                  class={`sender-item ${selected.has(g.key) ? 'selected' : ''}`}
                  onClick={() => toggleSelect(g.key)}
                  title={g.isCluster ? g.addresses.join('\n') : g.key}
                >
                  <input
                    type="checkbox"
                    class="sender-checkbox"
                    checked={selected.has(g.key)}
                    onChange={() => toggleSelect(g.key)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${g.name}`}
                  />
                  <div class="sender-info">
                    <div class="sender-name">
                      {g.name}
                      {g.isCluster && (
                        <span class="cluster-badge">{g.addresses.length} addresses</span>
                      )}
                    </div>
                    {g.sublabel !== g.name && <div class="sender-email">{g.sublabel}</div>}
                  </div>
                  <div class="sender-meta">
                    <span class="sender-count">{g.count}</span>
                    <span class="sender-date">{formatDate(g.latestDate)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {progress ? (
            <ProgressBar
              done={progress.done}
              total={progress.total}
              label={progress.label}
              onCancel={handleCancel}
            />
          ) : (
            <div class="action-bar">
              {displayedGroups.length > 0 && (
                <button class="btn btn-ghost btn-sm" onClick={toggleSelectAll}>
                  {displayedGroups.every((g) => selected.has(g.key))
                    ? 'Deselect all'
                    : 'Select all'}
                </button>
              )}
              <div class="action-bar-buttons">
                <button
                  class="btn btn-danger btn-sm"
                  disabled={selected.size === 0}
                  onClick={() => void handleBulkAction('delete')}
                  data-testid="delete-btn"
                >
                  Delete
                </button>
                <button
                  class="btn btn-secondary btn-sm"
                  disabled={selected.size === 0}
                  onClick={() => void handleUnsubscribe()}
                  data-testid="unsubscribe-btn"
                >
                  Unsubscribe
                </button>
                <button
                  class="btn btn-primary btn-sm"
                  disabled={selected.size === 0}
                  onClick={() => void handleBulkAction('archive')}
                  data-testid="archive-btn"
                >
                  Archive
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div class="loading">
          <div class="spinner" />
          <span>Loading…</span>
        </div>
      )}

      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          provider={tokens.provider}
          senderCount={selectedAddressCount}
          totalMessages={confirmTotal}
          onConfirm={() => void handleConfirm()}
          onCancel={() => {
            setConfirmAction(null);
            setPendingIds(null);
          }}
        />
      )}

      {unsubResults && (
        <UnsubResultsModal results={unsubResults} onClose={() => setUnsubResults(null)} />
      )}
    </div>
  );
}
