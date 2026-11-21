import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The app's first load is the entry chunk (main.tsx and everything it imports statically; pages load
// lazily), and a bundler puts a whole module in the chunk that needs any of it. The voice catalogue
// (shared/domain/voices.ts) and the spoken-text sanitiser (shared/domain/spoken-text.ts) are only for
// the brief page, the call page and the server, so they must never be reachable from the entry:
// reachable means they ship in the first load, where they cost bytes before any page can draw (the
// production build was over its first-load budget for exactly this reason: the entry imported one
// header name from the speech contract, and the whole contract, catalogue included, came with it).
// scripts/check-budgets.mjs holds the line on the size after a build; this finds the cause at once,
// and names the chain of imports that leads to it.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const shown = (file: string) => relative(root, file).replaceAll('\\', '/');

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

/** Where an import lands, or null for a package, a stylesheet, an asset: anything that is not our code. */
function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('#shared/')) {
    base = join(root, 'shared', specifier.slice('#shared/'.length));
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(from), specifier);
  } else {
    return null;
  }
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  return candidates.find((candidate) => /\.tsx?$/.test(candidate) && isFile(candidate)) ?? null;
}

/**
 * What loading a file loads with it: its value imports and re-exports, and side-effect imports. Not
 * `import type` (erased), and not `import()` (a lazy chunk). An import whose names are all inline
 * `type` ones counts, because with verbatimModuleSyntax such an import is kept for its side effects.
 */
function staticImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [
    ...source.matchAll(/^[ \t]*(?:import|export)\s+(?!type\b)[^'";]*?\sfrom\s+['"]([^'"]+)['"]/gm),
    ...source.matchAll(/^[ \t]*import\s+['"]([^'"]+)['"]/gm),
  ].flatMap((match) => {
    const target = resolveImport(file, match[1] as string);
    return target ? [target] : [];
  });
}

/** Every module reachable from the entry by static imports, each with the module that first led to it. */
function reachableFrom(entry: string): Map<string, string | null> {
  const parent = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const target of staticImports(next)) {
      if (parent.has(target)) continue;
      parent.set(target, next);
      queue.push(target);
    }
  }
  return parent;
}

const reached = reachableFrom(join(root, 'web', 'src', 'main.tsx'));

/** The chain of files from the entry to `file`, or null when the entry never reaches it. */
function chainTo(file: string): string[] | null {
  const target = join(root, file);
  if (!reached.has(target)) return null;
  const chain: string[] = [];
  for (let at: string | null | undefined = target; at; at = reached.get(at))
    chain.unshift(shown(at));
  return chain;
}

describe('the first-load entry', () => {
  it('can be walked: it reaches the API client and, through it, the speech contract', () => {
    // If the walk found nothing, the checks below would pass for the wrong reason.
    expect(chainTo('web/src/lib/api.ts')).not.toBeNull();
    expect(chainTo('shared/domain/speech.ts')).not.toBeNull();
    expect(reached.size).toBeGreaterThan(30);
  });

  it.each([
    'shared/domain/voices.ts',
    'shared/domain/spoken-text.ts',
    'web/src/features/voice/playback/speech-text.ts',
  ])('never reaches %s, which only the brief page, the call page and the server use', (file) => {
    expect(chainTo(file), `${file} is reachable from main.tsx by this chain`).toBeNull();
  });

  it('can tell when a module is reachable', () => {
    expect(chainTo('web/src/main.tsx')).toEqual(['web/src/main.tsx']);
    expect(chainTo('web/src/lib/api.ts')?.[0]).toBe('web/src/main.tsx');
  });
});
