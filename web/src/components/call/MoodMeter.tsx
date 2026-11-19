import type { PublicStateDTO } from '#shared/domain/api.ts';
import { TEMPERATURE_BANDS } from '#shared/domain/vocab.ts';

export const TREND_TEXT: Record<PublicStateDTO['trend'], string> = {
  rising: 'Getting more tense',
  steady: 'Holding steady',
  falling: 'Easing',
};

/** A small coloured dot that goes with a mood's name. The name is always written beside it. */
export function MoodDot({ band }: { band: PublicStateDTO['band']['id'] }) {
  return <span className="mood-dot" data-band={band} aria-hidden="true" />;
}

/**
 * How the customer feels, in words and in five steps. It is shown in guided practice only. The
 * steps are decoration: the label and the sentence under them say the same thing.
 */
export function MoodMeter({ state }: { state: PublicStateDTO }) {
  const level = TEMPERATURE_BANDS.findIndex((band) => band.id === state.band.id);
  return (
    <div className="mood" data-band={state.band.id}>
      <p className="mood-head">
        <span className="mood-title">Customer mood</span>
        <strong className="mood-label">
          <MoodDot band={state.band.id} />
          {state.band.label}
        </strong>
      </p>
      <ol className="mood-steps" aria-hidden="true">
        {TEMPERATURE_BANDS.map((band, index) => (
          <li key={band.id} data-band={band.id} data-on={index <= level} />
        ))}
      </ol>
      <p className="mood-note">
        {TREND_TEXT[state.trend]}
        <span className="sr-only">
          . Step {level + 1} of {TEMPERATURE_BANDS.length}
        </span>
      </p>
    </div>
  );
}
