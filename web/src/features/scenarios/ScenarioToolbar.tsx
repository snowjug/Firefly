import { useId, useState, type RefObject } from 'react';
import {
  DIFFICULTIES,
  IMPACTS,
  IMPACT_LABELS,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  type BusinessImpact,
  type Difficulty,
  type IssueType,
} from '#shared/domain/vocab.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { Button, Field, SearchBox, Select } from '../../design/index.ts';
import type { Filters } from './catalogue.ts';
import './toolbar.css';

export type FilterPatch = Partial<Pick<Filters, 'issue' | 'difficulty' | 'impact'>>;

export interface ScenarioToolbarProps {
  /** What is in the search box (it may be a moment ahead of the address). */
  query: string;
  filters: Filters;
  /** Wide screens show every control; narrow ones keep the filters in a region that opens. */
  wide: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onQuery(value: string): void;
  onFilter(patch: FilterPatch): void;
}

function pick<T extends string>(list: readonly T[], value: string): T | null {
  return list.find((item) => item === value) ?? null;
}

function FilterSelects({ filters, onFilter }: Pick<ScenarioToolbarProps, 'filters' | 'onFilter'>) {
  return (
    <>
      <Field label="Issue type" className="scn-tools__filter scn-tools__filter--issue">
        <Select
          value={filters.issue ?? ''}
          onChange={(event) =>
            onFilter({ issue: pick<IssueType>(ISSUE_TYPES, event.target.value) })
          }
        >
          <option value="">All</option>
          {ISSUE_TYPES.map((type) => (
            <option key={type} value={type}>
              {ISSUE_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Difficulty" className="scn-tools__filter">
        <Select
          value={filters.difficulty ?? ''}
          onChange={(event) =>
            onFilter({ difficulty: pick<Difficulty>(DIFFICULTIES, event.target.value) })
          }
        >
          <option value="">All</option>
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {DIFFICULTY_PROFILES[difficulty].label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Business impact" className="scn-tools__filter">
        <Select
          value={filters.impact ?? ''}
          onChange={(event) =>
            onFilter({ impact: pick<BusinessImpact>(IMPACTS, event.target.value) })
          }
        >
          <option value="">All</option>
          {IMPACTS.map((impact) => (
            <option key={impact} value={impact}>
              {IMPACT_LABELS[impact].label}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

/**
 * Search and three filters, each with a visible label. On a phone the search stays in view and the
 * filters sit in a region that a button opens and closes.
 */
export function ScenarioToolbar({
  query,
  filters,
  wide,
  searchRef,
  onQuery,
  onFilter,
}: ScenarioToolbarProps) {
  const regionId = useId();
  const applied = [filters.issue, filters.difficulty, filters.impact].filter(Boolean).length;
  const [open, setOpen] = useState(applied > 0);

  const search = (
    <Field label="Search scenarios" className="scn-tools__search">
      <SearchBox
        ref={searchRef}
        value={query}
        onChange={onQuery}
        placeholder="Title or customer"
        clearLabel="Clear search"
      />
    </Field>
  );

  if (wide) {
    return (
      <div className="scn-tools">
        {search}
        <FilterSelects filters={filters} onFilter={onFilter} />
      </div>
    );
  }
  return (
    <div className="scn-tools scn-tools--narrow">
      <div className="scn-tools__row">
        {search}
        <Button
          appearance="outline"
          icon="filter"
          className="scn-tools__toggle"
          title="Filters"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="scn-tools__toggle-text">Filters</span>
          {applied > 0 ? ` (${applied})` : ''}
        </Button>
      </div>
      <div className="scn-tools__filters" id={regionId} hidden={!open}>
        <FilterSelects filters={filters} onFilter={onFilter} />
      </div>
    </div>
  );
}
