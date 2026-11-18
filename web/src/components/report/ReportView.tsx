import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { Page } from '../Page.tsx';
import { AboutSection, NextPracticeSection } from './ClosingSections.tsx';
import { DiscoverySection } from './DiscoverySection.tsx';
import { CurveballSection, JourneySection } from './JourneySections.tsx';
import { ImprovementsSection, StrengthsSection } from './MomentsSections.tsx';
import { ReportHeader } from './ReportHeader.tsx';
import { SectionNav, type NavItem } from './SectionNav.tsx';
import { SkillsSection } from './SkillsSection.tsx';
import { transcriptHref } from './labels.ts';
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
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  const sessionId = session.id;
  const turnHref = useCallback((turn: number) => transcriptHref(sessionId, turn), [sessionId]);
  const hasCurveball = report.curveball !== null;
  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'skills', label: 'Six skills' },
      { id: 'strengths', label: 'What went well' },
      { id: 'improvements', label: 'Opportunities' },
      { id: 'discovery', label: 'Discovery' },
      { id: 'mood', label: 'Customer temperature' },
      ...(hasCurveball ? [{ id: 'curveball', label: 'Curveball' }] : []),
      { id: 'next', label: 'Next practice' },
      { id: 'about', label: 'About this report' },
    ],
    [hasCurveball],
  );

  return (
    <Page title={`Coaching report \u00b7 ${session.scenarioTitle}`} className="rp-root">
      <ReportHeader session={session} report={report} headingRef={headingRef} />
      <div className="rp-body">
        <div className="rp-rail-col">
          <SectionNav items={navItems} />
        </div>
        <div className="rp-content">
          <SkillsSection dimensions={report.dimensions} turnHref={turnHref} />
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
  );
}
