import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Carousel } from '../../design/carousel/Carousel.tsx';
import { Button } from '../../design/primitives/Button.tsx';
import { useAnnouncer } from '../../design/primitives/LiveRegion.tsx';
import { MessageBar } from '../../design/primitives/MessageBar.tsx';
import { api, errorMessage } from '../../lib/api.ts';
import { useApi, useDocumentTitle, useOnline } from '../../lib/hooks.ts';
import { useAppSection } from '../../app/section.tsx';
import {
  NO_FILTERS,
  activeFilterCount,
  countLabel,
  difficultyOptions,
  filterScenarios,
  railProducts,
  readFilters,
  sortScenarios,
  type Filters,
} from './catalogue.ts';
import { briefPath, defaultConfig, parseConfig, type CallConfig } from './config-params.ts';
import { DifficultyFilter } from './DifficultyFilter.tsx';
import { GalleryEmpty, GallerySkeleton, RailSkeleton } from './GalleryStates.tsx';
import { cardTitle } from './labels.ts';
import { ProductRail } from './ProductRail.tsx';
import { DetailEmpty, DetailSkeleton, ScenarioDetail } from './ScenarioDetail.tsx';
import { ScenarioCard } from './ScenarioCard.tsx';
import { useVoiceOptions } from './use-voice-options.ts';
import { useWorkspaceSearch } from './use-workspace-search.ts';
import { normaliseSearch, workspaceSearch } from './workspace-url.ts';
import './workspace.css';

/**
 * The scenario workspace, in three coordinated areas: the product rail, the carousel of the scenarios
 * it leaves, and the details of the chosen one with the way on. One scenario is always chosen (the
 * one the address names, else the first shown). What is chosen lives in the address (the filters, the
 * scenario and every setting), so a view can be shared and survives a refresh; the address is only
 * ever replaced, never added to. The areas are stacked in one page at every width; from 64em the
 * details are two columns (what it is, and how to run it with the way on).
 */
export function ScenarioWorkspace() {
  useDocumentTitle('Scenarios');
  useAppSection('Scenarios');

  const online = useOnline();
  const voices = useVoiceOptions();
  const announce = useAnnouncer();
  const group = useId();
  const { search, address, settled, replace, tidy } = useWorkspaceSearch();
  const loaded = useApi((signal) => api.scenarios(signal), []);
  const scenarios = loaded.data;

  // ---- What the address says -------------------------------------------------------------
  // (`search` is the address, or a choice the address is still catching up with.)
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const filters = useMemo(() => readFilters(params), [params]);
  const urlId = params.get('scenario');

  const sorted = useMemo(() => (scenarios ? sortScenarios(scenarios) : []), [scenarios]);
  const visible = useMemo(() => filterScenarios(sorted, filters), [sorted, filters]);

  // A scenario is always chosen: the one the address names, else the first that is shown. Settings
  // are read from the address only for the scenario it names, so one scenario's changes never carry
  // over to another.
  const named = visible.find((scenario) => scenario.id === urlId) ?? null;
  const selected = named ?? visible[0] ?? null;
  const config = useMemo(
    () => (selected ? (named ? parseConfig(params, selected) : defaultConfig(selected)) : null),
    [selected, named, params],
  );

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
  const rail = useRef<HTMLDivElement>(null);
  const filtered = activeFilterCount(filters) > 0;
  const onFilter = (patch: Partial<Filters>) =>
    go({ ...filters, ...patch }, selected?.id ?? null, config);
  const clearFilters = () => {
    go(NO_FILTERS, selected?.id ?? null, config);
    // The Clear button goes away: focus moves to "All", not to the top of the page.
    rail.current?.querySelector<HTMLElement>('input[type="radio"][value=""]')?.focus();
  };

  // ---- Choosing and configuring ----------------------------------------------------------
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const firstSelect = (id: string): CallConfig | null => {
    const next = scenarios?.find((scenario) => scenario.id === id);
    return next ? defaultConfig(next) : null;
  };
  const select = (id: string) => {
    if (id === selected?.id) return;
    go(filters, id, firstSelect(id));
    // The arrow keys already say which card is chosen; this says that the details below changed.
    const chosen = visible.find((scenario) => scenario.id === id);
    if (chosen) announce(`Showing details for ${cardTitle(chosen)}.`);
  };
  const changeConfig = (next: CallConfig) => go(filters, selected?.id ?? null, next);
  const resetConfig = () => {
    if (selected) go(filters, selected.id, defaultConfig(selected));
  };

  // An old link can name a scenario that has gone: say so once, then show what there is.
  const [wantedId] = useState(urlId);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const gone =
    scenarios && wantedId && !noticeDismissed && !scenarios.some((item) => item.id === wantedId);

  // ---- What to show ----------------------------------------------------------------------
  const total = scenarios?.length ?? 0;
  const failed = !loaded.loading && !scenarios;
  const countText = scenarios ? countLabel(visible.length, total) : '';
  const products = useMemo(() => railProducts(sorted, filters), [sorted, filters]);
  const levels = useMemo(() => difficultyOptions(sorted, filters), [sorted, filters]);
  const selectedIndex = selected
    ? visible.findIndex((scenario) => scenario.id === selected.id)
    : -1;

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

  let gallery;
  if (loaded.loading && !scenarios) gallery = <GallerySkeleton />;
  else if (visible.length === 0) {
    gallery = <GalleryEmpty filtered={filtered} onClear={clearFilters} onRetry={loaded.reload} />;
  } else {
    gallery = (
      <Carousel label="Scenarios" noun="scenarios" mode="select" selectedIndex={selectedIndex}>
        {visible.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            mode="select"
            name={group}
            selected={scenario.id === selected?.id}
            onSelect={select}
          />
        ))}
      </Carousel>
    );
  }

  let detail;
  if (loaded.loading && !scenarios) detail = <DetailSkeleton />;
  else if (selected && config) {
    detail = (
      <ScenarioDetail
        scenario={selected}
        config={config}
        voices={voices}
        onChange={changeConfig}
        onReset={resetConfig}
        customiseOpen={customiseOpen}
        onCustomiseOpenChange={setCustomiseOpen}
        briefTo={briefPath(selected.id, config, selected)}
      />
    );
  } else detail = <DetailEmpty />;

  return (
    <div className="l-page scn-page">
      <header className="scn-head">
        <h1 className="scn-title">Scenarios</h1>
        <p className="scn-count" role="status" aria-live="polite" aria-atomic="true">
          <span className="scn-n" key={countText}>
            {countText}
          </span>
        </p>
        <div className="scn-head__tools">
          {scenarios ? (
            <DifficultyFilter
              options={levels}
              value={filters.difficulty}
              onChange={(difficulty) => onFilter({ difficulty })}
            />
          ) : null}
          {filtered ? (
            <Button size="small" appearance="subtle" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </header>
      {gone ? (
        <MessageBar intent="info" onDismiss={() => setNoticeDismissed(true)}>
          That scenario is no longer in the library. Choose another.
        </MessageBar>
      ) : null}
      {scenarios ? (
        <div ref={rail}>
          <ProductRail
            products={products.products}
            total={products.total}
            value={filters.product}
            onChange={(product) => onFilter({ product })}
          />
        </div>
      ) : (
        <RailSkeleton />
      )}
      <div className="scn-gallery">{gallery}</div>
      {detail}
    </div>
  );
}
