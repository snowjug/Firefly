import type { ScenarioOverrides } from '#shared/domain/scenario.ts';

// Synthetic trainee lines used to create labelled SAMPLE sessions. The customer side is produced by
// the real engine (in demo mode) and the report by the real evaluator; only the trainee's side is
// scripted. Nothing here is a real person, case or customer.

export interface SampleScript {
  key: string;
  scenarioId: string;
  overrides: ScenarioOverrides;
  daysAgo: number;
  durationMinutes: number;
  lines: string[];
  // Synthetic mentor scores (1-5 per dimension, in DIMENSION_IDS order) for the calibration demo.
  mentorScores: [number, number, number, number, number, number];
}

export const SAMPLE_SCRIPTS: SampleScript[] = [
  {
    key: 'sample-strong-lockout',
    scenarioId: 'locked-out-after-password-reset',
    overrides: { difficulty: 'starter' },
    daysAgo: 6,
    durationMinutes: 9,
    mentorScores: [4, 5, 4, 4, 4, 4],
    lines: [
      "Hello, thanks for calling. My name is Sam and I'm happy to help. What's been happening with the staff portal?",
      "I'm sorry about that, Maya. It sounds frustrating when you need the portal to check patients in. Can you read me exactly what the sign-in screen says?",
      'Thank you. When did it last work, and did anything change before that?',
      'That helps. Is your work email or the portal also signed in on your phone or another device that might still have your old password?',
      'So just to confirm: you changed your password at ten past eight, then your phone kept trying the old one, which locked your account. Is that right?',
      "That explains it. I'll take ownership of this: I'll unlock your account now, then I'd like you to update the password on your phone. I'll check in with you by 10:30 to confirm you can sign in. Does that work for you?",
      "Thank you for your patience, Maya. To wrap up: your account is unlocked, you'll update your phone, and I'll call you by 10:30. Is there anything else I can help with?",
    ],
  },
  {
    key: 'sample-weak-lockout',
    scenarioId: 'locked-out-after-password-reset',
    overrides: { difficulty: 'standard', startingTemperature: 'frustrated', style: 'demanding' },
    daysAgo: 4,
    durationMinutes: 5,
    mentorScores: [2, 2, 1, 2, 2, 1],
    lines: [
      'Please clear your browser cache and restart the computer.',
      'Your cached credentials are probably stale because of DNS propagation.',
      'You should have updated the password on all your devices.',
      "I'll look into it and we will get back to you soon.",
    ],
  },
  {
    key: 'sample-mixed-workspace',
    scenarioId: 'team-cannot-open-shared-workspace',
    overrides: {},
    daysAgo: 2,
    durationMinutes: 11,
    mentorScores: [3, 3, 4, 3, 3, 2],
    lines: [
      "Hi, this is Jordan from support. I'm sorry you're having trouble. What's happening with the workspace?",
      'That sounds really stressful with a client deliverable due today. When did this start?',
      'Did anything change recently, like a reorganisation of who can access it?',
      'How many people are affected, and can anyone open it?',
      "I'll take ownership of this. I'll find out what changed and update you by 2pm today. I can't promise a fix time yet.",
    ],
  },
];
