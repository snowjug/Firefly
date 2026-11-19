import { DIFFICULTIES } from '#shared/domain/vocab.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { Switch } from '../report/Switch.tsx';
import { STATUS_FILTERS, type HistoryFilters, type StatusFilter } from './status.ts';

export interface ScenarioOption {
  id: string;
  title: string;
}

/** Scenario, difficulty and status filters plus the sample toggle. Every control has a visible label. */
export function HistoryFilterBar({
  filters,
  scenarios,
  onChange,
}: {
  filters: HistoryFilters;
  scenarios: readonly ScenarioOption[];
  onChange(next: HistoryFilters): void;
}) {
  return (
    <form
      className="hs-filters"
      onSubmit={(event) => event.preventDefault()}
      role="search"
      aria-label="Filter calls"
    >
      <div className="field hs-field-wide">
        <label className="label" htmlFor="hs-scenario">
          Scenario
        </label>
        <select
          id="hs-scenario"
          className="select"
          value={filters.scenarioId}
          onChange={(event) => onChange({ ...filters, scenarioId: event.target.value })}
        >
          <option value="">All scenarios</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor="hs-difficulty">
          Difficulty
        </label>
        <select
          id="hs-difficulty"
          className="select"
          value={filters.difficulty}
          onChange={(event) => onChange({ ...filters, difficulty: event.target.value })}
        >
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_PROFILES[d].label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor="hs-status">
          Status
        </label>
        <select
          id="hs-status"
          className="select"
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value as StatusFilter })}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="hs-filter-end">
        <Switch
          checked={filters.includeSamples}
          onChange={(includeSamples) => onChange({ ...filters, includeSamples })}
        >
          Show sample calls
        </Switch>
      </div>
    </form>
  );
}
