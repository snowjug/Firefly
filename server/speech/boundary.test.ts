import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Two promises about the speech layer, checked against the source:
//
// 1. The speech port stays separate. Nothing in server/speech knows about HTTP, the database, a
//    model provider or the session service; the one place that chooses a concrete adapter is the
//    composition root in server/bootstrap.ts.
// 2. Audio never reaches a disk or a database. No file in the speech code path (or the speech
//    routes, or the code that reads an uploaded recording) writes anywhere, and what the speech
//    routes log is a short list of identifiers, sizes and timings.
//
// These read source text, so they say what the code can do, not what it did on a run; the runtime
// behaviour (a recording is zeroed after use, nothing is logged) is tested where it happens.

const root = fileURLToPath(new URL('../..', import.meta.url));
const posix = (path: string) => path.split(sep).join('/');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

const read = (file: string) => readFileSync(file, 'utf8');

/** Source with its comments taken out, so that a sentence about a rule is not mistaken for code. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

function specifiersOf(text: string): string[] {
  return [
    ...text.matchAll(/(?:^|\s)(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm),
    ...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...text.matchAll(/(?:^|\s)import\s+['"]([^'"]+)['"]/gm),
  ].map((m) => m[1] as string);
}

/** The repository-relative file an import lands in, or null for a package or a built-in. */
function landing(file: string, specifier: string): string | null {
  if (specifier.startsWith('#shared/')) return `shared/${specifier.slice('#shared/'.length)}`;
  if (!specifier.startsWith('.')) return null;
  return posix(relative(root, resolve(dirname(file), specifier)));
}

// Test support that talks to a local fake service or stands up the whole app is not part of the
// speech layer itself.
const isSupport = (file: string) =>
  posix(relative(root, file)) === 'server/speech/fake-azure-speech-server.ts' ||
  posix(relative(root, file)).startsWith('server/speech/testing/');

const speechFiles = sourceFiles(join(root, 'server/speech')).filter((file) => !isSupport(file));

