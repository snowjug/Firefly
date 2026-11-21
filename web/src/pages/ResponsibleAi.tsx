import { ContentPage } from '../features/content/ContentPage.tsx';
import {
  RESPONSIBLE_AI_TOC,
  ResponsibleAiSections,
} from '../features/content/ResponsibleAiSections.tsx';
import { useDocumentTitle } from '../lib/hooks.ts';

/** What Firefly does with your words, your voice and the AI models, and where it stops. */
export default function ResponsibleAi() {
  useDocumentTitle('Responsible AI');
  return (
    <ContentPage
      title="Responsible AI"
      lead="Firefly is a training aid. This page explains what it does with your words, your voice and the AI models behind it."
      toc={RESPONSIBLE_AI_TOC}
    >
      <ResponsibleAiSections />
    </ContentPage>
  );
}
