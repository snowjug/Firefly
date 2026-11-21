import { DIFFICULTIES } from '#shared/domain/vocab.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { ChoiceRow } from '../frame/ChoiceRow.tsx';
import { Field, SelectInput } from '../frame/Field.tsx';
import { TabRow } from '../frame/TabRow.tsx';
import { Toggle } from '../frame/Toggle.tsx';
import { STATUS_FILTERS, type HistoryFilters, type StatusFilter } from './status.ts';
import type { StatusCounts } from './useStatusCounts.ts';

export interface ScenarioOption {
  id: string;
  title: string;
}

/**
 * The status filter as words on a hairline, each with how many calls it would show (when that is
 * known). Choosing one asks the server again; the panel it controls is the list under it.
 */
export function StatusTabs({
  value,
  counts,
  onChange,
  panelId,
}: {
  value: StatusFilter;
  counts: StatusCounts | null;
  onChange(next: StatusFilter): void;
  panelId: string;
}) {
  return (
    <TabRow
      label="Show calls by status"
      panelId={panelId}
      active={value}
      onChange={(id) => onChange(id as StatusFilter)}
      tabs={STATUS_FILTERS.map((filter) => ({
        id: filter.value,
        label: filter.label,
        count: counts?.[filter.value],
      }))}
    />
  );
}

/** How many of the refinements (difficulty, scenario, sample calls) differ from "everything". */
export function refinementsApplied(filters: HistoryFilters): number {
  return (
    (filters.difficulty !== '' ? 1 : 0) +
    (filters.scenarioId !== '' ? 1 : 0) +
    (filters.includeSamples ? 0 : 1)
  );
}

/**
 * The quieter filters: difficulty as a row of words, the scenario as a list and whether sample
 * calls are shown. Every control has a visible label.
 */
export function RefineFilters({
  filters,
  scenarios,
  onChange,
}: {
  filters: HistoryFilters;
  scenarios: readonly ScenarioOption[];
  onChange(next: HistoryFilters): void;
}) {
  return (
    <div className="trail-refine">
      <ChoiceRow
        legend="Difficulty"
        name="trail-difficulty"
        size="text"
        value={filters.difficulty}
        onChange={(difficulty) => onChange({ ...filters, difficulty })}
        options={[
          { value: '', label: 'All' },
          ...DIFFICULTIES.map((difficulty) => ({
            value: difficulty,
            label: DIFFICULTY_PROFILES[difficulty].label,
          })),
        ]}
      />
      <Field label="Scenario">
        <SelectInput
          value={filters.scenarioId}
          onChange={(event) => onChange({ ...filters, scenarioId: event.target.value })}
        >
          <option value="">All scenarios</option>
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.title}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Toggle
        label="Show sample calls"
        hint="Samples are demonstration calls. They never count towards your progress."
        checked={filters.includeSamples}
        onChange={(includeSamples) => onChange({ ...filters, includeSamples })}
      />
    </div>
  );
}
