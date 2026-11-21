import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildAtlas } from '../atlas/atlas-model.ts';
import { CATALOGUE } from '../atlas/atlas.fixtures.ts';
import { describeGlyph } from './describe.ts';
import { SignalGlyph } from './SignalGlyph.tsx';
import { traits } from './signal.fixtures.ts';

describe('SignalGlyph', () => {
  it('is an image with a name when it is given one', () => {
    render(<SignalGlyph traits={traits()} label={describeGlyph(traits())} />);
    expect(
      screen.getByRole('img', {
        name: 'Standard difficulty, medium impact. The customer starts frustrated. First contact. Not tried yet. About 10 minutes.',
      }),
    ).toBeInTheDocument();
  });

  it('is decoration when it has no name, so a list row is not read twice', () => {
    const { container } = render(<SignalGlyph traits={traits()} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')).toHaveAttribute('focusable', 'false');
  });

  it('draws at the size it is asked for, from a box of 92 units', () => {
    const { container } = render(<SignalGlyph traits={traits()} size={28} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '28');
    expect(svg).toHaveAttribute('height', '28');
    expect(svg).toHaveAttribute('viewBox', '-46 -46 92 92');
  });

  it('needs no ids, so any number of glyphs on a page can never clash', () => {
    const { container } = render(
      <div>
        {Array.from({ length: 13 }, (_, i) => (
          <SignalGlyph key={i} traits={traits({ status: 'attempted', recommended: i === 0 })} />
        ))}
      </div>,
    );
    expect(container.querySelectorAll('[id]')).toHaveLength(0);
    expect(container.querySelectorAll('[clip-path], clipPath, filter')).toHaveLength(0);
  });

  it('is a small drawing: under 120 elements even with every mark', () => {
    const { container } = render(
      <SignalGlyph traits={traits({ status: 'attempted', recommended: true, start: 'angry' })} />,
    );
    expect(container.querySelectorAll('*').length).toBeLessThan(120);
  });

  it('draws the glint for the recommended mission only', () => {
    const { container, rerender } = render(<SignalGlyph traits={traits()} />);
    expect(container.querySelector('.sig-glint')).toBeNull();
    rerender(<SignalGlyph traits={traits({ recommended: true })} />);
    expect(container.querySelector('.sig-glint')).not.toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('data-recommended');
  });

  it('shows the status in the heart: open, half filled, solid', () => {
    const heart = (status: 'new' | 'attempted' | 'completed') => {
      const { container } = render(<SignalGlyph traits={traits({ status })} />);
      return {
        half: container.querySelector('.sig-heart-half') !== null,
        solid: container.querySelector('.sig-heart.is-solid') !== null,
      };
    };
    expect(heart('new')).toEqual({ half: false, solid: false });
    expect(heart('attempted')).toEqual({ half: true, solid: false });
    expect(heart('completed')).toEqual({ half: false, solid: true });
  });

  it('takes a mission from the atlas as it is, and renders the whole library', () => {
    const { missions } = buildAtlas(CATALOGUE, [], CATALOGUE[0]?.id ?? null);
    const { container } = render(
      <ul>
        {missions.map((mission) => (
          <li key={mission.id}>
            <SignalGlyph traits={mission} label={mission.description} />
          </li>
        ))}
      </ul>,
    );
    expect(screen.getAllByRole('img')).toHaveLength(13);
    expect(container.querySelectorAll('[data-recommended]')).toHaveLength(1);
  });

  it('renders the same markup for the same traits', () => {
    const a = render(<SignalGlyph traits={traits({ start: 'angry' })} />).container.innerHTML;
    const b = render(<SignalGlyph traits={traits({ start: 'angry' })} />).container.innerHTML;
    expect(a).toBe(b);
  });
});
