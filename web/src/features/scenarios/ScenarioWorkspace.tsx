import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { useAppSection } from '../../app/section.tsx';
import { Button, Dialog, Icon, MessageBar, Skeleton } from '../../design/index.ts';
import { api, errorMessage } from '../../lib/api.ts';
import { useApi, useDocumentTitle, useMediaQuery, useOnline } from '../../lib/hooks.ts';
import {
  NO_FILTERS,
  activeFilterCount,
  countLabel,
  filterScenarios,
  groupByIssue,
  readFilters,
  type Filters,
} from './catalogue.ts';
import { ConfigurationPanel } from './ConfigurationPanel.tsx';
import { defaultConfig, parseConfig, type CallConfig } from './config-params.ts';
import { InProgressBanner, RecentCallsDialog, useActiveCall } from './RecentCalls.tsx';
import { ScenarioDetail } from './ScenarioDetail.tsx';
import { ScenarioList, ScenarioListEmpty, ScenarioListSkeleton } from './ScenarioList.tsx';
import { ScenarioToolbar, type FilterPatch } from './ScenarioToolbar.tsx';
import { SummaryBar } from './SummaryBar.tsx';
import { useWorkspaceSearch } from './use-workspace-search.ts';
import { normaliseSearch, workspaceSearch } from './workspace-url.ts';
import './workspace.css';

/** From here the list and the details sit side by side; below it the details open in a sheet. */
const WIDE_QUERY = '(min-width: 64em)';

interface PaneProps {
  scenario: PublicScenarioDTO;
  config: CallConfig;
  onChange(config: CallConfig): void;
  onReset(): void;
}

/** The chosen scenario's details and setup, on its own scroll area, with the next step pinned under it. */
function ScenarioPane({ scenario, config, onChange, onReset }: PaneProps) {
  const titleId = useId();
  return (
    <section className="scn-pane" aria-labelledby={titleId}>
      <div className="scn-pane__scroll">
        <div className="scn-pane__content">
          <ScenarioDetail scenario={scenario} stage={config.stage} titleId={titleId} />
          <ConfigurationPanel
            key={scenario.id}
            scenario={scenario}
            config={config}
            onChange={onChange}
            onReset={onReset}
          />
        </div>
      </div>
      <div className="scn-pane__bar">
        <SummaryBar scenario={scenario} config={config} />
      </div>
    </section>
  );
}

function PaneSkeleton() {
  return (
    <div className="scn-pane scn-pane--quiet" aria-hidden="true">
      <div className="scn-pane__scroll">
        <div className="scn-pane__content">
          <Skeleton width="30%" />
          <Skeleton width="70%" height="1.75rem" />
          <div className="scn-pane__persona">
            <Skeleton variant="circle" width="3.5rem" height="3.5rem" />
            <Skeleton lines={2} width="12rem" />
          </div>
          <Skeleton lines={3} />
          <Skeleton variant="rect" height="7rem" />
        </div>
      </div>
    </div>
  );
}

function PaneEmpty() {
  return (
    <section className="scn-pane scn-pane--quiet scn-pane--empty" aria-label="Selected scenario">
      <Icon name="document" size={28} />
      <p className="scn-pane__empty-title">No scenario selected</p>
      <p className="scn-pane__empty-text">
        Choose a scenario from the list to read its brief and set up the call.
      </p>
    </section>
  );
}

/**
 * The scenario workspace: the list on the left, the chosen scenario and its call setup on the
 * right. What is chosen lives in the address (search, filters, the scenario and every setting), so a
 * view can be shared and survives a refresh. On narrow screens the details open in a full-screen
 * sheet from the list.
 */
