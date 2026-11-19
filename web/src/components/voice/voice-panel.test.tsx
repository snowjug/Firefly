import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceCall } from '../../lib/voice/index.ts';
import { VoicePanel, voiceStatusText } from './VoicePanel.tsx';

function engine(over: Partial<VoiceCall> = {}): VoiceCall {
  return {
    support: { recognition: true, synthesis: true, secureContext: true, reason: null },
    recognitionMode: 'unknown',
    status: 'off',
    interim: '',
    error: null,
    hint: null,
    muted: false,
    customerSpeaking: false,
    start: vi.fn(async () => undefined),
    stop: vi.fn(),
    toggleMute: vi.fn(),
    talk: vi.fn(),
    speakCustomerReply: vi.fn(),
    replay: vi.fn(),
    stopSpeaking: vi.fn(),
    ...over,
  };
}

const panel = (voice: VoiceCall, over: Partial<Parameters<typeof VoicePanel>[0]> = {}) => (
  <VoicePanel
    voice={voice}
    calling={false}
    handsFree={false}
    onHandsFree={vi.fn()}
    onToggleCall={vi.fn()}
    customer="Maya"
    hasDraft={false}
    {...over}
  />
);

describe('voiceStatusText', () => {
  const options = { handsFree: false, hasDraft: false, customer: 'Maya' };
  const say = (status: VoiceCall['status'], over: Partial<typeof options> = {}) =>
    voiceStatusText({ status }, { ...options, ...over });

  it('says what is happening in the customer\u2019s name', () => {
    expect(say('connecting')).toBe('Connecting…');
    expect(say('listening')).toBe('Listening…');
    expect(say('customer-speaking')).toBe('Maya is speaking…');
    expect(say('muted')).toBe('Microphone muted.');
    expect(say('thinking')).toBe('Waiting for Maya…');
  });

  it('tells a push-to-talk speaker to check the words once they are in the box', () => {
    expect(say('idle')).toBe('Press Talk to speak.');
    expect(say('idle', { hasDraft: true })).toBe('Check the words, then press Send.');
    expect(say('thinking', { hasDraft: true })).toBe('Check the words, then press Send.');
    expect(say('idle', { handsFree: true })).toBe('Ready. Say something when you like.');
    expect(say('thinking', { handsFree: true, hasDraft: true })).toBe('Waiting for Maya…');
  });

  it('leaves errors to their own message and says nothing while there is no call', () => {
    expect(say('error')).toBe('');
    expect(say('off')).toBe('');
  });
});

describe('VoicePanel', () => {
  it('names a connection that is not secure as the reason, without offering a call', () => {
    render(
      panel(
        engine({
          support: {
            recognition: true,
            synthesis: false,
            secureContext: false,
            reason: 'Voice input needs a secure (https) connection.',
          },
        }),
      ),
    );
    expect(screen.getByText(/needs a secure \(https\) connection/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Voice call' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Listen/)).not.toBeInTheDocument();
  });

  it('keeps the call button as the one control that starts and ends a call', async () => {
    const onToggleCall = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(panel(engine(), { onToggleCall }));
    const button = screen.getByRole('button', { name: 'Voice call' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(onToggleCall).toHaveBeenCalledTimes(1);
    rerender(panel(engine({ status: 'idle' }), { onToggleCall, calling: true }));
    expect(screen.getByRole('button', { name: 'Voice call' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Talk' })).toBeEnabled();
  });
});
