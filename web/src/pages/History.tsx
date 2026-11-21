import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { Disclosure } from '../components/frame/Disclosure.tsx';
import { EmptyNotice, ErrorNotice, LoadingNotice } from '../components/frame/Notices.tsx';
import { PageFrame, PageHead } from '../components/frame/PageFrame.tsx';
import { tabDomId, tabPanelDomId } from '../components/frame/TabRow.tsx';
import { CompareDialog } from '../components/history/CompareDialog.tsx';
import { DeleteDialog } from '../components/history/DeleteDialog.tsx';
import {
  RefineFilters,
  StatusTabs,
  refinementsApplied,
  type ScenarioOption,
} from '../components/history/HistoryFilters.tsx';
import {
  DEFAULT_FILTERS,
  isDefault,
  narrowed,
  type HistoryFilters,
} from '../components/history/status.ts';
import { Trail } from '../components/history/Trail.tsx';
import type { ScenarioFacts } from '../components/history/trail-model.ts';
import { useEarnedBadges } from '../components/history/useEarnedBadges.ts';
import { useSessionList } from '../components/history/useSessionList.ts';
import { useStatusCounts } from '../components/history/useStatusCounts.ts';
import { Icon } from '../components/Icon.tsx';
import { KeyToPlate } from '../components/signal/KeyToPlate.tsx';
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
  const counts = useStatusCounts(filters);
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

  // What the library knows about each scenario that a call's own summary does not.
  const facts = useMemo(
    () =>
      new Map<string, ScenarioFacts>(
        (scenarioList.data ?? []).map((s) => [
          s.id,
          { stage: s.callStage, minutes: s.estimatedMinutes, customer: s.persona?.name },
        ]),
      ),
    [scenarioList.data],
  );

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
    counts.reload();
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
      counts.reload();
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
    body = <LoadingNotice label="Loading your calls" lines={5} />;
  } else if (list.error) {
    body = (
      <ErrorNotice error={list.error} onRetry={list.reload} title="We couldn’t load your history" />
    );
  } else if (list.hasData && list.total === 0) {
    body = narrowed(filters) ? (
      <EmptyNotice
        title="No calls match these filters"
        action={
          <button type="button" className="action action--quiet" onClick={clear}>
            Clear filters
          </button>
        }
      >
        Try a different scenario, difficulty or status.
      </EmptyNotice>
    ) : (
      <EmptyNotice
        title="No practice calls yet"
        action={
          <div className="action-row">
            <Link to="/practice" className="action" viewTransition>
              Start practising <Icon name="arrow-right" size={18} />
            </Link>
            <Link to="/scenarios" className="text-link" viewTransition>
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
            <Link to="/trainer" className="text-link">
              Trainer page
            </Link>
            .
          </>
        ) : (
          <>
            {' '}
            Sample calls are hidden; turn them on under Refine to include any you have loaded from
            the{' '}
            <Link to="/trainer" className="text-link">
              Trainer page
            </Link>
            .
          </>
        )}
      </EmptyNotice>
    );
  } else {
    body = (
      <>
        <Trail
          sessions={list.items}
          scenarios={facts}
          badges={badges}
          more={list.hasMore}
          retryingId={retryingId}
          compareFor={compareFor}
          onDelete={setPendingDelete}
          onRetry={retry}
        />
        {list.hasMore ? (
          <div className="trail-more">
            <button
              type="button"
              className="action action--quiet"
              onClick={showMore}
              disabled={list.loadingMore}
              aria-busy={list.loadingMore || undefined}
            >
              {list.loadingMore ? 'Loading more\u2026' : 'Show more'}
            </button>
            {list.moreError ? (
              <p className="trail-problem" role="alert">
                {errorMessage(list.moreError)}
              </p>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  const applied = refinementsApplied(filters);
  return (
    <PageFrame title="History" className="trail-page">
      <PageHead
        eyebrow="History"
        title="My practice history"
        lead="Every call you practise, newest first. Open one to read its coaching report or its transcript."
      />

      <div className="trail-column">
        <form
          className="trail-filters"
          role="search"
          aria-label="Filter calls"
          onSubmit={(event) => event.preventDefault()}
        >
          <StatusTabs
            value={filters.status}
            // With no calls at all every count would be a zero, which says nothing.
            counts={counts.data && counts.data.all > 0 ? counts.data : null}
            panelId="trail"
            onChange={(status) => change({ ...filters, status })}
          />
          <Disclosure
            defaultOpen={applied > 0}
            summary={
              <>
                Refine
                {applied > 0 ? (
                  <span className="trail-refine-count"> {applied} applied</span>
                ) : null}
              </>
            }
          >
            <RefineFilters filters={filters} scenarios={scenarios} onChange={change} />
          </Disclosure>
        </form>

        {selected.length > 0 ? (
          <div
            className="trail-compare-bar glass glass--inspector"
            role="region"
            aria-label="Compare calls"
          >
            <p role="status">
              {selected.length === 1
                ? 'One call selected. Choose one more to compare them.'
                : 'Two calls selected.'}
            </p>
            <div className="action-row">
              <button
                type="button"
                className="action action--compact"
                disabled={selected.length !== 2}
                onClick={() => setComparing(true)}
              >
                Compare
              </button>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  // The bar goes with the selection, so hand focus to the list before it does.
                  resultsHeading.current?.focus();
                  setSelected([]);
                }}
              >
                Clear selection
              </button>
            </div>
          </div>
        ) : null}

        <div className="trail-status">
          <div className="trail-status__text">
            <p role="status" className="trail-status__count">
              {notice?.tone === 'info' ? `${notice.text} ` : ''}
              {list.hasData && list.total === 0 ? (
                <span className="sr-only">{countText}</span>
              ) : (
                countText
              )}
            </p>
            {notice?.tone === 'problem' ? (
              <p role="alert" className="trail-problem">
                {notice.text}
              </p>
            ) : null}
          </div>
          <div className="trail-status__end">
            {comparable >= 2 && selected.length === 0 ? (
              <p className="trail-hint">Tick two finished calls to compare their scores.</p>
            ) : null}
            {refreshing ? (
              <span className="trail-hint" aria-hidden="true">
                Updating
              </span>
            ) : null}
            {isDefault(filters) ? null : (
              <button type="button" className="text-link" onClick={clear}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div
          role="tabpanel"
          id={tabPanelDomId('trail', filters.status)}
          aria-labelledby={tabDomId('trail', filters.status)}
          aria-busy={refreshing}
          className="trail-panel"
        >
          <h2 ref={resultsHeading} tabIndex={-1} className="sr-only">
            Practice calls
          </h2>
          {body}
        </div>

        {list.hasData && list.total > 0 ? (
          <div className="trail-key">
            <Disclosure summary="How to read the instruments">
              <p>
                Each call is drawn from its own settings. Rings are difficulty and size is impact;
                the edge is how the customer started; the heart is the stage of the call, solid only
                for a call taken to a close; a tick is a minute.
              </p>
              <KeyToPlate compact />
            </Disclosure>
          </div>
        ) : null}
      </div>

      <DeleteDialog
        session={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onDeleted={onDeleted}
      />
      <CompareDialog
        sessions={comparing && selected.length === 2 ? [selected[0], selected[1]] : null}
        onClose={() => setComparing(false)}
      />
    </PageFrame>
  );
}