export function ScenarioWorkspace() {
  useDocumentTitle('Choose a scenario');
  useAppSection('Scenarios');

  const wide = useMediaQuery(WIDE_QUERY);
  const online = useOnline();
  const { search, address, settled, replace, tidy } = useWorkspaceSearch();
  const loaded = useApi((signal) => api.scenarios(signal), []);
  const scenarios = loaded.data;
  const activeCall = useActiveCall();

  // ---- What the address says -------------------------------------------------------------
  // (`search` is the address, or a choice the address is still catching up with.)
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const filters = useMemo(() => readFilters(params), [params]);
  const urlId = params.get('scenario');

  const visible = useMemo(
    () => (scenarios ? filterScenarios(scenarios, filters) : []),
    [scenarios, filters],
  );
  const groups = useMemo(() => groupByIssue(visible), [visible]);
  const first = groups[0]?.scenarios[0] ?? null;

  // The chosen scenario is the one in the address if it is in the list; on wide screens, with none
  // chosen, the first one is. Its settings are read from the address only when it is the one named
  // there, so one scenario's changes never carry over to another.
  const named = visible.find((scenario) => scenario.id === urlId) ?? null;
  const selected = named ?? (wide ? first : null);
  const config = useMemo(
    () => (selected ? (named ? parseConfig(params, selected) : defaultConfig(selected)) : null),
    [selected, named, params],
  );

  // Keep the address tidy and true to what is on screen. It is replaced, never added to, so the
  // Back button leaves the workspace instead of stepping through every keystroke and choice.
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

  const go = (nextFilters: Filters, nextId: string | null, nextConfig: CallConfig | null) => {
    const scenario = nextId ? scenarios?.find((item) => item.id === nextId) : undefined;
    replace(
      workspaceSearch(
        nextFilters,
        scenario && nextConfig ? { scenarioId: scenario.id, scenario, config: nextConfig } : null,
      ),
    );
  };

  // ---- Search ----------------------------------------------------------------------------
  // The box holds what was typed, and follows the address when something else changes it.
  const [draft, setDraft] = useState(filters.q);
  const [seenQuery, setSeenQuery] = useState(filters.q);
  if (filters.q !== seenQuery) {
    setSeenQuery(filters.q);
    if (filters.q !== draft) setDraft(filters.q);
  }
  const searchRef = useRef<HTMLInputElement>(null);

  const onQuery = (value: string) => {
    setDraft(value);
    go({ ...filters, q: value }, selected?.id ?? null, config);
  };
  const onFilter = (patch: FilterPatch) =>
    go({ ...filters, ...patch }, selected?.id ?? null, config);
  const clearFilters = () => {
    setDraft('');
    go(NO_FILTERS, selected?.id ?? null, config);
    searchRef.current?.focus();
  };

  // ---- Choosing and configuring ----------------------------------------------------------
  // On narrow screens the sheet is open for one scenario at a time. A page opened with a scenario in
  // its address (the way back from the brief, or a shared link) starts with its sheet open.
  const [sheetFor, setSheetFor] = useState<string | null>(() => (wide ? null : urlId));
  const sheetOpen = !wide && selected !== null && sheetFor === selected.id;

  const select = (id: string) => {
    if (id === selected?.id) return;
    const next = scenarios?.find((scenario) => scenario.id === id);
    if (next) go(filters, id, defaultConfig(next));
  };
  const changeConfig = (next: CallConfig) => go(filters, selected?.id ?? null, next);
  const resetConfig = () => {
    if (selected) go(filters, selected.id, defaultConfig(selected));
  };

  const [recentOpen, setRecentOpen] = useState(false);

  // ---- What to show ----------------------------------------------------------------------
  const filtered = activeFilterCount(filters) > 0;
  const total = scenarios?.length ?? 0;
  const countText = scenarios ? countLabel(visible.length, total) : '';
  const failed = !loaded.loading && !scenarios;

  let list;
  if (loaded.loading && !scenarios) list = <ScenarioListSkeleton />;
  else if (visible.length === 0)
    list = <ScenarioListEmpty filtered={filtered} onClear={clearFilters} />;
  else {
    list = (
      <ScenarioList
        groups={groups}
        selectedId={selected?.id ?? null}
        onSelect={select}
        onPointerChoose={wide ? undefined : setSheetFor}
        scrollable={wide}
      />
    );
  }

  let pane = null;
  if (wide) {
    if (loaded.loading && !scenarios) pane = <PaneSkeleton />;
    else if (selected && config) {
      pane = (
        <ScenarioPane
          scenario={selected}
          config={config}
          onChange={changeConfig}
          onReset={resetConfig}
        />
      );
    } else pane = <PaneEmpty />;
  }

  return (
    <div className="l-page scn-page">
      <header className="scn-head">
        <div className="scn-head__text">
          <h1 className="t-title2">Choose a scenario</h1>
          <p className="scn-head__lead">
            Pick a customer situation, set how demanding the call should be, then review the brief
            before you start.
          </p>
        </div>
        <Button icon="clock" onClick={() => setRecentOpen(true)}>
          Recent calls
        </Button>
      </header>

      {activeCall ? <InProgressBanner call={activeCall} /> : null}

      {failed ? (
        <MessageBar
          intent="error"
          title="Scenarios could not be loaded"
          actions={<Button onClick={loaded.reload}>Try again</Button>}
        >
          {online
            ? errorMessage(loaded.error)
            : 'You are offline, so the scenarios could not be loaded. Reconnect, then choose Try again.'}
        </MessageBar>
      ) : (
        <>
          <ScenarioToolbar
            query={draft}
            filters={filters}
            wide={wide}
            searchRef={searchRef}
            onQuery={onQuery}
            onFilter={onFilter}
          />
          <div className="scn-split">
            <div className="scn-listpane">
              <div className="scn-listhead">
                <p className="scn-count" role="status" aria-live="polite" aria-atomic="true">
                  {countText}
                </p>
                {filtered && scenarios ? (
                  <Button appearance="outline" size="small" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
              {list}
            </div>
            {pane}
          </div>
        </>
      )}

      {/* It stays in the page while the sheet it opens is showing, so closing the sheet can give
          focus back to this very button instead of losing it to the top of the page. */}
      {!wide && selected ? (
        <div className="scn-selected">
          <p className="scn-selected__text">
            <span className="scn-selected__label">Selected</span>
            <span className="scn-selected__title">{selected.title}</span>
          </p>
          <Button appearance="primary" onClick={() => setSheetFor(selected.id)}>
            Review and set up
          </Button>
        </div>
      ) : null}

      {sheetOpen && selected && config ? (
        <Dialog
          open
          title={selected.title}
          onClose={() => setSheetFor(null)}
          size="lg"
          mobile="fullscreen"
          className="scn-sheet"
          closeLabel="Back to scenarios"
          actions={<SummaryBar scenario={selected} config={config} />}
        >
          <div className="scn-sheet__content">
            <ScenarioDetail scenario={selected} stage={config.stage} showTitle={false} />
            <ConfigurationPanel
              key={selected.id}
              scenario={selected}
              config={config}
              onChange={changeConfig}
              onReset={resetConfig}
            />
          </div>
        </Dialog>
      ) : null}

      <RecentCallsDialog
        open={recentOpen}
        onClose={() => setRecentOpen(false)}
        scenarios={scenarios}
      />
    </div>
  );
}
