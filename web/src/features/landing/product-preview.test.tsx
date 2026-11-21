import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductPreview } from './ProductPreview.tsx';

// Vitest does not process stylesheets, so the CSS is read from disk to assert on its text.
const previewCss = readFileSync(
  join(process.cwd(), 'web/src/features/landing/product-preview.css'),
  'utf8',
);

afterEach(cleanup);

describe('the hero preview', () => {
  it('is one image with a description, captioned as an example from a fictional call', () => {
    render(<ProductPreview />);
    const figure = screen.getByRole('figure', { name: 'Example from a fictional call' });
    const image = within(figure).getByRole('img', { name: 'Preview of a call workspace' });
    expect(image).toHaveAccessibleDescription(
      /Maya Okafor, a front-desk coordinator, is frustrated/,
    );
    expect(image).toHaveAccessibleDescription(
      /Opening and Rapport 4 of 5, Scoping and Discovery 5 of 5/,
    );
    expect(image).toHaveAccessibleDescription(/Empathy and De-escalation 3 of 5/);
  });

  it('is made of real text, not of a picture', () => {
    const { container } = render(<ProductPreview />);
    expect(container.querySelectorAll('img, picture, canvas, video')).toHaveLength(0);
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
    }
    for (const text of [
      'Maya Okafor',
      'Front-desk coordinator',
      'Frustrated, rising',
      'The customer is speaking',
      'When did it start, and has anything changed on your side recently?',
      'Context found',
      'Opening & Rapport',
      'Scoping & Discovery',
      'Empathy & De-escalation',
      'Example from a fictional call',
    ]) {
      expect(screen.getAllByText(text).length, text).toBeGreaterThan(0);
    }
  });

  it('shows the customer, the trainee and the customer again, with the context marker after the trainee', () => {
    render(<ProductPreview />);
    const turns = screen.getAllByRole('listitem', { hidden: true }).slice(0, 3) as HTMLElement[];
    expect(turns.map((turn) => turn.textContent?.replace(/\s+/g, ' '))).toEqual([
      'Maya Okafor 0:08I can’t sign in to the staff portal. It stopped letting me in after I changed my password this morning.',
      'You 0:21When did it start, and has anything changed on your side recently?Context found',
      'Maya Okafor 0:34Right after I changed my password, about ten past eight. I need to be in before the nine o’clock appointments.',
    ]);
  });

  it('shows three of the six skills with the number and the word as text', () => {
    render(<ProductPreview />);
    const rows = screen.getAllByRole('listitem', { hidden: true }).slice(3);
    expect(rows.map((row) => row.textContent?.replace(/\s+/g, ' '))).toEqual([
      'Opening & Rapport4 of 5Strong',
      'Scoping & Discovery5 of 5Excellent',
      'Empathy & De-escalation3 of 5Developing',
    ]);
    expect(screen.getByText('Three of six skills shown')).toBeInTheDocument();
  });
});

// Strips comments, then finds the text of the blocks that open with the given at-rule.
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function takeBlocks(css: string, opener: string): { blocks: string[]; rest: string } {
  const blocks: string[] = [];
  let rest = css;
  for (;;) {
    const start = rest.indexOf(opener);
    if (start < 0) return { blocks, rest };
    let depth = 0;
    let end = start;
    for (let index = rest.indexOf('{', start); index < rest.length; index++) {
      if (rest[index] === '{') depth++;
      if (rest[index] === '}' && --depth === 0) {
        end = index + 1;
        break;
      }
    }
    blocks.push(rest.slice(start, end));
    rest = rest.slice(0, start) + rest.slice(end);
  }
}

describe('the hero preview animation', () => {
  const css = withoutComments(previewCss);
  const { blocks, rest } = takeBlocks(css, '@media (prefers-reduced-motion: no-preference)');

  it('exists, and only inside the no-preference media query', () => {
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatch(/@keyframes/);
    expect(blocks[0]).toMatch(/animation:/);
    expect(rest).not.toMatch(/animation|@keyframes|transition/);
  });

  it('ends by itself in under five seconds, so nothing needs a pause control', () => {
    expect(css).not.toMatch(/infinite/);
    const [, duration, count] =
      /animation:\s*\S+\s+(\d+)ms\s+\S+(?:\([^)]*\))?\s+(\d+)\b/.exec(css) ?? [];
    const delays = [...css.matchAll(/animation-delay:\s*(\d+)ms/g)].map((match) =>
      Number(match[1]),
    );
    const total = Number(duration) * Number(count) + Math.max(0, ...delays);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(5000);
  });
});
