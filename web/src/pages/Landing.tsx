import { FinalAction } from '../features/landing/FinalAction.tsx';
import { Hero } from '../features/landing/Hero.tsx';
import { Coverage } from '../features/landing/Coverage.tsx';
import { Evidence } from '../features/landing/Evidence.tsx';
import { ResponsibleNote } from '../features/landing/ResponsibleNote.tsx';
import { Steps } from '../features/landing/Steps.tsx';
import { useLandingTitle } from '../features/landing/use-landing-title.ts';

/** The front door: a short promise, a real call preview, three steps and one way in. No API calls. */
export default function Landing() {
  useLandingTitle();
  return (
    <>
      <Hero />
      <Steps />
      <Coverage />
      <Evidence />
      <ResponsibleNote />
      <FinalAction />
    </>
  );
}
