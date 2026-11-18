// Compares AI coaching scores with mentor scores recorded in calibration files.
//
//   npm run calibrate                           reads calibration/samples/*.json
//   npm run calibrate -- path/to/file.json ...  reads the files (or folders of .json files) you give it
//   npm run calibrate -- --json file.json       prints machine-readable output
//
// Only numbers computed from the records in the files are printed. With few records the report says
// so instead of implying precision. See docs/calibration.md for the file format and how to read it.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  computeCalibration,
  type CalibrationMetrics,
  type CalibrationPair,
} from '#shared/domain/calibration.ts';
import { pairsFromFile, parseCalibrationFile } from '#shared/domain/calibration-file.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';

const BIAS_NOTICEABLE = 0.25;

function describeBias(bias: number): string {
  if (Math.abs(bias) < BIAS_NOTICEABLE) return 'no consistent difference';
  return bias > 0 ? 'AI scores higher than mentors' : 'AI scores lower than mentors';
}

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ' '}${Math.abs(n).toFixed(2)}`;
const percent = (n: number) => `${Math.round(n * 100)}%`;

export interface ReportInfo {
  files: string[];
  mentorRecords: number;
  sampleRecords: number;
}

export function formatCalibrationReport(metrics: CalibrationMetrics, info: ReportInfo): string {
  const lines: string[] = ['Firefly calibration report', ''];
  lines.push(`Files              : ${info.files.join(', ')}`);
  lines.push(`Records            : ${info.mentorRecords + info.sampleRecords}`);
  lines.push(`Sessions reviewed  : ${metrics.sessions}`);
  lines.push(`Scores compared    : ${metrics.scores}`);
  lines.push(`Evaluator versions : ${metrics.evaluatorVersions.join(', ') || 'none'}`);
  lines.push(`Rubric versions    : ${metrics.rubricVersions.join(', ') || 'none'}`);
  lines.push('');

  if (!metrics.overall) {
    lines.push('There is nothing to compare yet.');
  } else {
    lines.push('Overall');
    lines.push(
      `  Mean absolute difference : ${metrics.overall.meanAbsoluteDifference.toFixed(2)} points`,
    );
    lines.push(`  Within 1 point           : ${percent(metrics.overall.withinOne)} of scores`);
    lines.push(
      `  Bias (AI minus mentor)   : ${signed(metrics.overall.bias)} (${describeBias(metrics.overall.bias)})`,
    );
    lines.push('');
    lines.push('By dimension');
    const width = Math.max(...Object.values(DIMENSIONS).map((d) => d.label.length));
    for (const d of metrics.perDimension) {
      lines.push(
        `  ${DIMENSIONS[d.dimension].label.padEnd(width)}  n=${String(d.n).padEnd(3)} ` +
          `mean difference ${d.meanAbsoluteDifference.toFixed(2)}  ` +
          `within 1 point ${percent(d.withinOne).padStart(4)}  ` +
          `bias ${signed(d.bias)} (${describeBias(d.bias)})`,
      );
    }
  }
  lines.push('');
  lines.push(`Read with care: ${metrics.caveat}`);
  if (info.sampleRecords > 0) {
    lines.push(
      `${info.sampleRecords} of ${info.mentorRecords + info.sampleRecords} records are marked "sample": ` +
        'they are invented examples that show the file format and say nothing about the evaluator.',
    );
  }
  return lines.join('\n');
}

function collectFiles(inputs: string[]): string[] {
  const files: string[] = [];
  for (const input of inputs) {
    const path = resolve(input);
    if (!existsSync(path)) throw new Error(`Not found: ${input}`);
    if (statSync(path).isDirectory()) {
      const found = readdirSync(path)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => join(path, name));
      if (found.length === 0) throw new Error(`No .json files in ${input}`);
      files.push(...found);
    } else {
      files.push(path);
    }
  }
  return files;
}

export function runCalibration(inputs: string[]): {
  metrics: CalibrationMetrics;
  info: ReportInfo;
  errors: string[];
} {
  const pairs: CalibrationPair[] = [];
  const errors: string[] = [];
  const names: string[] = [];
  const files = collectFiles(inputs);
  for (const file of files) {
    const name = relative(process.cwd(), file) || file;
    names.push(name);
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      errors.push(`${name}: not valid JSON.`);
      continue;
    }
    const parsed = parseCalibrationFile(json);
    if (!parsed.ok) {
      for (const message of parsed.errors) errors.push(`${name}: ${message}`);
      continue;
    }
    pairs.push(...pairsFromFile(parsed.file));
  }
  return {
    metrics: computeCalibration(pairs),
    info: {
      files: names,
      mentorRecords: pairs.filter((p) => p.source === 'mentor').length,
      sampleRecords: pairs.filter((p) => p.source === 'sample').length,
    },
    errors,
  };
}

function main(argv: string[]): number {
  const json = argv.includes('--json');
  const args = argv.filter((a) => !a.startsWith('--'));
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      'Usage: npm run calibrate -- [--json] [file-or-folder ...]\n' +
        'Defaults to calibration/samples. See docs/calibration.md for the file format.',
    );
    return 0;
  }
  try {
    const { metrics, info, errors } = runCalibration(
      args.length > 0 ? args : ['calibration/samples'],
    );
    if (errors.length > 0) {
      console.error('The calibration files could not be used:');
      for (const message of errors) console.error(`  ${message}`);
      return 1;
    }
    console.log(
      json ? JSON.stringify({ ...info, metrics }, null, 2) : formatCalibrationReport(metrics, info),
    );
    return 0;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
