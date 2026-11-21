import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useNavigation,
  useNavigationType,
  useSearchParams,
} from 'react-router';
import { recommendMission } from '#shared/domain/recommend.ts';
import { Atlas } from '../components/atlas/Atlas.tsx';
import { AtlasList } from '../components/atlas/AtlasList.tsx';
import { AtlasToolbar, PLATE_PANEL, plateTabId } from '../components/atlas/AtlasToolbar.tsx';
import { HistoryKnown } from '../components/atlas/MissionDetail.tsx';
import {
  cleared,
  isNarrowed,
  lensGroups,
  lensOf,
  lensSetCount,
  parsePlateQuery,
  toPlateSearchParams,
  withLens,
  type LensKey,
  type PlateQuery,
  type PlateView,
} from '../components/atlas/atlas-lens.ts';
import { applyLens, buildAtlas, isLensEmpty } from '../components/atlas/atlas-model.ts';
import {
  Disclosure,
  EmptyNotice,
  ErrorNotice,
  LoadingNotice,
  PageFrame,
  PageHead,
  tabPanelDomId,
} from '../components/frame/index.ts';
import { setupPath } from '../components/scenario/paths.ts';
import { useScenarioLibrary } from '../components/scenario/useScenarioLibrary.ts';
import { KeyToPlate } from '../components/signal/index.ts';
import { useWorldPose } from '../components/world/useWorldPose.ts';
import { api } from '../lib/api.ts';
import { plural } from '../lib/format.ts';
import { useApi, useMediaQuery } from '../lib/hooks.ts';
import { useReducedMotion } from '../lib/theme.tsx';
import '../styles/atlas.css';

/** The address follows typing after this pause, so every key press does not make a history entry. */
const SEARCH_DEBOUNCE_MS = 250;

const NUMBER_WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
];
const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

/**
 * Missions: the scenario library as a field of small instruments, and the way into calibrating a
 * call. The plate never rearranges: a search or a lens only lights the missions that match.
 */
