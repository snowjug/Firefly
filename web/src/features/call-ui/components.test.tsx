import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDialogShim } from '../../design/dialog-shim.ts';
import { AnnouncerProvider } from '../../design/index.ts';
import type { CallSupport } from '../call/contract.ts';
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

  it('shows dots while the customer thinks, and keeps them still under reduced motion too', () => {
    const interval = vi.spyOn(window, 'setInterval');
    for (const reducedMotion of [false, true]) {
      const { container, unmount } = render(
        <Waveform mode="thinking" level={0} reducedMotion={reducedMotion} />,
      );
      expect(container.querySelectorAll('circle.cw-wave__dot')).toHaveLength(7);
      unmount();
    }
    expect(interval).not.toHaveBeenCalled();
  });

  it('says nothing to assistive technology but the shimmer’s name: the status says the rest', () => {
    for (const mode of ['idle', 'trainee', 'customer', 'thinking'] as const) {
      const { container, unmount } = render(
        <Waveform mode={mode} level={0.5} reducedMotion={false} />,
      );
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(container.textContent).toBe('');
      unmount();
    }
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

  it('becomes one row on a narrow screen', () => {
    const { container } = render(<CustomerStage {...baseProps()} compact />);
    expect(container.querySelector('.cw-person--compact')).not.toBeNull();
    expect(container.querySelector('.cw-wave--thin')).not.toBeNull();
  });
});
