import { Link } from 'react-router';
import type { DimensionTrendDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { formatDate, plural } from '../../lib/format.ts';
import type { SkillInput } from '../atlas/constellation-layout.ts';
import { Icon } from '../Icon.tsx';
import { Tag } from '../frame/index.ts';
import { reportHref } from '../report/labels.ts';
import { setupPath } from '../scenario/paths.ts';
import { LightPips } from './LightPips.tsx';
import { Sparkline } from './Sparkline.tsx';
import {
  callsScored,
  lightNext,
  lightText,
  movedText,
  skillNumber,
  trendAlt,
  trendSummary,
} from './progress-model.ts';
import '../../styles/progress.css';

export interface SkillReadingProps {
  skill: SkillInput;
  trend: DimensionTrendDTO | undefined;
  strongest: boolean;
  /** How many completed calls it came up as an improvement area in, when more than one. */
  repeated: number | null;
  completedSessions: number;
  /** A scenario built to practise this skill, when one is known. */
  scenario: PublicScenarioDTO | null;
  /** The scenarios are still arriving, so the link is held back rather than moving under the pointer. */
  practiceLoading: boolean;
  /** Whether there is anything to look up at all (there is not, for someone with no calls yet). */
  canPractise: boolean;
  headingLevel: 2 | 3;
  /** The id of the heading, so the surrounding region can be named by it. */
  titleId: string;
}

/**
 * Everything the stars of one skill say, in words and numbers: what it is, how far it is lit, its
 * scores across calls with the line they draw, what moved on the latest call, where it was last
 * evidenced and a scenario to practise it. Real data only; nothing here is an invented insight.
 */
export function SkillReading({
  skill,
  trend,
  strongest,
  repeated,
  completedSessions,
  scenario,
  practiceLoading,
  canPractise,
  headingLevel,
  titleId,
}: SkillReadingProps) {
  const meta = DIMENSIONS[skill.id];
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const points = trend?.points ?? [];
  const summary = trend ? trendSummary(trend) : null;
  const moved = trend ? movedText(trend) : null;
  const latest = points[points.length - 1];
  return (
    <>
      <div className="pg-reading__main">
        <header className="pg-reading__head">
          <p className="pg-reading__no type-label">
            <span>{skillNumber(skill.id)}</span>
            {strongest ? <Tag tone="sage">Strongest so far</Tag> : null}
            {skill.focus ? <Tag tone="amber">Suggested focus</Tag> : null}
          </p>
          <Heading id={titleId} className="pg-reading__title">
            {meta.label}
          </Heading>
          <p className="pg-reading__desc">{meta.description}</p>
        </header>

        <p className="pg-reading__light">
          <LightPips level={skill.level} />
          <span>
            {lightText(skill.level)}
            {skill.evidence > 0 ? ` \u00b7 ${callsScored(skill.evidence)}` : ''}
          </span>
        </p>
        {skill.evidence > 0 ? <p className="pg-reading__next">{lightNext(skill.level)}</p> : null}
      </div>

      <div className="pg-reading__figure">
        {trend && points.length > 0 ? (
          <>
            <Sparkline points={points} label={trendAlt(trend)} />
            <p className="pg-reading__line">
              {summary?.direction ? <Icon name={summary.direction.icon} size={16} /> : null}
              <span>{summary?.text}</span>
            </p>
            {moved ? <p className="pg-reading__moved">{moved}</p> : null}
          </>
        ) : (
          <p className="pg-reading__none">
            This skill is drawn as outlines because no completed call has been scored on it yet.
            That is not a low score: a star lights as soon as one is.
          </p>
        )}

        {latest ? (
          <p className="pg-reading__evidence">
            Last evidenced in the call on {formatDate(latest.at)}.{' '}
            <Link to={reportHref(latest.sessionId)} className="text-link pg-nowrap" viewTransition>
              Open that report
            </Link>
          </p>
        ) : null}

        {repeated !== null ? (
          <p className="pg-reading__repeat">
            Came up as an improvement area in {repeated} of{' '}
            {plural(completedSessions, 'completed call')}.
          </p>
        ) : null}

        {canPractise && skill.evidence > 0 ? (
          practiceLoading ? (
            <div className="pg-focus__wait" aria-hidden="true" />
          ) : scenario ? (
            <p className="pg-reading__practise">
              <Link
                to={setupPath(scenario.id)}
                className="action action--quiet action--compact"
                viewTransition
              >
                Practise it in &ldquo;{scenario.title}&rdquo;
                <Icon name="arrow-right" size={16} />
              </Link>
            </p>
          ) : null
        ) : null}
      </div>
    </>
  );
}
