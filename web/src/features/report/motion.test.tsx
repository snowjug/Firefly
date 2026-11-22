import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MOUSE, stubMedia } from '../../design/interaction/test-utils.ts';
import { ReportView } from './ReportView.tsx';
import { CALLS, type CallName } from './fixtures.ts';
import { stagger } from './reveal.ts';
import {
  FakeIntersectionObserver,
  renderAtReport,
  scriptedClient,
  stubIntersectionObserver,
  stubMatchMedia,
  stubScroll,
} from './test-utils.tsx';

// How the report comes in and answers: what waits to be scrolled to, what draws itself, the line that
// slides in the navigation, the card that answers a mouse. jsdom has no layout and no animation, so
// this is the wiring (what is marked, when, and what the page's text is while it happens); the
// stylesheets that draw the motion are read by report-source.test.ts, and a browser sees it in
// e2e/report.spec.ts.

// Role queries over a whole report are slow in jsdom, and slower on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function show(name: CallName = 'strong') {
  const { session, report } = CALLS[name];
  return renderAtReport(
    <ReportView
      session={session}
      report={report}
      client={scriptedClient(session)}
      reveal={false}
    />,
  );
}

const region = (name: string) => screen.getByRole('region', { name });

/** The one watcher of an element, from the fake observers. */
function watcherOf(element: Element): FakeIntersectionObserver {
  const [watcher] = FakeIntersectionObserver.watching(element);
  if (!watcher) throw new Error('Nothing is watching that element');
  return watcher;
}

describe('the stagger', () => {
  const place = (index: number) => (stagger(index) as Record<string, unknown>)['--reveal-i'];

  it('steps a child along its group a place at a time, and never past the last of eight', () => {
    expect([0, 3, 7].map(place)).toEqual([0, 3, 7]);
    expect(place(40)).toBe(7);
    expect(place(-2)).toBe(0);
  });
});

describe('what waits to be scrolled to', () => {
  it('has each part rise in with its heading and the line under it, one watcher for the two', () => {
    const observer = stubIntersectionObserver();
    try {
      show();
      const scores = region('Scores');
      const head = scores.querySelector('.rp-section__head') as HTMLElement;
      const lead = scores.querySelector('.rp-section__lead') as HTMLElement;
      expect(head).toHaveAttribute('data-reveal');
      expect(lead).toHaveAttribute('data-reveal');
      expect(head).not.toHaveAttribute('data-revealed');
      expect(lead.style.getPropertyValue('--reveal-i')).toBe('1');
      expect(FakeIntersectionObserver.watching(lead)).toHaveLength(0);

      act(() => {
        watcherOf(head).reportElement(head, true);
      });
      expect(head).toHaveAttribute('data-revealed');
      expect(lead).toHaveAttribute('data-revealed');
    } finally {
      observer.restore();
    }
  });

  it('does that for every part below the first screen, and for the block under its heading', () => {
    const observer = stubIntersectionObserver();
    try {
      show();
      for (const name of [
        'Call journey',
        'Scores',
        'CARE review',
        'Customer experience',
        'Discovery review',
        'Strengths',
        'Improvement opportunities',
        'Next practice',
        'Actions',
        'Transcript',
        'About this report',
      ]) {
        const part = region(name);
        const waiting = part.hasAttribute('data-reveal')
          ? part
          : part.querySelector('.rp-section__head');
        expect(waiting, `${name} waits to come in`).toHaveAttribute('data-reveal');
        // The parts with a heading row (all but About, which is one block) also have a block that
        // waits, a step behind the heading and the line under it.
        if (!part.hasAttribute('data-reveal')) {
          expect(
            part.querySelectorAll('[data-reveal]').length,
            `${name} has more than a heading that waits`,
          ).toBeGreaterThanOrEqual(2);
        }
      }
    } finally {
      observer.restore();
    }
  });

  it('leaves the block at the top of the report to settle in by itself, not behind a scroll', () => {
    const observer = stubIntersectionObserver();
    try {
      show();
      const top = document.querySelector('.rp-exec') as HTMLElement;
      expect(top).not.toHaveAttribute('data-reveal');
      expect(top.querySelector('[data-reveal]')).toBeNull();
    } finally {
      observer.restore();
    }
  });

  it('leaves nothing waiting when the browser cannot say what is in view', () => {
    show();
    const waiting = [...document.querySelectorAll('[data-reveal]')];
    expect(waiting.length).toBeGreaterThan(20);
    for (const element of waiting) expect(element).toHaveAttribute('data-revealed');
  });

  it('draws the line beside a quote when the quote is first seen, and at once where nothing can tell', () => {
    const observer = stubIntersectionObserver();
    try {
      show();
      const quote = region('Strengths').querySelector('figure.rp-quote') as HTMLElement;
      expect(quote).not.toHaveAttribute('data-drawn');
      act(() => {
        watcherOf(quote).reportElement(quote, true);
      });
      expect(quote).toHaveAttribute('data-drawn');
    } finally {
      observer.restore();
    }
    cleanup();
    show();
    for (const quote of document.querySelectorAll('figure.rp-quote')) {
      expect(quote).toHaveAttribute('data-drawn');
    }
  });
});