describe('the speech port is separate from HTTP, the database, the model and the session service', () => {
  it('finds the speech layer it is checking', () => {
    const names = speechFiles.map((file) => posix(relative(join(root, 'server/speech'), file)));
    expect(names).toEqual(
      expect.arrayContaining([
        'types.ts',
        'azure.ts',
        'mock.ts',
        'index.ts',
        'voices.ts',
        'direction.ts',
        'service.ts',
        'wav.ts',
      ]),
    );
  });

  it('imports only the shared contract, zod, itself, and the evaluator’s reader of mood changes', () => {
    const offences: string[] = [];
    for (const file of speechFiles) {
      for (const specifier of specifiersOf(read(file))) {
        const target = landing(file, specifier);
        const allowed =
          specifier === 'zod' ||
          (target !== null &&
            (target.startsWith('shared/') ||
              target.startsWith('server/speech/') ||
              target === 'server/evaluator/mood.ts'));
        if (!allowed) offences.push(`${posix(relative(root, file))} imports ${specifier}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('keeps the port itself (types.ts) free of every adapter and of Node', () => {
    const imports = specifiersOf(read(join(root, 'server/speech/types.ts')));
    expect(imports.every((specifier) => specifier.startsWith('#shared/'))).toBe(true);
  });

  it('is reached by the rest of the server only through its port and its pure helpers', () => {
    const offences: string[] = [];
    for (const file of sourceFiles(join(root, 'server'))) {
      const name = posix(relative(root, file));
      if (name.startsWith('server/speech/')) continue;
      for (const specifier of specifiersOf(read(file))) {
        const target = landing(file, specifier);
        if (!target?.startsWith('server/speech/')) continue;
        const module = target.replace(/\.ts$/, '').slice('server/speech/'.length);
        // Nothing outside the speech layer builds a concrete adapter directly...
        if (module === 'azure' || module === 'mock') offences.push(`${name} imports ${specifier}`);
        // ...and only the composition root (and the test harness) asks the speech layer for one.
        if (
          module === 'index' &&
          name !== 'server/bootstrap.ts' &&
          name !== 'server/http/harness.ts'
        ) {
          offences.push(`${name} imports ${specifier}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  it('chooses the provider in one place: the composition root, from the configuration', () => {
    const bootstrap = read(join(root, 'server/bootstrap.ts'));
    expect(bootstrap.match(/create\w*SpeechProvider\(/g)).toEqual(['createSpeechProvider(']);
    expect(bootstrap).toContain('options.speech ?? createSpeechProvider(config.speech)');
  });

  it('keeps the three ports apart: the speech port does not mention the model, and the model port does not mention speech', () => {
    const speech = speechFiles.map((file) => code(read(file))).join('\n');
    expect(speech).not.toMatch(/ModelProvider|providers\/|generateCustomer|classifyTurn/);
    const model = code(read(join(root, 'server/providers/types.ts')));
    expect(model).not.toMatch(/SpeechProvider|SpeechError|speech\//);
  });
});

// ---------------------------------------------------------------------------------------

const WRITES =
  /\b(?:node:fs|fs\/promises|writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdtemp|tmpdir|node:sqlite|DatabaseSync|localStorage|indexedDB)\b|\.prepare\(|\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b/;

/** The text of the speech routes in the HTTP app: from their marker to the test-only routes. */
function speechRoutes(): string {
  const app = read(join(root, 'server/http/app.ts'));
  const start = app.indexOf('// ---- speech');
  const end = app.indexOf('if (hooks.enabled)', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return app.slice(start, end);
}

/** The code that reads an uploaded recording. */
function audioReader(): string {
  const security = read(join(root, 'server/http/security.ts'));
  const start = security.indexOf('export async function readAudioBody');
  const end = security.indexOf('// ---- rate limiting', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return security.slice(start, end);
}

describe('audio is never written to a disk or a database', () => {
  it('has no write to a file, a temporary folder or a database anywhere in the speech layer', () => {
    for (const file of speechFiles) {
      expect(code(read(file)), posix(relative(root, file))).not.toMatch(WRITES);
    }
  });

  it('has none in the speech routes, which also never touch the repository', () => {
    const routes = speechRoutes();
    expect(code(routes)).not.toMatch(WRITES);
    expect(code(routes)).not.toMatch(/\brepo\b|deps\.repo/);
    // The recording is read into memory and zeroed when done.
    expect(routes).toContain('scrub(upload)');
  });

  it('has none in the code that reads an uploaded recording, which only holds it in memory', () => {
    const reader = audioReader();
    expect(code(reader)).not.toMatch(WRITES);
    expect(reader).toContain('Buffer.concat(chunks, size)');
  });

  it('never keeps a recording or a line in a variable that outlives the request', () => {
    // No module-level state in the providers holds audio or text: the demonstration keeps only the
    // position in its script, and the Azure client keeps nothing.
    for (const name of ['azure.ts', 'mock.ts', 'service.ts']) {
      const text = code(read(join(root, 'server/speech', name)));
      const moduleLevel = text.split('\n').filter((line) => /^(?:let|var)\s/.test(line));
      expect(moduleLevel, name).toEqual([]);
    }
    const mock = code(read(join(root, 'server/speech/mock.ts')));
    const provider = mock.slice(mock.indexOf('export function createMockSpeechProvider'));
    // `next` is the demonstration's place in its script; there is no other mutable state.
    expect([...provider.matchAll(/\blet (\w+)/g)].map((m) => m[1])).toEqual(['next']);
  });
});

describe('what the speech code logs', () => {
  // Identifiers, sizes and timings: never the audio, the words, a key or anything a provider said.
  const ALLOWED = new Set([
    'requestId',
    'provider',
    'bytes',
    'audioMs',
    'status',
    'ms',
    'voice',
    'op',
    'code',
  ]);

  it('is a short list of identifiers, sizes and timings, in every speech log line', () => {
    const app = read(join(root, 'server/http/app.ts'));
    const calls = [...app.matchAll(/log\.(?:info|warn)\(\s*'(speech\.\w+)',\s*\{([^}]*)\}/g)];
    expect(calls.map((call) => call[1])).toEqual(
      expect.arrayContaining([
        'speech.failed',
        'speech.transcribed',
        'speech.spoken',
        'speech.previewed',
      ]),
    );
    for (const [, event, body] of calls) {
      // One property to a line: `name: value,` or the shorthand `name,`.
      const keys = [...(body as string).matchAll(/^\s*(\w+)\s*(?::|,?\s*$)/gm)].map((m) => m[1]);
      expect(keys.length, event).toBeGreaterThan(2);
      for (const key of keys) expect(ALLOWED.has(key as string), `${event}: ${key}`).toBe(true);
    }
  });

  it('is never fed the audio, a transcript, a line of the call or an error’s own words', () => {
    const routes = speechRoutes();
    for (const [, body] of routes.matchAll(
      /log\.(?:info|warn)\(\s*'speech\.\w+',\s*\{([^}]*)\}/g,
    )) {
      expect(body).not.toMatch(
        /\btext\b|\bline\b|\baudio:|\bupload\b(?!\.length)|\.message|\.cause|\.stack|\bkey\b/i,
      );
    }
    // And the speech layer itself never logs at all.
    for (const file of speechFiles) {
      expect(code(read(file)), posix(relative(root, file))).not.toMatch(
        /\bconsole\.|\blog\.(?:info|warn|error)\(/,
      );
    }
  });
});
