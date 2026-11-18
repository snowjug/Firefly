import { useId, useState } from 'react';
import { Icon } from '../Icon.tsx';
import { FACETS, type FacetCounts, type FacetKey, type LibraryQuery } from './library-filters.ts';

interface LibraryFiltersProps {
  query: LibraryQuery;
  counts: { available: FacetCounts; totals: FacetCounts };
  /** How many of the collapsible filters are set (the search box is always visible). */
  activeFacets: number;
  onSearchChange(value: string): void;
  onSearchBlur(): void;
  onFacetChange(key: FacetKey, value: string): void;
}

/** Search plus one native select per filter. On narrow screens the selects sit behind a "Filters" button. */
export function LibraryFilters({
  query,
  counts,
  activeFacets,
  onSearchChange,
  onSearchBlur,
  onFacetChange,
}: LibraryFiltersProps) {
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const panelId = `${baseId}-filters`;

  return (
    <form
      role="search"
      aria-label="Find a scenario"
      className="glass card-tight lib-toolbar"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="lib-search-row">
        <div className="lib-search-field">
          <Icon name="search" size={18} />
          <label htmlFor={`${baseId}-q`} className="sr-only">
            Search scenarios
          </label>
          <input
            id={`${baseId}-q`}
            type="search"
            className="input lib-search-input"
            placeholder="Title, topic or customer"
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            value={query.q}
            onChange={(event) => onSearchChange(event.target.value)}
            onBlur={onSearchBlur}
          />
          {query.q ? (
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm lib-search-clear"
              aria-label="Clear search"
              onClick={() => onSearchChange('')}
            >
              <Icon name="x" size={16} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-secondary lib-filters-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name="filter" size={18} />
          Filters
          {activeFacets > 0 ? (
            <span className="chip chip-accent lib-filter-count">{activeFacets} active</span>
          ) : null}
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
        </button>
      </div>

      <div id={panelId} className="lib-facets" data-open={open ? 'true' : 'false'}>
        {FACETS.map((def) => {
          const id = `${baseId}-${def.key}`;
          const value = query.facets[def.key] ?? '';
          // Options no scenario has are left out, unless one is already selected from the URL.
          const values = def.values.filter(
            (v) => (counts.totals[def.key][v] ?? 0) > 0 || v === value,
          );
          return (
            <div className="field" key={def.key}>
              <label className="label" htmlFor={id}>
                {def.label}
              </label>
              <select
                id={id}
                className="select"
                data-active={value ? 'true' : undefined}
                value={value}
                onChange={(event) => onFacetChange(def.key, event.target.value)}
              >
                <option value="">{def.anyLabel}</option>
                {values.map((v) => (
                  <option key={v} value={v}>
                    {def.valueLabel(v)} ({counts.available[def.key][v] ?? 0})
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </form>
  );
}
