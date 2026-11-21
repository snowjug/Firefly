import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The engineering rules for the public pages, checked on the files themselves: tokens and no raw
// colours, one owner for each class, nothing inline in markup, no stray logging.

const FOLDERS = ['web/src/features/landing', 'web/src/features/content'];

function files(extension: RegExp, skip = /\.test\.|test-support/) {
  return FOLDERS.flatMap((folder) =>
    readdirSync(join(process.cwd(), folder))
      .filter((name) => extension.test(name) && !skip.test(name))
      .map((name) => ({
        name: `${folder}/${name}`,
        text: readFileSync(join(process.cwd(), folder, name), 'utf8'),
      })),
  );
}

const stylesheets = files(/\.css$/);
const sources = files(/\.tsx?$/);
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('the public pages stylesheets', () => {
  it('exist for each of the features', () => {
    expect(stylesheets.map((sheet) => sheet.name)).toEqual(
      expect.arrayContaining([
        'web/src/features/landing/landing.css',
        'web/src/features/landing/hero.css',
        'web/src/features/landing/call-preview.css',
        'web/src/features/content/content.css',
      ]),
    );
  });

  it('use tokens for colour: no hexadecimal, rgb, hsl or named colours', () => {
    for (const sheet of stylesheets) {
      const css = withoutComments(sheet.text);
      expect(css, `${sheet.name} has a hexadecimal colour`).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(css, `${sheet.name} has a colour function`).not.toMatch(
        /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/i,
      );
      expect(css, `${sheet.name} has a named colour`).not.toMatch(
        /(?:color|background|border[\w-]*|fill|stroke|outline[\w-]*):\s*(?:white|black|red|green|blue|gr[ae]y|orange|yellow|purple|teal)\b/i,
      );
    }
  });

  it('take every font size from the type scale, so none is under 12 px', () => {
    for (const sheet of stylesheets) {
      const sizes = [...withoutComments(sheet.text).matchAll(/font-size:\s*([^;]+);/g)].map(
        (match) => (match[1] ?? '').trim(),
      );
      for (const size of sizes) {
        expect(size, `${sheet.name} sets a font size of ${size}`).toMatch(
          /^(?:var\(--fs-[a-z0-9]+\)|[\d.]+em|inherit)$/,
        );
      }
    }
  });

  it('give each class to exactly one stylesheet', () => {
    const owners = new Map<string, string>();
    for (const sheet of stylesheets) {
      const classes = new Set(
        [...withoutComments(sheet.text).matchAll(/\.([a-z][\w-]*)/gi)].map(
          (match) => match[1] ?? '',
        ),
      );
      for (const name of classes) {
        expect(
          owners.get(name),
          `.${name} is in ${sheet.name} and in ${owners.get(name)}`,
        ).toBeUndefined();
        owners.set(name, sheet.name);
      }
    }
  });

  it('never restyle the design system’s own classes', () => {
    for (const sheet of stylesheets) {
      expect(withoutComments(sheet.text), sheet.name).not.toMatch(/\.ff-/);
    }
  });
});

describe('the public pages source', () => {
  it('writes no inline style attribute and no style tag into markup', () => {
    for (const file of sources) {
      expect(file.text, file.name).not.toMatch(/style=["']/);
      expect(file.text, file.name).not.toMatch(/<style[\s>]/);
    }
  });

  it('does not log', () => {
    for (const file of sources) expect(file.text, file.name).not.toMatch(/console\.log/);
  });

  it('loads no web font and no image file', () => {
    for (const sheet of stylesheets) {
      expect(sheet.text, sheet.name).not.toMatch(/@font-face|url\(/);
    }
  });
});
