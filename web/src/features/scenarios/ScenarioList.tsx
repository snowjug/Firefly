import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import { Link } from 'react-router';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_RANK, type Difficulty } from '#shared/domain/vocab.ts';
import { Icon } from '../../design/icons.tsx';
import { Button } from '../../design/primitives/Button.tsx';
import { Skeleton } from '../../design/primitives/Skeleton.tsx';
import { VisuallyHidden } from '../../design/primitives/VisuallyHidden.tsx';
import { difficultyLabel, productLine } from './labels.ts';

/** How tall the moving indicator is (the same number is in the stylesheet). */
const INDICATOR_PX = 20;

/** The difficulty: three bars filled to the level, and always its name. */
function Level({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="scn-level">
      <span
        className="scn-level__bars"
        data-steps={DIFFICULTY_RANK[difficulty] + 1}
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
      </span>
      {difficultyLabel(difficulty)}
    </span>
  );
}

interface RowProps {
  scenario: PublicScenarioDTO;
  checked: boolean;
  name: string;
  onSelect(id: string): void;
}

/** A row that chooses the scenario in place: a radio the whole row answers to. */
function SelectRow({ scenario, checked, name, onSelect }: RowProps) {
  const base = useId();
  const inputId = `${base}-input`;
  const metaId = `${base}-meta`;
  const summaryId = `${base}-summary`;
  return (
    <div className="scn-row" data-scenario={scenario.id} data-selected={checked || undefined}>
      <input
        id={inputId}
        className="scn-row__input"
        type="radio"
        name={name}
        value={scenario.id}
        checked={checked}
        aria-describedby={`${metaId} ${summaryId}`}
        onChange={() => onSelect(scenario.id)}
      />
      <div className="scn-row__face">
        <p className="scn-row__meta" id={metaId}>
          <span className="scn-row__product">{productLine(scenario.product)}</span>
          <Level difficulty={scenario.difficulty} />
        </p>
        <label className="scn-row__title" htmlFor={inputId}>
          {scenario.title}
        </label>
        <p className="scn-row__summary" id={summaryId}>
          {scenario.listSummary}
        </p>
      </div>
    </div>
  );
}

interface LinkRowProps {
  scenario: PublicScenarioDTO;
  search: string;
  onOpen(id: string): void;
}

/** A row that opens the scenario: a link, with the whole row as its target. */
function LinkRow({ scenario, search, onOpen }: LinkRowProps) {
  const base = useId();
  const metaId = `${base}-meta`;
  const summaryId = `${base}-summary`;
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    // A plain click opens it here; a click with a modifier key keeps the browser's own behaviour.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onOpen(scenario.id);
  };
  return (
    <li className="scn-row" data-scenario={scenario.id}>
      <div className="scn-row__face">
        <p className="scn-row__meta" id={metaId}>
          <span className="scn-row__product">{productLine(scenario.product)}</span>
          <Level difficulty={scenario.difficulty} />
        </p>
        <Link
          to={{ search }}
          className="scn-row__title scn-row__link"
          aria-describedby={`${metaId} ${summaryId}`}
          onClick={open}
        >
          {scenario.title}
        </Link>
        <p className="scn-row__summary" id={summaryId}>
          {scenario.listSummary}
        </p>
        <Icon name="chevron-right" size={18} className="scn-row__go" />
      </div>
    </li>
  );
}

/**
 * Keeps the moving indicator beside the chosen row. It is positioned from the row's own offset and
 * moved with a transform, so it slides without ever changing the layout. The first placement does
 * not animate (it would slide in from the top); every later one does.
 */
function useIndicator(
  list: RefObject<HTMLDivElement | null>,
  selectedId: string | null,
  order: string,
) {
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const place = () => {
      const row = element.querySelector<HTMLElement>('[data-selected="true"]');
      if (!row) {
        element.style.setProperty('--scn-ind-o', '0');
        return;
      }
      const y = row.offsetTop + (row.offsetHeight - INDICATOR_PX) / 2;
      element.style.setProperty('--scn-ind-y', `${Math.round(y)}px`);
      element.style.setProperty('--scn-ind-o', '1');
    };
    place();
    const frame = requestAnimationFrame(() => {
      element.dataset.placed = 'true';
    });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [list, selectedId, order]);
}

