import { useEffect, useId, useRef } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { STYLE_LABELS } from '#shared/domain/vocab.ts';
import { Badge, Button, Icon, Skeleton, StateBadge, VisuallyHidden } from '../../design/index.ts';
import type { ScenarioGroup } from './catalogue.ts';
import { START_STATE, difficultyLabel, impactLabel, minutesLabel, startsLabel } from './labels.ts';
import './scenario-list.css';

const MAX_TAGS = 3;

interface RowProps {
  scenario: PublicScenarioDTO;
  checked: boolean;
  onSelect(id: string): void;
  onPointerChoose?(id: string): void;
}

function ScenarioRow({ scenario, checked, onSelect, onPointerChoose }: RowProps) {
  const base = useId();
  const inputId = `${base}-input`;
  const summaryId = `${base}-summary`;
  const metaId = `${base}-meta`;
  return (
    <div className="scn-row">
      <input
        id={inputId}
        className="scn-row__input"
        type="radio"
        name="scenario"
        value={scenario.id}
        checked={checked}
        aria-describedby={`${summaryId} ${metaId}`}
        onChange={() => onSelect(scenario.id)}
        // A press, tap or click has a click count; arrow keys and Space move the choice without
        // one, and must never open the sheet.
        onClick={(event) => {
          if (event.detail > 0) onPointerChoose?.(scenario.id);
        }}
      />
      <div className="scn-row__face">
        <label className="scn-row__title" htmlFor={inputId}>
          {scenario.title}
        </label>
        <p className="scn-row__summary" id={summaryId}>
          {scenario.summary}
        </p>
        <div className="scn-row__meta" id={metaId}>
          <Badge size="small" tone="neutral" icon={null}>
            {difficultyLabel(scenario.difficulty)}
          </Badge>
          <Badge size="small" tone="neutral" icon={null} appearance="outline">
            {impactLabel(scenario.impact)}
          </Badge>
          <StateBadge
            size="small"
            state={START_STATE[scenario.startingTemperature]}
            label={startsLabel(scenario.startingTemperature)}
          />
          <span className="scn-row__fact">
            <Icon name="chat" size={14} />
            {STYLE_LABELS[scenario.style].label}
          </span>
          <span className="scn-row__fact">
            <Icon name="clock" size={14} />
            {minutesLabel(scenario.estimatedMinutes)}
          </span>
          {scenario.tags.length > 0 ? (
            <span className="scn-row__tags">{scenario.tags.slice(0, MAX_TAGS).join(', ')}</span>
          ) : null}
        </div>
        <Icon name="check-circle" size={20} className="scn-row__check" />
      </div>
    </div>
  );
}

export interface ScenarioListProps {
  groups: readonly ScenarioGroup[];
  selectedId: string | null;
  onSelect(id: string): void;
  /** A click or tap on a row (not an arrow key): narrow screens open the details. */
  onPointerChoose?(id: string): void;
  /** The list scrolls on its own and can be focused to scroll it with the keyboard. */
  scrollable: boolean;
}

/** Brings the chosen row into view inside the list's own scroll area, once, when the page opens. */
function useScrollToChosen(selectedId: string | null, scrollable: boolean) {
  const region = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const container = region.current;
    if (done.current || !scrollable || !container || !selectedId) return;
    done.current = true;
    const row = container
      .querySelector<HTMLElement>('input:checked')
      ?.closest<HTMLElement>('.scn-row');
    if (!row || container.scrollHeight <= container.clientHeight) return;
    const top = row.offsetTop - container.offsetTop;
    if (
      top + row.offsetHeight > container.scrollTop + container.clientHeight ||
      top < container.scrollTop
    ) {
      container.scrollTop = Math.max(0, top - container.clientHeight / 3);
    }
  }, [selectedId, scrollable]);
  return region;
}

/**
 * The scenarios as one radio group, so arrow keys move through them and a screen reader says
 * "3 of 13". Each row is a native radio styled as a row; the group headings are issue types.
 */
export function ScenarioList({
  groups,
  selectedId,
  onSelect,
  onPointerChoose,
  scrollable,
}: ScenarioListProps) {
  const region = useScrollToChosen(selectedId, scrollable);
  return (
    <div
      ref={region}
      className="scn-scroll"
      {...(scrollable ? { role: 'region', 'aria-label': 'Scenario list', tabIndex: 0 } : {})}
    >
      <fieldset className="scn-list">
        <legend className="visually-hidden">Choose a scenario</legend>
        {groups.map((group) => (
          <div className="scn-group" key={group.issueType}>
            <h2 className="scn-group__title">
              {group.label}
              <span className="scn-group__count">
                {group.scenarios.length}
                <VisuallyHidden>
                  {' '}
                  {group.scenarios.length === 1 ? 'scenario' : 'scenarios'}
                </VisuallyHidden>
              </span>
            </h2>
            {group.scenarios.map((scenario) => (
              <ScenarioRow
                key={scenario.id}
                scenario={scenario}
                checked={scenario.id === selectedId}
                onSelect={onSelect}
                onPointerChoose={onPointerChoose}
              />
            ))}
          </div>
        ))}
      </fieldset>
    </div>
  );
}

/** Placeholder rows while the scenarios load. */
export function ScenarioListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="scn-scroll" aria-busy="true">
      <VisuallyHidden>Loading scenarios</VisuallyHidden>
      <div className="scn-list scn-list--loading">
        {Array.from({ length: rows }, (_, index) => (
          <div className="scn-row scn-row--skeleton" key={index}>
            <div className="scn-row__face">
              <Skeleton width="55%" />
              <Skeleton lines={2} />
              <div className="scn-row__meta">
                <Skeleton variant="rect" width="5rem" height="1.375rem" />
                <Skeleton variant="rect" width="6rem" height="1.375rem" />
                <Skeleton variant="rect" width="7rem" height="1.375rem" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScenarioListEmpty({
  filtered,
  onClear,
}: {
  /** Something is narrowing the list, so clearing it can help. */
  filtered: boolean;
  onClear(): void;
}) {
  return (
    <div className="scn-empty">
      <Icon name="search" size={28} className="scn-empty__icon" />
      <h2 className="scn-empty__title">
        {filtered ? 'No scenarios match' : 'No scenarios available'}
      </h2>
      <p className="scn-empty__text">
        {filtered
          ? 'Try different words, or remove a filter to see more.'
          : 'There are no scenarios to show right now. Try again in a moment.'}
      </p>
      {filtered ? <Button onClick={onClear}>Clear filters</Button> : null}
    </div>
  );
}
