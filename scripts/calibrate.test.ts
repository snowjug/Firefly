import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeCalibration } from '#shared/domain/calibration.ts';
import { formatCalibrationReport, runCalibration } from './calibrate.ts';

const run = (...args: string[]) =>
  spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', 'scripts/calibrate.ts', ...args],
    { encoding: 'utf8' },
  );

describe('calibrate script', () => {
  it('compares the bundled example records and labels them as invented samples', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Sessions reviewed  : 6');
    expect(result.stdout).toContain('Scores compared    : 36');
    expect(result.stdout).toMatch(/Mean absolute difference : \d\.\d\d points/);
    expect(result.stdout).toMatch(/Fewer than 20 reviewed sessions/);
    expect(result.stdout).toMatch(/6 of 6 records are marked "sample"/);
  });

  it('prints machine-readable output', () => {
    const out = execFileSync(
      process.execPath,
      ['--disable-warning=ExperimentalWarning', 'scripts/calibrate.ts', '--json'],
      { encoding: 'utf8' },
    );
    const parsed = JSON.parse(out) as { sampleRecords: number; metrics: { sessions: number } };
    expect(parsed.sampleRecords).toBe(6);
    expect(parsed.metrics.sessions).toBe(6);
  });

  it('refuses unusable files with a clear message and a failing exit code', () => {
    const dir = mkdtempSync(join(tmpdir(), 'firefly-calibrate-'));
    try {
      const file = join(dir, 'bad.json');
      writeFileSync(file, JSON.stringify({ records: [{ sessionId: 'x' }] }));
      const result = run(file);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('could not be used');
      expect(result.stderr).toMatch(/records\.0\.evaluatorVersion/);

      const broken = join(dir, 'broken.json');
      writeFileSync(broken, '{ nope');
      expect(run(broken).stderr).toContain('not valid JSON');
      expect(run(join(dir, 'missing.json')).status).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not describe a tiny difference as a bias', () => {
    const { metrics, info } = runCalibration(['calibration/samples']);
    const text = formatCalibrationReport(metrics, info);
    expect(text).toContain('no consistent difference');
  });

  it('says there is nothing to compare when there are no records', () => {
    const text = formatCalibrationReport(computeCalibration([]), {
      files: [],
      mentorRecords: 0,
      sampleRecords: 0,
    });
    expect(text).toContain('There is nothing to compare yet.');
    expect(text).not.toMatch(/Mean absolute difference/);
  });
});
