import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The simulation core must not know how it is served, stored, spoken or powered. This test fails
// when domain or application code imports an adapter, so the direction of dependencies stays:
//
//   shared/domain  <-  server/engine, scenarios, evaluator, prompts  <-  server/services
//                                                                   <-  server/http, db, providers, speech
//
// Adapters (HTTP, SQLite, model providers, speech providers) depend on the core and its ports,
// never the other way round. The web app depends only on `shared` and never on `server`.

const root = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

interface Import {
  file: string;
  specifier: string;
  /** The folder under the repository root that the import lands in, or null for a package. */
  target: string | null;
}

function importsOf(dir: string): Import[] {
  return sourceFiles(join(root, dir)).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    const specifiers = [
      ...text.matchAll(/(?:^|\s)(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm),
      ...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
      ...text.matchAll(/(?:^|\s)import\s+['"]([^'"]+)['"]/gm),
    ].map((m) => m[1] as string);
    return specifiers.map((specifier) => {
      let target: string | null = null;
      if (specifier.startsWith('#shared/')) target = `shared/${specifier.slice('#shared/'.length)}`;
      else if (specifier.startsWith('.'))
        target = relative(root, resolve(dirname(file), specifier))
          .split(sep)
          .join('/');
      return { file: relative(root, file).split(sep).join('/'), specifier, target };
    });
  });
}

const offences = (found: Import[], forbidden: (i: Import) => boolean): string[] =>
  found.filter(forbidden).map((i) => `${i.file} imports ${i.specifier}`);

describe('dependency direction', () => {
  it('keeps shared/domain free of server and web code', () => {
    const bad = offences(importsOf('shared'), (i) => {
      if (i.target === null) return i.specifier !== 'zod';
      return !i.target.startsWith('shared/');
    });
    expect(bad).toEqual([]);
  });

  it('keeps the web app from importing the server', () => {
    const bad = offences(importsOf('web/src'), (i) => i.target?.startsWith('server/') === true);
    expect(bad).toEqual([]);
  });

  // What each core area may import from the rest of `server`. Everything else is an adapter.
  const core: Record<string, string[]> = {
    'server/engine': ['server/engine'],
    'server/scenarios': ['server/scenarios'],
    'server/evaluator': ['server/evaluator', 'server/engine'],
    // Prompts speak to the model port (types only), never to a provider.
    'server/prompts': ['server/prompts', 'server/engine', 'server/providers/types'],
  };

  for (const [area, allowed] of Object.entries(core)) {
    it(`keeps ${area} free of HTTP, database, provider and speech adapters`, () => {
      const bad = offences(importsOf(area), (i) => {
        if (i.target === null) return false;
        if (i.target.startsWith('shared/')) return false;
        if (!i.target.startsWith('server/')) return true; // reaches outside `server`
        const stem = i.target.replace(/\.ts$/, '');
        return !allowed.some((a) => stem === a || stem.startsWith(`${a}/`));
      });
      expect(bad).toEqual([]);
    });
  }
});
