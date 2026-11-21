import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario. Everything here is fictional: people, organisation, case number and every
// detail on the screen. No real key, code or password appears anywhere in this file, and none may
// be added.
//
// Root cause (hidden from the trainee; plausible, and never confirmed on the call): after an
// overnight update, during which the charger probably came loose, Hannah's work laptop stops on a
// screen asking for a recovery key. She has never needed one and does not know where one would be
// kept. She has tried her work password and her phone PIN and restarted twice, she has not rung the
// IT help desk because she fears being blamed, and weeks of her analysis exist only on the laptop.
// There is nothing technical to diagnose on this call. A strong call slows down, reassures honestly
// without promising her files are safe, keeps anything sensitive off the call, finds what she sees,
// tried and could lose, and agrees who she contacts, what she says and when the engineer checks in.

const scenario = {
  id: 'windows-bitlocker-recovery-prompt',
  version: 1,
  title: 'Work laptop asks for a recovery key after an update',
  listSummary:
    "A researcher's work laptop asks for a recovery key after an update, and she fears losing work.",
  summary:
    "A research associate's work laptop now stops on a screen asking for a recovery key after an update. She does not know what the key is or where to find it, and she is worried about losing her work. She talks a lot when anxious, so the call needs a calm pace and clear next steps.",
  tags: [
    'recovery key',
    'reassurance',
    'sensitive information',
    'plain language',
    'anxious customer',
  ],
  estimatedMinutes: 11,

  product: { id: 'windows-11', area: 'Disk encryption' },
  caseReference: 'SIM-430003',

  issueType: 'sign-in-access',
  impact: 'medium',
  startingTemperature: 'anxious',
  proficiency: 'novice',
  style: 'talkative',
  callStage: 'first-contact',
  difficulty: 'standard',

  persona: {
    name: 'Hannah Brooks',
    speaker: 'female',
    role: 'Research Associate',
    organisation: 'Trey Research',
    background:
      'Hannah analyses survey data for a small project team. She works from the office and from home, and keeps her analysis on her laptop. She is careful with her work but has never needed to think about how the laptop is protected, and she worries about being blamed when something goes wrong.',
    voice:
      "Warm, quick and worried. Talks in long, looping sentences, adds background nobody asked for, and apologises a lot. Says what she sees rather than naming it, and often asks 'is that bad?'. Settles when someone slows the call down and tells her exactly what happens next.",
  },
  environment: {
    details: [
      "A work laptop running Windows 11, given to Hannah by Trey Research's IT team when she joined and set up by them.",
      'She signs in with her work account and does not have administrator rights.',
      'Her survey analysis is in a folder on the laptop. She is not sure whether it is copied anywhere else.',
      'She is working from home. The IT help desk is open during office hours.',
      'She has never needed a recovery key and does not know whether one exists or where it would be kept.',
    ],
  },
  affectedUsers: {
    low: {
      count: 1,
      summary: 'Only Hannah. She has an older laptop she can use for email and meetings.',
    },
    medium: {
      count: 1,
      summary: 'Only Hannah, but the results her project lead is waiting for are on this laptop.',
    },
    high: {
      count: 3,
      summary:
        'Hannah and two colleagues who cannot finish their parts of a funder report without her analysis.',
    },
  },
  customerObjective:
    'Get back into her laptop, keep her work safe, and understand what to do next without making anything worse.',
  customerExpectation:
    'Someone calm to explain what the screen means in plain words, say honestly what is and is not known, and give her clear steps to follow.',
  desiredOutcome:
    'The engineer slows the call down, reassures her honestly without promising anything they cannot know, finds what she can see, what she tried and what is at stake, and agrees clear, safe next steps and a time to follow up.',
  previousTroubleshooting: [
    'She typed her work password and then her phone PIN into the box on the screen.',
    'She restarted the laptop twice and got the same screen each time.',
    'She has not contacted the IT help desk yet.',
  ],
  recentChanges: [
    'The laptop installed an update overnight and restarted by itself.',
    'The charger probably came loose during the update, because the battery was almost flat afterwards.',
  ],

  publicBrief: {
    issue: 'A work laptop shows a screen asking for a recovery key after an update.',
    impact: {
      low: 'Only her laptop is affected, and she has an older one she can use.',
      medium: 'Only her laptop is affected, but her project lead is waiting for her results.',
      high: 'Two colleagues are waiting on her results, and a funder report is due soon.',
    },
    objective: 'Reassure her honestly, find out what she can see, and agree safe next steps.',
    knownContext:
      'Hannah is not technical and has never needed a recovery key. Think about what is safe to ask for and to say aloud on a call.',
    environment:
      "Trey Research's IT team set up the laptop. You cannot see her screen in this practice call, so rely on what Hannah describes.",
  },
  brief: {
    situation:
      'A research associate is calling because her work laptop stops on a screen asking for a recovery key after an update. She has never needed one and does not know where one would be kept. She is anxious, talkative and worried about losing her work.',
    goal: 'Slow the call down, reassure her honestly, find out what she can see and what is at stake, and agree safe next steps and when you will follow up.',
    groundRules: [
      'The customer and organisation are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot see her screen in this practice call, so rely on what Hannah describes.',
    ],
  },

  openingCore:
    "My work laptop is stuck on a screen asking for a recovery key. It came up after an update, and I don't know what a recovery key is or where I'd find one.",
  impactVariants: {
    low: {
      summary: "I've got an older laptop I can use for emails, so I'm not completely stuck.",
      detail:
        "It's only my laptop. I've got an old one in the cupboard that I can use for email and meetings, so I'm not stuck, but I do want my own files back. Nothing is due this week.",
      deadline: "Nothing is due this week, so there's a bit of time.",
    },
    medium: {
      summary:
        "I can't get into my work laptop, and I'm meant to be sending results to my project lead. I don't want to let her down.",
      detail:
        "It's only my laptop, but my project lead is waiting for the survey results I've been working on. I'm meant to send her a draft by tomorrow afternoon.",
      deadline: "I'm meant to send the draft by tomorrow afternoon.",
    },
    high: {
      summary:
        "I can't get into my work laptop, two colleagues are waiting on my results, and our funder report is due.",
      detail:
        "It's only my laptop, but two colleagues can't finish their parts until I send them my analysis. The report for the funder is due tomorrow at noon, and it all depends on what's on this laptop.",
      deadline: 'The funder report is due tomorrow at noon.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I rang earlier about my work laptop asking for a recovery key, and I haven't heard anything since.",
      brief:
        'Hannah contacted support earlier about the same screen. She has no plan to follow yet, and the laptop is still locked.',
    },
    escalated: {
      opening:
        "This is my second call about my work laptop asking for a recovery key. Nobody has told me what to do, and I'm getting really worried.",
      brief:
        'Hannah has already called once about this. The laptop is still locked, she has no clear plan and she is more anxious than before.',
    },
    closure: {
      opening:
        "I'm calling about the recovery key screen on my work laptop, to check where things stand so we can close the case.",
      brief:
        'Hannah expects to confirm that she is back in her laptop and to understand what happened and what to do if it happens again.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier today',
      summary:
        'Hannah called to report that her work laptop shows a recovery key screen after an update. A case was logged and she was told she would be contacted.',
    },
    {
      when: 'Since then',
      summary: 'No engineer has been assigned and nobody has followed up with her.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-the-screen',
      text: "It's stopped on a screen asking me for a recovery key. I can't get past it to my files.",
      intents: ['problem_description', 'error_message'],
      elaboration:
        "I got to my desk, switched it on, and that was it. I didn't change anything, honestly.",
      simple:
        'The laptop stopped on a screen that asks for a recovery key. I cannot get to my files.',
    },
    {
      id: 'kf-laptop-from-it',
      text: 'The laptop came from our IT team when I started. They set it all up for me.',
      intents: ['environment', 'account_details'],
      simple: 'The laptop came from our IT team. They set it up for me.',
    },
    {
      id: 'kf-working-from-home',
      text: "I'm working from home today, so I can't just walk over and ask someone.",
      intents: ['environment'],
    },
    {
      id: 'kf-work-account',
      text: 'I sign in with my work account, the same as everyone here.',
      intents: ['account_details'],
    },
    {
      id: 'kf-outcome',
      text: 'I just want to get back into my laptop and not lose anything.',
      intents: ['expected_outcome'],
      simple: 'I want to get back into my laptop. I do not want to lose anything.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-key-given',
      intents: ['account_details'],
      cues: [
        'been given',
        'ever given',
        'gave you',
        'welcome pack',
        'paperwork',
        'when you started',
        'when you joined',
        'recovery key',
        'had a key',
      ],
      text: "I don't think anyone ever gave me a key, but I couldn't swear to it. There was a lot of paperwork when I started.",
      confirmedText:
        'I do still have the folder from my first week. I could look through it, if that would help.',
    },
    {
      id: 'vf-personal-account',
      intents: ['account_details', 'environment'],
      cues: [
        'personal',
        'microsoft account',
        'my own account',
        'private email',
        'home account',
        'another account',
      ],
      text: "I might have signed in with my personal Microsoft account once, to get an app. I'm not sure.",
      confirmedText: 'Actually, no. I think that was on my old laptop at home, not this one.',
    },
    {
      id: 'vf-update-night',
      intents: ['timing_onset'],
      text: 'I think the update went on overnight, but I might have it wrong. It could have been the night before.',
      confirmedText:
        'No, it was the night before I rang. I remember seeing the notice when I closed the lid.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-first-week-folder',
      intents: ['account_details', 'already_tried'],
      cues: [
        'folder',
        'paperwork',
        'welcome',
        'first week',
        'look through',
        'look in',
        'have a look',
        'could you check',
        'can you check',
      ],
      checking: "Give me a moment, I'll look through the folder from my first week.",
      text: "Okay, there's a welcome leaflet, a parking form and a sheet about when the IT help desk is open. I can't see anything that looks like a key.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-where-key',
      intents: ['account_details', 'environment'],
      cues: [
        'where would the key',
        'where would it be',
        'where might the key',
        'where might it be',
        'where is the key',
        'where is it stored',
        'where is it kept',
        'where it is kept',
        'where it might be',
        'who has the key',
      ],
      text: "I really don't know where a key would be kept. I'd only be guessing, and I don't want to guess.",
      whoKnows: 'our IT help desk',
    },
    {
      id: 'uf-automatic-copy',
      intents: ['workaround', 'environment'],
      cues: [
        'copied automatically',
        'automatic copy',
        'automatic backup',
        'cloud folder',
        'cloud',
        'synced',
        'sync',
      ],
      text: "I don't know whether my files are copied anywhere automatically. Someone mentioned a cloud folder when I started, but I never checked.",
      whoKnows: 'our IT help desk',
    },
    {
      id: 'uf-why-screen',
      intents: ['problem_description', 'recent_changes'],
      cues: [
        'why is it asking',
        'why is this happening',
        'why did it',
        'what caused',
        'the cause',
        'reason it',
      ],
      text: "I couldn't tell you why it's asking. I only know it started after the update.",
      whoKnows: 'our IT help desk',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-kitchen',
      text: "There's a builder in the kitchen this week, so it's noisy here. Sorry if you hear drilling.",
    },
    {
      id: 'if-coffee',
      text: "I've had far too much coffee, which probably isn't helping my nerves.",
    },
    {
      id: 'if-conference',
      text: "I was meant to be at a conference this week, but it was cancelled, which is why I'm working from home.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-work-only-on-laptop',
      importance: 'critical',
      label: 'Her analysis is only on the laptop',
      statement:
        "The survey analysis I've been building for months is in a folder on the laptop. I haven't copied it to the shared drive for a few weeks, so I don't know what's backed up.",
      partialStatement: 'A lot of my work is on it, yes.',
      revealWhen:
        'Asks whether anything on the laptop is saved or backed up anywhere else, what work is at risk, or what files matter most.',
      intents: ['workaround', 'environment'],
      partialIntents: ['business_impact'],
      cues: [
        'backed up',
        'backup',
        'saved anywhere',
        'saved elsewhere',
        'copy of',
        'synced',
        "what's on the laptop",
        'what is on the laptop',
        'anything on the laptop',
        'what files',
        'what work',
        'at risk',
      ],
      hint: 'Most of my work is on this laptop.',
      statementTerse:
        "My analysis is only in a folder on the laptop. I haven't copied it anywhere for weeks.",
      statementSimple:
        'My survey analysis is in a folder on the laptop. I did not copy it to the shared drive for some weeks.',
      missedConsequence:
        'The engineer does not learn what is at stake, so reassurance is either too vague or too confident, and the follow-up plan does not protect the work she is worried about.',
      betterQuestion:
        "Is there anything on the laptop that isn't saved or backed up anywhere else?",
    },
    {
      id: 'hf-what-tried',
      importance: 'important',
      label: 'What she typed and how often she restarted',
      statement:
        'I typed my work password in, then my phone PIN, in case that was it. Then I restarted twice, and it came back to the same screen each time.',
      revealWhen:
        'Asks what the customer has already tried, what she typed into the screen, or whether she has restarted the laptop.',
      intents: ['already_tried'],
      cues: [
        'tried',
        'typed',
        'entered',
        'put in',
        'restart',
        'restarted',
        'rebooted',
        'what have you done',
        'anything you did',
        'so far',
      ],
      hint: "I've already tried a couple of things, but nothing worked.",
      statementTerse:
        'I typed my work password, then my phone PIN. I restarted twice. Same screen.',
      statementSimple:
        'I typed my work password. Then I typed my phone PIN. I restarted the laptop two times. The same screen came back.',
      missedConsequence:
        'Repeated attempts and restarts go unnoticed, so the engineer may repeat what she has already tried and does not get the chance to ask her to pause.',
      betterQuestion:
        'What have you tried so far, including anything you typed into that screen and how many times you restarted?',
    },
    {
      id: 'hf-screen-wording',
      importance: 'important',
      label: 'What the screen says, in her words',
      statement:
        "It's a dark screen with white writing. It says it needs a recovery key to unlock, there's a box to type it in, and some small print about asking whoever looks after the device.",
      revealWhen:
        'Asks what the screen says or shows, asks her to describe or read out the wording, or asks whether there is a message.',
      intents: ['error_message'],
      cues: [
        'what does it say',
        'what does the screen',
        'what do you see',
        'what you see',
        'describe the screen',
        'describe what',
        'wording',
        'read me',
        'say on the screen',
        'on the screen',
        'screen look like',
        'message',
      ],
      knowledge: 'after-checking',
      checking: 'Let me look at it properly. Hold on.',
      hint: "There's a bit of small print on it that I haven't read properly.",
      statementTerse:
        'Dark screen, white writing. It needs a recovery key, and there is small print about asking whoever looks after the device.',
      statementSimple:
        'The screen is dark with white writing. It says it needs a recovery key. There is a box to type in. There is small print about asking the person who looks after the device.',
      missedConsequence:
        'Without her own description of the screen, the engineer works from assumptions, and misses that the screen itself points her towards whoever looks after the device.',
      betterQuestion:
        'Can you describe what the screen says, in your own words, without typing anything into it?',
    },
    {
      id: 'hf-it-desk-not-called',
      importance: 'important',
      minDifficulty: 'standard',
      availableAfterTurn: 2,
      minTrust: 40,
      label: "She hasn't called the IT help desk yet",
      // Once she is back in her laptop (a closure call) this is no longer true.
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        "I haven't rung our IT help desk yet. I didn't want them to think I'd broken something.",
      revealWhen:
        'Asks whether she has contacted her IT help desk or anyone at her organisation yet, or what is stopping her.',
      intents: ['already_tried', 'previous_contact'],
      cues: [
        'it help desk',
        'help desk',
        'service desk',
        'it team',
        'your it',
        'it department',
        'anyone at',
        'anybody at',
        'spoken to anyone',
        'told anyone',
        'contacted anyone',
        'project lead',
      ],
      statementTerse: "I haven't rung IT yet. I didn't want them to think I'd broken something.",
      statementSimple:
        'I have not called our IT help desk yet. I did not want them to think I broke something.',
      missedConsequence:
        'The engineer tells her to contact IT without knowing why she has not, and her worry about being blamed stays, so the call ends without the plan being followed.',
      betterQuestion:
        'Have you spoken to anyone at Trey Research about this yet, such as the IT help desk?',
    },
    {
      id: 'hf-code-on-screen',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'A long code on the screen she has not copied',
      statement:
        "There's also a long line of letters and numbers on the screen. I haven't copied it down, and I'm not sure I should read it out to anyone.",
      revealWhen:
        'Asks what else is on the screen, whether there is a code or identifier shown, or asks her to read out or write down what the screen shows.',
      intents: ['error_message'],
      cues: [
        'anything else on',
        'anything else it says',
        'anything else showing',
        'any numbers',
        'any code',
        'a code',
        'identifier',
        'long line',
        'read it out',
        'read out',
        'letters and numbers',
        'write down',
      ],
      statementTerse:
        "There's a long line of letters and numbers. I haven't copied it. I'm not sure I should read it out.",
      statementSimple:
        'There is a long line of letters and numbers on the screen. I did not write it down. I am not sure if I should read it to you.',
      missedConsequence:
        'A code on the screen goes unmentioned, and the engineer misses the moment to show how to handle something that may be sensitive: not asking her to read it out, and telling her to keep it for her IT help desk.',
      betterQuestion:
        'Without reading it out to me, is there anything else on the screen, such as a long code?',
    },
    {
      id: 'hf-overnight-charger',
      importance: 'helpful',
      minDifficulty: 'challenge',
      label: 'The charger may have come loose during the update',
      statement:
        "I left it to update overnight with the lid closed, and I think the charger wasn't properly in, because the battery was almost flat when I came to it.",
      revealWhen:
        'Asks what happened to the laptop before the screen appeared, or whether anything unusual happened during the update, such as a power or battery problem.',
      intents: ['recent_changes', 'timing_onset'],
      cues: [
        'what happened before',
        'just before',
        'overnight',
        'during the update',
        'unusual',
        'battery',
        'charger',
        'plugged in',
        'power cut',
        'shut down',
        'switched off',
        'turned off',
      ],
      statementTerse:
        'I left it updating overnight. I think the charger came loose, because the battery was nearly flat.',
      statementSimple:
        'I left the laptop to update overnight with the lid closed. I think the charger was not in properly. The battery was almost flat in the morning.',
      missedConsequence:
        'A plain account of what happened to the laptop is never heard, and the engineer cannot give her IT help desk a clear picture of the events before the screen appeared.',
      betterQuestion:
        'What happened to the laptop just before this screen appeared, and did anything unusual happen during the update?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-update-wiped-everything',
      statement: "I think the update has wiped everything, and that's why it wants a key.",
      truth:
        'Nothing described on the call shows that any files are gone. The screen is asking for a key, and nobody can say what is or is not safe until the right route to the key is found, so the engineer should not promise either way.',
    },
    {
      id: 'ia-my-fault',
      statement: 'I must have pressed something wrong when it was updating.',
      truth:
        'Nothing she has described suggests she did anything wrong, so the engineer can reassure her on that without blaming anyone.',
    },
  ],

  curveballs: [
    {
      id: 'cb-promise-files',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9, whenTemperatureAtLeast: 30 },
      statement:
        'Can you promise me my files are still there? I just need to hear that nothing is lost.',
      followUp: 'Please, just say it. Are my files safe?',
      expectedResponse:
        'Do not promise that her files are safe or lost, because you cannot know. Be honest about what is known, reassure her about what you can (she has not done anything wrong, and there is a clear route to ask for the key), and say what happens next and when you will follow up.',
      minDifficulty: 'standard',
    },
    {
      id: 'cb-last-time-wiped',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 6, latestTurn: 10, whenOwnershipUnclear: true },
      statement:
        "The last time I had a laptop problem, IT just wiped it and I lost a week of work. Please don't let that happen again.",
      followUp: "Will they wipe it this time? I really can't lose it again.",
      expectedResponse:
        'Acknowledge the earlier experience without defending anyone. Do not promise how her own IT team will handle it. Say what you will do: explain the safe next step, make sure she tells the help desk what is at stake, and give a time when you will check in.',
      minDifficulty: 'challenge',
    },
  ],
  allowedCurveballs: ['unsupported-guarantee', 'previous-bad-experience', 'go-silent', 'deadline'],

  expectedDiscoveryAreas: [
    'What she sees on the screen',
    'What she has tried so far',
    'What is at stake on the laptop',
    'What happened before the screen appeared',
    'Who is responsible for the laptop at Trey Research',
    'Whether anyone else is affected',
    'Where a key might be kept',
  ],
  successCriteria: [
    'Slows the call down, introduces themselves and acknowledges her worry before asking questions.',
    'Reassures honestly: says what is known and what is not, without promising her files are safe.',
    'Finds out what she can see, what she typed and how often she restarted, and what is at stake on the laptop.',
    'Handles anything sensitive safely: does not ask her to read out a password or key, and says who should see it.',
    'Agrees clear next steps she can follow, including who to contact at Trey Research, and a time for the follow-up.',
  ],
  coachingFocus: ['empathy-deescalation', 'clarity', 'ownership-next-steps'],
  careExpectations: {
    communicate: [
      'Speaks slowly in plain words, gives one step at a time and checks she has followed before moving on.',
      'Sums up the plan in a few short sentences she can write down.',
    ],
    accountable: [
      'Says what they will do and when they will follow up, instead of only telling her to call someone else.',
      'Is honest that nobody can promise the state of her files before the key is found.',
    ],
    resourceful: [
      'Asks what she can see and what is at stake, then points her to the right place at Trey Research for the next step.',
      'Thinks about what is safe to say on a call and keeps anything sensitive off it.',
    ],
    empathetic: [
      'Acknowledges her worry in her own terms, early, and does not rush her or talk over her tangents.',
      'Reassures her that nothing she has described suggests she has done anything wrong.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Promising that her files are safe, or that the key will be found, when nobody can know yet.',
    'Asking her to read out or type a password or key on the call, or to send one by message or email.',
    "Using terms such as 'encryption policy' or 'TPM' without explaining them.",
    'Telling her to keep trying passwords, or to restart again and again, until it works.',
    'Telling her to call IT and ending the call without a plan, a summary or a follow-up time.',
  ],
  goodBehaviours: [
    'Welcoming her tangents briefly, then steering back gently with a short, specific question.',
    'Asking what the screen says in her own words, and what she has tried.',
    'Asking what on the laptop matters most and whether it is saved anywhere else.',
    'Saying plainly that nothing she has described suggests she did anything wrong, and what is and is not known yet.',
    'Telling her not to read out any code or key to anyone except her IT help desk, and to leave the screen as it is.',
    'Agreeing who she will contact, what she will tell them and when the engineer will check in.',
  ],
  expectedOutcome:
    'Hannah is calmer and knows what to do next: she has not done anything wrong, nobody can yet say what state her files are in, and she will contact her IT help desk with a short summary and keep any code to herself. The engineer owns the case and agrees a time to check in.',
  evaluatorNotes:
    'Root cause (plausible, not confirmed on the call): after an overnight update during which the charger probably came loose, the laptop stops on a screen asking for a recovery key. Hannah has never needed one and does not know where one would be kept. She has tried her work password and her phone PIN, has not rung the IT help desk because she fears blame, and has weeks of unsaved analysis on the laptop. A strong call is calm and plain: it finds what she sees, tried and could lose, keeps anything sensitive off the call, reassures honestly without promising her files are safe, and agrees who she contacts, what she says and when the engineer checks in.',
} satisfies ScenarioInput;

export default scenario;
