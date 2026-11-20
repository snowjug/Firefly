import { DIFFICULTIES } from '#shared/domain/vocab.ts';
import { coreParams } from '../components/atlas/core-params.ts';
import { defaultChoices } from '../components/scenario/setup-model.ts';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import { CoreLegend } from '../components/signal/CoreLegend.tsx';
import { KeyToPlate } from '../components/signal/KeyToPlate.tsx';
import type { CoreTraits } from '../components/signal/types.ts';

const SAMPLE = makeScenario();

export function KeySection() {
  return (
    <section id="key" aria-labelledby="key-h" className="gal-section">
      <h2 id="key-h" className="gal-h">
        Key and legend
      </h2>
      <p className="gal-note">
        The key to the plate explains the glyph grammar on the atlas. The core legend is the
        lettered list that goes with the core. Both are description lists with real text.
      </p>
      <div className="gal-keys">
        <div>
          <h3 className="gal-sub">Key to the plate</h3>
          <KeyToPlate />
        </div>
        <div>
          <h3 className="gal-sub">Compact</h3>
          <div className="gal-narrow">
            <KeyToPlate compact />
          </div>
        </div>
      </div>
      <h3 className="gal-sub">Core legend, one for each difficulty</h3>
      <div className="gal-keys">
        {DIFFICULTIES.map((difficulty) => {
          const choices = {
            ...defaultChoices(SAMPLE),
            difficulty,
            impact:
              difficulty === 'starter'
                ? ('low' as const)
                : difficulty === 'standard'
                  ? ('medium' as const)
                  : ('high' as const),
            startingTemperature:
              difficulty === 'starter'
                ? ('calm' as const)
                : difficulty === 'standard'
                  ? ('frustrated' as const)
                  : ('angry' as const),
          };
          const traits: CoreTraits = {
            difficulty,
            impact: choices.impact,
            start: choices.startingTemperature,
            stage: 'first-contact',
            status:
              difficulty === 'starter'
                ? 'new'
                : difficulty === 'standard'
                  ? 'attempted'
                  : 'completed',
            minutes: 10,
          };
          return (
            <div key={difficulty}>
              <CoreLegend traits={traits} params={coreParams(choices)} explain />
            </div>
          );
        })}
      </div>
    </section>
  );
}
