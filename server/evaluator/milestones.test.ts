import { describe, expect, it } from 'vitest';
import { MILESTONE_IDS } from '#shared/domain/report.ts';
import {
  classified,
  evaluate,
  expectQuotesVerified,
  milestone,
  strongCall,
  weakCall,
  type Line,
} from './testing.ts';

// The customer journey: greeting, impact established, discovery, escalation, ownership, closure.
// Each is "reached" at a trainee turn with a verbatim quote, or "not-reached"; the escalation
// milestone is "not-applicable" when no curveball came up.

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });
const STUCK =
  'Three of us at the front desk cannot sign in, and the first patients arrive at nine.';
const HELLO = 'Hello Maya, this is Sam from the Microsoft support team. What is happening?';

describe('the journey as a whole', () => {
  it('always lists the six milestones once each, in call order', () => {
    for (const input of [
      strongCall(),
      weakCall(),
      classified([turn('Hello, how can I help you today?')]),
    ]) {
      const ids = evaluate(input).journey.milestones?.map((m) => m.id);
      expect(ids).toEqual([...MILESTONE_IDS]);
    }
  });

  it('reaches every milestone in a strong call, each at a trainee turn with a verbatim quote', () => {
    const input = strongCall();
    const report = evaluate(input);
    for (const id of MILESTONE_IDS) {
      const m = milestone(report, id);
      if (id === 'escalation') continue; // the strong call has no curveball
      expect(m.status, id).toBe('reached');
      expect(m.turnIndex, id).not.toBeNull();
      expect(m.quote, id).toBeTruthy();
    }
    expectQuotesVerified(report, input);
  });

  it('reaches none of them in a weak call, and is not-applicable for escalation without a curveball', () => {
    const report = evaluate(weakCall());
    for (const id of MILESTONE_IDS) {
      expect(milestone(report, id).status, id).toBe(
        id === 'escalation' ? 'not-applicable' : 'not-reached',
      );
    }
    expect(milestone(report, 'greeting').turnIndex).toBeNull();
    expect(milestone(report, 'greeting').quote).toBeNull();
  });

  it('reaches milestones in the order the call moved through them', () => {
    const report = evaluate(strongCall());
    const at = MILESTONE_IDS.map((id) => milestone(report, id).turnIndex).filter(
      (t): t is number => t !== null,
    );
    expect(at.length).toBeGreaterThanOrEqual(5);
    expect(at[0]).toBeLessThanOrEqual(at[at.length - 1] as number);
  });
});

describe('greeting', () => {
  it('is reached by a greeting or an introduction in the first two turns', () => {
    const report = evaluate(classified([turn(HELLO, STUCK), turn('What does the screen say?')]));
    const m = milestone(report, 'greeting');
    expect(m.status).toBe('reached');
    expect(m.turnIndex).toBe(2);
    expect(m.quote).toMatch(/Hello Maya/);
  });

  it('is not reached when the opening went straight to questions', () => {
    const report = evaluate(
      classified([turn('What does the screen say?'), turn('When did it start?')]),
    );
    expect(milestone(report, 'greeting').status).toBe('not-reached');
  });

  it('is not reached by a greeting that came too late', () => {
    const report = evaluate(
      classified([
        turn('What does the screen say?'),
        turn('When did it start?'),
        turn('Hello, this is Sam from support.'),
      ]),
    );
    expect(milestone(report, 'greeting').status).toBe('not-reached');
  });
});

describe('impact established', () => {
  it('is reached by acknowledging what the problem means for the customer', () => {
    const report = evaluate(
      classified([
        turn(HELLO, STUCK),
        turn(
          "I can see three of you are stuck with the patients arriving at nine, so I'll treat this as urgent.",
        ),
      ]),
    );
    const m = milestone(report, 'impact');
    expect(m.status).toBe('reached');
    expect(m.turnIndex).toBe(4);
  });

  it('is reached by asking what the problem is costing them', () => {
    const report = evaluate(
      classified([
        turn(HELLO, STUCK),
        turn('How is this affecting your work, and is there a deadline?'),
      ]),
    );
    expect(milestone(report, 'impact').status).toBe('reached');
  });

  it('is not reached by "I understand" alone', () => {
    const report = evaluate(classified([turn(HELLO, STUCK), turn('I understand.')]));
    expect(milestone(report, 'impact').status).toBe('not-reached');
  });
});

