import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { coreParams, OPTION_EXPLANATIONS, type CoreParams } from '../atlas/core-params.ts';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import { defaultChoices, type SetupChoices } from '../scenario/setup-model.ts';
import { CoreLegend } from './CoreLegend.tsx';
import { KeyToPlate } from './KeyToPlate.tsx';
import { traits } from './signal.fixtures.ts';

const params = (over: Partial<SetupChoices> = {}): CoreParams =>
  coreParams({ ...defaultChoices(makeScenario()), ...over });

describe('CoreLegend', () => {
  it('is a description list of the six lettered parts, in order', () => {
    const { container } = render(<CoreLegend traits={traits()} params={params()} />);
    expect(container.querySelector('dl')).not.toBeNull();
    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    expect(terms).toEqual([
      'Minute ticks',
      'Pressure band',
      'Heart',
      'Edge and needle',
      'Rings',
      'Signal density',
    ]);
    expect(screen.getAllByRole('definition')).toHaveLength(6);
  });

  it('says what each part shows from the same inputs as the instrument', () => {
    render(
      <CoreLegend
        traits={traits({ minutes: 10, stage: 'follow-up', status: 'attempted' })}
        params={params({
          impact: 'medium',
          startingTemperature: 'frustrated',
          difficulty: 'standard',
        })}
      />,
    );
    expect(screen.getByText('10 of 15 engraved')).toBeInTheDocument();
    expect(screen.getByText('medium, 15 of 24 lit')).toBeInTheDocument();
    expect(screen.getByText('diamond, follow-up, half filled')).toBeInTheDocument();
    expect(screen.getByText('frustrated, long and short dashes')).toBeInTheDocument();
    expect(screen.getByText('standard, 2 rings')).toBeInTheDocument();
    expect(screen.getByText('moderate, still hidden')).toBeInTheDocument();
  });

  it('keeps the letters out of the reading order: they only match the picture', () => {
    const { container } = render(<CoreLegend traits={traits()} params={params()} />);
    for (const letter of container.querySelectorAll('.sig-legend__k')) {
      expect(letter).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('describes the signal density in a word, never a count, at every difficulty', () => {
    for (const difficulty of ['starter', 'standard', 'challenge'] as const) {
      const { unmount } = render(<CoreLegend traits={traits()} params={params({ difficulty })} />);
      const density = screen.getAllByRole('definition').at(-1)?.textContent ?? '';
      expect(density).toMatch(/^(light|moderate|dense), still hidden$/);
      unmount();
    }
  });

  it('can add what each part means, from the words the settings use', () => {
    const { container } = render(
      <CoreLegend
        explain
        traits={traits()}
        params={params({ impact: 'high', startingTemperature: 'angry', difficulty: 'challenge' })}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain(OPTION_EXPLANATIONS.impact.high);
    expect(text).toContain(OPTION_EXPLANATIONS.startingTemperature.angry);
    expect(text).toContain(OPTION_EXPLANATIONS.difficulty.challenge);
    expect(text).not.toMatch(/criteria|rubric|score|evaluator/i);
  });

  it('changes with the settings', () => {
    const { rerender } = render(
      <CoreLegend traits={traits()} params={params({ impact: 'low' })} />,
    );
    expect(screen.getByText('low, 5 of 24 lit')).toBeInTheDocument();
    rerender(<CoreLegend traits={traits()} params={params({ impact: 'high' })} />);
    expect(screen.getByText('high, 24 of 24 lit')).toBeInTheDocument();
  });
});

describe('KeyToPlate', () => {
  it('is a description list with a row for each channel of the grammar', () => {
    const { container } = render(<KeyToPlate />);
    expect(container.querySelector('dl')).not.toBeNull();
    const terms = screen
      .getAllByRole('term')
      .map((term) => term.textContent?.replace(/\s+/g, ' ').trim());
    expect(terms).toEqual([
      'Rings, difficulty',
      'Size, impact',
      'Edge, start',
      'Form, stage',
      'Fill, status',
      'Ticks, minutes',
      'Glint, suggested',
    ]);
  });

  it('names every value in words, so no channel is picture or colour alone', () => {
    render(<KeyToPlate />);
    for (const word of [
      'Starter',
      'Standard',
      'Challenge',
      'Low',
      'Medium',
      'High',
      'Calm',
      'Anxious',
      'Frustrated',
      'Angry',
      'First contact',
      'Follow-up',
      'Escalated',
      'Closure',
      'New',
      'Attempted',
      'Completed',
    ]) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }
    expect(
      screen.getByText('One tick is one minute. A full circle is fifteen.'),
    ).toBeInTheDocument();
    expect(screen.getByText('An amber cross marks the recommended mission.')).toBeInTheDocument();
  });

  it('lists the values as lists, with the pictures hidden from assistive technology', () => {
    const { container } = render(<KeyToPlate />);
    const lists = screen.getAllByRole('list');
    expect(lists).toHaveLength(5);
    expect(within(lists[0] as HTMLElement).getAllByRole('listitem')).toHaveLength(3);
    expect(within(lists[2] as HTMLElement).getAllByRole('listitem')).toHaveLength(4);
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
    expect(container.querySelectorAll('[id]')).toHaveLength(0);
  });

  it('has a compact form for the side panel with the same words', () => {
    const full = render(<KeyToPlate />).container.textContent;
    const compact = render(<KeyToPlate compact />);
    expect(compact.container.querySelector('dl')).toHaveAttribute('data-compact');
    expect(compact.container.textContent).toBe(full);
  });
});
