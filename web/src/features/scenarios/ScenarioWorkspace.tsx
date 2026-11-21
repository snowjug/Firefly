import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { useAppSection } from '../../app/section.tsx';
import { Button } from '../../design/primitives/Button.tsx';
import { MessageBar } from '../../design/primitives/MessageBar.tsx';
import { api, errorMessage } from '../../lib/api.ts';
import { useApi, useDocumentTitle, useMediaQuery, useOnline } from '../../lib/hooks.ts';
import {
  NO_FILTERS,
  activeFilterCount,
  countLabel,
  difficultyOptions,
  filterScenarios,
  issueOptions,
  productGroups,
  readFilters,
  sortScenarios,
  type Filters,
} from './catalogue.ts';
import { briefPath, defaultConfig, parseConfig, type CallConfig } from './config-params.ts';
import { FilterBar, type FilterPatch } from './FilterBar.tsx';
import { ScenarioList, ScenarioListEmpty, ScenarioListSkeleton } from './ScenarioList.tsx';
import { PaneEmpty, PaneSkeleton, ScenarioPane } from './ScenarioPane.tsx';
import { useVoiceOptions } from './use-voice-options.ts';
import { useWorkspaceSearch } from './use-workspace-search.ts';
import { normaliseSearch, workspaceSearch } from './workspace-url.ts';
import './workspace.css';

/** From here the list and the details sit side by side; below it the list leads to the details. */
const WIDE_QUERY = '(min-width: 64em)';

/**
 * The scenario workspace: filters and the list on the left, the chosen scenario on the right. What
 * is chosen lives in the address (filters, the scenario and every setting), so a view can be shared
 * and survives a refresh. On a narrow screen the list leads to the details, and Back returns.
 */
