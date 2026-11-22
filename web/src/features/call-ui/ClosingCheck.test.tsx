import { act, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClosingCheckDTO } from '#shared/domain/api.ts';
import {
  CLOSING_CHECK_DEADLINE_MS,
  CLOSING_LEAD,
  CLOSING_ROWS,
  ClosingCheck,
  readClosingChecks,
} from './ClosingCheck.tsx';

afterEach(() => {
  vi.useRealTimers();
});

const answer = (checks: Partial<ClosingCheckDTO['checks']> = {}): ClosingCheckDTO => ({
  sessionId: 'ses_check',
  traineeTurns: 6,
  checks: { plan: false, owner: false, updateTime: false, agreement: false, ...checks },
});

const never = () => new Promise<ClosingCheckDTO>(() => undefined);

describe('the closing check', () => {
  it('asks once when it appears, and says nothing in words while it waits', () => {
    const load = vi.fn(never);
    const { container } = render(<ClosingCheck load={load} />);
    expect(load).toHaveBeenCalledTimes(1);
    const waiting = container.querySelector('.cw-close--loading') as HTMLElement;
    // A skeleton of the same four rows, drawn but not read: nothing to announce, nothing to focus.
    expect(waiting).toHaveAttribute('aria-hidden', 'true');
    expect(waiting.querySelectorAll('li')).toHaveLength(CLOSING_ROWS.length);
    expect(waiting.textContent).toBe('');
    // And the room of the line that comes before them, so the rows do not move when it arrives.
    expect(container.querySelector('.cw-closing__skeleton')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('says what the rows are in one neutral line before them, and that it is not a score', async () => {
    render(<ClosingCheck load={() => Promise.resolve(answer({ plan: true }))} />);
    const list = await screen.findByRole('list', { name: 'Closing check' });
    expect(CLOSING_LEAD).toBe('What the call has covered so far. This is not a score.');
    const lead = screen.getByText(CLOSING_LEAD);
    expect(lead.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The line is not one of the rows: they hold the four things and no talk of a score.
    expect(list).not.toContainElement(lead);
    expect(within(list).getAllByRole('listitem')).toHaveLength(CLOSING_ROWS.length);
  });

  it('gives a covered row its mark and leaves the others plain: one tick, and no tick, never a count', async () => {
    render(
      <ClosingCheck
        load={() => Promise.resolve(answer({ plan: true, owner: false, updateTime: false }))}
      />,
    );
    const list = await screen.findByRole('list', { name: 'Closing check' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.filter((row) => row.classList.contains('cw-close__row--done'))).toHaveLength(1);
    // Each row has one icon whichever it is: the clock for what is not yet covered, the tick for what is.
    for (const row of rows) expect(row.querySelectorAll('svg')).toHaveLength(1);
    expect(within(list).getAllByText('Not yet')).toHaveLength(3);
    expect(within(list).getAllByText('Done')).toHaveLength(1);
  });

  it('lists the four things in order, each by words and not colour alone', async () => {
    render(
      <ClosingCheck
        load={() => Promise.resolve(answer({ plan: true, owner: true, updateTime: false }))}
      />,
    );
    const list = await screen.findByRole('list', { name: 'Closing check' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Plan statedDone',
      'Owner statedDone',
      'Update time statedNot yet',
      'Customer agreement confirmedNot yet',
    ]);
    expect(list.querySelectorAll('svg')).toHaveLength(4);
    expect(rows.map((row) => row.classList.contains('cw-close__row--done'))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('is calm when nothing is done yet: no warning, no alert, no advice about what to say', async () => {
    const { container } = render(<ClosingCheck load={() => Promise.resolve(answer())} />);
    const list = await screen.findByRole('list', { name: 'Closing check' });
    expect(within(list).getAllByText('Not yet')).toHaveLength(4);
    expect(container.querySelector('[role="alert"], [role="status"], [aria-live]')).toBeNull();
    expect(list.textContent).not.toMatch(/should|try|say |must|score|\d/i);
  });

  it('shows nothing at all when the check fails, and no message about it', async () => {
    const load = vi.fn(() => Promise.reject(new Error('The server said no.')));
    const { container } = render(<ClosingCheck load={load} />);
    await act(async () => undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing when what came back is not four yes-or-no answers', async () => {
    const wrong = { sessionId: 's', traineeTurns: 2, checks: { plan: 'yes', owner: true } };
    const { container } = render(
      <ClosingCheck load={() => Promise.resolve(wrong as unknown as ClosingCheckDTO)} />,
    );
    await act(async () => undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing, and asks nothing, when it was given no way to ask', () => {
    const { container } = render(<ClosingCheck />);
    expect(container).toBeEmptyDOMElement();
  });

  it('gives up after a second: it is told to stop, and a late answer is not shown', async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    let respond!: (value: ClosingCheckDTO) => void;
    const load = (given: AbortSignal) => {
      signal = given;
      return new Promise<ClosingCheckDTO>((resolve) => {
        respond = resolve;
      });
    };
    const { container } = render(<ClosingCheck load={load} />);
    act(() => {
      vi.advanceTimersByTime(CLOSING_CHECK_DEADLINE_MS - 1);
    });
    expect(container.querySelector('.cw-close--loading')).not.toBeNull();
    expect(signal.aborted).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(signal.aborted).toBe(true);
    expect(container).toBeEmptyDOMElement();
    await act(async () => {
      respond(answer({ plan: true }));
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('is told to stop when the dialog goes away before the answer comes', () => {
    let signal!: AbortSignal;
    const { unmount } = render(
      <ClosingCheck
        load={(given) => {
          signal = given;
          return never();
        }}
      />,
    );
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('is never red: its stylesheet uses no danger, warning or customer-state colour', () => {
    const css = readFileSync(resolve('web/src/features/call-ui/dialogs.css'), 'utf8');
    const rules = [...css.matchAll(/([^{}]*\.cw-close[^{}]*)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(3);
    const tokens = rules.flatMap((rule) => [...(rule[2] ?? '').matchAll(/var\((--[\w-]+)/g)]);
    expect(tokens.length).toBeGreaterThan(5);
    for (const [, token] of tokens) {
      expect(token, 'a colour of alarm in the closing check').not.toMatch(
        /danger|error|warning|angry|frustrated|escalat|critical/,
      );
    }
  });
});

describe('reading the closing check', () => {
  it('keeps the four answers and nothing else', () => {
    expect(
      readClosingChecks({
        checks: { plan: true, owner: false, updateTime: true, agreement: false, extra: true },
      }),
    ).toEqual({ plan: true, owner: false, updateTime: true, agreement: false });
  });

  it('refuses anything that is not four booleans', () => {
    expect(readClosingChecks(null)).toBeNull();
    expect(readClosingChecks({})).toBeNull();
    expect(readClosingChecks({ checks: 'done' })).toBeNull();
    expect(readClosingChecks({ checks: { plan: true, owner: true, updateTime: true } })).toBeNull();
    expect(
      readClosingChecks({
        checks: { plan: 1, owner: true, updateTime: true, agreement: true },
      }),
    ).toBeNull();
  });
});
