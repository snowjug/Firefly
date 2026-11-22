import scenario from '../library/outlook-shared-mailbox-missing.ts';

// For the validate-scenarios script's own test: a real scenario with its provenance record taken
// away, which the script must refuse. It is not part of the library.
const { grounding: _grounding, ...withoutProvenance } = scenario;
export default withoutProvenance;