export function ScenarioWorkspace() {
  useDocumentTitle('Scenarios');
  useAppSection('Scenarios');

  const wide = useMediaQuery(WIDE_QUERY);
  const online = useOnline();
  const voices = useVoiceOptions();
  const { search, address, settled, replace, open, back, tidy } = useWorkspaceSearch();
  const loaded = useApi((signal) => api.scenarios(signal), []);
  const scenarios = loaded.data;

  // ---- What the address says -------------------------------------------------------------
  // (`search` is the address, or a choice the address is still catching up with.)
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const filters = useMemo(() => readFilters(params), [params]);
  const urlId = params.get('scenario');

  const sorted = useMemo(() => (scenarios ? sortScenarios(scenarios) : []), [scenarios]);
  const visible = useMemo(() => filterScenarios(sorted, filters), [sorted, filters]);

  // On a wide screen a scenario is always chosen (the first, when the address names none). On a
  // narrow one the address names a scenario exactly when its details are open. Settings are read
  // from the address only for the scenario it names, so one scenario's changes never carry to another.
  const named = visible.find((scenario) => scenario.id === urlId) ?? null;
  const selected = named ?? (wide ? (visible[0] ?? null) : null);
  const config = useMemo(
    () => (selected ? (named ? parseConfig(params, selected) : defaultConfig(selected)) : null),
    [selected, named, params],
  );
  const detailOpen = !wide && named !== null;

  // Keep the address tidy and true to what is on screen. It is replaced, never added to, so the
  // Back button leaves the workspace instead of stepping through every choice.
  const wanted =
    scenarios && (!selected || config)
      ? workspaceSearch(
          filters,
          selected && config ? { scenarioId: selected.id, scenario: selected, config } : null,
        )
      : null;
  useEffect(() => {
    if (wanted === null || !settled || normaliseSearch(address) === wanted) return;
    tidy(wanted);
  }, [wanted, address, settled, tidy]);

  const searchFor = (
    nextFilters: Filters,
    nextId: string | null,
    nextConfig: CallConfig | null,
  ) => {
    const scenario = nextId ? scenarios?.find((item) => item.id === nextId) : undefined;
    return workspaceSearch(
      nextFilters,
      scenario && nextConfig ? { scenarioId: scenario.id, scenario, config: nextConfig } : null,
    );
  };
  const go = (nextFilters: Filters, nextId: string | null, nextConfig: CallConfig | null) =>
    replace(searchFor(nextFilters, nextId, nextConfig));

  // ---- Filters ---------------------------------------------------------------------------
  const filterBar = useRef<HTMLDivElement>(null);
  const filtered = activeFilterCount(filters) > 0;
  const onFilter = (patch: FilterPatch) =>
    go({ ...filters, ...patch }, selected?.id ?? null, config);
  const clearFilters = () => {
    go(NO_FILTERS, selected?.id ?? null, config);
    // The Clear button goes away: focus moves to the first filter, not to the top of the page.
    const first = [
      ...(filterBar.current?.querySelectorAll<HTMLElement>('select, button') ?? []),
    ].find((element) => !element.closest('[hidden]'));
    first?.focus();
  };

  // ---- Choosing and configuring ----------------------------------------------------------
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const firstSelect = (id: string): CallConfig | null => {
    const next = scenarios?.find((scenario) => scenario.id === id);
    return next ? defaultConfig(next) : null;
  };
  const select = (id: string) => {
    if (id !== selected?.id) go(filters, id, firstSelect(id));
  };
  const openScenario = (id: string) => open(searchFor(filters, id, firstSelect(id)));
  const closeDetail = () => back(searchFor(filters, null, null));
  const changeConfig = (next: CallConfig) => go(filters, selected?.id ?? null, next);
  const resetConfig = () => {
    if (selected) go(filters, selected.id, defaultConfig(selected));
  };

  // Where focus goes as the details open and close on a narrow screen: the title, then the row.
  const heading = useRef<HTMLHeadingElement>(null);
  const wasOpen = useRef(detailOpen);
  const lastOpened = useRef<string | null>(named?.id ?? null);
  useEffect(() => {
    if (named) lastOpened.current = named.id;
    if (detailOpen && !wasOpen.current) heading.current?.focus();
    if (!detailOpen && wasOpen.current) {
      const row = [...document.querySelectorAll<HTMLElement>('[data-scenario]')].find(
        (element) => element.dataset.scenario === lastOpened.current,
      );
      row?.querySelector<HTMLElement>('a')?.focus();
    }
    wasOpen.current = detailOpen;
  }, [detailOpen, named]);

  // An old link can name a scenario that has gone: say so once, then show what there is.
  const [wantedId] = useState(urlId);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const gone =
    scenarios && wantedId && !noticeDismissed && !scenarios.some((item) => item.id === wantedId);

  // ---- What to show ----------------------------------------------------------------------
  const total = scenarios?.length ?? 0;
  const failed = !loaded.loading && !scenarios;
  const countText = scenarios ? countLabel(visible.length, total) : '';
  const hrefFor = (id: string) => searchFor(filters, id, firstSelect(id));

  let list;
  if (loaded.loading && !scenarios) list = <ScenarioListSkeleton />;
  else if (visible.length === 0) {
    list = <ScenarioListEmpty filtered={filtered} onClear={clearFilters} onRetry={loaded.reload} />;
  } else {
    list = (
      <ScenarioList
        scenarios={visible}
        selectedId={selected?.id ?? null}
        mode={wide ? 'select' : 'open'}
        onSelect={select}
        searchFor={hrefFor}
        onOpen={openScenario}
      />
    );
  }

  const pane = (scenario: PublicScenarioDTO, scenarioConfig: CallConfig, titleLevel: 1 | 2 = 2) => (
    <ScenarioPane
      scenario={scenario}
      config={scenarioConfig}
      voices={voices}
      titleLevel={titleLevel}
      onChange={changeConfig}
      onReset={resetConfig}
      customiseOpen={customiseOpen}
      onCustomiseOpenChange={setCustomiseOpen}
      briefTo={briefPath(scenario.id, scenarioConfig, scenario)}
      headingRef={heading}
    />
  );

  if (failed) {
    return (
      <div className="l-page scn-page">
        <h1 className="scn-title">Scenarios</h1>
        <MessageBar
          intent="error"
          title="Scenarios could not be loaded"
          actions={<Button onClick={loaded.reload}>Try again</Button>}
        >
          {online
            ? errorMessage(loaded.error)
            : 'You are offline, so the scenarios could not be loaded. Reconnect, then choose Try again.'}
        </MessageBar>
      </div>
    );
  }

  if (detailOpen && named && config) {
    return (
      <div className="l-page scn-page scn-page--detail">
        <Button appearance="subtle" icon="arrow-left" className="scn-back" onClick={closeDetail}>
          Scenarios
        </Button>
        {pane(named, config, 1)}
      </div>
    );
  }

  return (
    <div className="l-page scn-page">
      <div className="scn-split">
        <div className="scn-side">
          <header className="scn-head">
            <h1 className="scn-title">Scenarios</h1>
            <p className="scn-count" role="status" aria-live="polite" aria-atomic="true">
              <span className="scn-n" key={countText}>
                {countText}
              </span>
            </p>
            {filtered ? (
              <Button size="small" appearance="subtle" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </header>
          {gone ? (
            <MessageBar intent="info" onDismiss={() => setNoticeDismissed(true)}>
              That scenario is no longer in the library. Choose another.
            </MessageBar>
          ) : null}
          {scenarios ? (
            <div ref={filterBar}>
              <FilterBar
                filters={filters}
                products={productGroups(sorted, filters)}
                issues={issueOptions(sorted, filters)}
                difficulties={difficultyOptions(sorted, filters)}
                wide={wide}
                onFilter={onFilter}
              />
            </div>
          ) : null}
          <div className="scn-scroll">{list}</div>
        </div>
        {wide ? (
          loaded.loading && !scenarios ? (
            <PaneSkeleton />
          ) : selected && config ? (
            pane(selected, config)
          ) : (
            <PaneEmpty />
          )
        ) : null}
      </div>
    </div>
  );
}
