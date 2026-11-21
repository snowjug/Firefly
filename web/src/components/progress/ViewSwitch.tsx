import '../../styles/progress.css';

export type SkyView = 'sky' | 'list';

const VIEWS: readonly { id: SkyView; label: string }[] = [
  { id: 'sky', label: 'Constellation' },
  { id: 'list', label: 'List' },
];

/**
 * Two ways to read the same six skills. It is a pair of toggle buttons (not tabs): pressing one
 * swaps the view in place, and the pressed one says so to assistive technology and in its
 * underline, never in colour alone.
 */
export function ViewSwitch({ view, onChange }: { view: SkyView; onChange(view: SkyView): void }) {
  return (
    <div className="pg-switch" role="group" aria-label="Show the skills as">
      {VIEWS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="pg-switch__button"
          aria-pressed={view === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
