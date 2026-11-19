import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { assessMastery, type MasterySession } from '#shared/domain/mastery.ts';
import { MasteryStars, describeStars, overallLight, starLayout } from './MasteryStars.tsx';

const call = (id: string, scenarioId: string, scores: MasterySession['dimensionScores']) =>
  ({
    id,
    scenarioId,
    difficulty: 'standard',
    completion: 'completed',
    isSample: false,
    startedAt: `2026-03-0${id}T09:00:00.000Z`,
    endedAt: `2026-03-0${id}T09:10:00.000Z`,
    dimensionScores: scores,
  }) satisfies MasterySession;

describe('MasteryStars', () => {
  const dormant = assessMastery([]);
  const lit = assessMastery([
    call('1', 'a', { closing: 4, clarity: 3 }),
    call('2', 'b', { closing: 4, clarity: 3 }),
  ]);

  it('lays the six constellations out in rubric order with names that always fit the picture', () => {
    const nodes = starLayout(lit);
    expect(nodes).toHaveLength(6);
    // Names are centred under their star (over it for the top one), so none can spill past an edge.
    expect(nodes.every((n) => n.anchor === 'middle')).toBe(true);
    expect(nodes[0]?.labelY).toBeLessThan((nodes[0]?.y ?? 0) / 3);
    for (const n of nodes.slice(1)) expect(n.labelY).toBeGreaterThan((n.y / 300) * 100);
    for (const n of nodes) {
      expect(n.labelX).toBeGreaterThan(10);
      expect(n.labelX).toBeLessThan(90);
      expect(n.labelY).toBeGreaterThan(0);
      expect(n.labelY).toBeLessThan(100);
    }
  });

  it('is described in words for assistive technology, tier by tier', () => {
    expect(describeStars(dormant)).toContain('Listener, Opening & Rapport: Dormant');
    expect(describeStars(lit)).toContain('Finisher, Closing: Glowing');
    render(<MasteryStars mastery={lit} />);
    expect(screen.getByRole('img', { name: /Finisher, Closing: Glowing/ })).toBeInTheDocument();
  });

  it('can be purely decorative when the same facts are written beside it', () => {
    const { container } = render(<MasteryStars mastery={lit} decorative />);
    expect(container.querySelector('.ms')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('gets brighter in the middle as practice builds up', () => {
    expect(overallLight(dormant)).toBe(0);
    expect(overallLight(lit)).toBeGreaterThan(0);
    expect(overallLight(lit)).toBeLessThan(1);
  });

  it('marks each constellation with its tier, and lights the links between lit neighbours only', () => {
    const { container } = render(<MasteryStars mastery={lit} />);
    const tiers = [...container.querySelectorAll('.ms-star')].map((s) =>
      s.getAttribute('data-tier'),
    );
    // closing and clarity are lit (glowing); the rest are dormant.
    expect(tiers).toEqual(['0', '0', '0', '2', '0', '2']);
    expect(container.querySelectorAll('.ms-link[data-lit="true"]')).toHaveLength(0);
  });
});
