import { act, cleanup, render, screen, within } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clock } from './call-model.ts';
import { tracePoints, describeCustomerState } from './call-model.ts';
import { TemperatureTrace } from './TemperatureTrace.tsx';
import { Waveform } from './Waveform.tsx';
import { useVisualViewportHeight } from './use-layout.ts';
import { describeVoice } from './VoiceSettings.tsx';
import { clearViewport, renderCall, snapshotOf, WIDTH } from './test-utils.tsx';

afterEach(() => {
  cleanup();
  clearViewport();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the waveform', () => {
  const shape = (container: HTMLElement) =>
    container.querySelector('svg')?.getAttribute('data-shape');

  it('is hidden from assistive technology in every mode', () => {
    for (const mode of ['idle', 'trainee', 'customer', 'transcribing', 'thinking'] as const) {
      const { container, unmount } = render(
        <Waveform mode={mode} level={0.5} reducedMotion={false} />,
      );
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      unmount();
    }
  });

  it('draws a quiet line when idle and dots while something works, with no timers', () => {
    vi.useFakeTimers();
    const idle = render(<Waveform mode="idle" level={0} reducedMotion={false} />);
    expect(shape(idle.container)).toBe('line');
    idle.unmount();
    const transcribing = render(<Waveform mode="transcribing" level={0} reducedMotion={false} />);
    expect(shape(transcribing.container)).toBe('dots');
    transcribing.unmount();
    const thinking = render(<Waveform mode="thinking" level={0} reducedMotion={false} />);
    expect(shape(thinking.container)).toBe('dots');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is a still level meter under reduced motion: no timers, no scrolling bars', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Waveform mode="trainee" level={0.2} reducedMotion />);
    expect(shape(container)).toBe('meter');
    expect(vi.getTimerCount()).toBe(0);
    const fill = () => Number(container.querySelector('.cw-wave__bar')?.getAttribute('width'));
    const low = fill();
    rerender(<Waveform mode="trainee" level={0.9} reducedMotion />);
    expect(fill()).toBeGreaterThan(low);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('moves at most about fifteen times a second, and only while a voice is moving', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const { container, unmount } = render(
      <Waveform mode="customer" level={0.8} reducedMotion={false} />,
    );
    expect(shape(container)).toBe('bars');
    const delays = setIntervalSpy.mock.calls.map(([, delay]) => Number(delay));
    expect(delays).toHaveLength(1);
    expect(1000 / delays[0]!).toBeLessThanOrEqual(15.2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows the level of the voice that is speaking', () => {
    vi.useFakeTimers();
    const heights = (level: number) => {
      const { container, unmount } = render(
        <Waveform mode="trainee" level={level} reducedMotion={false} />,
      );
      act(() => vi.advanceTimersByTime(66 * 40));
      const rects = [...container.querySelectorAll('.cw-wave__bar')];
      const last = Number(rects.at(-1)?.getAttribute('height'));
      unmount();
      return last;
    };
    expect(heights(1)).toBeGreaterThan(heights(0.1));
  });
});

describe('the temperature trace', () => {
  const history = [
    { turnIndex: 1, band: 'calm', label: 'Calm' },
    { turnIndex: 3, band: 'concerned', label: 'Concerned' },
    { turnIndex: 5, band: 'frustrated', label: 'Frustrated' },
  ] as const;
  const state = (id: 'frustrated', trend: 'rising') => ({
    band: { id, label: 'Frustrated' },
    trend,
    discoveredCount: 0,
    silent: false,
    shifts: 0,
  });

  it('labels five bands, the start and the latest point, and describes itself in words', () => {
    const view = describeCustomerState(state('frustrated', 'rising'), history);
    render(<TemperatureTrace points={tracePoints(history, null)} view={view} />);
    const chart = screen.getByRole('img');
    expect(chart).toHaveAccessibleName(
      'Customer temperature over 3 points: started Calm, now Frustrated, rising.',
    );
    for (const label of ['Escalating', 'Angry', 'Frustrated', 'Concerned', 'Calm']) {
      expect(within(chart.parentElement as HTMLElement).getAllByText(label).length).toBeGreaterThan(
        0,
      );
    }
    expect(screen.getByText('Start:')).toBeInTheDocument();
    expect(screen.getByText('Now:')).toBeInTheDocument();
  });

  it('lists every point in a table for anyone who prefers to read it', () => {
    render(<TemperatureTrace points={tracePoints(history, null)} view={null} />);
    const table = screen.getByRole('table', { name: 'Customer state after each reply' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(within(rows[1]!).getByText('Opening line')).toBeInTheDocument();
    expect(within(rows[3]!).getByText('Reply 3 (now)')).toBeInTheDocument();
    expect(within(rows[3]!).getByText('Frustrated')).toBeInTheDocument();
  });

  it('shows only "Now" when there is a single point, and nothing when there are none', () => {
    const single = render(
      <TemperatureTrace points={tracePoints([], state('frustrated', 'rising'))} view={null} />,
    );
    expect(screen.queryByText('Start:')).not.toBeInTheDocument();
    expect(screen.getByText('Now:')).toBeInTheDocument();
    single.unmount();
    const none = render(<TemperatureTrace points={[]} view={null} />);
    expect(none.container).toBeEmptyDOMElement();
  });
});

describe('the voice read-out', () => {
  const server = { playback: 'server-speech', playbackLabel: 'Azure AI Speech' } as const;
  const browser = {
    playback: 'browser-synthesis',
    playbackLabel: 'Browser voice (on this device): Microsoft David, en-US',
  } as const;
  const none = { playback: 'none', playbackLabel: 'Captions only' } as const;

  it('says the voice that spoke and the style the provider really applied', () => {
    expect(describeVoice('en-GB-RyanNeural', 'unfriendly', server)).toEqual({
      voice: 'en-GB-RyanNeural',
      style: 'unfriendly',
    });
  });

  it('says mood was approximated by pace and pitch when no style was applied', () => {
    expect(describeVoice('en-GB-SoniaNeural', 'none', server).style).toBe(
      'approximated by pace and pitch',
    );
    expect(describeVoice('Microsoft David', 'unfriendly', browser).style).toBe(
      'approximated by pace and pitch',
    );
  });

  it('shows the browser voice by the call’s own label, never as a bare voice name', () => {
    expect(describeVoice('Microsoft David', null, browser).voice).toBe(
      'Browser voice (on this device): Microsoft David, en-US',
    );
    expect(
      describeVoice(null, null, { playback: 'browser-synthesis', playbackLabel: 'Browser voice' })
        .voice,
    ).toBe('Browser voice');
    expect(
      describeVoice(null, null, {
        playback: 'browser-synthesis',
        playbackLabel: 'Browser voice (default voice)',
      }).voice,
    ).toBe('Browser voice (default voice)');
  });

  it('admits when the server’s voice has not spoken yet', () => {
    expect(describeVoice(null, null, server)).toEqual({
      voice: 'Shown once the customer has spoken',
      style: 'Shown once the customer has spoken',
    });
  });

  it('says there is no voice at all on a captions-only call', () => {
    expect(describeVoice(null, null, none).voice).toMatch(/captions/);
  });
});

describe('the clock in the bar', () => {
  it('counts up on screen each second without being announced', () => {
    vi.useFakeTimers();
    const base = snapshotOf('ready-for-next-turn');
    const { update } = renderCall(base, { width: WIDTH.wide });
    expect(screen.getByRole('timer')).toHaveTextContent(clock(base.elapsedSeconds));
    update({ ...base, elapsedSeconds: base.elapsedSeconds + 1 });
    expect(screen.getByRole('timer')).toHaveTextContent(clock(base.elapsedSeconds + 1));
    expect(document.querySelector('[role="status"][aria-live="polite"]')).toBeEmptyDOMElement();
  });
});

describe('the on-screen keyboard', () => {
  function Probe({ enabled }: { enabled: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    useVisualViewportHeight(ref, enabled);
    return <div ref={ref} data-testid="probe" />;
  }
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');

  afterEach(() => {
    if (original) Object.defineProperty(window, 'visualViewport', original);
    else Reflect.deleteProperty(window, 'visualViewport');
    viewport.height = 800;
    viewport.scale = 1;
  });

  it('keeps the screen as tall as what is visible while the keyboard is open', () => {
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    render(<Probe enabled />);
    const probe = screen.getByTestId('probe');
    expect(probe.style.getPropertyValue('--cw-vh')).toBe('');

    viewport.height = 420;
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(probe.style.getPropertyValue('--cw-vh')).toBe('420px');

    viewport.height = 800;
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(probe.style.getPropertyValue('--cw-vh')).toBe('');
  });

  it('ignores a pinch zoom, which also shrinks the visible area', () => {
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    render(<Probe enabled />);
    viewport.height = 300;
    viewport.scale = 2;
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('probe').style.getPropertyValue('--cw-vh')).toBe('');
  });
});
