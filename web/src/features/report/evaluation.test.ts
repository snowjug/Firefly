import { describe, expect, it } from 'vitest';
import { EVALUATION_PHASES } from '#shared/domain/vocab.ts';
import {
  PHASE_STEPS,
  phaseAnnouncement,
  safeEvaluationMessage,
  stepStatuses,
} from './evaluation.ts';
import { SERVER_EVALUATION_ERRORS } from './fixtures.ts';

describe('the five steps', () => {
  it('are the five phases the server reports, in order', () => {
    expect(PHASE_STEPS.map((step) => step.phase)).toEqual([...EVALUATION_PHASES]);
  });

  it('have a title that is not just the phase name', () => {
    for (const step of PHASE_STEPS) expect(step.title).toMatch(/^[A-Z][a-z]/);
    expect(new Set(PHASE_STEPS.map((step) => step.title)).size).toBe(5);
  });
});

describe('stepStatuses', () => {
  it('marks the transcript as saved as soon as the call has ended', () => {
    expect(stepStatuses('transcript_locked')).toEqual([
      'done',
      'waiting',
      'waiting',
      'waiting',
      'waiting',
    ]);
    expect(stepStatuses(null)).toEqual(stepStatuses('transcript_locked'));
  });

  it('puts the step the server reached in progress, the ones before it done and the rest waiting', () => {
    expect(stepStatuses('discovery_review')).toEqual([
      'done',
      'current',
      'waiting',
      'waiting',
      'waiting',
    ]);
    expect(stepStatuses('scoring')).toEqual(['done', 'done', 'current', 'waiting', 'waiting']);
    expect(stepStatuses('building_report')).toEqual(['done', 'done', 'done', 'current', 'waiting']);
  });

  it('shows everything done once the report is saved', () => {
    expect(stepStatuses('saved')).toEqual(['done', 'done', 'done', 'done', 'done']);
  });
});

describe('phaseAnnouncement', () => {
  it('says one whole sentence for a step that has started, and nothing for the first', () => {
    expect(phaseAnnouncement('transcript_locked')).toBeNull();
    expect(phaseAnnouncement(null)).toBeNull();
    expect(phaseAnnouncement('scoring')).toBe('Scoring six skills.');
  });
});

describe('safeEvaluationMessage', () => {
  it('lets through the sentences the server really writes', () => {
    for (const error of Object.values(SERVER_EVALUATION_ERRORS)) {
      expect(safeEvaluationMessage(error.message)).toBe(error.message);
    }
    expect(
      safeEvaluationMessage(
        "The AI provider's rate limit was reached. Please try again in about 12 seconds.",
      ),
    ).not.toBeNull();
  });

  it('collapses stray whitespace', () => {
    expect(safeEvaluationMessage('  The report could not be   made.\n')).toBe(
      'The report could not be made.',
    );
  });

  it.each([
    ['nothing', ''],
    ['null', null],
    ['undefined', undefined],
    ['JSON', '{"error":{"message":"quota exceeded","code":429}}'],
    ['markup', 'The call <b>failed</b>.'],
    ['a URL', 'See https://provider.example/errors/429 for details.'],
    ['a stack trace', 'Failed at evaluate (/srv/app/server.js:120:9)'],
    ['an error name', 'TypeError: Cannot read properties of undefined'],
    ['a system error code', 'connect ECONNREFUSED 10.0.0.12:443'],
    ['an address', 'Could not reach 127.0.0.1 on that port.'],
    ['a long block of text', 'The provider said that '.repeat(20)],
  ])('refuses %s', (_name, message) => {
    expect(safeEvaluationMessage(message)).toBeNull();
  });
});
