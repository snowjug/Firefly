import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DataPanel } from '../components/trainer/DataPanel.tsx';
import { DemoChecklist } from '../components/trainer/DemoChecklist.tsx';
import { ProviderStatusCard } from '../components/trainer/ProviderStatusCard.tsx';
import { QuickStart } from '../components/trainer/QuickStart.tsx';
import { RelatedLinks } from '../components/trainer/RelatedLinks.tsx';
import { SpotlightSection } from '../components/trainer/SpotlightSection.tsx';
import { Page, PageHeader } from '../components/Page.tsx';
import { api } from '../lib/api.ts';
import { useApi } from '../lib/hooks.ts';
import '../styles/trainer.css';

export default function Trainer() {
  const demo = useApi((signal) => api.demo(signal), []);
  const spotlightId = demo.data?.spotlightScenarioId ?? null;
  const spotlight = useApi<PublicScenarioDTO | null>(
    (signal) => (spotlightId ? api.scenario(spotlightId, signal) : Promise.resolve(null)),
    [spotlightId],
  );
  const scenarios = useApi((signal) => api.scenarios(signal), []);

  return (
    <Page title="Trainer">
      <PageHeader
        title="Trainer"
        lead="Run a clean, unscripted demo in a few minutes. Everything on this page is real, and anything pre-generated is labelled."
      />
      <div className="tr-layout">
        <ProviderStatusCard />
        <div className="tr-grid">
          <div className="tr-area-spotlight">
            <SpotlightSection demo={demo} spotlight={spotlight} />
          </div>
          <div className="tr-area-quick">
            <QuickStart scenarios={scenarios} defaultScenarioId={spotlightId} />
          </div>
          <div className="tr-area-checklist">
            <DemoChecklist spotlightId={spotlightId} />
          </div>
        </div>
        <DataPanel status={demo} />
        <RelatedLinks />
      </div>
    </Page>
  );
}
