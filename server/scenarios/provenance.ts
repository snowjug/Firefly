import { PROVENANCE_KEYS, type ScenarioDefinition } from '#shared/domain/scenario.ts';

// Helpers for a scenario's internal provenance record (`grounding`). The record is for authors and
// reviewers: it is printed by `npm run validate:scenarios` and read by tests, and nothing else.

/** The table `npm run validate:scenarios` prints: one line for each scenario, under a header. */
export function provenanceTable(scenarios: readonly ScenarioDefinition[]): string[] {
  const header = ['id', 'family', 'authoredOn', 'behaviourCheck', 'review'];
  const rows = scenarios.map((s) => [
    s.id,
    s.grounding.productFamily,
    s.grounding.authoredOn,
    s.grounding.behaviourCheck,
    s.grounding.review,
  ]);
  const widths = header.map((cell, i) =>
    Math.max(cell.length, ...rows.map((row) => (row[i] as string).length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => cell.padEnd(widths[i] as number))
      .join('  ')
      .trimEnd();
  return [line(header), ...rows.map(line)];
}

/**
 * Where a provenance field turns up in a value, as paths like `$.scenarios[0].grounding`. Run over a
 * public scenario, a session view or any response body, an empty result means the record stayed
 * internal.
 */
export function provenanceLeaks(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => provenanceLeaks(item, `${path}[${i}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [
      ...((PROVENANCE_KEYS as readonly string[]).includes(key) ? [`${path}.${key}`] : []),
      ...provenanceLeaks(child, `${path}.${key}`),
    ]);
  }
  return [];
}
