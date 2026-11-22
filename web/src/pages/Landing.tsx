import { FeaturedScenarios } from '../features/landing/FeaturedScenarios.tsx';
import { FinalAction } from '../features/landing/FinalAction.tsx';
import { Hero } from '../features/landing/Hero.tsx';
import { ReportPreview } from '../features/landing/ReportPreview.tsx';
import { ResponsibleNote } from '../features/landing/ResponsibleNote.tsx';
import { Steps } from '../features/landing/Steps.tsx';
import { useLandingTitle } from '../features/landing/use-landing-title.ts';

/**
 * The front door, in seven parts: a short promise, a call that plays beside it, the featured
 * scenarios, three steps, a report that shows its evidence first, a line about responsible use, and
 * one way in. Only the featured scenarios ask the server for anything, and the page never waits for them.
 */
export default function Landing() {
  useLandingTitle();
  return (
    <>
      <Hero />
      <FeaturedScenarios />
      <Steps />
      <ReportPreview />
      <ResponsibleNote />
      <FinalAction />
    </>
  );
}
