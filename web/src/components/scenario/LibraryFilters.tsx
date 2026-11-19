import { useId, useState, type Ref } from 'react';
import { Icon } from '../Icon.tsx';
import { FACETS, type FacetCounts, type FacetKey, type LibraryQuery } from './library-filters.ts';

interface LibraryFiltersProps {
  query: LibraryQuery;
  counts: { available: FacetCounts; totals: FacetCounts };
  searchRef?: Ref<HTMLInputElement>;
  onSearchChange(value: string): void;
  onSearchBlur(): void;
  onFacetChange(key: FacetKey, value: string): void;
}

/**
 * A search box and one native select for each filter. Every control has a visible label. On a phone
 * the selects sit behind a "Filters" button, which says how many are set.
 */
export function LibraryFilters({
  query,
  counts,
  searchRef,
  onSearchChange,
  onSearchBlur,
  onFacetChange,
}: LibraryFiltersProps) {
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const panelId = `${baseId}-filters`;
  const active = FACETS.filter((def) => Boolean(query.facets[def.key])).length;

  return (
    <form
      role="search"
      aria-label="Find a scenario"
      className="glass card-tight lib-toolbar"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="lib-search-row">
        <div className="field lib-search">
          <label className="label" htmlFor={`${baseId}-q`}>
            Search scenarios
          </label>
          <span className="input-icon">
            <Icon name="search" size={18} />
            <input
              ref={searchRef}
              id={`${baseId}-q`}
              type="search"
              className="input"
              placeholder="Title, topic or customer"
              autoComplete="off"
              spellCheck={false}
              maxLength={100}
              value={query.q}
              onChange={(event) => onSearchChange(event.target.value)}
              onBlur={onSearchBlur}
            />
          </span>
        </div>
        <button
          type="button"
          className="btn btn-secondary lib-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name="filter" size={18} />
          Filters
          {active > 0 ? <span className="chip chip-accent">{active} set</span> : null}
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
        </button>
      </div>

      <div id={panelId} className="lib-facets" data-open={open ? 'true' : 'false'}>
        {FACETS.map((def) => {
          const id = `${baseId}-${def.key}`;
          const value = query.facets[def.key] ?? '';
          // Options no scenario has are left out, unless one is already selected from the address.
          const values = def.values.filter(
            (option) => (counts.totals[def.key][option] ?? 0) > 0 || option === value,
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
                {values.map((option) => (
                  <option key={option} value={option}>
                    {def.valueLabel(option)} ({counts.available[def.key][option] ?? 0})
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