/** Brings the chosen row into view, once, when the page opens with a scenario far down the list. */
function useRevealChosen(list: RefObject<HTMLDivElement | null>, selectedId: string | null) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !selectedId) return;
    done.current = true;
    list.current
      ?.querySelector<HTMLElement>('[data-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [list, selectedId]);
}

export interface ScenarioListProps {
  scenarios: readonly PublicScenarioDTO[];
  selectedId: string | null;
  /** `select` chooses in place (wide screens); `open` opens the scenario (narrow screens). */
  mode: 'select' | 'open';
  onSelect(id: string): void;
  /** The address that opens a scenario, for the links of `open` mode. */
  searchFor(id: string): string;
  onOpen(id: string): void;
}

/**
 * The scenarios as rows. On a wide screen they are one radio group, so the arrow keys move through
 * them (and the details follow) and a screen reader says "3 of 16". On a narrow screen they are
 * links, and the arrow keys move between them. Either way each row is one target, and focus is the
 * outline drawn round it.
 */
export function ScenarioList({
  scenarios,
  selectedId,
  mode,
  onSelect,
  searchFor,
  onOpen,
}: ScenarioListProps) {
  const name = useId();
  const list = useRef<HTMLDivElement>(null);
  const order = scenarios.map((scenario) => scenario.id).join('|');
  useIndicator(list, mode === 'select' ? selectedId : null, order);
  useRevealChosen(list, mode === 'select' ? selectedId : null);

  if (mode === 'open') {
    const move = (event: KeyboardEvent<HTMLUListElement>) => {
      const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('a.scn-row__link')];
      const at = links.findIndex((link) => link === document.activeElement);
      if (at === -1) return;
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? links.length - 1
            : Math.min(links.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)));
      links[next]?.focus();
    };
    return (
      // The arrow keys are an extra on top of Tab: every link stays reachable by Tab alone.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
      <ul className="scn-list" role="list" aria-label="Scenarios" onKeyDown={move}>
        {scenarios.map((scenario) => (
          <LinkRow
            key={scenario.id}
            scenario={scenario}
            search={searchFor(scenario.id)}
            onOpen={onOpen}
          />
        ))}
      </ul>
    );
  }
  return (
    <div className="scn-list scn-list--select" ref={list}>
      <span className="scn-ind" aria-hidden="true" />
      <fieldset className="scn-list__group">
        <legend className="visually-hidden">Scenarios</legend>
        {scenarios.map((scenario) => (
          <SelectRow
            key={scenario.id}
            scenario={scenario}
            checked={scenario.id === selectedId}
            name={name}
            onSelect={onSelect}
          />
        ))}
      </fieldset>
    </div>
  );
}

/** Placeholder rows while the scenarios load. */
export function ScenarioListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="scn-list scn-list--loading" aria-busy="true">
      <VisuallyHidden>Loading scenarios</VisuallyHidden>
      {Array.from({ length: rows }, (_, index) => (
        <div className="scn-row scn-row--skeleton" key={index} aria-hidden="true">
          <div className="scn-row__face">
            <Skeleton width="45%" />
            <Skeleton width="80%" height="1.125rem" />
            <Skeleton lines={2} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ScenarioListEmpty({
  filtered,
  onClear,
  onRetry,
}: {
  /** Something is narrowing the list, so clearing it can help. */
  filtered: boolean;
  onClear(): void;
  onRetry(): void;
}) {
  return (
    <div className="scn-empty">
      <Icon name="search" size={28} className="scn-empty__icon" />
      <h2 className="scn-empty__title">
        {filtered ? 'No scenarios match' : 'No scenarios available'}
      </h2>
      {filtered ? (
        <Button onClick={onClear}>Clear filters</Button>
      ) : (
        <Button onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
