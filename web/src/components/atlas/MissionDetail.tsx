import { createContext, useContext } from 'react';
import { Link } from 'react-router';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { CALL_STAGE_LABELS, IMPACT_LABELS } from '#shared/domain/vocab.ts';
import { scoreOfFive } from '../report/labels.ts';
import { Icon } from '../Icon.tsx';
import type { AtlasMission } from './atlas-model.ts';

/** False when the practice history could not be read: then nothing on the plate says "not tried yet". */
export const HistoryKnown = createContext(true);

/** Where the trainee stands with a mission, in words (the glyph's fill says it in a shape). */
export function standingText(mission: Pick<AtlasMission, 'status' | 'best'>, known = true): string {
  if (!known) return '';
  if (mission.status === 'completed') {
    return mission.best === null
      ? 'Completed.'
      : `Completed. Best score ${scoreOfFive(mission.best)}.`;
  }
  return mission.status === 'attempted' ? 'Started, not completed yet.' : 'Not tried yet.';
}

/**
 * The small mono lines of public settings: how hard, how long and how big a matter it is; then how
 * the customer starts and where in the case the call falls.
 */
export function factsLines(mission: AtlasMission): [string, string] {
  return [
    [
      DIFFICULTY_PROFILES[mission.difficulty].label,
      `${mission.minutes} min`,
      `${IMPACT_LABELS[mission.impact].label} impact`,
    ].join(' \u00b7 '),
    [`Starts ${mission.start}`, CALL_STAGE_LABELS[mission.stage].label].join(' \u00b7 '),
  ];
}

/** The settings as one line, for the list. */
export function factsText(mission: AtlasMission): string {
  return factsLines(mission).join(' \u00b7 ');
}

/** The mission's description without its title (the title is the name of the link, said once). */
export function descriptionWithoutTitle(mission: AtlasMission, known = true): string {
  const title = mission.title.trim();
  const sentence = /[.!?]$/.test(title) ? title : `${title}.`;
  const text = mission.description.startsWith(sentence)
    ? mission.description.slice(sentence.length).trim()
    : mission.description;
  return known ? text : text.replace(/\s*Not tried yet\./, '').trim();
}

/**
 * What opens beside the mission the pointer is near or the focus is on: its title, the customer,
 * the public settings, where the trainee stands, and the way in. Everything here is also said by
 * the link itself (its name and description) and in the list, so it is hidden from assistive
 * technology; it is for the eye. Its link is for a pointer or a finger: the keyboard uses the
 * mission itself, which is already a link.
 */
export function MissionDetail({
  mission,
  to,
  state,
  reason,
  viewTransition,
}: {
  mission: AtlasMission;
  to: string;
  state: unknown;
  /** Why this is the suggested mission, when it is. */
  reason?: string | undefined;
  viewTransition: boolean;
}) {
  const { persona } = mission;
  const standing = standingText(mission, useContext(HistoryKnown));
  return (
    <>
      <p className="plate-detail__family type-label">{mission.familyLabel}</p>
      <p className="plate-detail__title">{mission.title}</p>
      <p className="plate-detail__who">
        {persona.name}, {persona.role}, {persona.organisation}
      </p>
      <p className="plate-detail__facts type-label">
        {factsLines(mission).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      {standing ? (
        <p className="plate-detail__standing" data-status={mission.status}>
          {standing}
        </p>
      ) : null}
      {reason ? <p className="plate-detail__why">{reason}</p> : null}
      <Link
        className="plate-detail__go"
        to={to}
        state={state}
        viewTransition={viewTransition}
        tabIndex={-1}
      >
        Calibrate <Icon name="arrow-right" size={16} />
      </Link>
    </>
  );
}
