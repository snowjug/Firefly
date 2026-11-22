import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MOUSE, stubMedia } from '../../design/interaction/test-utils.ts';
import { REPORT_FIRST, REPORT_PREVIEW, REPORT_ROWS } from './landing-copy.ts';
import { ReportPreview } from './ReportPreview.tsx';
import { stubIntersection, wellInView } from './test-utils.ts';
import { DIMENSIONS, DIMENSION_IDS } from '#shared/domain/vocab.ts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const region = () => screen.getByRole('region', { name: REPORT_PREVIEW.title });
const skills = () => within(region()).getByRole('group', { name: REPORT_PREVIEW.skills });
const radio = (skill: (typeof DIMENSION_IDS)[number]) =>
  within(skills()).getByRole('radio', { name: new RegExp(`^${DIMENSIONS[skill].label}`) });
const card = () => region().querySelector('.lp-rp__card') as HTMLElement;
const evidence = () => region().querySelector('.lp-rp__evidence') as HTMLElement;
// The words that are on show: the six sets share one cell, and the other five are hidden and inert.
const shown = () => evidence().querySelector('.lp-rp__linked[data-active]') as HTMLElement;

function setUp() {
  stubIntersection();
  return { user: userEvent.setup(), ...render(<ReportPreview />) };
}

