import { describe, expect, it } from 'vitest';
import { applyConfig } from '#shared/domain/config.ts';
import { inCustomerVoice, pronounOf, recordNotes, restatesHiddenFact } from './record.ts';
import { makeDefinition, makeScenario } from './testing.ts';

describe("what the case notes say, in the customer's own voice", () => {
  const voice = (note: string, name = 'Marcus Bell', pronoun: 'he' | 'she' | null = 'he') =>
    inCustomerVoice(note, name, pronoun);

  it('turns what the notes say the customer did into what they would say', () => {
    expect(
      voice(
        'Marcus closed and reopened Outlook and restarted the computer. The mailbox is still not listed.',
      ),
    ).toBe(
      'I closed and reopened Outlook and restarted the computer. The mailbox is still not listed.',
    );
    expect(voice('Restarted the laptop on Wednesday, which made no difference')).toBe(
      'I restarted the laptop on Wednesday, which made no difference.',
    );
    expect(voice('Re-ran the script twice with the service account: same failure each time.')).toBe(
      'I re-ran the script twice with the service account: same failure each time.',
    );
    expect(
      voice(
        'On Friday moved the laptops back to their usual group and asked them to check in again',
      ),
    ).toBe(
      'On Friday I moved the laptops back to their usual group and asked them to check in again.',
    );
    expect(
      voice('Saves his work every few minutes since losing two hours of changes yesterday'),
    ).toBe('I save my work every few minutes since losing two hours of changes yesterday.');
  });

  it('turns he, his and him, and keeps the verbs that follow in agreement', () => {
    expect(
      voice('He has not opened the tool behind the process, because he did not build it.'),
    ).toBe('I have not opened the tool behind the process, because I did not build it.');
    expect(voice('He has not shut the laptop down since the update, as far as he remembers.')).toBe(
      'I have not shut the laptop down since the update, as far as I remember.',
    );
    expect(voice('As far as Marcus knows, nothing was changed in the mail setup.')).toBe(
      'As far as I know, nothing was changed in the mail setup.',
    );
    expect(
      voice(
        'An administrator changed a policy yesterday. Priya heard about it in passing and does not know which one.',
        'Priya Raman',
        'she',
      ),
    ).toBe(
      'An administrator changed a policy yesterday. I heard about it in passing and do not know which one.',
    );
  });

  it('turns her to my or me by what follows it', () => {
    expect(
      voice(
        'Emailed the workbook to her manager while the files were missing',
        'Ingrid Solheim',
        'she',
      ),
    ).toBe('I emailed the workbook to my manager while the files were missing.');
    expect(
      voice('An engineer told her to leave the laptop switched on', 'Ingrid Solheim', 'she'),
    ).toBe('An engineer told me to leave the laptop switched on.');
  });

  it('leaves a note about other people as it was written', () => {
    expect(voice('The platform team restarted the machine twice, with no effect.')).toBe(
      'The platform team restarted the machine twice, with no effect.',
    );
  });

  it('leaves unsaid a note it cannot turn round safely', () => {
    // About someone else: the customer is a "he", so "she" is not them.
    expect(voice("She was taken off the editorial team's shared sites when she moved.")).toBeNull();
    // The name of the customer somewhere it cannot be turned into "I".
    expect(voice('Dana asked Marcus to restart it.')).toBeNull();
    // The author's own commentary on what the customer believes.
    expect(
      voice('He thinks tidying his folders may have broken something, which is not so'),
    ).toBeNull();
    // "He's" could be "he has" or "he is".
    expect(voice("He's already restarted it.")).toBeNull();
    // Nothing says who "he" or "she" is.
    expect(voice('She restarted the laptop twice.', 'Alex Kim', null)).toBeNull();
  });

  it('knows which pronoun the scenario uses for its customer', () => {
    expect(
      pronounOf({
        background: 'He books patients all day.',
        voice: 'Friendly. He apologises a lot.',
      }),
    ).toBe('he');
    expect(
      pronounOf({
        background: 'She runs the front desk.',
        voice: 'Chatty, and she explains step by step.',
      }),
    ).toBe('she');
    expect(pronounOf({ background: 'Runs the front desk.', voice: 'Chatty.' })).toBeNull();
  });
});

describe('keeping a hidden fact secret when the case notes give it away', () => {
  const scenario = makeScenario();
  const none = { discovery: {} };

  it('recognises a note that says what an unearned hidden fact says', () => {
    const giveaway =
      'Read that the sign-in message says the account has been temporarily locked after too many sign-in attempts';
    expect(restatesHiddenFact(giveaway, scenario, none)).toBe(true);
    expect(restatesHiddenFact('Typed the new password again several times', scenario, none)).toBe(
      false,
    );
  });

  it('lets the note through once the fact has been earned', () => {
    const giveaway =
      'Read that the sign-in message says the account has been temporarily locked after too many sign-in attempts';
    const earned = {
      discovery: {
        'hf-lockout-message': {
          factId: 'hf-lockout-message',
          status: 'discovered' as const,
          turnIndex: 4,
          question: 'x',
        },
      },
    };
    expect(restatesHiddenFact(giveaway, scenario, earned)).toBe(false);
  });

  it('returns only the notes the customer can say now, in their own voice', () => {
    const definition = makeDefinition({
      previousTroubleshooting: [
        'Typed the new password again several times',
        'Read that the sign-in message says the account has been temporarily locked after too many sign-in attempts',
        'Dana asked Maya to restart it',
      ],
    });
    const custom = applyConfig(
      definition,
      { difficulty: 'standard' },
      { seed: 7, timeOfDay: 'morning' },
    );
    expect(recordNotes('tried', custom, none)).toEqual([
      'I typed the new password again several times.',
    ]);
    expect(recordNotes('changes', custom, none)).toEqual([
      'I changed the password this morning after the reminder email.',
    ]);
  });
});
