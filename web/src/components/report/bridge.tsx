import { memo, useMemo } from 'react';
import { SignalPresence } from '../signal/SignalPresence.tsx';
import type { BandInfo } from './timeline-model.ts';
import { atmosphereAt } from './journey-model.ts';
import type { Atmosphere } from '../call/atmosphere.ts';

// The one place the debrief meets the parts of the app that other work owns: the page frame, the
// Signal instrument and the field behind the app. Everything the debrief needs from them comes
// through here, so a change to any of them is a change to one file.

export {
  Disclosure,
  EmptyNotice,
  ErrorNotice,
  Ledger,
  LoadingNotice,
  PageFrame,
  PageHead,
  Section,
  Tag,
  Toggle,
  type TagTone,
} from '../frame/index.ts';
export { pulseWorld } from '../world/useWorldPose.ts';

/**
 * The customer as the call chamber's presence, held still at one moment of the call. It is a
 * picture of what the words next to it say, so it is hidden from assistive technology. The dormant
 * dots are the hidden facts of the scenario, as many as there were, and the lit ones are those
 * found by this moment: after the call the total is no secret.
 */
export const FrozenPresence = memo(function FrozenPresence({
  band,
  trend,
  found,
  facts,
  size,
  className,
}: {
  band: Pick<BandInfo, 'id' | 'label'>;
  trend: Atmosphere['trend'];
  /** How many hidden facts had been found by this moment. */
  found: number;
  /** How many hidden facts the scenario held. */
  facts: number;
  size: number;
  className?: string;
}) {
  const atmosphere = useMemo(() => atmosphereAt(band, trend), [band, trend]);
  return (
    <SignalPresence
      atmosphere={atmosphere}
      discovered={Math.min(found, facts)}
      pool={facts}
      shifts={0}
      frozen
      size={size}
      className={className}
    />
  );
});
