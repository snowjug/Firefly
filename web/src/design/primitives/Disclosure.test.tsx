import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Disclosure, ScoreRow } from '../index.ts';

afterEach(cleanup);

describe('Disclosure', () => {
  it('is a button that says whether it is open and which panel it controls', () => {
    render(<Disclosure summary="Where speech goes">The detail</Disclosure>);
    const button = screen.getByRole('button', { name: 'Where speech goes' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    expect(panel).toHaveTextContent('The detail');
    expect(panel).not.toBeVisible();
  });

  it('opens and closes with a click, Enter and Space, and each press does exactly one thing', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Disclosure summary="Details" onOpenChange={onOpenChange}>
        The detail
      </Disclosure>,
    );
    const button = screen.getByRole('button', { name: 'Details' });
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('The detail')).toBeVisible();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('can start open', () => {
    render(
      <Disclosure summary="Details" defaultOpen>
        The detail
      </Disclosure>,
    );
    expect(screen.getByRole('button', { name: 'Details', expanded: true })).toBeInTheDocument();
    expect(screen.getByText('The detail')).toBeVisible();
  });

  it('leaves the state to its owner when it is controlled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Disclosure summary="Details" open={false} onOpenChange={onOpenChange}>
        The detail
      </Disclosure>,
    );
    await user.click(screen.getByRole('button', { name: 'Details' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Details', expanded: false })).toBeInTheDocument();
    rerender(
      <Disclosure summary="Details" open onOpenChange={onOpenChange}>
        The detail
      </Disclosure>,
    );
    expect(screen.getByRole('button', { name: 'Details', expanded: true })).toBeInTheDocument();
  });

  it('reads its meta as part of the button, and sits in a heading when it names a section', () => {
    render(
      <Disclosure summary="Evidence" meta="3 quotes" headingLevel={3}>
        The detail
      </Disclosure>,
    );
    const heading = screen.getByRole('heading', { level: 3 });
    expect(within(heading).getByRole('button', { name: 'Evidence 3 quotes' })).toBeInTheDocument();
  });
});

describe('ScoreRow', () => {
  it('puts the label, the number, the word and the quote count on one line, closed', () => {
    render(
      <ScoreRow label="Scoping & Discovery" score={4} evidenceCount={3}>
        <p>The rationale</p>
      </ScoreRow>,
    );
    const button = screen.getByRole('button', { expanded: false });
    expect(button).toHaveTextContent('Scoping & Discovery');
    expect(button).toHaveTextContent('4 of 5');
    expect(button).toHaveTextContent('Strong');
    expect(button).toHaveTextContent('3 quotes');
    expect(button).toHaveTextContent('Expand details');
    expect(screen.getByText('The rationale')).not.toBeVisible();
  });

  it('opens its evidence in place and says so in words', async () => {
    const user = userEvent.setup();
    render(
      <ScoreRow label="Closing" score={3} evidenceCount={1}>
        <p>The rationale</p>
      </ScoreRow>,
    );
    await user.click(screen.getByRole('button', { name: /Closing/ }));
    expect(screen.getByRole('button', { name: /Closing/, expanded: true })).toHaveTextContent(
      'Hide details',
    );
    expect(screen.getByRole('button', { name: /Closing/ })).toHaveTextContent('1 quote');
    expect(screen.getByText('The rationale')).toBeVisible();
  });

  it('is a plain line, with no button, when there is nothing to open', () => {
    render(<ScoreRow label="Opening" score={null} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Opening')).toBeVisible();
    expect(screen.getByText('Not scored')).toBeVisible();
  });
});
