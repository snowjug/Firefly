import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TEMPERATURE_BANDS } from '#shared/domain/vocab.ts';
import { AgentAvatar, BuildingArt, CustomerAvatar, HeroOrb } from './index.ts';

const svgs = (container: HTMLElement) => [...container.querySelectorAll('svg')];

describe('CustomerAvatar', () => {
  it('is decorative unless it has a label', () => {
    const { container, rerender } = render(<CustomerAvatar seed="Carmen Fraser" mood="calm" />);
    const decorative = container.querySelector('svg.ill-customer');
    expect(decorative).toHaveAttribute('aria-hidden', 'true');
    expect(decorative).not.toHaveAttribute('role');

    rerender(<CustomerAvatar seed="Carmen Fraser" mood="calm" label="Carmen, the customer" />);
    expect(screen.getByRole('img', { name: 'Carmen, the customer' })).toBeInTheDocument();
  });

  it('shows the mood it is given, in every band, and whether the customer is speaking', () => {
    const { container, rerender } = render(<CustomerAvatar seed="Carmen" mood="calm" />);
    for (const band of TEMPERATURE_BANDS) {
      rerender(<CustomerAvatar seed="Carmen" mood={band.id} speaking />);
      const svg = container.querySelector('svg.ill-customer');
      expect(svg).toHaveAttribute('data-mood', band.id);
      expect(svg).toHaveAttribute('data-speaking', 'true');
    }
    rerender(<CustomerAvatar seed="Carmen" mood="calm" />);
    expect(container.querySelector('svg.ill-customer')).toHaveAttribute('data-speaking', 'false');
  });

  it('gives the same face for the same seed, and different faces for different seeds', () => {
    const markup = (seed: string) => {
      const { container, unmount } = render(<CustomerAvatar seed={seed} mood="calm" />);
      // Generated ids differ between renders; the drawing itself must not.
      const html = container.innerHTML.replace(/ill[a-zA-Z0-9]+/g, 'ill');
      unmount();
      return html;
    };
    expect(markup('Carmen Fraser')).toBe(markup('Carmen Fraser'));
    const faces = new Set(
      ['Carmen Fraser', 'Dev Anand', 'Maya Okafor', 'Tom Hughes', 'Lena Petrova', 'Sam Ortiz'].map(
        markup,
      ),
    );
    expect(faces.size).toBeGreaterThanOrEqual(5);
  });
});

describe('AgentAvatar', () => {
  it('is decorative unless it has a label', () => {
    const { container, rerender } = render(<AgentAvatar />);
    expect(svgs(container)[0]).toHaveAttribute('aria-hidden', 'true');
    rerender(<AgentAvatar label="A support engineer wearing a headset" />);
    expect(
      screen.getByRole('img', { name: 'A support engineer wearing a headset' }),
    ).toBeInTheDocument();
  });
});

describe('HeroOrb', () => {
  it('keeps its words as real text and hides the artwork from assistive technology', () => {
    const { container } = render(
      <HeroOrb>
        <p>Better conversations.</p>
        <p>Stronger engineers.</p>
      </HeroOrb>,
    );
    expect(screen.getByText('Better conversations.')).toBeInTheDocument();
    expect(screen.getByText('Stronger engineers.')).toBeInTheDocument();
    expect(svgs(container)[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('can describe itself when it carries meaning', () => {
    render(<HeroOrb title="A glowing sphere with orbit rings" />);
    expect(
      screen.getByRole('img', { name: 'A glowing sphere with orbit rings' }),
    ).toBeInTheDocument();
  });
});

describe('BuildingArt', () => {
  it('is decoration only', () => {
    const { container } = render(<BuildingArt />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
