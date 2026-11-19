import { useEffect, useId, useRef, useState } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { TemperatureOrb } from '../TemperatureOrb.tsx';
import { describeCall, type SettingRow, type SetupChoices } from './setup-model.ts';

interface SetupPreviewProps {
  scenario: PublicScenarioDTO;
  choices: SetupChoices;
  rows: readonly SettingRow[];
  onReset(): void;
  /** "panel" is the side panel on wide screens; "bar" is the collapsible summary docked on narrow ones. */
  variant: 'panel' | 'bar';
}

/** A region that scrolls must be reachable by keyboard, so it takes a tab stop only while it overflows. */
function useScrollable<T extends HTMLElement>(variant: string) {
  const ref = useRef<T>(null);
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setScrollable(el.scrollHeight > el.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [variant]);
  return { ref, scrollable };
}

function PreviewBody({ scenario, choices, rows, onReset }: Omit<SetupPreviewProps, 'variant'>) {
  const profile = DIFFICULTY_PROFILES[choices.difficulty];
  const changed = rows.some((row) => row.changed);
  return (
    <div className="stp-preview-body">
      <p className="stp-sentence">{describeCall(scenario, choices)}</p>

      <div className="stp-preview-difficulty">
        <DifficultyChip difficulty={choices.difficulty} />
        <p>{profile.summary}</p>
      </div>

      <dl className="stp-notes">
        {rows
          .filter((row) => row.key !== 'difficulty')
          .map((row) => (
            <div key={row.key} className="stp-note">
              <dt>
                {row.band ? <TemperatureOrb band={row.band} /> : null}
                <span className="stp-note-text">
                  {row.term}: <strong>{row.value}</strong>
                </span>
                {row.changed ? <span className="stp-changed">Changed</span> : null}
              </dt>
              <dd>{row.description}</dd>
            </div>
          ))}
      </dl>

      <div className="stp-preview-foot">
        {changed ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
            Reset to scenario defaults
          </button>
        ) : (
          <p>This matches the scenario as written.</p>
        )}
        <p>Built from the public scenario brief. What the customer holds back stays hidden.</p>
      </div>
    </div>
  );
}

/** "Your call so far": a plain-language picture of the call that updates with every choice. */
export function SetupPreview({ variant, ...body }: SetupPreviewProps) {
  const titleId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const { ref, scrollable } = useScrollable<HTMLDivElement>(variant);

  if (variant === 'panel') {
    return (
      <section
        ref={ref}
        className="glass card stp-preview"
        aria-labelledby={titleId}
        // A region that scrolls has to be reachable by keyboard, so it is focusable while it overflows.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={scrollable ? 0 : undefined}
      >
        <h2 id={titleId} className="stp-preview-title">
          Your call so far
        </h2>
        <PreviewBody {...body} />
      </section>
    );
  }

  const { choices } = body;
  const peek = [
    DIFFICULTY_PROFILES[choices.difficulty].label,
    `${body.rows.find((row) => row.key === 'impact')?.value ?? ''} impact`,
    body.rows.find((row) => row.key === 'startingTemperature')?.value ?? '',
  ].join(' \u00b7 ');

  return (
    <section className="stp-bar" aria-label="Your call so far">
      <div
        ref={ref}
        id={bodyId}
        className="stp-bar-body"
        hidden={!open}
        role={scrollable ? 'region' : undefined}
        aria-label={scrollable ? 'Your call so far, details' : undefined}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={scrollable ? 0 : undefined}
      >
        <PreviewBody {...body} />
      </div>
      <button
        type="button"
        className="stp-bar-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="stp-bar-text">
          <span className="stp-bar-label">Your call so far</span>
          <span className="stp-bar-peek">{peek}</span>
        </span>
        <Icon name={open ? 'chevron-down' : 'chevron-up'} size={18} />
      </button>
    </section>
  );
}
