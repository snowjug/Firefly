// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The web app must not ship a schema library, or the server. The shared modules that hold schemas
// (they build them with zod when they load) may only be imported for their types, written as
// `import type`, which is erased completely. `import { type X }` is not: with this project's
// `verbatimModuleSyntax` it still loads the module.

const SCHEMA_MODULES = ['scenario', 'report', 'classification', 'api', 'speech'];

const folder = fileURLToPath(new URL('.', import.meta.url));
const sources = readdirSync(folder)
  .filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name))
  .map((name) => ({ name, text: readFileSync(`${folder}${name}`, 'utf8') }));

/** Every import in a file: whether it is `import type`, and where from. */
function imports(text: string): { isType: boolean; from: string }[] {
  const found: { isType: boolean; from: string }[] = [];
  for (const match of text.matchAll(/^import\s+(type\s+)?[^;]*?\s+from\s+['"]([^'"]+)['"]/gm)) {
    found.push({ isType: Boolean(match[1]), from: match[2] as string });
  }
  for (const match of text.matchAll(/^import\s+['"]([^'"]+)['"]/gm)) {
    found.push({ isType: false, from: match[1] as string });
  }
  return found;
}

describe('what the scenario screens import', () => {
  it('finds the source files and their imports', () => {
    expect(sources.length).toBeGreaterThan(15);
    expect(sources.flatMap(({ text }) => imports(text)).length).toBeGreaterThan(50);
  });

  it('never imports a schema library', () => {
    for (const { name, text } of sources) {
      expect(
        imports(text).filter(({ from }) => from === 'zod'),
        name,
      ).toEqual([]);
    }
  });

  it('imports the shared schema modules for their types only', () => {
    const wrong = sources.flatMap(({ name, text }) =>
      imports(text)
        .filter(
          ({ isType, from }) =>
            !isType && SCHEMA_MODULES.some((module) => from === `#shared/domain/${module}.ts`),
        )
        .map(({ from }) => `${name}: ${from}`),
    );
    expect(wrong).toEqual([]);
  });

  it('never imports server code', () => {
    for (const { name, text } of sources) {
      expect(
        imports(text).filter(({ from }) => from.startsWith('#server/')),
        name,
      ).toEqual([]);
    }
  });
});