export default function Library() {
  const scenarios = useScenarioLibrary();
  const sessions = useApi(
    (signal) => api.listSessions({ limit: 100, includeSamples: false }, signal),
    [],
  );
  const progress = useApi((signal) => api.progress(false, signal), []);
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();
  const beside = useMediaQuery('(min-width: 74rem)');
  const narrow = useMediaQuery('(max-width: 39.99rem)');
  const roomy = useMediaQuery('(min-width: 74rem) and (min-height: 56rem)');

  useWorldPose({ intensity: 0.55 });

  const urlQuery = useMemo(() => parsePlateQuery(params), [params]);
  const urlSearch = urlQuery.search.q;

  // The search box keeps its own text so typing is never held up by the address. The address follows
  // after a short pause (replacing the entry, so Back is not flooded), and the box follows the address
  // again when the person navigates (Ctrl+K, Back, Forward, a link) rather than types.
  const [text, setText] = useState(urlSearch);
  const [seenLocation, setSeenLocation] = useState(location.key);
  if (seenLocation !== location.key) {
    setSeenLocation(location.key);
    if (navigationType !== 'REPLACE') setText(urlSearch);
  }
  const query = useMemo<PlateQuery>(
    () => ({ ...urlQuery, search: { ...urlQuery.search, q: text } }),
    [urlQuery, text],
  );

  const writeSearch = useCallback(() => {
    // The pause can end just after a link was followed, while the next page's code is still loading
    // and this page is still on screen. Writing then would replace the new address and send the
    // person back to the missions.
    if (navigation.state !== 'idle') return;
    void navigate(
      {
        search: toPlateSearchParams({
          ...urlQuery,
          search: { ...urlQuery.search, q: text },
        }).toString(),
      },
      { replace: true },
    );
  }, [navigate, navigation.state, urlQuery, text]);

  const searchPending = text.trim() !== urlSearch.trim();
  useEffect(() => {
    if (!searchPending) return;
    const timer = window.setTimeout(writeSearch, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchPending, writeSearch]);

  const go = (next: PlateQuery, replace = false) => {
    void navigate({ search: toPlateSearchParams(next).toString() }, { replace });
  };
  const clearAll = () => {
    setText('');
    go(cleared(query));
    searchRef.current?.focus();
  };

  const all = scenarios.data;
  const history = sessions.data?.sessions;
  const historyKnown = history !== undefined;
  const recommendation = useMemo(
    () =>
      all && history
        ? recommendMission({ scenarios: all, sessions: history, progress: progress.data })
        : null,
    [all, history, progress.data],
  );
  const model = useMemo(
    () => buildAtlas(all ?? [], history ?? [], recommendation?.scenario.id ?? null),
    [all, history, recommendation],
  );

  const lens = lensOf(query);
  const matching = useMemo(() => applyLens(model, lens), [model, lens]);
  const narrowed = isNarrowed(query);
  const lit = isLensEmpty(lens) ? null : matching.matches;
  const groups = useMemo(() => lensGroups(model, query), [model, query]);

  const total = model.missions.length;
  const shown = matching.count;
  const view: PlateView = query.view ?? (narrow ? 'list' : 'chart');
  const backTo = `${location.pathname}${location.search}`;
  const reason = recommendation?.reason;

  const statusText =
    shown === 0
      ? 'No missions match'
      : narrowed
        ? `Showing ${shown} of ${plural(total, 'mission')}`
        : plural(total, 'mission');

  if (scenarios.loading || (sessions.loading && !sessions.data)) {
    return (
      <PageFrame title="Missions" width="wide">
        <LoadingNotice label="Loading missions" />
      </PageFrame>
    );
  }
  if (scenarios.error) {
    return (
      <PageFrame title="Missions" width="wide">
        <ErrorNotice
          level={1}
          error={scenarios.error}
          onRetry={scenarios.reload}
          title="Could not load the missions"
        />
      </PageFrame>
    );
  }
  if (!all || all.length === 0) {
    return (
      <PageFrame title="Missions" width="wide">
        <EmptyNotice level={1} title="No missions are available yet">
          Missions will appear here once scenarios have been added.
        </EmptyNotice>
      </PageFrame>
    );
  }

  const families = model.families.length;
  return (
    <PageFrame title="Missions" width="wide">
      <div className="plate-layout" data-view={view}>
        <div className="plate-rail">
          <div className="plate-intro">
            <PageHead
              eyebrow="Missions"
              title={
                <>
                  The mission <em>field</em>
                </>
              }
              lead={`${numberWord(total)} practice ${total === 1 ? 'call' : 'calls'} in ${numberWord(families).toLowerCase()} ${families === 1 ? 'family' : 'families'}. Choose a signal to calibrate it.`}
            />
            {recommendation ? (
              <p className="plate-suggest">
                <span className="type-label">Suggested next</span>
                <Link
                  className="plate-suggest__link"
                  to={setupPath(recommendation.scenario.id)}
                  state={{ from: backTo }}
                  viewTransition={!reduced}
                >
                  {recommendation.scenario.title}
                </Link>
                <span className="plate-suggest__why">{recommendation.reason}</span>
              </p>
            ) : null}
          </div>
          <div className="plate-key">
            <Disclosure summary="Key to the plate" defaultOpen={roomy}>
              <KeyToPlate compact />
            </Disclosure>
          </div>
        </div>

        <div className="plate-main">
          {all.length > 1 ? (
            <AtlasToolbar
              view={view}
              onView={(next) => go({ ...query, view: next }, true)}
              search={text}
              searchRef={searchRef}
              onSearch={setText}
              onSearchBlur={() => {
                if (searchPending) writeSearch();
              }}
              groups={groups}
              lensSet={lensSetCount(query)}
              onLens={(key: LensKey, value) => go(withLens(query, key, value || null))}
              status={statusText}
              narrowed={narrowed}
              onClear={clearAll}
            />
          ) : null}
          {!historyKnown ? (
            <p className="plate-note">
              Your practice history could not be read, so no mission is marked as tried and none is
              suggested.
            </p>
          ) : null}
          {shown === 0 ? (
            <div className="plate-empty">
              <EmptyNotice
                title="No missions match"
                action={
                  <button type="button" className="action action--quiet" onClick={clearAll}>
                    Clear all filters
                  </button>
                }
              >
                Try a different word, or remove a filter to see more of the field.
              </EmptyNotice>
            </div>
          ) : null}
          <HistoryKnown.Provider value={historyKnown}>
            <div
              role="tabpanel"
              id={tabPanelDomId(PLATE_PANEL, view)}
              aria-labelledby={plateTabId(view)}
            >
              {view === 'chart' ? (
                <Atlas model={model} lit={lit} beside={beside} reason={reason} backTo={backTo} />
              ) : (
                <AtlasList
                  model={model}
                  lit={lit}
                  reason={reason}
                  backTo={backTo}
                  morph={!reduced}
                />
              )}
            </div>
          </HistoryKnown.Provider>
        </div>
      </div>
    </PageFrame>
  );
}
