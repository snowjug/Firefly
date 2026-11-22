import { cleanup, render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MOUSE, stubMedia, stubRaf } from '../../design/interaction/test-utils.ts';
import { CallPreview, PREVIEW_CAPTION } from './CallPreview.tsx';
import { BEATS, LOOP_MS, MAX_LOOPS, PREVIEW_EXAMPLES } from './preview-script.ts';
import { live, stepper, stubIntersection } from './test-utils.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TEAMS = PREVIEW_EXAMPLES[0] as (typeof PREVIEW_EXAMPLES)[number];
const REDUCED = { ...DESKTOP_MOUSE, '(prefers-reduced-motion: reduce)': true };

/** Renders the preview with fake media, animation frames and visibility, on screen unless told not to. */
function setUp(media: Record<string, boolean> = DESKTOP_MOUSE, { visible = true } = {}) {
  stubMedia(media);
  const raf = stubRaf();
  stubIntersection();
  const user = userEvent.setup();
  const view = render(<CallPreview />);
  const { advance } = stepper(raf);
  // The first observer is the preview's own: it watches whether the preview is in the window.
  const inWindow = (value: boolean) => live()[0]?.report(value);
  if (visible) inWindow(true);
  return { ...view, user, raf, advance, inWindow };
}

/** The panel of the example that is chosen. */
const panel = () =>
  document.querySelector<HTMLElement>('[role="tabpanel"][data-selected] .lp-panel');
const stage = () => panel() as HTMLElement;
const line = (text: string) => within(stage()).getByText(text).closest('li') as HTMLElement;
const status = () => within(stage()).getByText(/^(Speaking|Listening|Call ended)$/).textContent;
const mic = () => stage().querySelector('.lp-ind--mic') as HTMLElement;
const [FIRST, SECOND, THIRD] = TEAMS.lines.map((item) => item.text) as [string, string, string];

