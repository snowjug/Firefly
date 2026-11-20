import { memo, useContext, type CSSProperties } from 'react';
import { Link, useViewTransitionState } from 'react-router';
import { Tag } from '../frame/index.ts';
import { Icon } from '../Icon.tsx';
import { setupPath } from '../scenario/paths.ts';
import { SignalGlyph } from '../signal/index.ts';
import { describeFamily, type AtlasMission, type AtlasModel } from './atlas-model.ts';
import {
  HistoryKnown,
  descriptionWithoutTitle,
  factsText,
  standingText,
} from './MissionDetail.tsx';
import '../../styles/atlas.css';

const GLYPH = 56;

const Row = memo(function Row({
  mission,
  reason,
  backTo,
  morph,
}: {
  mission: AtlasMission;
  reason: string | undefined;
  backTo: string;
  morph: boolean;
}) {
  const to = setupPath(mission.id);
  const moving = useViewTransitionState(to);
  const known = useContext(HistoryKnown);
  const base = `plate-row-${mission.id}`;
  const { persona } = mission;
  const standing = standingText(mission, known);
  return (
    <li className="plate-row" data-recommended={mission.recommended ? 'true' : undefined}>
      <Link
        className="plate-row__link"
        to={to}
        state={{ from: backTo, status: mission.status }}
        viewTransition={morph}
        aria-labelledby={`${base}-title`}
        aria-describedby={`${base}-about`}
      >
        <span
          className="plate-row__glyph"
          style={moving ? ({ viewTransitionName: 'signal-mission' } as CSSProperties) : undefined}
        >
          <SignalGlyph
            traits={{
              difficulty: mission.difficulty,
              impact: mission.impact,
              start: mission.start,
              stage: mission.stage,
              status: mission.status,
              minutes: mission.minutes,
              recommended: mission.recommended,
            }}
            size={GLYPH}
          />
        </span>
        <span className="plate-row__main">
          <span id={`${base}-title`} className="plate-row__title">
            {mission.title}
          </span>
          <span className="plate-row__who">
            {persona.name}, {persona.role}, {persona.organisation}
          </span>
          {mission.recommended ? (
            <span className="plate-row__why">
              <Tag tone="amber">Suggested next</Tag>
              {reason ? <span>{reason}</span> : null}
            </span>
          ) : null}
        </span>
        <span className="plate-row__meta" aria-hidden="true">
          <span className="plate-row__facts type-label">{factsText(mission)}</span>
          <span className="plate-row__standing" data-status={mission.status}>
            {standing}
          </span>
        </span>
        <Icon name="arrow-right" size={18} className="plate-row__go" />
      </Link>
      <span id={`${base}-about`} className="sr-only">
        {descriptionWithoutTitle(mission, known)}
      </span>
    </li>
  );
});

/**
 * The missions as a list: the same information as the plate, in a form that reads in order and
 * works at any width. Grouped by family, gentlest first; every row is one link to its calibration.
 */
export function AtlasList({
  model,
  lit,
  reason,
  backTo,
  morph,
}: {
  model: AtlasModel;
  lit: ReadonlySet<string> | null;
  reason?: string | undefined;
  backTo: string;
  morph: boolean;
}) {
  return (
    <div className="plate-list">
      {model.families.flatMap((family, index) => {
        const rows = model.missions.filter(
          (mission) => mission.family === family.id && (!lit || lit.has(mission.id)),
        );
        if (rows.length === 0) return [];
        const headingId = `plate-family-${family.id}`;
        return [
          <section key={family.id} className="plate-list__family" aria-labelledby={headingId}>
            <h2 id={headingId} className="plate-list__heading type-label">
              <span className="plate-list__number">{String(index + 1).padStart(2, '0')}</span>
              {family.label}
            </h2>
            <p className="sr-only">{describeFamily(family)}</p>
            <ul className="plate-list__rows" role="list">
              {rows.map((mission) => (
                <Row
                  key={mission.id}
                  mission={mission}
                  reason={mission.recommended ? reason : undefined}
                  backTo={backTo}
                  morph={morph}
                />
              ))}
            </ul>
          </section>,
        ];
      })}
    </div>
  );
}