describe('discovery', () => {
  it('is reached at the turn that uncovered a hidden fact, quoting the question that did', () => {
    const asked = 'Can you read me exactly what the sign-in screen says?';
    const report = evaluate(
      classified([
        turn(HELLO, STUCK),
        {
          say: asked,
          reply: 'It says my account is locked.',
          finds: { 'hf-lockout-message': 'discovered' },
        },
      ]),
    );
    const m = milestone(report, 'discovery');
    expect(m.status).toBe('reached');
    expect(m.turnIndex).toBe(4);
    expect(m.quote).toMatch(/sign-in screen says/);
  });

  it('is reached by a spread of questions about different areas even if none uncovered a fact', () => {
    const report = evaluate(
      classified([
        turn(HELLO, STUCK),
        turn('When did it start?'),
        turn('Is your work email signed in on any other device?'),
      ]),
    );
    expect(milestone(report, 'discovery').status).toBe('reached');
  });

  it('is not reached when nothing was asked', () => {
    const report = evaluate(classified([turn(HELLO, STUCK), turn('Okay, let me look.')]));
    expect(milestone(report, 'discovery').status).toBe('not-reached');
  });
});

describe('escalation or curveball', () => {
  const lines = [
    turn(HELLO, STUCK),
    turn(
      'What does the screen say?',
      "I'm sorry to rush you, but patients arrive at nine. How long will this take?",
    ),
    turn(
      "I understand the time pressure, so I'll unlock it now and call you back at nine with an update.",
    ),
  ];

  it('is not applicable when no curveball came up', () => {
    expect(milestone(evaluate(classified(lines)), 'escalation').status).toBe('not-applicable');
  });

  it('is reached when the curveball was handled, at the turn that handled it', () => {
    const report = evaluate(
      classified(
        lines,
        {},
        {
          curveball: {
            status: 'resolved',
            type: 'deadline',
            firedAtTurn: 5,
            resolvedAtTurn: 6,
            firedCount: 1,
          },
        },
      ),
    );
    const m = milestone(report, 'escalation');
    expect(m.status).toBe('reached');
    expect(m.turnIndex).toBe(6);
  });

  it('is not reached when the curveball came up and was never handled', () => {
    const report = evaluate(
      classified(
        lines,
        {},
        {
          curveball: {
            status: 'unresolved',
            type: 'deadline',
            firedAtTurn: 5,
            resolvedAtTurn: null,
            firedCount: 1,
          },
        },
      ),
    );
    expect(milestone(report, 'escalation').status).toBe('not-reached');
  });
});

describe('ownership', () => {
  it('is reached by taking the problem on, quoting the words', () => {
    const report = evaluate(
      classified([
        turn(HELLO, STUCK),
        turn("I'll own this and stay with it until you're back in."),
      ]),
    );
    const m = milestone(report, 'ownership');
    expect(m.status).toBe('reached');
    expect(m.quote).toMatch(/I'll own this/);
  });

  it('is not reached when someone else was left to look at it', () => {
    const report = evaluate(
      classified([turn(HELLO, STUCK), turn('Someone will look at it soon.')]),
    );
    expect(milestone(report, 'ownership').status).toBe('not-reached');
  });
});

describe('closure', () => {
  const body = [
    turn(HELLO, STUCK),
    turn('What does the screen say?'),
    turn("I'll own this and unlock it now."),
  ];

  it('is reached when the end of the call wraps up what was agreed and says goodbye', () => {
    const report = evaluate(
      classified([
        ...body,
        turn(
          "Just to recap, I've unlocked the account and I'll call you at nine to check. Is there anything else I can help with? Thanks, goodbye.",
        ),
      ]),
    );
    const m = milestone(report, 'closure');
    expect(m.status).toBe('reached');
    expect(m.turnIndex).toBe(8);
  });

  it('is not reached when the call just stops', () => {
    const report = evaluate(classified([...body, turn('Okay.')]));
    expect(milestone(report, 'closure').status).toBe('not-reached');
  });

  it('is not reached by a goodbye alone', () => {
    const report = evaluate(classified([...body, turn('Bye.')]));
    expect(milestone(report, 'closure').status).toBe('not-reached');
  });

  it('is not reached from a wrap-up that came early in the call and was never repeated at the end', () => {
    const report = evaluate(
      classified([
        turn(HELLO, STUCK),
        turn(
          "Just to recap, I'll call you at nine. Is there anything else I can help with? Thanks, goodbye.",
        ),
        turn('Okay, let me check something.'),
        turn('Still checking.'),
        turn('One more minute.'),
      ]),
    );
    expect(milestone(report, 'closure').status).toBe('not-reached');
  });
});
