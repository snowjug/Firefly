import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Ledger, Stat, StatRow, Tag } from './index.ts';

describe('Tag', () => {
  it('is words with a mark in front, neutral unless told otherwise', () => {
    render(
      <>
        <Tag>Not started</Tag>
        <Tag tone="amber">Recommended</Tag>
        <Tag tone="coral">Missed</Tag>
      </>,
    );
    expect(screen.getByText('Not started')).toHaveAttribute('data-tone', 'neutral');
    expect(screen.getByText('Recommended')).toHaveAttribute('data-tone', 'amber');
    expect(screen.getByText('Missed')).toHaveAttribute('data-tone', 'coral');
  });
});

describe('Stat and StatRow', () => {
  it('reads the label first and then the figure, with an optional note', () => {
    render(
      <StatRow>
        <Stat label="Calls completed" value="12" note="Since March" />
        <Stat label="Signals found" value={31} />
      </StatRow>,
    );
    const terms = screen.getAllByRole('term');
    expect(terms.map((term) => term.textContent)).toEqual(['Calls completed', 'Signals found']);
    expect(screen.getAllByRole('definition').map((item) => item.textContent)).toEqual([
      '12',
      'Since March',
      '31',
    ]);
  });
});

describe('Ledger', () => {
  it('ties each label to its value, and shows notes only when there are some', () => {
    render(
      <Ledger
        rows={[
          { label: 'Duration', value: '9 min 40 s', note: 'Scenario length is 10 minutes' },
          { label: 'Practice style', value: 'Guided' },
        ]}
      />,
    );
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Duration',
      'Practice style',
    ]);
    expect(screen.getAllByRole('definition').map((item) => item.textContent)).toEqual([
      '9 min 40 s',
      'Scenario length is 10 minutes',
      'Guided',
    ]);
  });

  it('copes with no rows and with very long values', () => {
    const long = 'Supercalifragilisticexpialidocious'.repeat(5);
    const { container, rerender } = render(<Ledger rows={[]} />);
    expect(container.querySelectorAll('.ff-ledger__row')).toHaveLength(0);
    rerender(<Ledger rows={[{ label: 'Value', value: long }]} />);
    expect(screen.getByText(long)).toBeInTheDocument();
  });
});