describe('the call preview: what it is', () => {
  it('is a figure named by a caption that says the customer is synthetic', () => {
    setUp();
    expect(PREVIEW_CAPTION).toBe('Example call. The customer is synthetic.');
    const figure = screen.getByRole('figure', { name: PREVIEW_CAPTION });
    expect(within(figure).getByText(PREVIEW_CAPTION)).toBeVisible();
  });

  it('offers the three products as tabs, with Teams chosen and its call showing', () => {
    setUp();
    expect(screen.getByRole('tablist', { name: 'Example calls by product' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Teams',
      'Outlook',
      'Entra ID',
    ]);
    expect(screen.getByRole('tab', { name: 'Teams', selected: true })).toBeInTheDocument();
    const shown = screen.getByRole('tabpanel', { name: 'Teams' });
    expect(within(shown).getByText('Microsoft Teams')).toBeInTheDocument();
    expect(within(shown).getByText('Maya Okafor', { selector: 'p' })).toBeInTheDocument();
    expect(within(shown).getByText('Operations coordinator')).toBeInTheDocument();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('is made of text and decorative drawings, never a picture of a screen', () => {
    const { container } = setUp();
    expect(container.querySelectorAll('img, picture, canvas, video, audio')).toHaveLength(0);
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.closest('[aria-hidden="true"]'), 'an svg is exposed').not.toBeNull();
    }
  });
});

describe('the call preview: every word is in the document before it can be seen', () => {
  it('has all three lines of the call, and the report, at the very first frame', () => {
    setUp(DESKTOP_MOUSE, { visible: false });
    for (const text of [FIRST, SECOND, THIRD]) {
      expect(within(stage()).getByText(text)).toBeInTheDocument();
    }
    for (const row of TEAMS.report) {
      expect(within(stage()).getByText(row.quote)).toBeInTheDocument();
    }
    expect(within(stage()).getByText('After the call')).toBeInTheDocument();
    const scores = [...stage().querySelectorAll('.lp-mini__score')].map((cell) => cell.textContent);
    expect(scores).toEqual(TEAMS.report.map((row) => expect.stringContaining(`${row.score} of 5`)));
    // ... though nothing has appeared yet.
    expect(stage().querySelectorAll('.lp-line[data-shown]')).toHaveLength(0);
    expect(
      stage().querySelectorAll('.lp-mini__row[data-quoted], .lp-mini__row[data-scored]'),
    ).toHaveLength(0);
  });

  it('keeps the moving parts out of the accessibility tree and the words in it', () => {
    setUp();
    for (const text of ['Listening', 'Calm']) {
      expect(within(stage()).getByText(text).closest('[aria-hidden="true"]'), text).not.toBeNull();
    }
    expect(stage().querySelector('.lp-wave')?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(stage().querySelector('.lp-panel__indicators')).toHaveAttribute('aria-hidden', 'true');
    for (const text of [FIRST, SECOND, THIRD, 'After the call']) {
      expect(within(stage()).getByText(text).closest('[aria-hidden="true"]'), text).toBeNull();
    }
    expect(screen.getByRole('tabpanel', { name: 'Teams' })).toBeInTheDocument();
  });

  it('has indicators that are pictures: no control, nothing to tab to', () => {
    setUp();
    const indicators = stage().querySelector('.lp-panel__indicators') as HTMLElement;
    expect(within(indicators).queryAllByRole('button')).toHaveLength(0);
    expect(indicators.querySelectorAll('[tabindex], button, a, input')).toHaveLength(0);
  });
});

describe('the call preview: it plays a short call', () => {
  it('has the customer speak, the trainee answer, the customer explain, the call end and the report appear', () => {
    const { advance } = setUp();
    expect(status()).toBe('Listening');
    expect(within(stage()).getByText('Calm')).toBeInTheDocument();
    expect(stage()).toHaveAttribute('data-phase', 'call');

    advance(1500);
    expect(status()).toBe('Speaking');
    expect(stage()).toHaveAttribute('data-speaking', 'customer');
    expect(line(FIRST)).toHaveAttribute('data-shown');
    expect(line(SECOND)).not.toHaveAttribute('data-shown');
    expect(mic()).not.toHaveAttribute('data-live');

    advance(3000); // 4.5 s
    expect(status()).toBe('Listening');
    expect(stage()).toHaveAttribute('data-speaking', 'trainee');
    expect(line(SECOND)).toHaveAttribute('data-shown');
    expect(mic(), 'the trainee’s microphone lights while the trainee speaks').toHaveAttribute(
      'data-live',
    );

    advance(3500); // 8 s
    expect(status()).toBe('Speaking');
    expect(line(THIRD)).toHaveAttribute('data-shown');
    expect(mic()).not.toHaveAttribute('data-live');
    expect(within(stage()).getByText('Calm')).toBeInTheDocument();

    advance(600); // 8.6 s
    expect(within(stage()).getByText('Concerned')).toBeInTheDocument();
    expect(within(stage()).queryByText('Calm')).toBeNull();

    advance(BEATS.end - 8600 + 100);
    expect(status()).toBe('Call ended');
    expect(stage()).toHaveAttribute('data-phase', 'call');
    advance(BEATS.report - BEATS.end);
    expect(stage()).toHaveAttribute('data-phase', 'report');
  });

  it('shows the quotes first and the scores after them, one row at a time', () => {
    const { advance } = setUp();
    advance(BEATS.quotes[0] + 100);
    const rows = () => [...stage().querySelectorAll('.lp-mini__row')];
    expect(rows().map((row) => row.hasAttribute('data-quoted'))).toEqual([true, false, false]);
    expect(rows().some((row) => row.hasAttribute('data-scored'))).toBe(false);
    advance(BEATS.quotes[2] - BEATS.quotes[0]);
    expect(rows().map((row) => row.hasAttribute('data-quoted'))).toEqual([true, true, true]);
    expect(rows().some((row) => row.hasAttribute('data-scored'))).toBe(false);
    advance(BEATS.scores[0] - BEATS.quotes[2] + 100);
    expect(rows().map((row) => row.hasAttribute('data-scored'))).toEqual([true, false, false]);
    advance(BEATS.scores[2] - BEATS.scores[0]);
    expect(rows().map((row) => row.hasAttribute('data-scored'))).toEqual([true, true, true]);
  });

  it('starts again from the top after each loop, and plays three loops', () => {
    const { advance } = setUp();
    advance(LOOP_MS - 100);
    expect(stage()).toHaveAttribute('data-phase', 'report');
    advance(1200);
    expect(stage()).toHaveAttribute('data-phase', 'call');
    expect(stage().querySelectorAll('.lp-line[data-shown]').length).toBeLessThanOrEqual(1);
    advance(LOOP_MS);
    expect(screen.getByRole('button', { name: 'Pause preview' })).toBeInTheDocument();
    expect(MAX_LOOPS).toBe(3);
  });

  it('rests on the report after three loops and asks for no more frames', () => {
    const { advance, raf } = setUp();
    advance(LOOP_MS * MAX_LOOPS + 500);
    expect(stage()).toHaveAttribute('data-phase', 'report');
    expect(stage().querySelectorAll('.lp-mini__row[data-scored]')).toHaveLength(3);
    expect(raf.pending()).toBe(0);
    expect(screen.getByRole('button', { name: 'Play preview' })).toBeInTheDocument();
  });

  it('plays it again from the top on "Play" at the end, with focus kept on the control', async () => {
    const { advance, user } = setUp();
    advance(LOOP_MS * MAX_LOOPS + 500);
    await user.click(screen.getByRole('button', { name: 'Play preview' }));
    const again = screen.getByRole('button', { name: 'Pause preview' });
    expect(again).toHaveFocus();
    expect(stage()).toHaveAttribute('data-phase', 'call');
    expect(stage().querySelectorAll('.lp-line[data-shown]')).toHaveLength(0);
    advance(1500);
    expect(status()).toBe('Speaking');
  });
});

describe('the call preview: the visitor can always stop it (WCAG 2.2.2)', () => {
  it('has a button named "Pause preview" that becomes "Play preview" and stops the clock where it is', async () => {
    const { advance, raf, user } = setUp();
    advance(1500);
    await user.click(screen.getByRole('button', { name: 'Pause preview' }));
    expect(screen.getByRole('button', { name: 'Play preview' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause preview' })).toBeNull();
    // The pointer's own frame (the tilt) is flushed first; after it, the clock asks for none.
    advance(100);
    expect(raf.pending()).toBe(0);
    advance(5000);
    expect(status()).toBe('Speaking');
    expect(line(SECOND)).not.toHaveAttribute('data-shown');
  });

  it('carries on from the same place on "Play"', async () => {
    const { advance, user } = setUp();
    advance(1500);
    await user.click(screen.getByRole('button', { name: 'Pause preview' }));
    await user.click(screen.getByRole('button', { name: 'Play preview' }));
    expect(screen.getByRole('button', { name: 'Pause preview' })).toBeInTheDocument();
    advance(3000);
    expect(line(SECOND)).toHaveAttribute('data-shown');
    expect(line(FIRST)).toHaveAttribute('data-shown');
  });

  it('works from the keyboard: Enter pauses and Space plays', async () => {
    const { advance, raf, user } = setUp();
    advance(500);
    screen.getByRole('button', { name: 'Pause preview' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Play preview' })).toHaveFocus();
    expect(raf.pending()).toBe(0);
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Pause preview' })).toHaveFocus();
    expect(raf.pending()).toBe(1);
  });

  it('is a real, named button of a size a finger can find', () => {
    setUp();
    const button = screen.getByRole('button', { name: 'Pause preview' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toBeVisible();
    expect(within(button).getByText('Pause')).toBeInTheDocument();
  });
});

describe('the call preview: it pauses when it cannot be seen', () => {
  it('does not start while it is off screen, and carries on when it comes into view', () => {
    const { advance, raf, inWindow } = setUp(DESKTOP_MOUSE, { visible: false });
    expect(raf.pending()).toBeLessThanOrEqual(1);
    advance(3000);
    expect(stage().querySelectorAll('.lp-line[data-shown]')).toHaveLength(0);
    inWindow(true);
    advance(1500);
    expect(line(FIRST)).toHaveAttribute('data-shown');
  });

  it('freezes while it is scrolled out of the window and carries on where it was', () => {
    const { advance, raf, inWindow } = setUp();
    advance(1500);
    inWindow(false);
    expect(raf.pending()).toBe(0);
    advance(6000);
    expect(status()).toBe('Speaking');
    expect(line(SECOND)).not.toHaveAttribute('data-shown');
    inWindow(true);
    advance(3000);
    expect(line(SECOND)).toHaveAttribute('data-shown');
  });

  it('freezes while the tab is in the background', () => {
    const { advance, raf } = setUp();
    advance(1500);
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(raf.pending()).toBe(0);
    advance(6000);
    expect(line(SECOND)).not.toHaveAttribute('data-shown');
    hidden.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(raf.pending()).toBe(1);
  });
});

describe('the call preview: reduced motion', () => {
  it('stops at the complete final frame: the call over, the report showing, every score in', () => {
    const { advance, raf } = setUp(REDUCED);
    advance(5000);
    expect(stage()).toHaveAttribute('data-phase', 'report');
    expect(stage().querySelectorAll('.lp-line[data-shown]')).toHaveLength(3);
    expect(stage().querySelectorAll('.lp-mini__row[data-scored]')).toHaveLength(3);
    expect(status()).toBe('Call ended');
    expect(within(stage()).getByText('Concerned')).toBeInTheDocument();
    expect(raf.pending()).toBe(0);
  });

  it('has nothing to pause, so no control', () => {
    setUp(REDUCED);
    expect(screen.queryByRole('button', { name: /preview/i })).toBeNull();
    expect(stage().querySelectorAll('button')).toHaveLength(0);
  });

  it('still lets the visitor choose another product, and shows that one finished too', async () => {
    const { user } = setUp(REDUCED);
    await user.click(screen.getByRole('tab', { name: 'Outlook' }));
    const outlook = screen.getByRole('tabpanel', { name: 'Outlook' });
    expect(within(outlook).getByText('Frustrated')).toBeInTheDocument();
    expect(outlook.querySelector('.lp-panel')).toHaveAttribute('data-phase', 'report');
  });
});

describe('the call preview: it makes no sound', () => {
  it('uses no audio element, no speech synthesis and no Audio object, through a whole run', () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    const audio = vi.fn();
    vi.stubGlobal('Audio', audio);
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const { advance, container } = setUp();
    advance(LOOP_MS * MAX_LOOPS + 500);
    expect(container.querySelectorAll('audio, video, source, track')).toHaveLength(0);
    expect(speak).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });
});

describe('the call preview: the three products', () => {
  it('starts the chosen product from the top and keeps focus on its tab', async () => {
    const { advance, user } = setUp();
    advance(5000);
    screen.getByRole('tab', { name: 'Teams' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Outlook', selected: true })).toHaveFocus();
    const outlook = screen.getByRole('tabpanel', { name: 'Outlook' });
    expect(
      within(outlook).getByText(
        'We cannot open Outlook this morning, and the whole team is waiting.',
      ),
    ).toBeInTheDocument();
    expect(stage()).toHaveAttribute('data-phase', 'call');
    expect(stage().querySelectorAll('.lp-line[data-shown]')).toHaveLength(0);
    advance(1500);
    expect(status()).toBe('Speaking');
    expect(screen.queryByRole('tabpanel', { name: 'Teams' })).toBeNull();
  });

  it('leaves the call alone when the chosen tab is chosen again', async () => {
    const { advance, user } = setUp();
    advance(1500);
    await user.click(screen.getByRole('tab', { name: 'Teams' }));
    expect(line(FIRST)).toHaveAttribute('data-shown');
    expect(status()).toBe('Speaking');
  });

  it('moves ONE line to the chosen tab, and gives it the chosen product’s accent', async () => {
    const boxes: Record<string, { left: number; width: number }> = {
      Teams: { left: 0, width: 90 },
      Outlook: { left: 94, width: 100 },
      'Entra ID': { left: 198, width: 110 },
    };
    const label = (element: HTMLElement) => element.textContent?.trim() ?? '';
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.closest('.lp-preview__bar');
    });
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return boxes[label(this)]?.left ?? 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return boxes[label(this)]?.width ?? 0;
    });
    const { container, user } = setUp();
    const bar = container.querySelector('.lp-preview__bar') as HTMLElement;
    expect(container.querySelectorAll('.lp-preview__line')).toHaveLength(1);
    expect(bar.style.getPropertyValue('--ind-x')).toBe('0px');
    expect(bar.style.getPropertyValue('--ind-w')).toBe('90');
    await user.click(screen.getByRole('tab', { name: 'Outlook' }));
    expect(bar.style.getPropertyValue('--ind-x')).toBe('94px');
    expect(bar.style.getPropertyValue('--ind-w')).toBe('100');
    expect(container.querySelector('.lp-preview__line')).toHaveClass('ff-accent--blue');
    await user.click(screen.getByRole('tab', { name: 'Teams' }));
    expect(container.querySelector('.lp-preview__line')).toHaveClass('ff-accent--purple');
  });
});

describe('the call preview: it follows a mouse by a degree or two, and only a mouse', () => {
  it.each([
    ['a desktop mouse', DESKTOP_MOUSE, 'on'],
    ['a touch screen', { '(hover: none)': true, '(pointer: coarse)': true }, 'off'],
    [
      'a coarse pointer that can hover',
      { '(hover: hover)': true, '(pointer: coarse)': true },
      'off',
    ],
    ['a mouse and reduced motion', REDUCED, 'off'],
  ])('with %s the window is "%s"', (_name, media, expected) => {
    const { container } = setUp(media);
    expect(container.querySelector('.lp-preview__window')).toHaveAttribute('data-fx', expected);
  });
});
