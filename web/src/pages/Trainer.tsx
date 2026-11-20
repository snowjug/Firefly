import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DataPanel } from '../components/trainer/DataPanel.tsx';
import { DemoChecklist } from '../components/trainer/DemoChecklist.tsx';
import { ProviderStatus } from '../components/trainer/ProviderStatus.tsx';
import { QuickStart } from '../components/trainer/QuickStart.tsx';
import { RelatedLinks } from '../components/trainer/RelatedLinks.tsx';
import { SpotlightSection } from '../components/trainer/SpotlightSection.tsx';
import { StudioFrame } from '../components/trainer/StudioFrame.tsx';
import { api } from '../lib/api.ts';
import { useApi } from '../lib/hooks.ts';

export default function Trainer() {
  const demo = useApi((signal) => api.demo(signal), []);
  const spotlightId = demo.data?.spotlightScenarioId ?? null;
  const spotlight = useApi<PublicScenarioDTO | null>(
    (signal) => (spotlightId ? api.scenario(spotlightId, signal) : Promise.resolve(null)),
    [spotlightId],
  );
  const scenarios = useApi((signal) => api.scenarios(signal), []);

  return (
    <StudioFrame
      tool="trainer"
      lead="Run a clean, unscripted demo in a few minutes. Everything on this page is real, and anything pre-generated is labelled."
    >
      <ProviderStatus />
      <SpotlightSection demo={demo} spotlight={spotlight} />
      <QuickStart scenarios={scenarios} defaultScenarioId={spotlightId} />
      <DemoChecklist spotlightId={spotlightId} />
      <DataPanel status={demo} />
      <RelatedLinks />
    </StudioFrame>
  );
}
