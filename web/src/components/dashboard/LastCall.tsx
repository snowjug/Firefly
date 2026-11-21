import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { Tag } from '../frame/Tag.tsx';
import { statusOf } from '../history/status.ts';
import {
  callGlyphTraits,
  formatWhen,
  statusTone,
  type ScenarioFacts,
} from '../history/trail-model.ts';
import { Icon } from '../Icon.tsx';
import { reportHref } from '../report/labels.ts';
import { SignalGlyph } from '../signal/SignalGlyph.tsx';
import { NONE } from './dashboard-model.ts';

/**
 * The most recent finished call, as one line: its instrument, what it was, when, how it ended, the
 * overall score when there is one and the way to its coaching report. A call that ended early says
 * so, and has no score unless the report could give one.
 */
export function LastCall({
  call,
  scenario,
}: {
  call: SessionSummaryDTO;
  scenario: ScenarioFacts | undefined;
}) {
  const when = call.endedAt ?? call.startedAt;
  const score = call.overallScore;
  return (
    <div className="home-last">
      <div className="home-last__glyph" aria-hidden="true">
        <SignalGlyph traits={callGlyphTraits(call, scenario)} size={48} />
      </div>
      <div className="home-last__main">
        <p className="home-last__title">{call.scenarioTitle}</p>
        <p className="home-last__meta">
          <time dateTime={when}>{formatWhen(when)}</time>
          <Tag tone={statusTone(call)}>{statusOf(call).label}</Tag>
        </p>
      </div>
      <p className="home-last__score">
        {score === null ? (
          <>
            <span aria-hidden="true">{NONE}</span>
            <span className="sr-only">No score</span>
          </>
        ) : (
          <>
            <span className="home-last__figure">{score.toFixed(1)}</span>
            <span className="home-last__of"> of 5</span>
          </>
        )}
      </p>
      <Link
        to={reportHref(call.id)}
        className="home-last__link text-link"
        aria-label={`View report: ${call.scenarioTitle}`}
        viewTransition
      >
        View report <Icon name="arrow-right" size={16} />
      </Link>
    </div>
  );
}

/** For someone whose calls have not finished yet: one calm sentence and the way in. */
export function NoRecentCalls() {
  return (
    <div className="home-note">
      <p className="home-note__title">No finished calls yet</p>
      <p>
        Your latest call shows up here once you finish one, with its score and a link to the
        coaching report.
      </p>
      <p>
        <Link to="/practice" className="text-link" viewTransition>
          Start practising
        </Link>
      </p>
    </div>
  );
}
