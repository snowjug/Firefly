import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router';
import { recommendMission, summariseScenarioPractice } from '#shared/domain/recommend.ts';
import { EmptyState, ErrorState, LoadingCards, Page, PageHeader } from '../components/Page.tsx';
import { LibraryFilters } from '../components/scenario/LibraryFilters.tsx';
import {
  EMPTY_QUERY,
  facetCounts,
  filterScenarios,
  isFiltered,
  orderScenarios,
  parseQuery,
  toSearchParams,
  withFacet,
  type FacetKey,
  type LibraryQuery,
} from '../components/scenario/library-filters.ts';
import { ScenarioCard } from '../components/scenario/ScenarioCard.tsx';
import { plural } from '../lib/format.ts';
import { usePractice } from '../lib/practice.ts';
import '../styles/library.css';

/** The address follows typing after this pause, so every key press does not make a history entry. */
const SEARCH_DEBOUNCE_MS = 250;

export default function Library() {
  const { scenarios, sessions, progress } = usePractice();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [params] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const urlQuery = useMemo(() => parseQuery(params), [params]);
  const urlSearch = urlQuery.q;

  // The search box keeps its own text so typing is never held up by the address. The address follows
  // after a short pause (replacing the entry, so Back is not flooded), and the box follows the address
  // again when the person navigates (the top bar search, Back, Forward, a link) rather than types.
  const [text, setText] = useState(urlSearch);
  const [seenLocation, setSeenLocation] = useState(location.key);
  if (seenLocation !== location.key) {
    setSeenLocation(location.key);
    if (navigationType !== 'REPLACE') setText(urlSearch);
  }
  const query = useMemo<LibraryQuery>(() => ({ ...urlQuery, q: text }), [urlQuery, text]);

  const writeSearch = useCallback(() => {
    // The pause can end just after a link was followed, while the next page's code is still loading
    // and this page is still on screen. Writing then would replace the new address and send the
    // person back to the library.
    if (window.location.pathname !== location.pathname) return;
    void navigate(
      { search: toSearchParams({ ...urlQuery, q: text }).toString() },
      { replace: true },
    );
  }, [navigate, location.pathname, urlQuery, text]);

  const searchPending = text.trim() !== urlSearch.trim();
  useEffect(() => {
    if (!searchPending) return;
    const timer = window.setTimeout(writeSearch, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchPending, writeSearch]);

  const go = (next: LibraryQuery) => {
    void navigate({ search: toSearchParams(next).toString() });
  };
  const changeFacet = (key: FacetKey, value: string) => go(withFacet(query, key, value));
  const clearAll = () => {
    setText('');
    go(EMPTY_QUERY);
    searchRef.current?.focus();
  };

  const all = scenarios.data;
  const history = sessions.data?.sessions;
  // What has been practised and what to suggest next. Both are optional: if the history cannot be
  // loaded, scenarios simply show without a practice line.
  const practice = useMemo(() => summariseScenarioPractice(history ?? []), [history]);
  const recommendation = useMemo(
    () =>
      all && history
        ? recommendMission({ scenarios: all, sessions: history, progress: progress.data })
        : null,
    [all, history, progress.data],
  );
  const counts = useMemo(() => facetCounts(all ?? [], query), [all, query]);
  const visible = useMemo(
    () => orderScenarios(filterScenarios(all ?? [], query), recommendation?.scenario.id ?? null),
    [all, query, recommendation],
  );
  const filtered = isFiltered(query);

  const total = all?.length ?? 0;
  const countText =
    visible.length === 0
      ? 'No scenarios match'
      : filtered
        ? `Showing ${visible.length} of ${plural(total, 'scenario')}`
        : plural(total, 'scenario');

  return (
    <Page title="Scenarios" className="lib">
      <PageHeader
        title="Scenarios"
        lead="Choose a customer call to practise. Every customer here is fictional, so never type real customer information."
      />

      {scenarios.loading ? (
        <LoadingCards count={6} label="Loading scenarios" />
      ) : scenarios.error ? (
        <ErrorState
          error={scenarios.error}
          onRetry={scenarios.reload}
          title="Could not load scenarios"
        />
      ) : !all || all.length === 0 ? (
        <EmptyState icon="book" title="No scenarios are available yet">
          Scenarios will appear here once they have been added.
        </EmptyState>
      ) : (
        <>
          {all.length > 1 ? (
            <LibraryFilters
              query={query}
              counts={counts}
              searchRef={searchRef}
              onSearchChange={setText}
              onSearchBlur={() => {
                if (searchPending) writeSearch();
              }}
              onFacetChange={changeFacet}
            />
          ) : null}

          <div className="lib-results">
            <p role="status" aria-live="polite" className="lib-count">
              {countText}
            </p>
            {filtered ? (
              <button type="button" className="btn btn-ghost" onClick={clearAll}>
                Clear filters
              </button>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon="search"
              title="No scenarios match"
              action={
                <button type="button" className="btn btn-secondary" onClick={clearAll}>
                  Clear all filters
                </button>
              }
            >
              Try a different word, or remove a filter to see more of the library.
            </EmptyState>
          ) : (
            <ul role="list" className="lib-grid">
              {visible.map((scenario) => (
                <li key={scenario.id}>
                  <ScenarioCard
                    scenario={scenario}
                    practice={practice.get(scenario.id)}
                    recommendedReason={
                      recommendation?.scenario.id === scenario.id
                        ? recommendation.reason
                        : undefined
                    }
                    showPractice={history !== undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Page>
  );
}
