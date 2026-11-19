import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router';
import { recommendMission, summariseScenarioPractice } from '#shared/domain/recommend.ts';
import { Icon } from '../components/Icon.tsx';
import { MissionMap } from '../components/mission/MissionMap.tsx';
import { ViewToggle, type LibraryView } from '../components/mission/ViewToggle.tsx';
import { EmptyState, ErrorState, LoadingCards, Page } from '../components/Page.tsx';
import { isOneOf } from '../components/scenario/guards.ts';
import { LibraryFilters } from '../components/scenario/LibraryFilters.tsx';
import {
  EMPTY_QUERY,
  SORT_KEYS,
  SORT_LABELS,
  activeFilters,
  facetCounts,
  filterScenarios,
  parseQuery,
  sortScenarios,
  toSearchParams,
  withFacet,
  type ActiveFilter,
  type FacetKey,
  type LibraryQuery,
} from '../components/scenario/library-filters.ts';
import { ScenarioCard } from '../components/scenario/ScenarioCard.tsx';
import { ScenarioPreviewDialog } from '../components/scenario/ScenarioPreviewDialog.tsx';
import { plural } from '../lib/format.ts';
import { useMediaQuery } from '../lib/hooks.ts';
import { usePractice } from '../lib/practice.ts';
import { readStorage, writeStorage } from '../lib/storage.ts';
import '../styles/library.css';
import '../styles/mission-map.css';

const SEARCH_DEBOUNCE_MS = 250;
const VIEW_KEY = 'firefly.library.view';
const isView = (value: unknown): value is LibraryView => value === 'map' || value === 'list';

