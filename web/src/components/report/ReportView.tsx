import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { play } from '../../lib/sound.ts';
import { Page } from '../Page.tsx';
import { AboutSection, NextPracticeSection } from './ClosingSections.tsx';
import { DiscoverySection } from './DiscoverySection.tsx';
import { CurveballSection, JourneySection } from './JourneySections.tsx';
import { HighlightsSection, ImprovementsSection } from './MomentsSections.tsx';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportMeta } from './ReportMeta.tsx';
import { RewardsSection, useSessionRewards } from './RewardsSection.tsx';
import { ScoreOverview } from './ScoreOverview.tsx';
import { SectionNav, type NavItem } from './SectionNav.tsx';
import { SkillDetailsSection } from './SkillsSection.tsx';
import { transcriptHref } from './labels.ts';
import { ReportTurnsContext } from './turns-context.ts';
import '../../styles/report.css';

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
  const rewards = useSessionRewards(session);

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
  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'skills', label: 'Six skills' },
      { id: 'strengths', label: 'What went well' },
      { id: 'skill-details', label: 'Skill details' },
      { id: 'improvements', label: 'Opportunities' },
      { id: 'discovery', label: 'Discovery' },
      { id: 'mood', label: 'Customer temperature' },
      ...(hasCurveball ? [{ id: 'curveball', label: 'Curveball' }] : []),
      ...(showRewards ? [{ id: 'rewards', label: 'Rewards' }] : []),
      { id: 'next', label: 'Next practice' },
      { id: 'about', label: 'About this report' },
    ],
    [hasCurveball, showRewards],
  );

  return (
    <ReportTurnsContext.Provider value={session.turns}>
      <Page title={`Call feedback \u00b7 ${session.scenarioTitle}`} className="rp-root">
        <ReportHeader sessionId={session.id} report={report} headingRef={headingRef} />
        <ReportMeta session={session} report={report} />
        <ScoreOverview report={report} />
        <SectionNav items={navItems} />
        <HighlightsSection
          strengths={report.strengths}
          improvements={report.improvements}
          turnHref={turnHref}
        />
        <SkillDetailsSection dimensions={report.dimensions} turnHref={turnHref} />
        <ImprovementsSection improvements={report.improvements} turnHref={turnHref} />
        <DiscoverySection discovery={report.discovery} turnHref={turnHref} />
        <JourneySection journey={report.journey} turnHref={turnHref} />
        {report.curveball ? (
          <CurveballSection curveball={report.curveball} turnHref={turnHref} />
        ) : null}
        <RewardsSection
          session={session}
          completion={report.completion}
          rewards={rewards}
          celebrate={focusHeading}
        />
        <NextPracticeSection session={session} next={report.nextPractice} />
        <AboutSection session={session} report={report} />
      </Page>
    </ReportTurnsContext.Provider>
  );
}
