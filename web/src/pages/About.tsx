import { ContentPage } from '../features/content/ContentPage.tsx';
import { AboutSections } from '../features/content/AboutSections.tsx';
import { useDocumentTitle } from '../lib/hooks.ts';

/** What Firefly is, who made it, how it works and what state it is in. */
export default function About() {
  useDocumentTitle('About');
  return (
    <ContentPage
      title="About Firefly"
      lead="Firefly is a practice environment for customer-facing support conversations."
    >
      <AboutSections />
    </ContentPage>
  );
}
