import { CoachingSection } from '../features/landing/CoachingSection.tsx';
import { FinalAction } from '../features/landing/FinalAction.tsx';
import { Hero } from '../features/landing/Hero.tsx';
import { HowItWorks } from '../features/landing/HowItWorks.tsx';
import { Overview } from '../features/landing/Overview.tsx';
import { ResponsibleUse } from '../features/landing/ResponsibleUse.tsx';
import { ScenarioKinds } from '../features/landing/ScenarioKinds.tsx';
import { useLandingTitle } from '../features/landing/use-landing-title.ts';

/** The front door: what Firefly is, how a call works and how to start. It makes no API calls. */
export default function Landing() {
  useLandingTitle();
  return (
    <>
      <Hero />
      <Overview />
      <HowItWorks />
      <ScenarioKinds />
      <CoachingSection />
      <ResponsibleUse />
      <FinalAction />
    </>
  );
}
