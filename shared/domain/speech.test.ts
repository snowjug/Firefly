import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as speech from './speech.ts';

describe('the speech contract', () => {
  it('puts a header for the neutral voice id next to the three that say what was really used', () => {
    expect(speech.SPEECH_RESPONSE_HEADERS).toEqual({
      provider: 'x-firefly-speech-provider',
      voice: 'x-firefly-speech-voice',
      style: 'x-firefly-speech-style',
      voiceId: 'x-firefly-speech-voice-id',
    });
  });
});

// The first load of the web app imports this module (web/src/lib/api.ts for the header names), and a
// bundler puts a whole module in the chunk that needs any of it. So this module holds only the small
// constants and types the first load can need. The voice catalogue (voices.ts) and the spoken-text
// sanitiser (spoken-text.ts) live in modules of their own that only the brief page, the call page and
// the server import. web/src/features/voice/entry-weight.test.ts checks the entry's whole import graph;
// this checks the module itself, so a change here fails next to its cause.
describe('what the first load of the web app takes with this module', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'speech.ts'), 'utf8');

  it('exports only small constants, never the voice catalogue or the sanitiser', () => {
    expect(Object.keys(speech).sort()).toEqual([
      'DEFAULT_SPEECH_LANGUAGE',
      'INPUT_MODES',
      'SPEECH_LANGUAGES',
      'SPEECH_PROVIDER_KINDS',
      'SPEECH_RESPONSE_HEADERS',
    ]);
  });

  it('imports other modules for types only, which are erased, and re-exports nothing', () => {
    const valueImports = [
      ...source.matchAll(/^import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gm),
      ...source.matchAll(/^import\s+['"]([^'"]+)['"]/gm),
    ].map((match) => match[1]);
    expect(valueImports).toEqual([]);
    expect(source).not.toMatch(/^export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s/m);
  });
});