describe('the arrival of the report', () => {
  const signal = () => document.querySelector('.rp-exec__signal') as HTMLElement;

  it('counts the practice signal up, and the real value is its text from the start', () => {
    show();
    const number = signal().querySelector('.rp-exec__number') as HTMLElement;
    expect(number).toHaveClass('rp-count');
    expect(number.querySelector('.rp-count__value')).toHaveTextContent('4.2');
    expect(number).toHaveAttribute('data-counting');
    expect(number).toHaveAttribute('data-shown');
    expect(signal()).toHaveTextContent('Practice signal 4.2 of 5, the average of six skills.');
  });

  it('shows the signal as it is, with nothing counting, when motion is reduced', () => {
    const restore = stubMatchMedia((query) => query.includes('prefers-reduced-motion: reduce'));
    try {
      show();
      const number = signal().querySelector('.rp-exec__number') as HTMLElement;
      expect(number).not.toHaveAttribute('data-counting');
      expect(number).toHaveTextContent('4.2');
    } finally {
      restore();
    }
  });

  it('counts how many hidden facts were found, up from nothing, beside the segments', () => {
    show();
    const { discovery } = CALLS.strong.report;
    const total = region('Discovery review').querySelector('.rp-discovery__total') as HTMLElement;
    const number = total.querySelector('.rp-discovery__number') as HTMLElement;
    expect(number).toHaveClass('rp-count');
    expect(number.querySelector('.rp-count__value')).toHaveTextContent(String(discovery.found));
    expect(total).toHaveTextContent(`${discovery.found} of ${discovery.total} hidden facts found`);
  });
});

describe('the discovery review', () => {
  it('draws a segment for each fact, the found ones first and each a step after the one before', () => {
    show();
    const { discovery } = CALLS.strong.report;
    const segments = [
      ...region('Discovery review').querySelectorAll<HTMLElement>('.rp-ratio__seg'),
    ];
    expect(segments).toHaveLength(discovery.total);
    const order = segments.map((segment) => /rp-ratio__seg--(\w+)/.exec(segment.className)?.[1]);
    expect(order).toEqual(
      [...order].sort(
        (a, b) =>
          ['discovered', 'partial', 'missed'].indexOf(a ?? '') -
          ['discovered', 'partial', 'missed'].indexOf(b ?? ''),
      ),
    );
    expect(segments.map((segment) => segment.style.getPropertyValue('--seg'))).toEqual(
      segments.map((_, index) => String(Math.min(index, 7))),
    );
  });

  it('brings the facts that were missed in exactly as the ones that were found', () => {
    const observer = stubIntersectionObserver();
    try {
      show();
      const lists = [...region('Discovery review').querySelectorAll<HTMLElement>('.rp-facts-list')];
      expect(lists.length).toBeGreaterThan(1);
      for (const list of lists) {
        const rows = [...list.children] as HTMLElement[];
        expect(rows.map((row) => row.style.getPropertyValue('--reveal-i'))).toEqual(
          rows.map((_, index) => String(Math.min(index + 3, 7))),
        );
        for (const row of rows) expect(row).toHaveAttribute('data-reveal');
        act(() => {
          watcherOf(list).reportElement(list, true);
        });
        for (const row of rows) expect(row).toHaveAttribute('data-revealed');
      }
    } finally {
      observer.restore();
    }
  });
});

