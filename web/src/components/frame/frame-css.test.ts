import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The primitives' stylesheets use tokens only. These checks read the sheets as text, so a stray
// colour, a mistyped token or a keyframe nobody uses fails here and not in somebody's screenshot.

const styles = resolve(dirname(fileURLToPath(import.meta.url)), '../../styles');
const read = (name: string) =>
  readFileSync(resolve(styles, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const OWN = ['frame.css', 'dialog.css', 'toast.css'] as const;
const sheets = Object.fromEntries(OWN.map((name) => [name, read(name)])) as Record<
  (typeof OWN)[number],
  string
>;
const tokens = read('tokens.css') + read('legacy.css') + read('materials.css');

describe.each(OWN)('%s', (name) => {
  const css = sheets[name];

  it('has no raw colours: every colour is a token, a system colour or a mix of tokens', () => {
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(css.match(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g) ?? []).toEqual([]);
  });

  it('only reads custom properties that exist or that it sets itself', () => {
    const declared = new Set(
      [...(tokens + Object.values(sheets).join('\n')).matchAll(/(--[\w-]+)\s*:/g)].map(
        (match) => match[1],
      ),
    );
    // Set by the shell and the page frame, with a fallback wherever they are read.
    const provided = new Set(['--masthead-h', '--dock-clear']);
    const missing = [...css.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)]
      .filter(([, property, after]) => after === ')' && !declared.has(property!))
      .map(([, property]) => property)
      .filter((property) => !provided.has(property!));
    expect(missing).toEqual([]);
  });

  it('keeps no keyframes that nothing uses', () => {
    const used = Object.values(sheets).join('\n');
    const unused = [...css.matchAll(/@keyframes\s+([\w-]+)/g)]
      .map((match) => match[1]!)
      .filter(
        (keyframes) => !new RegExp(`animation(?:-name)?\\s*:[^;]*\\b${keyframes}\\b`).test(used),
      );
    expect(unused).toEqual([]);
  });
});

describe('frame.css', () => {
  const css = sheets['frame.css'];

  it('never sets a fixed pixel font size on text a person reads', () => {
    expect(css.match(/font-size:\s*\d+px/g) ?? []).toEqual([]);
  });

  it('gives every interactive primitive a target of at least 44 px', () => {
    for (const selector of ['.action', '.ff-field__control', '.ff-toggle', '.ff-tabs__tab']) {
      const block = new RegExp(
        `${selector.replace('.', '\\.')}\\s*\\{[^}]*min-height:\\s*(\\d*\\.?\\d+)rem`,
      ).exec(css);
      expect(block, `${selector} has a min-height`).not.toBeNull();
      expect(Number(block![1]) * 16, `${selector} is tall enough`).toBeGreaterThanOrEqual(44);
    }
  });

  it('draws the amber point only in forced colours as a system colour', () => {
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
    expect(forced).toContain('Highlight');
    expect(forced).toContain('CanvasText');
  });
});
