import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnnouncerProvider,
  Avatar,
  CUSTOMER_STATES,
  CUSTOMER_STATE_ICONS,
  CUSTOMER_STATE_LABELS,
  MessageBar,
  ProgressBar,
  ScoreBar,
  Spinner,
  StateBadge,
  initials,
  useAnnouncer,
} from '../index.ts';
import { createAnnouncerQueue } from './announcer.ts';

afterEach(cleanup);

describe('MessageBar', () => {
  it('interrupts for an error, and speaks up politely for everything else', () => {
    render(
      <>
        <MessageBar intent="error" title="The customer did not reply" />
        <MessageBar intent="warning" title="You are offline" />
        <MessageBar intent="success" title="Call saved" />
        <MessageBar intent="info" title="Speech goes to your browser" />
      </>,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('The customer did not reply');
    expect(screen.getAllByRole('status')).toHaveLength(3);
  });

  it('can be plain page content with no live role', () => {
    render(<MessageBar intent="info" live={false} title="A note" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('A note')).toBeInTheDocument();
  });

  it('writes the intent in words as well as colour and an icon', () => {
    render(<MessageBar intent="warning" title="You are offline" />);
    expect(screen.getByRole('status')).toHaveTextContent('Warning: You are offline');
  });

  it('offers its actions and a dismiss button that is named', () => {
    const onDismiss = vi.fn();
    render(
      <MessageBar
        intent="error"
        title="Could not send"
        actions={<button type="button">Try again</button>}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Dismiss' }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('Spinner and ProgressBar', () => {
  it('names an indeterminate spinner', () => {
    render(<Spinner label="Loading scenarios" />);
    expect(screen.getByRole('progressbar', { name: 'Loading scenarios' })).toBeInTheDocument();
  });

  it('can show its label and be named by it', () => {
    render(<Spinner label="Loading Firefly" showLabel />);
    expect(screen.getByRole('progressbar', { name: 'Loading Firefly' })).toBeInTheDocument();
    expect(screen.getByText('Loading Firefly')).toBeVisible();
  });

  it('says how far a determinate bar has got, in numbers and in words', () => {
    render(
      <ProgressBar
        label="Evaluating the call"
        value={3}
        max={5}
        valueText="Step 3 of 5"
        showLabel
        showValue
      />,
    );
    const bar = screen.getByRole('progressbar', { name: 'Evaluating the call' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar).toHaveAttribute('aria-valuetext', 'Step 3 of 5');
    expect(screen.getByText('Step 3 of 5')).toBeVisible();
  });

  it('has no value when the work cannot be measured', () => {
    render(<ProgressBar label="Preparing the report" />);
    expect(screen.getByRole('progressbar', { name: 'Preparing the report' })).not.toHaveAttribute(
      'aria-valuenow',
    );
  });

  it('fills a determinate bar to its share of the track, and clamps what is out of range', () => {
    const { container, rerender } = render(<ProgressBar label="Evaluating" value={60} />);
    const fill = () => container.querySelector<HTMLElement>('.ff-progress__fill');
    // The fill is as wide as the track and slides in from the left: 60 per cent leaves 40 hidden.
    expect(fill()?.style.transform).toBe('translateX(-40%)');
    rerender(<ProgressBar label="Evaluating" value={250} />);
    expect(fill()?.style.transform).toBe('translateX(0%)');
    rerender(<ProgressBar label="Evaluating" value={-5} />);
    expect(fill()?.style.transform).toBe('translateX(-100%)');
  });
});

describe('Badge', () => {
  it('gives each customer state its own word and its own icon shape, so colour is never alone', () => {
    expect(new Set(CUSTOMER_STATES.map((state) => CUSTOMER_STATE_ICONS[state])).size).toBe(6);
    const shapes = new Set<string>();
    for (const state of CUSTOMER_STATES) {
      const { container, unmount } = render(<StateBadge state={state} />);
      expect(screen.getByText(CUSTOMER_STATE_LABELS[state])).toBeVisible();
      shapes.add(container.querySelector('svg')?.innerHTML ?? '');
      unmount();
    }
    expect(shapes.size).toBe(6);
  });
});

describe('ScoreBar', () => {
  it('puts the number and the word in text beside the segments', () => {
    render(<ScoreBar score={3} />);
    expect(screen.getByText('3')).toBeVisible();
    expect(screen.getByText(/of 5/)).toBeVisible();
    expect(screen.getByText('Developing')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('says so when there is no score', () => {
    render(<ScoreBar score={null} />);
    expect(screen.getByText('Not scored')).toBeVisible();
  });

  it('is a labelled image when the text is left out', () => {
    render(<ScoreBar score={4} showText={false} />);
    expect(screen.getByRole('img', { name: '4 of 5, Strong' })).toBeInTheDocument();
  });

  it('keeps the words in the document as text when only the segments are to be drawn', () => {
    const { container } = render(<ScoreBar score={4} hideText />);
    expect(container.firstElementChild).toHaveClass('ff-scorebar--text-hidden');
    expect(container.querySelector('.ff-scorebar__text')).toHaveTextContent('4 of 5');
    expect(container.querySelector('.ff-scorebar__text')).toHaveTextContent('Strong');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('fills a whole segment for each point and part of the next for a fraction', () => {
    const { container } = render(<ScoreBar score={3.5} />);
    const fills = [...container.querySelectorAll<HTMLElement>('.ff-scorebar__fill')];
    // Each fill is as wide as its segment and slides in from the left: no shift is a full segment.
    expect(fills.map((fill) => fill.style.transform)).toEqual([
      'translateX(0%)',
      'translateX(0%)',
      'translateX(0%)',
      'translateX(-50%)',
      'translateX(-100%)',
    ]);
  });
});

describe('Avatar', () => {
  it('takes initials from the first and last words of a name', () => {
    expect(initials('Maya Okonkwo')).toBe('MO');
    expect(initials('Declan')).toBe('D');
    expect(initials('  priya   anne  nair ')).toBe('PN');
    expect(initials('')).toBe('?');
  });

  it('is decorative unless it is given a name', () => {
    const { container, rerender } = render(<Avatar name="Maya Okonkwo" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    rerender(<Avatar name="Maya Okonkwo" label="Maya Okonkwo is speaking" speaking />);
    expect(screen.getByRole('img', { name: 'Maya Okonkwo is speaking' })).toBeInTheDocument();
  });
});

describe('announcer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads whole sentences one at a time, each given time before the next replaces it', () => {
    const spoken: string[] = [];
    const queue = createAnnouncerQueue((text) => spoken.push(text));
    queue.announce('The customer is speaking.');
    queue.announce('The customer finished. Your turn.');
    expect(spoken).toEqual(['The customer is speaking.']);
    vi.advanceTimersByTime(5000);
    expect(spoken).toEqual([
      'The customer is speaking.',
      '',
      'The customer finished. Your turn.',
      '',
    ]);
  });

  it('drops a sentence that is already waiting, and one just spoken, but not a real repeat later', () => {
    const spoken: string[] = [];
    const queue = createAnnouncerQueue((text) => spoken.push(text));
    queue.announce('Message sent.');
    queue.announce('Message sent.');
    queue.announce('  Message   sent.  ');
    vi.advanceTimersByTime(2000);
    expect(spoken.filter(Boolean)).toEqual(['Message sent.']);
    queue.announce('Message sent.');
    expect(spoken.filter(Boolean)).toEqual(['Message sent.']);
    vi.advanceTimersByTime(10_000);
    queue.announce('Message sent.');
    expect(spoken.filter(Boolean)).toEqual(['Message sent.', 'Message sent.']);
  });

  it('ignores empty announcements and keeps only the latest few when many arrive at once', () => {
    const spoken: string[] = [];
    const queue = createAnnouncerQueue((text) => spoken.push(text));
    queue.announce('   ');
    expect(spoken).toEqual([]);
    for (let i = 1; i <= 12; i += 1) queue.announce(`Update ${i}.`);
    vi.advanceTimersByTime(60_000);
    const heard = spoken.filter(Boolean);
    expect(heard[0]).toBe('Update 1.');
    expect(heard.at(-1)).toBe('Update 12.');
    expect(heard.length).toBeLessThan(12);
  });

  it('renders exactly one polite status region and fills it through useAnnouncer', () => {
    function Speaker() {
      const announce = useAnnouncer();
      return (
        <button type="button" onClick={() => announce('Call paused.')}>
          Pause
        </button>
      );
    }
    render(
      <AnnouncerProvider>
        <Speaker />
      </AnnouncerProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
    act(() => screen.getByRole('button', { name: 'Pause' }).click());
    expect(region).toHaveTextContent('Call paused.');
    act(() => vi.advanceTimersByTime(5000));
    expect(region).toBeEmptyDOMElement();
  });

  it('does nothing, and does not throw, without a provider', () => {
    function Speaker() {
      const announce = useAnnouncer();
      announce('Nobody hears this.');
      return null;
    }
    expect(() => render(<Speaker />)).not.toThrow();
  });
});
