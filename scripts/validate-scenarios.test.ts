import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getScenarioLibrary } from '../server/scenarios/index.ts';

// The command a person runs before adding a scenario: `npm run validate:scenarios`. It prints a
// coverage summary and each scenario's provenance, and fails when a scenario has no valid record.

const run = (...files: string[]) => {
  const result = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', 'scripts/validate-scenarios.ts', ...files],
    { encoding: 'utf8' },
  );
  return { status: result.status, out: result.stdout, err: result.stderr };
};

describe('validate-scenarios', () => {
  it('passes the library and prints one provenance line for each scenario', () => {
    const { status, out } = run();
    expect(status).toBe(0);
    const library = getScenarioLibrary();
    expect(out).toMatch(new RegExp(`^Scenarios loaded: ${library.length}$`, 'm'));
    expect(out).toMatch(/Provenance \(internal, never shown to trainees\)/);
    expect(out).toMatch(/id\s+family\s+authoredOn\s+behaviourCheck\s+review/);
    // One line for each scenario, with what its own record says.
    for (const { id, grounding } of library) {
      const columns = [
        id,
        grounding.productFamily,
        grounding.authoredOn,
        grounding.behaviourCheck,
        grounding.review,
      ];
      expect(out, id).toMatch(new RegExp(`^\\s+${columns.join('\\s+')}\\s*$`, 'm'));
    }
    expect(out).toMatch(/All scenarios are valid\./);
  });

  it('fails a scenario that has no provenance record, and says which field is missing', () => {
    const { status, err } = run('server/scenarios/testing/without-provenance.ts');
    expect(status).toBe(1);
    expect(err).toMatch(/outlook-shared-mailbox-missing: grounding/);
  });
});
