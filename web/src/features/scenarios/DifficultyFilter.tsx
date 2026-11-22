import { DIFFICULTIES, type Difficulty } from '#shared/domain/vocab.ts';
import { SegmentedControl } from '../../design/primitives/SegmentedControl.tsx';
import { VisuallyHidden } from '../../design/primitives/VisuallyHidden.tsx';
import type { FilterOption } from './catalogue.ts';

export interface DifficultyFilterProps {
  options: readonly FilterOption<Difficulty>[];
  value: Difficulty | null;
  onChange(value: Difficulty | null): void;
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

function pick(value: string): Difficulty | null {
  return DIFFICULTIES.find((difficulty) => difficulty === value) ?? null;
}

/**
 * The one filter besides the product rail: All, or one difficulty, each with how many scenarios it
 * would show. A choice with nothing behind it is out of reach unless it is the one chosen.
 */
export function DifficultyFilter({ options, value, onChange }: DifficultyFilterProps) {
  const everyone = options.reduce((sum, option) => sum + option.count, 0);
  return (
    <SegmentedControl
      className="scn-diff"
      legend="Difficulty"
      size="small"
      layout="segments"
      value={value ?? 'all'}
      onChange={(next) => onChange(pick(next))}
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
        ...options.map((option) => ({
          value: option.value as string,
          label: (
            <>
              {option.label}
              <Count n={option.count} />
            </>
          ),
          disabled: option.count === 0 && option.value !== value,
        })),
      ]}
    />
  );
}
