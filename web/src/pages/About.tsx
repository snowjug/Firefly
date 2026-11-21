import { AboutSections } from '../features/content/AboutSections.tsx';
import { ContentPage } from '../features/content/ContentPage.tsx';
import { useDocumentTitle } from '../lib/hooks.ts';

/** What Firefly is, how its coaching works and what state it is in. */
export default function About() {
  useDocumentTitle('About');
  return (
    <ContentPage
      title="About Firefly"
      lead="A voice-first simulator for practising Microsoft product support calls."
    >
      <AboutSections />
    </ContentPage>
  );
}
