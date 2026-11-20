import { useId, useState, type ReactNode, type Ref } from 'react';
import { ChoiceRow, Field, TabRow, TextInput, tabDomId } from '../frame/index.ts';
import { Icon } from '../Icon.tsx';
import type { LensGroup, PlateView } from './atlas-lens.ts';
import '../../styles/atlas.css';

/** The id the view's panel carries, so the tabs can name it. */
export const PLATE_PANEL = 'plate-view';

/** The tab that names the panel of the current view. */
export const plateTabId = (view: PlateView) => tabDomId(PLATE_PANEL, view);

export interface AtlasToolbarProps {
  view: PlateView;
  onView(view: PlateView): void;
  /** The text in the search box, as typed. */
  search: string;
  searchRef?: Ref<HTMLInputElement>;
  onSearch(text: string): void;
  onSearchBlur(): void;
  groups: LensGroup[];
  /** How many parts of the lens are set. */
  lensSet: number;
  onLens(key: LensGroup['key'], value: string): void;
  /** What the lens and the search leave lit, said in a sentence, for a screen reader too. */
  status: ReactNode;
  narrowed: boolean;
  onClear(): void;
}

/**
 * The tools over the missions: how to show them (chart or list), a search, a lens that narrows them
 * by difficulty, impact, status and family, and the line that says how many are in view. Choosing
 * narrows the missions without moving any of them.
 */
export function AtlasToolbar({
  view,
  onView,
  search,
  searchRef,
  onSearch,
  onSearchBlur,
  groups,
  lensSet,
  onLens,
  status,
  narrowed,
  onClear,
}: AtlasToolbarProps) {
  const [open, setOpen] = useState(false);
  const panelId = `${useId()}-lens`;
  return (
    <div className="plate-tools">
      <div className="plate-tools__row">
        <TabRow
          label="Show the missions as"
          tabs={[
            { id: 'chart', label: 'Chart' },
            { id: 'list', label: 'List' },
          ]}
          active={view}
          onChange={(id) => onView(id === 'list' ? 'list' : 'chart')}
          panelId={PLATE_PANEL}
        />
        <div className="plate-tools__lens">
          <button
            type="button"
            className="plate-lens"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="plate-lens__mark" aria-hidden="true" />
            <span className="plate-lens__word">Lens</span>
            {lensSet > 0 ? <span className="plate-lens__set">{lensSet} set</span> : null}
            <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
          <p className="plate-status" role="status" aria-live="polite">
            {status}
          </p>
          {narrowed ? (
            <button type="button" className="text-link plate-clear" onClick={onClear}>
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="plate-tools__search" role="search" aria-label="Find a mission">
          <Field label="Find a signal">
            <TextInput
              ref={searchRef}
              type="search"
              serif
              counter={false}
              placeholder="Title, topic or customer"
              autoComplete="off"
              spellCheck={false}
              maxLength={100}
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              onBlur={onSearchBlur}
            />
          </Field>
        </div>
      </div>

      <div id={panelId} className="plate-lens__panel" hidden={!open}>
        <p className="plate-lens__lead">
          Light only the missions that match. Nothing on the plate moves.
        </p>
        <div className="plate-lens__groups">
          {groups.map((group) => (
            <ChoiceRow
              key={group.key}
              legend={group.label}
              name={`plate-lens-${group.key}`}
              size="text"
              value={group.value}
              options={[
                { value: '', label: 'Any' },
                ...group.options.map((option) => ({
                  value: option.value,
                  label: `${option.label} (${option.count})`,
                })),
              ]}
              onChange={(value) => onLens(group.key, value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
