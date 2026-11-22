import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

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
    expect(out).toMatch(/Scenarios loaded: 1\d/);
    expect(out).toMatch(/Provenance \(internal, never shown to trainees\)/);
    expect(out).toMatch(/id\s+family\s+authoredOn\s+behaviourCheck\s+review/);
    expect(out).toMatch(
      /outlook-shared-mailbox-missing\s+microsoft-365\s+\d{4}-\d{2}-\d{2}\s+\S+\s+\S+/,
    );
    expect(out).toMatch(/All scenarios are valid\./);
  });

  it('fails a scenario that has no provenance record, and says which field is missing', () => {
    const { status, err } = run('server/scenarios/testing/without-provenance.ts');
    expect(status).toBe(1);
    expect(err).toMatch(/outlook-shared-mailbox-missing: grounding/);
  });
});
