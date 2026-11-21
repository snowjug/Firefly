import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { play } from '../../lib/sound.ts';
import { PageFrame } from './bridge.tsx';
import { AboutSection, NextPracticeSection } from './ClosingSections.tsx';
import { DiscoverySection } from './DiscoverySection.tsx';
import { CurveballSection, JourneySection } from './JourneySections.tsx';
import { ImprovementsSection, StrengthsSection } from './MomentsSections.tsx';
import { ReportMasthead } from './ReportMasthead.tsx';
import { ReportOverview } from './ReportOverview.tsx';
import { RewardsSection, useSessionRewards } from './RewardsSection.tsx';
import { SectionRail, type NavItem } from './SectionRail.tsx';
import { SkillsSection } from './SkillsSection.tsx';
import { transcriptHref } from './labels.ts';
import { ReportTurnsContext } from './turns-context.ts';
import { useReconstruction } from './useReconstruction.ts';
import '../../styles/report.css';
import '../../styles/debrief.css';

/**
 * The finished coaching report, as one long editorial page: the call as a title and a line across
 * the page, the customer's mood as a filament, the six skills as a constellation, the moments that
 * mattered with a stronger way to say each, what the call found and what it missed, and one thing
 * to practise next. Every quote links to its turn in the transcript.
 */
export function ReportView({
  session,
  report,
  focusHeading,
}: {
  session: SessionDTO;
  report: CoachingReport;
  /** Move focus to the heading, used when the report replaces the "preparing" screen. */
  focusHeading: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rewards = useSessionRewards(session);
  const replay = useReconstruction(session.id, report.journey.points.length > 1);

  useEffect(() => {
    if (!focusHeading) return;
    headingRef.current?.focus();
    // Arriving straight from the call: a soft sound if the person turned sound on.
    play('reveal');
  }, [focusHeading]);

  const sessionId = session.id;
  const turnHref = useCallback((turn: number) => transcriptHref(sessionId, turn), [sessionId]);
  const hasCurveball = report.curveball !== null;
  const showRewards = rewards.phase !== 'hidden';
  const items = useMemo<NavItem[]>(
    () => [
      { id: 'mood', label: 'Customer temperature' },
      ...(hasCurveball ? [{ id: 'curveball', label: 'Curveball' }] : []),
      { id: 'skills', label: 'Six skills' },
      { id: 'strengths', label: 'What went well' },
      { id: 'improvements', label: 'Opportunities' },
      { id: 'discovery', label: 'Discovery' },
      ...(showRewards ? [{ id: 'rewards', label: 'Rewards' }] : []),
      { id: 'next', label: 'Next practice' },
      { id: 'about', label: 'About this report' },
    ],
    [hasCurveball, showRewards],
  );
  /** A section's number, the same as the one beside it in the rail. */
  const number = (id: string) =>
    String(items.findIndex((item) => item.id === id) + 1).padStart(2, '0');

  return (
    <ReportTurnsContext.Provider value={session.turns}>
      <PageFrame title={`Call feedback \u00b7 ${session.scenarioTitle}`} className="rp">
        <div className="rp-page" data-replay={replay.phase}>
          <ReportMasthead
            session={session}
            report={report}
            headingRef={headingRef}
            replay={replay}
          />
          <div className="rp-body">
            <SectionRail items={items} />
            <div className="rp-main">
              <ReportOverview report={report} />
              <JourneySection
                journey={report.journey}
                discovery={report.discovery}
                eyebrow={number('mood')}
                turnHref={turnHref}
              />
              {report.curveball ? (
                <CurveballSection
                  curveball={report.curveball}
                  eyebrow={number('curveball')}
                  turnHref={turnHref}
                />
              ) : null}
              <SkillsSection
                dimensions={report.dimensions}
                eyebrow={number('skills')}
                turnHref={turnHref}
                sessionId={sessionId}
              />
              <StrengthsSection
                strengths={report.strengths}
                eyebrow={number('strengths')}
                turnHref={turnHref}
                sessionId={sessionId}
              />
              <ImprovementsSection
                improvements={report.improvements}
                eyebrow={number('improvements')}
                turnHref={turnHref}
                sessionId={sessionId}
              />
              <DiscoverySection
                discovery={report.discovery}
                eyebrow={number('discovery')}
                turnHref={turnHref}
                sessionId={sessionId}
              />
              <RewardsSection
                session={session}
                completion={report.completion}
                rewards={rewards}
                celebrate={focusHeading}
                eyebrow={number('rewards')}
              />
              <NextPracticeSection session={session} report={report} eyebrow={number('next')} />
              <AboutSection session={session} report={report} eyebrow={number('about')} />
            </div>
          </div>
        </div>
      </PageFrame>
    </ReportTurnsContext.Provider>
  );
}