describe('the next practice card', () => {
  const card = () => document.querySelector('.rp-next') as HTMLElement;

  it('answers a mouse and a press only where the pointer can hover and nobody asked for less', () => {
    stubMedia(DESKTOP_MOUSE);
    show();
    expect(card()).toHaveAttribute('data-fx', 'on');
    cleanup();
    stubMedia({ ...DESKTOP_MOUSE, '(prefers-reduced-motion: reduce)': true });
    show();
    expect(card()).toHaveAttribute('data-fx', 'off');
    cleanup();
    stubMedia({ '(hover: none)': true, '(pointer: coarse)': true });
    show();
    expect(card()).toHaveAttribute('data-fx', 'off');
  });

  it('is one target, with the button its whole card', () => {
    show();
    const link = within(card()).getByRole('link');
    expect(link).toHaveClass('rp-next__cta');
    expect(within(card()).getAllByRole('link')).toHaveLength(1);
  });
});

describe('"On this page"', () => {
  /** jsdom has no layout: every list item is 32 px tall, one under the other, in a box of its own. */
  function stubLayout() {
    const proto = HTMLElement.prototype;
    const names = [
      'offsetParent',
      'offsetTop',
      'offsetLeft',
      'offsetWidth',
      'offsetHeight',
    ] as const;
    const saved = names.map(
      (name) => [name, Object.getOwnPropertyDescriptor(proto, name)] as const,
    );
    const row = (element: HTMLElement) => {
      const item = element.closest('li');
      return item?.parentElement ? [...item.parentElement.children].indexOf(item) : 0;
    };
    Object.defineProperty(proto, 'offsetParent', { configurable: true, get: () => document.body });
    Object.defineProperty(proto, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        return row(this) * 32;
      },
    });
    Object.defineProperty(proto, 'offsetLeft', { configurable: true, get: () => 0 });
    Object.defineProperty(proto, 'offsetWidth', { configurable: true, get: () => 160 });
    Object.defineProperty(proto, 'offsetHeight', { configurable: true, get: () => 32 });
    return () => {
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(proto, name, descriptor);
        else Reflect.deleteProperty(proto, name);
      }
    };
  }

  it('has one line, hidden from assistive technology, that moves to the part the reader has reached', () => {
    const restoreLayout = stubLayout();
    const observer = stubIntersectionObserver();
    try {
      show();
      const nav = screen.getByRole('navigation', { name: 'On this page' });
      expect(nav.querySelectorAll('.rp-nav__indicator')).toHaveLength(1);
      expect(nav.querySelector('.rp-nav__indicator')).toHaveAttribute('aria-hidden', 'true');
      const links = within(nav).getAllByRole('link');
      const current = () =>
        links.findIndex((link) => link.getAttribute('aria-current') === 'location');
      expect(current()).toBe(0);
      expect(nav.style.getPropertyValue('--ind-cy')).toBe('16px');
      expect(nav.style.getPropertyValue('--ind-o')).toBe('1');

      const watcher = FakeIntersectionObserver.instances.find((candidate) =>
        [...candidate.observed].some((element) => element.id === 'scores'),
      );
      act(() => {
        watcher?.report('scores', true);
      });
      const scores = links.findIndex((link) => link.textContent === 'Scores');
      expect(current()).toBe(scores);
      expect(nav.style.getPropertyValue('--ind-cy')).toBe(`${scores * 32 + 16}px`);
    } finally {
      observer.restore();
      restoreLayout();
    }
  });

  it('scrolls to a part smoothly from the navigation, and at once from anywhere else', async () => {
    const { scroll, restore } = stubScroll();
    try {
      show();
      const nav = screen.getByRole('navigation', { name: 'On this page' });
      await userEvent.click(within(nav).getByRole('link', { name: 'Discovery review' }));
      expect(scroll).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'smooth' }));
      const summary = region('Summary');
      await userEvent.click(within(summary).getByRole('link', { name: 'About this report' }));
      expect(scroll).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'auto' }));
    } finally {
      restore();
    }
  });

  it('never scrolls smoothly when motion is reduced', async () => {
    const { scroll, restore } = stubScroll();
    const media = stubMatchMedia((query) => query.includes('prefers-reduced-motion: reduce'));
    try {
      show();
      const nav = screen.getByRole('navigation', { name: 'On this page' });
      await userEvent.click(within(nav).getByRole('link', { name: 'Strengths' }));
      expect(scroll).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'auto' }));
    } finally {
      media();
      restore();
    }
  });
});
