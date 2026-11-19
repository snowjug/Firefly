import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { CompareDialog } from '../components/history/CompareDialog.tsx';
import { DeleteDialog } from '../components/history/DeleteDialog.tsx';
import { HistoryFilterBar, type ScenarioOption } from '../components/history/HistoryFilters.tsx';
import { HistoryTable } from '../components/history/HistoryTable.tsx';
import {
  DEFAULT_FILTERS,
  isDefault,
  narrowed,
  type HistoryFilters,
} from '../components/history/status.ts';
import { useEarnedBadges } from '../components/history/useEarnedBadges.ts';
import { useSessionList } from '../components/history/useSessionList.ts';
import { Icon } from '../components/Icon.tsx';
import { EmptyState, ErrorState, Page, PageHeader, SkeletonBlock } from '../components/Page.tsx';
import { api, errorMessage } from '../lib/api.ts';
import { useApi } from '../lib/hooks.ts';
import '../styles/history.css';

const canCompare = (s: SessionSummaryDTO) => s.status === 'completed' && s.dimensionScores !== null;

interface Notice {
  text: string;
  tone: 'info' | 'problem';
}

export default function History() {
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const list = useSessionList(filters);
  const scenarioList = useApi((signal) => api.scenarios(signal), []);
  const badges = useEarnedBadges();
  const [pendingDelete, setPendingDelete] = useState<SessionSummaryDTO | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selected, setSelected] = useState<SessionSummaryDTO[]>([]);
  const [comparing, setComparing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const focusAfter = useRef<string | null>(null);

  // After a deletion or "Show more", put focus on the row that now sits where the user was.
  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    if (target === 'results') {
      resultsHeading.current?.focus();
      return;
    }
    const row = [...document.querySelectorAll<HTMLElement>('[data-row-id]')].find(
      (el) => el.dataset.rowId === target,
    );
    row?.querySelector<HTMLElement>('[data-row-focus]')?.focus();
  }, [list.items]);

  const scenarios: ScenarioOption[] = (() => {
    const byId = new Map<string, string>();
    for (const s of scenarioList.data ?? []) byId.set(s.id, s.title);
    for (const s of list.items)
      if (!byId.has(s.scenarioId)) byId.set(s.scenarioId, s.scenarioTitle);
    return [...byId]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  })();

  const change = (next: HistoryFilters) => {
    setFilters(next);
    setNotice(null);
  };
  const clear = () => change(DEFAULT_FILTERS);

  const onDeleted = (session: SessionSummaryDTO) => {
    const index = list.items.findIndex((s) => s.id === session.id);
    const neighbour = list.items[index + 1] ?? list.items[index - 1];
    focusAfter.current = neighbour ? neighbour.id : 'results';
    list.remove(session.id);
    setSelected((current) => current.filter((s) => s.id !== session.id));
    setPendingDelete(null);
    setNotice({ text: `Deleted \u201c${session.scenarioTitle}\u201d.`, tone: 'info' });
  };

  const showMore = async () => {
    const fresh = await list.loadMore();
    const first = fresh[0];
    if (first) focusAfter.current = first.id;
  };

  const retry = async (session: SessionSummaryDTO) => {
    if (retryingId) return;
    setRetryingId(session.id);
    setNotice({
      text: `Trying the report for \u201c${session.scenarioTitle}\u201d again\u2026`,
      tone: 'info',
    });
    try {
      const next = await api.evaluate(session.id);
      list.replace(next);
      setSelected((current) => current.filter((s) => s.id !== session.id));
      setNotice(
        next.status === 'completed'
          ? { text: `The report for \u201c${session.scenarioTitle}\u201d is ready.`, tone: 'info' }
          : {
              text: `We tried again, but the report for \u201c${session.scenarioTitle}\u201d still could not be built. Your transcript is safe.`,
              tone: 'problem',
            },
      );
    } catch (error) {
      setNotice({ text: errorMessage(error), tone: 'problem' });
    } finally {
      setRetryingId(null);
    }
  };

  const toggleCompare = (session: SessionSummaryDTO, checked: boolean) =>
    setSelected((current) =>
      checked
        ? current.some((s) => s.id === session.id) || current.length >= 2
          ? current
          : [...current, session]
        : current.filter((s) => s.id !== session.id),
    );

  const compareFor = (session: SessionSummaryDTO) => {
    if (!canCompare(session)) return null;
    const checked = selected.some((s) => s.id === session.id);
    return {
      checked,
      disabled: !checked && selected.length >= 2,
      onChange: (next: boolean) => toggleCompare(session, next),
    };
  };

  const countText = !list.hasData
    ? ''
    : list.total === 0
      ? 'No calls to show.'
      : `Showing ${list.items.length} of ${list.total} ${list.total === 1 ? 'call' : 'calls'}.`;
  const refreshing = list.loading && list.hasData;
  const comparable = list.items.filter(canCompare).length;

  let body;
  if (!list.hasData && list.loading) {
    body = (
      <div className="surface hs-card hs-skeleton" role="status" aria-label="Loading your calls">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="hs-skeleton-row">
            <SkeletonBlock height={18} width="12%" />
            <SkeletonBlock height={18} width="38%" />
            <SkeletonBlock height={18} width="10%" />
            <SkeletonBlock height={18} width="8%" />
          </div>
        ))}
      </div>
    );
  } else if (list.error) {
    body = (
      <ErrorState error={list.error} onRetry={list.reload} title="We couldn’t load your history" />
    );
  } else if (list.hasData && list.total === 0) {
    body = narrowed(filters) ? (
      <EmptyState
        icon="filter"
        title="No calls match these filters"
        action={
          <button type="button" className="btn btn-secondary" onClick={clear}>
            Clear filters
          </button>
        }
      >
        Try a different scenario, difficulty or status.
      </EmptyState>
    ) : (
      <EmptyState
        icon="history"
        title="No practice calls yet"
        action={
          <div className="cluster" style={{ justifyContent: 'center' }}>
            <Link to="/practice" className="btn btn-primary" viewTransition>
              Start practising <Icon name="arrow-right" size={16} />
            </Link>
            <Link to="/scenarios" className="btn btn-secondary" viewTransition>
              Browse scenarios
            </Link>
          </div>
        }
      >
        Calls you practise appear here, newest first, each with its coaching report.
        {filters.includeSamples ? (
          <>
            {' '}
            To see what a finished call looks like first, sample calls can be loaded from the{' '}
            <Link to="/trainer">Trainer page</Link>.
          </>
        ) : (
          <>
            {' '}
            Sample calls are hidden; turn them on above to include any you have loaded from the{' '}
            <Link to="/trainer">Trainer page</Link>.
          </>
        )}
      </EmptyState>
    );
  } else {
    body = (
      <>
        <div className="surface hs-card">
          <HistoryTable
            sessions={list.items}
            badges={badges}
            busy={refreshing}
            retryingId={retryingId}
            compareFor={compareFor}
            onDelete={setPendingDelete}
            onRetry={retry}
          />
        </div>
        {list.hasMore ? (
          <div className="hs-more">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={showMore}
              disabled={list.loadingMore}
            >
              {list.loadingMore ? <span className="spinner" aria-hidden="true" /> : null}
              {list.loadingMore ? 'Loading more\u2026' : 'Show more'}
            </button>
            {list.moreError ? (
              <p className="field-error" role="alert">
                {errorMessage(list.moreError)}
              </p>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <Page title="History" className="hs-page">
      <PageHeader title="My practice history" lead="Track your progress over time." />

      <HistoryFilterBar filters={filters} scenarios={scenarios} onChange={change} />

      {selected.length > 0 ? (
        <div className="surface hs-comparebar" role="region" aria-label="Compare calls">
          <p role="status">
            {selected.length === 1
              ? 'One call selected. Choose one more to compare them.'
              : 'Two calls selected.'}
          </p>
          <div className="cluster">
            <button
              type="button"
              className="btn btn-primary"
              disabled={selected.length !== 2}
              onClick={() => setComparing(true)}
            >
              Compare
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setSelected([])}>
              Clear selection
            </button>
          </div>
        </div>
      ) : null}

      <h2 ref={resultsHeading} tabIndex={-1} className="sr-only">
        Practice calls
      </h2>
      <div className="hs-status">
        <div className="hs-status-text">
          <p role="status" className="t-small t-muted">
            {notice?.tone === 'info' ? `${notice.text} ` : ''}
            {list.hasData && list.total === 0 ? (
              <span className="sr-only">{countText}</span>
            ) : (
              countText
            )}
          </p>
          {notice?.tone === 'problem' ? (
            <p role="alert" className="field-error">
              {notice.text}
            </p>
          ) : null}
          {comparable >= 2 && selected.length === 0 ? (
            <p className="t-meta">Tick two finished calls to compare their scores.</p>
          ) : null}
        </div>
        <div className="hs-status-end">
          {refreshing ? (
            <span className="t-meta hs-updating" aria-hidden="true">
              <span className="spinner" /> Updating
            </span>
          ) : null}
          {isDefault(filters) ? null : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {body}

      <DeleteDialog
        session={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onDeleted={onDeleted}
      />
      <CompareDialog
        sessions={comparing && selected.length === 2 ? [selected[0], selected[1]] : null}
        onClose={() => setComparing(false)}
      />
    </Page>
  );
}
