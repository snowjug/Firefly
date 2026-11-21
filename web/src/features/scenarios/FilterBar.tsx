import { useId, useState } from 'react';
import {
  DIFFICULTIES,
  ISSUE_TYPES,
  PRODUCT_IDS,
  type Difficulty,
  type IssueType,
  type ProductId,
} from '#shared/domain/vocab.ts';
import { Button } from '../../design/primitives/Button.tsx';
import { Field } from '../../design/primitives/Field.tsx';
import { SegmentedControl } from '../../design/primitives/SegmentedControl.tsx';
import { Select } from '../../design/primitives/TextInput.tsx';
import { VisuallyHidden } from '../../design/primitives/VisuallyHidden.tsx';
import {
  activeFilterCount,
  type FilterOption,
  type Filters,
  type ProductGroup,
} from './catalogue.ts';

export type FilterPatch = Partial<Filters>;

export interface FilterBarProps {
  filters: Filters;
  products: readonly ProductGroup[];
  issues: readonly FilterOption<IssueType>[];
  difficulties: readonly FilterOption<Difficulty>[];
  /** Wide screens show every filter; narrow ones keep them in a region that a button opens. */
  wide: boolean;
  onFilter(patch: FilterPatch): void;
}

function pick<T extends string>(list: readonly T[], value: string): T | null {
  return list.find((item) => item === value) ?? null;
}

/** A number that fades in when it changes, so a count never jumps. Read aloud once, in words. */
function Count({ n }: { n: number }) {
  return (
    <>
      <span className="scn-n" key={n} aria-hidden="true">
        {n}
      </span>
      <VisuallyHidden>
        , {n} {n === 1 ? 'scenario' : 'scenarios'}
      </VisuallyHidden>
    </>
  );
}

function FilterFields({ filters, products, issues, difficulties, wide, onFilter }: FilterBarProps) {
  const size = wide ? 'small' : 'medium';
  // An option with nothing behind it is left out of reach, unless it is the one chosen.
  const out = (count: number, chosen: boolean) => count === 0 && !chosen;
  const everyone = difficulties.reduce((sum, option) => sum + option.count, 0);
  return (
    <>
      <Field label="Product" className="scn-ff">
        <Select
          size={size}
          value={filters.product ?? ''}
          onChange={(event) =>
            onFilter({ product: pick<ProductId>(PRODUCT_IDS, event.target.value) })
          }
        >
          <option value="">All products</option>
          {products.map((group) => (
            <optgroup key={group.family} label={group.label}>
              {group.options.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={out(option.count, option.value === filters.product)}
                >
                  {`${option.label} (${option.count})`}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Field label="Issue type" className="scn-ff">
        <Select
          size={size}
          value={filters.issue ?? ''}
          onChange={(event) =>
            onFilter({ issue: pick<IssueType>(ISSUE_TYPES, event.target.value) })
          }
        >
          <option value="">All issue types</option>
          {issues.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={out(option.count, option.value === filters.issue)}
            >
              {`${option.label} (${option.count})`}
            </option>
          ))}
        </Select>
      </Field>
      <SegmentedControl
        className="scn-diff"
        legend="Difficulty"
        size={size}
        layout="segments"
        value={filters.difficulty ?? 'all'}
        onChange={(value) => onFilter({ difficulty: pick<Difficulty>(DIFFICULTIES, value) })}
        options={[
          {
            value: 'all',
            label: (
              <>
                All
                <Count n={everyone} />
              </>
            ),
          },
          ...difficulties.map((option) => ({
            value: option.value,
            label: (
              <>
                {option.label}
                <Count n={option.count} />
              </>
            ),
            disabled: out(option.count, option.value === filters.difficulty),
          })),
        ]}
      />
    </>
  );
}

/**
 * The three filters, each with a visible label and the number of scenarios it would show. On a
 * phone they sit in a region that a button opens and closes, and the button says how many are set.
 */
export function FilterBar(props: FilterBarProps) {
  const regionId = useId();
  const applied = activeFilterCount(props.filters);
  const [open, setOpen] = useState(applied > 0);

  if (props.wide) {
    return (
      <div className="scn-filters">
        <FilterFields {...props} />
      </div>
    );
  }
  return (
    <div className="scn-filters-narrow">
      <Button
        appearance="outline"
        icon="filter"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((current) => !current)}
      >
        {applied > 0 ? `Filters (${applied})` : 'Filters'}
      </Button>
      <div className="scn-filters" id={regionId} hidden={!open}>
        <FilterFields {...props} />
      </div>
    </div>
  );
}