export default function Library() {
  const { scenarios, sessions, progress } = usePractice();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [params] = useSearchParams();
  const sortId = useId();
  const mappable = useMediaQuery('(min-width: 760px)');
  const roomy = useMediaQuery('(min-width: 1000px)');

  const urlQuery = useMemo(() => parseQuery(params), [params]);
  const urlSearch = urlQuery.q;

  // The map is the first view on a wide screen; the list is always one switch away and is the only
  // view on a phone. The address wins, then what the person last chose, then the screen size.
  const requestedView = params.get('view');
  const view: LibraryView = !mappable
    ? 'list'
    : isView(requestedView)
      ? requestedView
      : (() => {
          const stored = readStorage<unknown>(VIEW_KEY, null);
          return isView(stored) ? stored : roomy ? 'map' : 'list';
        })();
  /** The address keeps the chosen view when filters or the search change. */
  const searchString = useCallback(
    (next: LibraryQuery) => {
      const search = toSearchParams(next);
      if (isView(requestedView)) search.set('view', requestedView);
      return search.toString();
    },
    [requestedView],
  );
  const changeView = (next: LibraryView) => {
    writeStorage(VIEW_KEY, next);
    const search = toSearchParams(urlQuery);
    search.set('view', next);
    void navigate({ search: search.toString() }, { replace: true });
  };

  // The search box keeps its own text so typing is never held up by the URL. The URL follows after a
  // short pause (replacing the entry, so Back is not flooded), and the box follows the URL again when
  // the person navigates (Back, Forward, a link) rather than types.
  const [text, setText] = useState(urlSearch);
  const [seenLocation, setSeenLocation] = useState(location.key);
  if (seenLocation !== location.key) {
    setSeenLocation(location.key);
    if (navigationType !== 'REPLACE') setText(urlSearch);
  }

  const query = useMemo<LibraryQuery>(() => ({ ...urlQuery, q: text }), [urlQuery, text]);

  const writeSearch = useCallback(() => {
    // The pause can end just after a link was followed, while the next page's chunk is still loading
    // and this page is still on screen. Writing then would replace the new address and send the
    // person back to the library.
    if (window.location.pathname !== location.pathname) return;
    void navigate({ search: searchString({ ...urlQuery, q: text }) }, { replace: true });
  }, [navigate, location.pathname, urlQuery, text, searchString]);

  const searchPending = text.trim() !== urlSearch.trim();
  useEffect(() => {
    if (!searchPending) return;
    const timer = window.setTimeout(writeSearch, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchPending, writeSearch]);

  const go = (next: LibraryQuery) => {
    void navigate({ search: searchString(next) });
  };

  const all = scenarios.data;
  const counts = useMemo(() => facetCounts(all ?? [], query), [all, query]);
  const visible = useMemo(
    () => sortScenarios(filterScenarios(all ?? [], query), query.sort),
    [all, query],
  );
  const matchIds = useMemo(() => new Set(visible.map((s) => s.id)), [visible]);
  const active = activeFilters(query);
  const activeFacets = active.filter((f) => f.key !== 'q').length;

  // What has been practised and what to suggest next. Both are optional: if the history cannot be
  // loaded, missions simply show without a practice state.
  const history = sessions.data?.sessions;
  const practice = useMemo(() => summariseScenarioPractice(history ?? []), [history]);
  const recommendation = useMemo(
    () =>
      all && history
        ? recommendMission({ scenarios: all, sessions: history, progress: progress.data })
        : null,
    [all, history, progress.data],
  );
  const showPractice = history !== undefined;

  const statusRef = useRef<HTMLParagraphElement>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewing = all?.find((s) => s.id === previewId) ?? null;
  const closePreview = useCallback(() => setPreviewId(null), []);
  const openPreview = useCallback((s: { id: string }) => setPreviewId(s.id), []);

  const removeFilter = (filter: ActiveFilter) => {
    statusRef.current?.focus();
    if (filter.key === 'q') {
      setText('');
      go({ ...query, q: '' });
    } else {
      go(withFacet(query, filter.key, ''));
    }
  };
  const clearAll = () => {
    statusRef.current?.focus();
    setText('');
    go({ ...EMPTY_QUERY, sort: query.sort });
  };
  const changeFacet = (key: FacetKey, value: string) => go(withFacet(query, key, value));

  const total = all?.length ?? 0;
  const countText =
    visible.length === 0
      ? 'No scenarios match'
      : active.length > 0
        ? `Showing ${visible.length} of ${plural(total, 'scenario')}`
        : plural(total, 'scenario');

  return (
    <Page title="Scenarios">
      <header className="lib-header">
        <p className="t-label">Scenario library</p>
        <h1 className="t-title">Scenarios</h1>
        <p className="t-lead">
          Choose a customer call to practise. Preview a scenario, set it up your way, or start with
          its defaults.
        </p>
        <p className="lib-note">
          <Icon name="shield" size={16} />
          <span>Every customer here is fictional. Don't enter real customer information.</span>
        </p>
      </header>

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
              activeFacets={activeFacets}
              onSearchChange={setText}
              onSearchBlur={() => {
                if (searchPending) writeSearch();
              }}
              onFacetChange={changeFacet}
            />
          ) : null}

          <div className="lib-results">
            <p ref={statusRef} tabIndex={-1} role="status" className="lib-count">
              {countText}
            </p>
            <div className="lib-tools">
              {mappable && all.length > 1 ? (
                <ViewToggle value={view} onChange={changeView} />
              ) : null}
              {view === 'list' && all.length > 1 ? (
                <div className="field lib-sort">
                  <label className="label" htmlFor={sortId}>
                    Sort by
                  </label>
                  <select
                    id={sortId}
                    className="select"
                    value={query.sort}
                    onChange={(event) => {
                      const sort = event.target.value;
                      if (isOneOf(SORT_KEYS, sort)) go({ ...query, sort });
                    }}
                  >
                    {SORT_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {SORT_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </div>

          {active.length > 0 ? (
            <ul role="list" className="cluster lib-active" aria-label="Active filters">
              {active.map((filter) => (
                <li key={filter.key}>
                  <button
                    type="button"
                    className="chip lib-chip"
                    onClick={() => removeFilter(filter)}
                    aria-label={`Remove filter: ${filter.label}, ${filter.value}`}
                  >
                    <span>
                      {filter.label}: <strong>{filter.value}</strong>
                    </span>
                    <Icon name="x" size={14} />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
                  Clear all
                </button>
              </li>
            </ul>
          ) : null}

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
          ) : view === 'map' ? (
            <MissionMap
              scenarios={all}
              matchIds={matchIds}
              practice={practice}
              recommendation={recommendation}
              onPreview={openPreview}
            />
          ) : (
            <ul role="list" className="grid-cards lib-grid">
              {visible.map((scenario) => (
                <li key={scenario.id}>
                  <ScenarioCard
                    scenario={scenario}
                    onPreview={openPreview}
                    practice={practice.get(scenario.id)}
                    recommended={recommendation?.scenario.id === scenario.id}
                    showPractice={showPractice}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ScenarioPreviewDialog scenario={previewing} onClose={closePreview} />
    </Page>
  );
}
