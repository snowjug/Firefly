import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDialogShim } from '../../design/dialog-shim.ts';
import { AnnouncerProvider } from '../../design/index.ts';
import type { PublicStateDTO } from '#shared/domain/api.ts';
import { TEMPERATURE_BANDS, type TemperatureBandId } from '#shared/domain/vocab.ts';
import type { CallStatePoint, CallSupport } from '../call/contract.ts';
import { describeCustomerState, describeStatus, type WaveMode } from './call-model.ts';
import { FIXTURES } from './call-fixtures.ts';
import { CustomerStage, type CustomerStageProps } from './CustomerStage.tsx';
import { fakeActions } from './test-utils.tsx';
import { VoiceSettings, describeVoice, type VoiceSettingsProps } from './VoiceSettings.tsx';
import { Waveform } from './Waveform.tsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  // Back to jsdom's own property on the prototype, if a test pretended the tab was hidden.
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('the waveform', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const tick = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  const bars = (container: HTMLElement) =>
    [...container.querySelectorAll('rect.cw-wave__bar')].map((bar) =>
      Number(bar.getAttribute('height')),
    );

  it('is a still line while nothing is happening, with no timer running', () => {
    const interval = vi.spyOn(window, 'setInterval');
    const { container } = render(<Waveform mode="idle" level={0.9} reducedMotion={false} />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg).toHaveAttribute('data-shape', 'line');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    tick(2000);
    expect(interval).not.toHaveBeenCalled();
  });

  it.each<WaveMode>(['trainee', 'customer'])(
    'moves with the %s’s voice, sampled about fifteen times a second and no faster',
    (mode) => {
      const interval = vi.spyOn(window, 'setInterval');
      const { container } = render(<Waveform mode={mode} level={0.8} reducedMotion={false} />);
      expect(interval).toHaveBeenCalledTimes(1);
      expect(interval.mock.calls[0]?.[1]).toBeGreaterThanOrEqual(60);
      expect(new Set(bars(container)).size).toBe(1);
      tick(66 * 5 + 10);
      const heights = bars(container);
      expect(heights.length).toBe(28);
      // The newest samples are at the right and the older ones have moved left.
      expect(heights.at(-1)).toBeGreaterThan(heights[0] as number);
    },
  );

  it('follows the level as it changes without starting another timer', () => {
    const interval = vi.spyOn(window, 'setInterval');
    const { container, rerender } = render(
      <Waveform mode="trainee" level={0.1} reducedMotion={false} />,
    );
    tick(70);
    const quiet = bars(container).at(-1) as number;
    rerender(<Waveform mode="trainee" level={0.9} reducedMotion={false} />);
    tick(70);
    expect(bars(container).at(-1)).toBeGreaterThan(quiet);
    expect(interval).toHaveBeenCalledTimes(1);
  });

  it('stops its timer when the voice stops and when it is taken away', () => {
    const clear = vi.spyOn(window, 'clearInterval');
    const { rerender, unmount } = render(
      <Waveform mode="trainee" level={0.5} reducedMotion={false} />,
    );
    rerender(<Waveform mode="idle" level={0} reducedMotion={false} />);
    expect(clear).toHaveBeenCalledTimes(1);
    rerender(<Waveform mode="customer" level={0.5} reducedMotion={false} />);
    unmount();
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it('is a still level meter under reduced motion: its fill is the level, and no timer runs', () => {
    const interval = vi.spyOn(window, 'setInterval');
    const { container, rerender } = render(<Waveform mode="trainee" level={0.25} reducedMotion />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg).toHaveAttribute('data-shape', 'meter');
    const fill = () => Number(container.querySelector('.cw-wave__bar')?.getAttribute('width'));
    const low = fill();
    rerender(<Waveform mode="trainee" level={0.9} reducedMotion />);
    expect(fill()).toBeGreaterThan(low);
    tick(2000);
    expect(interval).not.toHaveBeenCalled();
  });

  it('shows a shimmer, never a percentage, while speech is turned into text', () => {
    const { container } = render(<Waveform mode="transcribing" level={0} reducedMotion={false} />);
    const progress = screen.getByRole('progressbar', { name: 'Transcribing' });
    expect(progress).not.toHaveAttribute('aria-valuenow');
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('shows three points while the customer thinks, and keeps them still under reduced motion too', () => {
    const interval = vi.spyOn(window, 'setInterval');
    for (const reducedMotion of [false, true]) {
      const { container, unmount } = render(
        <Waveform mode="thinking" level={0} reducedMotion={reducedMotion} />,
      );
      expect(container.querySelectorAll('.cw-think__dot')).toHaveLength(3);
      expect(container.querySelector('[data-shape="points"]')).not.toBeNull();
      unmount();
    }
    expect(interval).not.toHaveBeenCalled();
  });

  it('gives the three points the accessible text they are given, once, and no other words', () => {
    const { container } = render(
      <Waveform mode="thinking" level={0} reducedMotion={false} label="Customer is responding" />,
    );
    expect(screen.getAllByText('Customer is responding')).toHaveLength(1);
    expect(container.textContent).toBe('Customer is responding');
    // The points themselves are decoration: the text is the name.
    expect(container.querySelector('.cw-think__points')).toHaveAttribute('aria-hidden', 'true');
  });

  it('says nothing to assistive technology but the names of the shimmer and the points: the status says the rest', () => {
    for (const mode of ['idle', 'trainee', 'customer'] as const) {
      const { container, unmount } = render(
        <Waveform mode={mode} level={0.5} reducedMotion={false} />,
      );
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(container.textContent).toBe('');
      unmount();
    }
    // Three points with no name are plain decoration: the status label beside them is the name.
    const { container } = render(<Waveform mode="thinking" level={0} reducedMotion={false} />);
    expect(container.textContent).toBe('');
  });

  describe('when the customer’s level cannot be measured', () => {
    it('draws a calm fixed pattern and runs no timer, whatever level it is given', () => {
      const interval = vi.spyOn(window, 'setInterval');
      const { container, rerender } = render(
        <Waveform mode="customer" level={0.9} measured={false} reducedMotion={false} />,
      );
      expect(container.querySelector('svg')).toHaveAttribute('data-shape', 'pattern');
      const before = bars(container);
      rerender(<Waveform mode="customer" level={0.1} measured={false} reducedMotion={false} />);
      tick(2000);
      expect(bars(container)).toEqual(before);
      expect(interval).not.toHaveBeenCalled();
    });

    it('is the same pattern under reduced motion, and never a meter that pretends to read the sound', () => {
      const { container } = render(
        <Waveform mode="customer" level={0.9} measured={false} reducedMotion />,
      );
      expect(container.querySelector('svg')).toHaveAttribute('data-shape', 'pattern');
      expect(container.querySelector('.cw-wave__track')).toBeNull();
    });

    it('does not change the microphone’s strip: the trainee’s level is always measured', () => {
      const { container } = render(
        <Waveform mode="trainee" level={0.8} measured={false} reducedMotion={false} />,
      );
      expect(container.querySelector('svg')).toHaveAttribute('data-shape', 'bars');
    });
  });

  it('settles onto the quiet line when a voice finishes, instead of cutting to it', () => {
    const { container, rerender } = render(
      <Waveform mode="customer" level={0.9} reducedMotion={false} />,
    );
    tick(66 * 10);
    const loud = Math.max(...bars(container));
    rerender(<Waveform mode="idle" level={0} reducedMotion={false} />);
    // Still bars, and sinking.
    expect(container.querySelector('svg')).toHaveAttribute('data-shape', 'bars');
    expect(container.querySelector('.cw-wave--settling')).not.toBeNull();
    tick(66 * 2);
    expect(Math.max(...bars(container))).toBeLessThan(loud);
    tick(66 * 12);
    expect(container.querySelector('svg')).toHaveAttribute('data-shape', 'line');
    expect(container.querySelector('.cw-wave--settling')).toBeNull();
  });

  it('does not settle under reduced motion: the meter simply goes quiet', () => {
    const { container, rerender } = render(<Waveform mode="customer" level={0.9} reducedMotion />);
    rerender(<Waveform mode="idle" level={0} reducedMotion />);
    expect(container.querySelector('svg')).toHaveAttribute('data-shape', 'line');
  });

  it('drops what is left of a voice at once when the strip shows something else', () => {
    const { container, rerender } = render(
      <Waveform mode="trainee" level={0.9} reducedMotion={false} />,
    );
    tick(66 * 10);
    rerender(<Waveform mode="transcribing" level={0} reducedMotion={false} />);
    expect(container.querySelector('svg')).toBeNull();
    rerender(<Waveform mode="trainee" level={0} reducedMotion={false} />);
    // The next voice starts from nothing, not from the old bars.
    expect(Math.max(...bars(container))).toBe(Math.min(...bars(container)));
  });

  it('stops sampling while the tab is hidden, and starts again when it is back', () => {
    const interval = vi.spyOn(window, 'setInterval');
    const clear = vi.spyOn(window, 'clearInterval');
    const visibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      act(() => void document.dispatchEvent(new Event('visibilitychange')));
    };
    render(<Waveform mode="trainee" level={0.8} reducedMotion={false} />);
    expect(interval).toHaveBeenCalledTimes(1);
    visibility('hidden');
    expect(clear).toHaveBeenCalled();
    const running = interval.mock.calls.length;
    tick(2000);
    // Whatever timer is left is the settle after a hidden tab, never a sampler of the voice.
    expect(interval.mock.calls.length).toBe(running);
    visibility('visible');
    expect(interval.mock.calls.length).toBeGreaterThan(running);
  });
});

describe('what the voice settings say about the voice', () => {
  it('names the voice and the expressive style the provider really used', () => {
    const support = { playback: 'server-speech', playbackLabel: 'Azure AI Speech' } as const;
    expect(describeVoice('en-GB-SoniaNeural', 'cheerful', support)).toEqual({
      voice: 'en-GB-SoniaNeural',
      style: 'cheerful',
    });
    expect(describeVoice('en-GB-SoniaNeural', 'none', support).style).toBe(
      'approximated by pace and pitch',
    );
  });

  it('waits for the customer to speak rather than guessing a voice', () => {
    const support = { playback: 'server-speech', playbackLabel: 'Azure AI Speech' } as const;
    expect(describeVoice(null, null, support)).toEqual({
      voice: 'Shown once the customer has spoken',
      style: 'Shown once the customer has spoken',
    });
  });

  it('keeps the word "Browser" for the browser’s own voice, and approximates its style', () => {
    const support = {
      playback: 'browser-synthesis',
      playbackLabel: 'Browser voice (on this device): Microsoft David, en-US',
    } as const;
    expect(describeVoice('whatever', 'whatever', support)).toEqual({
      voice: 'Browser voice (on this device): Microsoft David, en-US',
      style: 'approximated by pace and pitch',
    });
  });

  it('has no voice when replies are captions', () => {
    expect(describeVoice(null, null, { playback: 'none', playbackLabel: 'Captions only' })).toEqual(
      {
        voice: 'None. Replies are captions.',
        style: 'not applicable',
      },
    );
  });
});

describe('the voice settings dialog', () => {
  const SERVER: CallSupport = FIXTURES['mic-ready'].snapshot.support;
  const settings = (overrides: Partial<VoiceSettingsProps> = {}) => {
    installDialogShim();
    const props: VoiceSettingsProps = {
      open: true,
      onClose: vi.fn(),
      handsFree: false,
      language: 'en-GB',
      audio: 'on',
      voice: 'en-GB-SoniaNeural',
      style: 'none',
      support: SERVER,
      actions: fakeActions(),
      ...overrides,
    };
    render(
      <AnnouncerProvider>
        <VoiceSettings {...props} />
      </AnnouncerProvider>,
    );
    return { props, dialog: within(screen.getByRole('dialog', { name: 'Voice settings' })) };
  };

  it('shows what is really in use: voice, style and recognition service', () => {
    const { dialog } = settings();
    const fact = (label: string) => dialog.getByText(label).nextElementSibling;
    expect(fact('Customer voice')).toHaveTextContent('en-GB-SoniaNeural');
    expect(fact('Expressive style')).toHaveTextContent('approximated by pace and pitch');
    expect(fact('Speech recognition')).toHaveTextContent('Azure AI Speech');
  });

  it('warns that the browser’s recognition can miss words, and that typing always works', () => {
    const { dialog } = settings({
      support: {
        ...SERVER,
        capture: 'browser-recognition',
        captureLabel: 'Browser speech recognition',
      },
    });
    expect(dialog.getByText('It can miss words. Typing always works.')).toBeInTheDocument();
  });

  it('calls scripted demo speech a demo, not a service that understands audio', () => {
    const { dialog } = settings({ support: { ...SERVER, speechDemo: true } });
    expect(dialog.getByText('Scripted demo: it does not understand audio.')).toBeInTheDocument();
  });

  it('is honest when there is no recognition in this browser', () => {
    const { dialog } = settings({ support: { ...SERVER, capture: 'none', captureLabel: 'None' } });
    expect(dialog.getByText('Not available in this browser')).toBeInTheDocument();
  });

  it('turns the customer’s audio switch off and explains it when this browser has no voice', () => {
    const { dialog } = settings({ audio: 'none' });
    const toggle = dialog.getByRole('switch', { name: 'Customer audio' });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAccessibleDescription('Not available here. Replies are captions.');
  });

  it('reports the switch’s state, and asks the engine for the opposite when it is pressed', async () => {
    const user = userEvent.setup();
    const { dialog, props } = settings({ audio: 'off', handsFree: true });
    expect(dialog.getByRole('switch', { name: 'Customer audio' })).not.toBeChecked();
    expect(dialog.getByRole('switch', { name: 'Hands-free' })).toBeChecked();
    await user.click(dialog.getByRole('switch', { name: 'Customer audio' }));
    expect(props.actions.setAudio).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('lists the languages speech supports, by name, with the current one chosen', () => {
    const { dialog } = settings({ language: 'en-IE' });
    const select = dialog.getByRole('combobox', { name: 'Speech language' }) as HTMLSelectElement;
    expect(select.value).toBe('en-IE');
    expect(within(select).getByRole('option', { name: 'English (Ireland)' })).toBeInTheDocument();
    expect(select.options.length).toBeGreaterThanOrEqual(5);
  });
});

describe('the customer on screen', () => {
  const baseProps = (): CustomerStageProps => {
    const { snapshot } = FIXTURES['mic-ready'];
    return {
      name: 'Priya Raman',
      role: 'IT coordinator',
      organisation: 'Harbourline Logistics',
      speaking: false,
      state: describeCustomerState(snapshot.customerState, snapshot.stateHistory),
      status: describeStatus({
        stage: 'ready',
        mode: 'voice',
        phase: 'ready-for-next-turn',
        speechDetected: false,
        microphone: 'granted',
      }),
      statusId: 'status-line',
      micLevel: 0,
      customerLevel: 0,
      reducedMotion: false,
      compact: false,
    };
  };

  it('shows initials, never a photograph, and says the customer is synthetic', () => {
    const { container } = render(<CustomerStage {...baseProps()} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.ff-avatar__initials')).toHaveTextContent('PR');
    expect(screen.getByText('Synthetic customer')).toBeInTheDocument();
  });

  it('reads the state as words, with the trend, and not by colour alone', () => {
    render(<CustomerStage {...baseProps()} />);
    const mood = screen.getByRole('group', { name: 'Customer state' });
    expect(mood).toHaveTextContent('Concerned');
    expect(mood).toHaveTextContent('Trend: steady');
    expect(mood.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
  });

  it('draws the speaking ring only while the customer’s voice plays', () => {
    const props = baseProps();
    const { container, rerender } = render(<CustomerStage {...props} />);
    expect(container.querySelector('.ff-avatar--speaking')).toBeNull();
    rerender(<CustomerStage {...props} speaking />);
    expect(container.querySelector('.ff-avatar--speaking')).not.toBeNull();
  });

  it('gives the status line the id the controls point at, and keeps it out of the live regions', () => {
    const { container } = render(<CustomerStage {...baseProps()} />);
    const line = container.querySelector('#status-line') as HTMLElement;
    expect(line).toHaveTextContent('Microphone ready');
    expect(line.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it('replaces the label node when the status changes, so the change is drawn and not just swapped', () => {
    const props = baseProps();
    const { container, rerender } = render(<CustomerStage {...props} />);
    const before = container.querySelector('.cw-status__label');
    rerender(
      <CustomerStage
        {...props}
        status={describeStatus({
          stage: 'customer-speaking',
          mode: 'voice',
          phase: 'customer-speaking',
          speechDetected: false,
          microphone: 'granted',
        })}
      />,
    );
    const after = container.querySelector('.cw-status__label');
    expect(after).toHaveTextContent('Customer speaking');
    expect(after).not.toBe(before);
  });

  it('says nothing about a state before there is one', () => {
    const { container } = render(<CustomerStage {...baseProps()} state={null} />);
    expect(container.querySelector('.cw-mood')).toBeNull();
  });

  describe('when the customer’s state changes', () => {
    const stateOf = (band: TemperatureBandId, trend: PublicStateDTO['trend'] = 'steady') =>
      describeCustomerState(
        {
          band: { id: band, label: TEMPERATURE_BANDS.find((b) => b.id === band)!.label },
          trend,
          discoveredCount: 0,
          silent: false,
          shifts: 0,
        },
        [],
      );

    it('cross-fades the word and its colour: the old state fades under the new, out of a screen reader’s reach', () => {
      const props = baseProps();
      const { container, rerender } = render(<CustomerStage {...props} state={stateOf('calm')} />);
      const mood = () => screen.getByRole('group', { name: 'Customer state' });
      expect(container.querySelector('.cw-fade__out')).toBeNull();
      rerender(<CustomerStage {...props} state={stateOf('angry', 'rising')} />);
      const leaving = container.querySelector('.cw-fade__out') as HTMLElement;
      expect(leaving).toHaveTextContent('Calm');
      expect(leaving).toHaveAttribute('aria-hidden', 'true');
      expect(container.querySelector('.cw-fade__in')).toHaveTextContent('Angry');
      expect(mood()).toHaveAttribute('data-tone', 'angry');
      // Nothing else on the screen is touched: the badge words are the only thing that blends.
      expect(container.querySelector('.cw-status')).not.toBeNull();
    });

    it('does not fade for a change of trend alone: the word stays', () => {
      const props = baseProps();
      const { container, rerender } = render(
        <CustomerStage {...props} state={stateOf('concerned')} />,
      );
      rerender(<CustomerStage {...props} state={stateOf('concerned', 'rising')} />);
      expect(container.querySelector('.cw-fade__out')).toBeNull();
      expect(screen.getByRole('group', { name: 'Customer state' })).toHaveTextContent('rising');
    });
  });

  describe('the thin trace of how the customer has felt', () => {
    const history: CallStatePoint[] = [
      { turnIndex: 1, band: 'calm', label: 'Calm' },
      { turnIndex: 2, band: 'concerned', label: 'Concerned' },
    ];

    it('is drawn only when it is given, as a picture with its words and no number', () => {
      const { container, rerender } = render(<CustomerStage {...baseProps()} />);
      expect(container.querySelector('.cw-trace')).toBeNull();
      rerender(<CustomerStage {...baseProps()} trace={history} />);
      const trace = screen.getByRole('img', {
        name: 'Customer state so far: calm, then concerned.',
      });
      expect(trace.querySelector('polyline')).not.toBeNull();
      expect(trace.textContent).toBe('');
      expect(trace.getAttribute('aria-label')).not.toMatch(/\d/);
    });

    it('is left out on a narrow screen, where there is no room for it', () => {
      const { container } = render(<CustomerStage {...baseProps()} trace={history} compact />);
      expect(container.querySelector('.cw-trace')).toBeNull();
    });

    it('is hidden from a screen reader while it has nothing to say, and keeps its size', () => {
      const { container } = render(<CustomerStage {...baseProps()} trace={[]} />);
      const trace = container.querySelector('.cw-trace') as HTMLElement;
      expect(trace).toHaveAttribute('aria-hidden', 'true');
      expect(trace.querySelector('svg')).toHaveAttribute('viewBox', '0 0 120 24');
    });
  });

  describe('the customer’s voice strip', () => {
    const speaking = describeStatus({
      stage: 'customer-speaking',
      mode: 'voice',
      phase: 'customer-speaking',
      speechDetected: false,
      microphone: 'granted',
    });
    const strip = (container: HTMLElement) => container.querySelector('svg.cw-wave');

    it('is a calm fixed pattern unless the level was measured from the sound that plays', () => {
      const props = { ...baseProps(), status: speaking, customerLevel: 0.7 };
      const { container, rerender } = render(<CustomerStage {...props} />);
      expect(strip(container)).toHaveAttribute('data-shape', 'pattern');
      rerender(<CustomerStage {...props} customerLevelMeasured />);
      expect(strip(container)).toHaveAttribute('data-shape', 'bars');
    });

    it('is never held to that for the trainee’s own microphone', () => {
      const listening = describeStatus({
        stage: 'listening',
        mode: 'voice',
        phase: 'listening',
        speechDetected: true,
        microphone: 'granted',
        micOpen: true,
      });
      const { container } = render(
        <CustomerStage {...baseProps()} status={listening} micLevel={0.6} />,
      );
      expect(strip(container)).toHaveAttribute('data-shape', 'bars');
    });

    it('thinks with three points that a screen reader hears as “Customer is responding”', () => {
      const thinking = describeStatus({
        stage: 'processing',
        mode: 'voice',
        phase: 'processing',
        speechDetected: false,
        microphone: 'granted',
      });
      const { container } = render(<CustomerStage {...baseProps()} status={thinking} />);
      expect(container.querySelectorAll('.cw-think__dot')).toHaveLength(3);
      expect(screen.getByText('Customer is responding')).toBeInTheDocument();
      expect(container.querySelector('.cw-status__label')).toHaveTextContent(
        'Customer is replying',
      );
    });

    it('does not say “Customer is responding” while the trainee’s words are still being turned into text', () => {
      const transcribing = describeStatus({
        stage: 'transcribing',
        mode: 'voice',
        phase: 'transcribing',
        speechDetected: false,
        microphone: 'granted',
      });
      render(<CustomerStage {...baseProps()} status={transcribing} />);
      expect(screen.queryByText('Customer is responding')).toBeNull();
    });
  });

  it('becomes one row on a narrow screen', () => {
    const { container } = render(<CustomerStage {...baseProps()} compact />);
    expect(container.querySelector('.cw-person--compact')).not.toBeNull();
    expect(container.querySelector('.cw-wave--thin')).not.toBeNull();
  });
});
