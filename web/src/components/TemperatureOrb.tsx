import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import { TEMPERATURE_BANDS } from '#shared/domain/vocab.ts';

export function bandLabel(id: TemperatureBandId): string {
  return TEMPERATURE_BANDS.find((b) => b.id === id)?.label ?? id;
}

/** A small glowing orb. Colour is never the only signal: the band is always available as text. */
export function TemperatureOrb({
  band,
  large = false,
}: {
  band: TemperatureBandId;
  large?: boolean;
}) {
  return (
    <span
      className={`temp-orb${large ? ' temp-orb-lg' : ''}`}
      data-band={band}
      aria-hidden="true"
    />
  );
}
