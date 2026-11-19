import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import { deriveAchievements } from '#shared/domain/achievements.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { play } from '../../lib/sound.ts';
import { Page } from '../Page.tsx';
import { AboutSection, NextPracticeSection } from './ClosingSections.tsx';
import { AchievementsSection } from './AchievementsSection.tsx';
import { DiscoverySection } from './DiscoverySection.tsx';
import { CurveballSection, JourneySection } from './JourneySections.tsx';
import { ImprovementsSection, StrengthsSection } from './MomentsSections.tsx';
import { ReportHeader } from './ReportHeader.tsx';
import { SectionNav, type NavItem } from './SectionNav.tsx';
import { SkillsSection } from './SkillsSection.tsx';
import { transcriptHref } from './labels.ts';
import { ReportTurnsContext } from './turns-context.ts';
import '../../styles/report.css';
import '../../styles/report-reveal.css';

/** The finished coaching report. Every quote links to its turn in the transcript. */
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
  const earned = useMemo(
    () => deriveAchievements(report, { proficiency: session.scenario.config.proficiency }),
    [report, session.scenario.config.proficiency],
  );

  useEffect(() => {
    if (!focusHeading) return;
    headingRef.current?.focus();
    // Arriving straight from the call: a soft sound if the person turned sound on.
    play(earned.length > 0 ? 'earned' : 'reveal');
    // Only on arrival, not whenever the report is re-derived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusHeading]);

  const sessionId = session.id;
  const turnHref = useCallback((turn: number) => transcriptHref(sessionId, turn), [sessionId]);
  const hasCurveball = report.curveball !== null;
  const hasEarned = earned.length > 0;
  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'skills', label: 'Six skills' },
      ...(hasEarned ? [{ id: 'earned', label: 'Earned' }] : []),
      { id: 'strengths', label: 'What went well' },
      { id: 'improvements', label: 'Opportunities' },
      { id: 'discovery', label: 'Discovery' },
      { id: 'mood', label: 'Customer temperature' },
      ...(hasCurveball ? [{ id: 'curveball', label: 'Curveball' }] : []),
      { id: 'next', label: 'Next practice' },
      { id: 'about', label: 'About this report' },
    ],
    [hasCurveball, hasEarned],
  );

  return (
    <ReportTurnsContext.Provider value={session.turns}>
      <Page title={`Coaching report \u00b7 ${session.scenarioTitle}`} className="rp-root">
        <ReportHeader session={session} report={report} headingRef={headingRef} />
        <div className="rp-body">
          <div className="rp-rail-col">
            <SectionNav items={navItems} />
          </div>
          <div className="rp-content">
            <SkillsSection dimensions={report.dimensions} turnHref={turnHref} />
            <AchievementsSection earned={earned} turnHref={turnHref} />
            <StrengthsSection strengths={report.strengths} turnHref={turnHref} />
            <ImprovementsSection improvements={report.improvements} turnHref={turnHref} />
            <DiscoverySection discovery={report.discovery} turnHref={turnHref} />
            <JourneySection journey={report.journey} turnHref={turnHref} />
            {report.curveball ? (
              <CurveballSection curveball={report.curveball} turnHref={turnHref} />
            ) : null}
            <NextPracticeSection session={session} next={report.nextPractice} />
            <AboutSection report={report} />
          </div>
        </div>
      </Page>
    </ReportTurnsContext.Provider>
  );
}
