import { ContentPage } from '../features/content/ContentPage.tsx';
import { ResponsibleAiSections } from '../features/content/ResponsibleAiSections.tsx';
import { useDocumentTitle } from '../lib/hooks.ts';

/** What Firefly does with your words, your voice and the AI models, and where it stops. */
export default function ResponsibleAi() {
  useDocumentTitle('Responsible AI');
  return (
    <ContentPage
      title="Responsible AI"
      lead="Firefly is a training aid. Here is how it treats your words and voice."
    >
      <ResponsibleAiSections />
    </ContentPage>
  );
}