describe('the report preview: what it shows', () => {
  it('is an example, and says so, with one short line under its heading', () => {
    setUp();
    expect(REPORT_PREVIEW.caption).toBe('Example report. Synthetic call.');
    expect(screen.getByRole('figure', { name: REPORT_PREVIEW.caption })).toBeInTheDocument();
    expect(within(region()).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Coaching evidence',
    );
    expect(within(region()).getByText(REPORT_PREVIEW.lead)).toBeVisible();
  });

  it('has the six skills, as one choice, each with the turn its words are from and its score', () => {
    setUp();
    const radios = within(skills()).getAllByRole('radio');
    expect(radios).toHaveLength(6);
    expect(REPORT_ROWS.map((row) => row.skill)).toEqual(DIMENSION_IDS);
    REPORT_ROWS.forEach((row, index) => {
      const input = radios[index] as HTMLElement;
      expect(input).toHaveAccessibleName(expect.stringContaining(`${DIMENSIONS[row.skill].label}`));
      expect(input.closest('label')).toHaveTextContent(`Turn ${row.turn}`);
      expect(input.closest('label')).toHaveTextContent(`${row.score} of 5`);
    });
  });

  it('opens on turn 4: the evidence for Scoping & Discovery, with what the coaching made of it', () => {
    setUp();
    expect(REPORT_FIRST).toBe('scoping-discovery');
    expect(radio('scoping-discovery')).toBeChecked();
    const first = REPORT_ROWS.find((row) => row.skill === REPORT_FIRST);
    expect(first?.turn).toBe(4);
    expect(within(shown()).getByText('Turn 4')).toBeInTheDocument();
    expect(within(evidence()).getByRole('blockquote')).toHaveTextContent(first?.quote ?? '?');
    expect(within(shown()).getByText(first?.note ?? '?')).toBeInTheDocument();
  });

  it('keeps every set of words in one cell, so the card is as tall as the longest and never moves: only the chosen set is exposed', () => {
    setUp();
    const sets = [...evidence().querySelectorAll('.lp-rp__linked')];
    expect(sets).toHaveLength(6);
    expect(evidence().querySelectorAll('.lp-rp__stack')).toHaveLength(1);
    for (const set of sets) {
      expect(set.parentElement).toHaveClass('lp-rp__stack');
      const chosen = set === shown();
      expect(set.hasAttribute('aria-hidden'), set.textContent ?? '').toBe(!chosen);
      expect(set.hasAttribute('inert'), set.textContent ?? '').toBe(!chosen);
    }
    // Hidden sets do not read out: one quote is in the accessibility tree, the chosen one.
    expect(within(evidence()).getAllByRole('blockquote')).toHaveLength(1);
  });

  it('puts the evidence before the scores, in reading order as well as on the screen', () => {
    setUp();
    expect(
      evidence().compareDocumentPosition(skills()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('quotes the trainee word for word, and keeps every example short', () => {
    setUp();
    for (const row of REPORT_ROWS) {
      expect(row.quote.split(/\s+/).length, row.quote).toBeLessThanOrEqual(16);
      expect(row.note.split(/\s+/).length, row.note).toBeLessThanOrEqual(10);
      expect(row.turn % 2, 'the customer speaks first, so the trainee has the even turns').toBe(0);
    }
  });
});

describe('the report preview: a row shows the words it came from', () => {
  it('shows the words of a row that is clicked, and marks the row', async () => {
    const { user } = setUp();
    await user.click(radio('ownership-next-steps'));
    const row = REPORT_ROWS.find((item) => item.skill === 'ownership-next-steps');
    expect(radio('ownership-next-steps')).toBeChecked();
    expect(radio('scoping-discovery')).not.toBeChecked();
    expect(within(shown()).getByText(`Turn ${row?.turn}`)).toBeInTheDocument();
    expect(within(evidence()).getByRole('blockquote')).toHaveTextContent(row?.quote ?? '?');
    expect(within(shown()).getByText(row?.note ?? '?')).toBeInTheDocument();
    expect(radio('ownership-next-steps').closest('label')).toHaveAttribute('data-active');
    expect(radio('scoping-discovery').closest('label')).not.toHaveAttribute('data-active');
  });

  it('follows the arrow keys from a row to the next, the way any radio group does', async () => {
    const { user } = setUp();
    radio('scoping-discovery').focus();
    await user.keyboard('{ArrowDown}');
    expect(radio('empathy-deescalation')).toHaveFocus();
    expect(radio('empathy-deescalation')).toBeChecked();
    expect(within(shown()).getByText('Turn 6')).toBeInTheDocument();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(radio('opening-rapport')).toBeChecked();
    expect(within(shown()).getByText('Turn 2')).toBeInTheDocument();
  });

  it('is one native radio group, and the chosen words are what each row is described by', async () => {
    const { user } = setUp();
    const inputs = within(skills()).getAllByRole('radio');
    expect(new Set(inputs.map((input) => input.getAttribute('name'))).size).toBe(1);
    for (const input of inputs) {
      expect(input).toHaveAccessibleDescription(expect.stringContaining('Turn 4'));
      expect(input).not.toHaveAccessibleDescription(expect.stringContaining('Turn 10'));
    }
    await user.click(radio('ownership-next-steps'));
    expect(radio('clarity')).toHaveAccessibleDescription(expect.stringContaining('Turn 10'));
    expect(radio('clarity')).not.toHaveAccessibleDescription(expect.stringContaining('Turn 4'));
  });

  it('shows the words of a row that a MOUSE points at, and not for touch or a pen, which choose by tapping', () => {
    setUp();
    const label = (skill: (typeof DIMENSION_IDS)[number]) =>
      radio(skill).closest('label') as HTMLElement;
    fireEvent.pointerEnter(label('clarity'), { pointerType: 'touch' });
    expect(radio('scoping-discovery')).toBeChecked();
    fireEvent.pointerEnter(label('clarity'), { pointerType: 'pen' });
    expect(radio('scoping-discovery')).toBeChecked();
    fireEvent.pointerEnter(label('clarity'), { pointerType: 'mouse' });
    expect(radio('clarity')).toBeChecked();
    expect(within(shown()).getByText('Turn 8')).toBeInTheDocument();
  });

  it('keeps the words of the last row that was pointed at when the pointer leaves', () => {
    setUp();
    const target = radio('closing').closest('label') as HTMLElement;
    fireEvent.pointerEnter(target, { pointerType: 'mouse' });
    fireEvent.pointerLeave(target, { pointerType: 'mouse' });
    expect(radio('closing')).toBeChecked();
    expect(within(shown()).getByText('Turn 12')).toBeInTheDocument();
  });
});

describe('the report preview: the scores come after the evidence', () => {
  it('has every score in the document from the start, though none is on show yet', () => {
    setUp();
    expect(card()).not.toHaveAttribute('data-revealed');
    for (const row of REPORT_ROWS) {
      expect(radio(row.skill).closest('label')).toHaveTextContent(`${row.score} of 5`);
    }
  });

  it('has the evidence on show before anything has been revealed', () => {
    setUp();
    expect(card()).not.toHaveAttribute('data-revealed');
    expect(within(evidence()).getByRole('blockquote')).toBeVisible();
  });

  it('reveals the scores once the card has scrolled into view, and keeps them', () => {
    setUp();
    wellInView()[0]?.report(true);
    expect(card()).toHaveAttribute('data-revealed');
    wellInView()[0]?.report(false);
    expect(card()).toHaveAttribute('data-revealed');
  });

  it('gives each row its place in the stagger, so the scores arrive one after another, top to bottom', () => {
    setUp();
    const places = REPORT_ROWS.map((row) =>
      (radio(row.skill).closest('label') as HTMLElement).style.getPropertyValue('--i'),
    );
    expect(places).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('shows everything at once for a visitor who has asked for less motion', () => {
    stubMedia({ ...DESKTOP_MOUSE, '(prefers-reduced-motion: reduce)': true });
    setUp();
    expect(card()).toHaveAttribute('data-revealed');
  });

  it('shows everything at once where there is no way to know what is in view', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<ReportPreview />);
    expect(card()).toHaveAttribute('data-revealed');
  });

  it('is not revealed by a sliver at the edge of the window', () => {
    stubIntersection();
    render(<ReportPreview />);
    expect(wellInView(), 'the scores wait for a margin').toHaveLength(1);
  });
});
