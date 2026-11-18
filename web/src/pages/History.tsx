import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { CompareDialog } from '../components/history/CompareDialog.tsx';
import { DeleteDialog } from '../components/history/DeleteDialog.tsx';
import { HistoryFilterBar, type ScenarioOption } from '../components/history/HistoryFilters.tsx';
import { SessionRow } from '../components/history/SessionRow.tsx';
import { useSessionList } from '../components/history/useSessionList.ts';
import {
  DEFAULT_FILTERS,
  isDefault,
  narrowed,
  type HistoryFilters,
} from '../components/history/status.ts';
import { Icon } from '../components/Icon.tsx';
import { EmptyState, ErrorState, Page, PageHeader, SkeletonBlock } from '../components/Page.tsx';
import { api, errorMessage } from '../lib/api.ts';
import { useApi } from '../lib/hooks.ts';
import '../styles/history.css';
import '../styles/report.css';

const canCompare = (s: SessionSummaryDTO) => s.status === 'completed' && s.dimensionScores !== null;

export default function History() {
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const list = useSessionList(filters);
  const scenarioList = useApi((signal) => api.scenarios(signal), []);
  const [pendingDelete, setPendingDelete] = useState<SessionSummaryDTO | null>(null);
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<SessionSummaryDTO[]>([]);
  const [comparing, setComparing] = useState(false);
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
    setNotice('');
  };
  const clear = () => change(DEFAULT_FILTERS);

  const onDeleted = (session: SessionSummaryDTO) => {
    const index = list.items.findIndex((s) => s.id === session.id);
    const neighbour = list.items[index + 1] ?? list.items[index - 1];
    focusAfter.current = neighbour ? neighbour.id : 'results';
    list.remove(session.id);
    setSelected((current) => current.filter((s) => s.id !== session.id));
    setPendingDelete(null);
    setNotice(`Deleted \u201c${session.scenarioTitle}\u201d.`);
  };

  const showMore = async () => {
    const fresh = await list.loadMore();
    const first = fresh[0];
    if (first) focusAfter.current = first.id;
  };

  const toggleCompare = (session: SessionSummaryDTO, checked: boolean) =>
    setSelected((current) =>
      checked
        ? current.some((s) => s.id === session.id) || current.length >= 2
          ? current
          : [...current, session]
        : current.filter((s) => s.id !== session.id),
    );

  const countText = !list.hasData
    ? ''
    : list.total === 0
      ? 'No sessions to show.'
      : `Showing ${list.items.length} of ${list.total} ${list.total === 1 ? 'session' : 'sessions'}.`;
  const refreshing = list.loading && list.hasData;

  let body;
  if (!list.hasData && list.loading) {
    body = (
      <div className="stack" role="status" aria-label="Loading your sessions">
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface hs-row">
            <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
              <SkeletonBlock height={22} width="55%" />
              <SkeletonBlock height={14} width="35%" />
              <SkeletonBlock height={26} width="70%" />
            </div>
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
        title="No sessions match these filters"
        action={
          <button type="button" className="btn btn-secondary" onClick={clear}>
            Clear filters
          </button>
        }
      >
        Try a different difficulty, scenario or status.
      </EmptyState>
    ) : (
      <EmptyState
        icon="history"
        title="No practice sessions yet"
        action={
          <div className="cluster" style={{ justifyContent: 'center' }}>
            <Link to="/scenarios" className="btn btn-primary" viewTransition>
              Browse scenarios <Icon name="arrow-right" size={16} />
            </Link>
            <Link to="/trainer" className="btn btn-secondary" viewTransition>
              Open the Trainer page
            </Link>
          </div>
        }
      >
        Calls you practise appear here, newest first, each with its coaching report.
        {filters.includeSamples
          ? ' To see what a finished call looks like first, sample sessions can be loaded from the Trainer page.'
          : ' Sample sessions are hidden; turn them on above to include any you have loaded from the Trainer page.'}
      </EmptyState>
    );
  } else {
    body = (
      <>
        <ul role="list" className="hs-list" aria-busy={refreshing}>
          {list.items.map((session) => {
            const comparable = canCompare(session);
            const checked = selected.some((s) => s.id === session.id);
            return (
              <li key={session.id}>
                <SessionRow
                  session={session}
                  onDelete={setPendingDelete}
                  compare={
                    comparable
                      ? {
                          checked,
                          disabled: !checked && selected.length >= 2,
                          onChange: (next) => toggleCompare(session, next),
                        }
                      : null
                  }
                />
              </li>
            );
          })}
        </ul>
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
    <Page title="History" className="hs-root">
      <PageHeader
        eyebrow="Practice history"
        title="History"
        lead="Every call you have practised, newest first, each with its transcript and coaching report."
      />

      <HistoryFilterBar filters={filters} scenarios={scenarios} onChange={change} />

      {selected.length > 0 ? (
        <div className="surface hs-comparebar" role="region" aria-label="Compare sessions">
          <p role="status">
            {selected.length === 1
              ? 'One session selected. Choose one more to compare them.'
              : 'Two sessions selected.'}
          </p>
          <div className="cluster">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={selected.length !== 2}
              onClick={() => setComparing(true)}
            >
              Compare
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>
              Clear selection
            </button>
          </div>
        </div>
      ) : null}

      <h2 ref={resultsHeading} tabIndex={-1} className="sr-only">
        Practice sessions
      </h2>
      <div className="hs-status">
        <p role="status" className="t-small t-muted">
          {notice ? `${notice} ` : ''}
          {list.hasData && list.total === 0 ? (
            <span className="sr-only">{countText}</span>
          ) : (
            countText
          )}
        </p>
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
