import { useId } from 'react';
import { Icon, type IconName } from '../Icon.tsx';

export type LibraryView = 'map' | 'list';

const OPTIONS: { value: LibraryView; label: string; icon: IconName }[] = [
  { value: 'map', label: 'Map', icon: 'map' },
  { value: 'list', label: 'List', icon: 'list' },
];

/**
 * Two ways to look at the same missions. The list is the complete, plainly structured version; the
 * map is the same set arranged by difficulty territory.
 */
export function ViewToggle({
  value,
  onChange,
}: {
  value: LibraryView;
  onChange(next: LibraryView): void;
}) {
  const name = useId();
  return (
    <fieldset className="lib-view">
      <legend className="sr-only">Library view</legend>
      <div className="segmented">
        {OPTIONS.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <Icon name={option.icon} size={16} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
