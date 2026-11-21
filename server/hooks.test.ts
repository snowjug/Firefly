import { describe, expect, it } from 'vitest';
import { createFailureHooks, FAILURE_TARGETS } from './hooks.ts';
import { ProviderError } from './providers/types.ts';
import { SpeechError } from './speech/types.ts';

const failureOf = (run: () => void): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('failure hooks', () => {
  it('can be aimed at the model calls and at the speech calls', () => {
    expect([...FAILURE_TARGETS]).toEqual([
      'customer',
      'classifier',
      'evaluator',
      'transcribe',
      'synthesize',
    ]);
  });

  it.each(['customer', 'classifier', 'evaluator'] as const)(
    'fails a %s call as a retryable provider error',
    (target) => {
      const hooks = createFailureHooks(true);
      hooks.setNext(target, 1);
      const error = failureOf(() => hooks.maybeFail(target));
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({
        code: 'provider_unavailable',
        retryable: true,
        message: 'The AI service is temporarily unavailable (simulated failure).',
      });
    },
  );

  it('lets the code of a model failure be chosen', () => {
    const hooks = createFailureHooks(true);
    hooks.setNext('customer', 1, 'provider_timeout');
    expect(failureOf(() => hooks.maybeFail('customer'))).toMatchObject({
      code: 'provider_timeout',
    });
  });

  it.each(['transcribe', 'synthesize'] as const)(
    'fails a %s call as a retryable speech failure with a message that is safe to show',
    (target) => {
      const hooks = createFailureHooks(true);
      hooks.setNext(target, 1);
      const error = failureOf(() => hooks.maybeFail(target));
      expect(error).toBeInstanceOf(SpeechError);
      expect(error).not.toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({
        code: 'speech_failed',
        retryable: true,
        message: 'The speech service is temporarily unavailable (simulated failure).',
      });
    },
  );

  it('always makes a speech failure speech_failed, whatever model code was asked for', () => {
    const hooks = createFailureHooks(true);
    hooks.setNext('synthesize', 1, 'provider_content_filtered');
    expect(failureOf(() => hooks.maybeFail('synthesize'))).toMatchObject({ code: 'speech_failed' });
  });

  it('keeps a queue for each target and uses up one failure per call', () => {
    const hooks = createFailureHooks(true);
    hooks.setNext('transcribe', 2);
    hooks.setNext('synthesize', 1);
    expect(failureOf(() => hooks.maybeFail('customer'))).toBeUndefined();
    expect(failureOf(() => hooks.maybeFail('transcribe'))).toBeInstanceOf(SpeechError);
    expect(failureOf(() => hooks.maybeFail('synthesize'))).toBeInstanceOf(SpeechError);
    expect(failureOf(() => hooks.maybeFail('synthesize'))).toBeUndefined();
    expect(failureOf(() => hooks.maybeFail('transcribe'))).toBeInstanceOf(SpeechError);
    expect(failureOf(() => hooks.maybeFail('transcribe'))).toBeUndefined();
  });

  it('queues nothing for a count of 0, and a new count replaces the old one', () => {
    const hooks = createFailureHooks(true);
    hooks.setNext('transcribe', 3);
    hooks.setNext('transcribe', 0);
    expect(failureOf(() => hooks.maybeFail('transcribe'))).toBeUndefined();
    hooks.setNext('transcribe', 1);
    hooks.setNext('transcribe', 2);
    expect(failureOf(() => hooks.maybeFail('transcribe'))).toBeInstanceOf(SpeechError);
    expect(failureOf(() => hooks.maybeFail('transcribe'))).toBeInstanceOf(SpeechError);
    expect(failureOf(() => hooks.maybeFail('transcribe'))).toBeUndefined();
  });

  it('forgets every queued failure on reset', () => {
    const hooks = createFailureHooks(true);
    hooks.setNext('transcribe', 2);
    hooks.setNext('customer', 2);
    hooks.reset();
    expect(failureOf(() => hooks.maybeFail('transcribe'))).toBeUndefined();
    expect(failureOf(() => hooks.maybeFail('customer'))).toBeUndefined();
  });

  it('does nothing at all when switched off, even if a failure is queued', () => {
    const hooks = createFailureHooks(false);
    expect(hooks.enabled).toBe(false);
    for (const target of FAILURE_TARGETS) {
      hooks.setNext(target, 5);
      expect(
        failureOf(() => hooks.maybeFail(target)),
        target,
      ).toBeUndefined();
    }
  });
});
