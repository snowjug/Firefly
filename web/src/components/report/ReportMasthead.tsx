import { useMemo, type RefObject } from 'react';
import { Link } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';
import { FrozenPresence } from './bridge.tsx';
import { journeyDiscoveries } from './journey-model.ts';
import { JourneyStrip } from './JourneyStrip.tsx';
import { PRINT_HINT, transcriptHref } from './labels.ts';
import { ReportMeta } from './ReportMeta.tsx';
import type { Reconstruction } from './useReconstruction.ts';

const END_TREND_WORD = { rising: ', rising', steady: '', falling: ', easing' } as const;

/**
 * The opening of the debrief: the call as a title (the scenario, in large serif) with the customer
 * and the facts of the call under it, the customer's presence held still as they were at the end,
 * and under both the whole call as one line across the page. The page heading is "Call feedback:"
 * and the scenario, so a screen reader hears what the page is and which call it is about.
 */
export function ReportMasthead({
  session,
  report,
  headingRef,
  replay,
}: {
  session: SessionDTO;
  report: CoachingReport;
  headingRef: RefObject<HTMLHeadingElement | null>;
  replay: Reconstruction;
}) {
  const roomy = useMediaQuery('(min-width: 900px)');
  const beside = useMediaQuery('(min-width: 640px)');
  const { persona } = session.scenario;
  const end = session.state;
  const discoveries = useMemo(
    () => journeyDiscoveries(report.discovery.results),
    [report.discovery.results],
  );
  return (
    <header className="rp-mast">
      <div className="rp-mast__text">
        <p className="rp-eyebrow type-label">Practice coaching report</p>
        <h1 id="rp-title" className="rp-title" tabIndex={-1} ref={headingRef}>
          <span className="sr-only">Call feedback:</span> {session.scenarioTitle}
        </h1>
        <p className="rp-who">
          <span className="rp-who__name">{persona.name}</span>
          <span className="rp-who__role">
            {persona.role}, {persona.organisation}
          </span>
        </p>
        <ReportMeta session={session} report={report} />
        <div className="action-row rp-mast__actions">
          <button
            type="button"
            className="action action--quiet"
            aria-describedby="rp-print-hint"
            onClick={() => window.print()}
          >
            <Icon name="print" size={18} /> Download report
          </button>
          <span id="rp-print-hint" className="sr-only">
            {PRINT_HINT}
          </span>
          <Link to={transcriptHref(session.id)} className="text-link" viewTransition>
            Review transcript
          </Link>
        </div>
      </div>

      <figure className="rp-mast__presence">
        <FrozenPresence
          band={end.band}
          trend={end.trend}
          found={report.discovery.found + report.discovery.partial}
          facts={report.discovery.total}
          size={roomy ? 288 : beside ? 196 : 148}
        />
        <figcaption className="rp-mast__caption">
          {`Customer at the end: ${end.band.label}`}
          <span>{END_TREND_WORD[end.trend]}</span>
        </figcaption>
      </figure>

      <JourneyStrip
        points={report.journey.points}
        discoveries={discoveries}
        phase={replay.phase}
        onSkip={replay.skip}
      />
    </header>
  );
}
