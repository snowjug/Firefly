import { Band, BandHead } from './Band.tsx';
import { CoachingPreview } from './CoachingPreview.tsx';

export function CoachingSection() {
  return (
    <Band id="coaching" tone="quiet">
      <BandHead
        id="coaching"
        title="Coaching based on what was actually said"
        intro="After the call Firefly scores six skills from 1 to 5 and shows its evidence."
      />
      <CoachingPreview />
    </Band>
  );
}
