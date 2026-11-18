import { describe, expect, it } from 'vitest';
import { EvaluationDraftError } from '../evaluator/merge.ts';
import { ProviderError } from '../providers/types.ts';
import { toAppError } from './sessions.ts';

describe('toAppError', () => {
  it('shows a user-safe message and allows a retry when a coaching draft cannot be verified', () => {
    const app = toAppError(new EvaluationDraftError('The coaching draft did not match your call.'));
    expect(app.code).toBe('provider_bad_output');
    expect(app.retryable).toBe(true);
    expect(app.message).toBe('The coaching draft did not match your call.');
  });

  it('keeps provider failure codes and hides anything unexpected', () => {
    const provider = toAppError(
      new ProviderError('provider_timeout', 'The model took too long.', true),
    );
    expect(provider.code).toBe('provider_timeout');
    const unknown = toAppError(new Error('secret internal detail: C:\\path\\to\\file'));
    expect(unknown.code).toBe('internal');
    expect(unknown.message).not.toContain('secret');
  });
});
