// Validates scenario definitions and prints a coverage summary.
//
//   npm run validate:scenarios                      validate the built-in library
//   npm run validate:scenarios -- path/to/file.ts   validate specific scenario files
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadScenarios } from '../server/scenarios/index.ts';
import {
  CALL_STAGES,
  DIFFICULTIES,
  IMPACTS,
  ISSUE_TYPES,
  PROFICIENCIES,
  START_TEMPERATURES,
  STYLES,
} from '#shared/domain/vocab.ts';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));

let input: unknown[] | undefined;
if (files.length > 0) {
  input = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(resolve(file)).href)) as { default?: unknown };
    if (mod.default === undefined) {
      console.error(`${file}: no default export`);
      process.exit(1);
    }
    input.push(mod.default);
  }
}

const { scenarios, errors } = loadScenarios(input);

console.log(`Scenarios loaded: ${scenarios.length}`);
const count = <T extends string>(
  values: readonly T[],
  pick: (s: (typeof scenarios)[number]) => T,
) => values.map((v) => `${v}=${scenarios.filter((s) => pick(s) === v).length}`).join('  ');
console.log(`  difficulty : ${count(DIFFICULTIES, (s) => s.difficulty)}`);
console.log(`  impact     : ${count(IMPACTS, (s) => s.impact)}`);
console.log(`  temperature: ${count(START_TEMPERATURES, (s) => s.startingTemperature)}`);
console.log(`  proficiency: ${count(PROFICIENCIES, (s) => s.proficiency)}`);
console.log(`  style      : ${count(STYLES, (s) => s.style)}`);
console.log(`  stage      : ${count(CALL_STAGES, (s) => s.callStage)}`);
console.log(`  issue type : ${count(ISSUE_TYPES, (s) => s.issueType)}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('\nAll scenarios are valid.');
