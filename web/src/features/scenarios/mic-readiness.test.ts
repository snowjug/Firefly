// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { describeReadiness } from './mic-readiness.ts';

const idle = { status: 'idle' } as const;

describe('what the brief says about the microphone', () => {
  it('says the browser will ask, until it says otherwise: nothing has opened the microphone', () => {
    for (const permission of ['prompt', 'unknown'] as const) {
      expect(describeReadiness({ speech: 'voice', check: idle, permission })).toEqual({
        tone: 'neutral',
        icon: 'microphone',
        text: 'The browser will ask to use your microphone.',
      });
    }
  });

  it('reads the browser\u2019s permission when it has one', () => {
    expect(
      describeReadiness({ speech: 'voice', check: idle, permission: 'granted' }),
    ).toMatchObject({
      tone: 'success',
      text: 'Microphone allowed.',
    });
    const denied = describeReadiness({ speech: 'voice', check: idle, permission: 'denied' });
    expect(denied.tone).toBe('danger');
    expect(denied.icon).toBe('microphone-off');
    expect(denied.text).toContain('You can type the call.');
  });

  it('follows the check while it runs and after it', () => {
    const say = (check: Parameters<typeof describeReadiness>[0]['check']) =>
      describeReadiness({ speech: 'voice', check, permission: 'prompt' });
    expect(say({ status: 'requesting' }).text).toBe('Waiting for permission');
    expect(say({ status: 'listening' }).text).toBe('Listening. Say a few words.');
    expect(say({ status: 'ok' })).toMatchObject({ tone: 'success', text: 'Microphone works.' });
    expect(say({ status: 'silent' })).toMatchObject({ tone: 'warning' });
  });

  it('puts the check above what the browser said before it', () => {
    expect(
      describeReadiness({ speech: 'voice', check: { status: 'ok' }, permission: 'denied' }).text,
    ).toBe('Microphone works.');
  });

  it('gives each way the microphone can fail its own words, and a way on', () => {
    const texts = (['denied', 'missing', 'busy', 'unsupported'] as const).map(
      (reason) =>
        describeReadiness({
          speech: 'voice',
          check: { status: 'failed', reason },
          permission: 'prompt',
        }).text,
    );
    expect(new Set(texts).size).toBe(4);
    expect(texts[0]).toContain('blocked');
    expect(texts[1]).toContain('No microphone found');
    expect(texts[2]).toContain('in use');
    expect(texts[3]).toContain('cannot use a microphone');
  });

  it('is honest while speech is still being looked up, when it cannot be, and when it is typed only', () => {
    expect(describeReadiness({ speech: 'loading', check: idle, permission: 'granted' }).text).toBe(
      'Checking what this browser can do.',
    );
    expect(
      describeReadiness({ speech: 'failed', check: idle, permission: 'granted' }),
    ).toMatchObject({
      tone: 'warning',
    });
    expect(describeReadiness({ speech: 'typed', check: idle, permission: 'granted' })).toEqual({
      tone: 'neutral',
      icon: 'keyboard',
      text: 'Voice is not available here. You can type the call.',
    });
  });
});
