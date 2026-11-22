import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario (first contact). Everything here is fictional: people, organisation and case.
// Microsoft Entra ID is a real product, so the scenario describes only what the customer sees and
// was told, never how Entra works.
//
// Root cause in the story (hidden from the trainee; plausible, never confirmed on the call): on
// Friday afternoon the airline replaced the company phones of its regional sales leadership team.
// Ruth's old phone went back to the supplier in a box, and nobody set up the extra sign-in check on
// the new one. She had signed in on Friday morning, before the swap; the check came up again this
// morning and she cannot complete it. The only other way the screen offers is a text to the old
// number, which she no longer has. The others on the team had new phones too, so some of them will
// meet it. Ruth does not
// know who looks after sign-in at her company and has not rung IT, because she assumed Microsoft
// could switch the check off. In the story it is her company's own administrator, once they have
// confirmed who she is, who decides what happens to her check. The engineer cannot do that on this
// call, and nothing here says how it is done. She presents a travel proposal to a large corporate
// customer at half past two and flies out tonight. Her assistant, Kofi, is signed in on his own
// computer and has the slides.
//
// Ruth is frustrated, demanding and not technical. She wants a yes or a no and a time. A strong call
// acknowledges the pressure in one sentence, keeps its words plain, holds a kind boundary about who
// can act and why her identity has to be confirmed first, finds the phone, the deadline and the
// person who can act, helps her protect the afternoon without bypassing the check, promises no time
// it cannot keep, handles the demand for a manager calmly, and agrees who does what by when.

const scenario = {
  id: 'entra-cannot-complete-sign-in-check',
  version: 1,
  title: 'Sales director cannot complete the extra sign-in check',
  shortTitle: 'Cannot complete sign-in check',
  listSummary:
    'A sales director cannot complete the extra sign-in check and wants it switched off straight away.',
  summary:
    'Ruth Calloway directs regional sales at Blue Yonder Airlines. She cannot complete the extra check that follows her password, and she wants it switched off now. She has little time and little patience. Acknowledge the pressure, be honest about what you can and cannot do, and agree who acts next.',
  tags: ['sign-in', 'extra check', 'identity', 'boundaries', 'high pressure', 'plain language'],
  estimatedMinutes: 14,

  product: { id: 'entra-id', area: 'Multifactor authentication' },
  caseReference: 'SIM-410401',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-learn', 'microsoft-support'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    revisedOn: '2026-11-22',
    review: 'assistant-reviewed',
    notes:
      "Re-read current Support and Learn pages on signing in another way, contacting your administrator and admin-managed sign-in methods; wording matches. The phone swap and who can act are the story's own. Revised timeline, cues, curveballs, closure wording. AI-assisted review, not a mentor's.",
  },
  issueType: 'sign-in-access',
  impact: 'high',
  startingTemperature: 'frustrated',
  proficiency: 'novice',
  style: 'demanding',
  callStage: 'first-contact',
  difficulty: 'challenge',

  persona: {
    name: 'Ruth Calloway',
    speaker: 'female',
    role: 'Regional Sales Director',
    organisation: 'Blue Yonder Airlines',
    background:
      'Ruth leads sales for a region of a mid-sized airline and spends most of her week with corporate customers. She uses her laptop and phone all day, but she has never needed to think about how they are set up, and she leaves that to IT. She is used to people acting on what she says.',
    voice:
      'Direct and impatient, in short sentences. Talks about what she has to do today, not about technology: "the extra security thing", "the thing on my phone". Asks for a yes or no and a time. Never abusive, but cuts across waffle. Softens when someone is plainly on her side and honest.',
  },
  environment: {
    details: [
      "Ruth works from the airline's regional office, on a company laptop.",
      'She signs in to email, her calendar and her cloud files with her work account, and an extra check follows her password.',
      "The airline's IT team looks after accounts and company phones.",
      'She leads the regional sales leadership team.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Ruth only, as far as she knows.' },
    medium: { count: 3, summary: 'Ruth and two regional managers who are stuck in the same way.' },
    high: { count: 12, summary: 'The twelve people of the regional sales leadership team.' },
  },
  customerObjective:
    'Get signed in to her email and files so that she can get on with her day, and have the extra check switched off.',
  customerExpectation:
    'Someone who takes ownership, explains in plain words what is going on, and says when she will hear back, without a lecture or questions she cannot answer.',
  desiredOutcome:
    'Ruth understands in plain words why she is stuck and who has to act, knows what to tell them and when she will hear back, and has a way to keep her afternoon on track in the meantime.',
  previousTroubleshooting: [
    'Ruth tried the sign-in four times, restarted her laptop and tried a second browser. The same check appeared each time.',
    'She asked at the front desk whether anyone could help, and was told to call support.',
  ],
  recentChanges: [
    "Ruth's company phone was replaced on Friday afternoon, and the old phone went back to the supplier.",
    'Nothing else changed on her laptop that she knows of.',
  ],

  publicBrief: {
    issue:
      'Ruth cannot complete the extra sign-in check after entering her password, and wants it switched off.',
    impact: {
      low: 'Ruth cannot reach her work, but nothing is due today.',
      medium: 'Ruth cannot reach her work, and something she needs is due soon.',
      high: 'Ruth cannot reach her work, and an important deadline is close.',
    },
    objective: 'Acknowledge the pressure, hold a kind boundary, and agree who acts next and when.',
    knownContext:
      'Ruth is a regional sales director at an airline. She is not technical, she is under pressure, and she wants a quick answer.',
    environment:
      'Ruth uses a work laptop. Her company manages how its staff sign in. You cannot see her account in this call.',
  },
  brief: {
    situation:
      'A regional sales director is calling because she cannot complete the extra check that follows her password. She is not technical, she is short of time, and she wants the check switched off.',
    goal: 'Find out what is happening and why, hold a kind but firm boundary about what you can do, avoid promising a time you cannot keep, and agree who acts next and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'You cannot see her account in this practice call, so rely on what she tells you.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'Do not promise a fix time or an outcome you cannot guarantee.',
    ],
  },

  openingCore:
    "I can't get past the extra security check when I sign in, and I want it switched off.",
  impactVariants: {
    low: {
      summary: "It's only me, and nothing's due today, but I can't work without access.",
      detail:
        "As far as I know it's only me. Being locked out of my email and my files has put my week behind, and I don't want it to drag on.",
      deadline: "It doesn't have to be this minute, but I don't want it dragging on.",
    },
    medium: {
      summary: "I can't get at my email or my files, and I need them for something later.",
      detail:
        "I'm not the only one. A couple of my regional managers have hit the same wall, and between us we've got a customer commitment this afternoon that needs email and files.",
      deadline: 'This afternoon is the deadline.',
    },
    high: {
      summary: "I can't get into anything, and I've got an important customer waiting on me today.",
      detail:
        "It isn't only me. There are others in my team who have hit the same wall. Being locked out of my email and my files has put a customer this afternoon at risk.",
      deadline: 'This afternoon is the deadline.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case I opened earlier about the extra security check. I still can't sign in, and nobody has come back to me.",
      brief:
        'Ruth opened a case earlier about the extra sign-in check. She still cannot sign in and has had no update.',
    },
    escalated: {
      opening:
        "This is my second call about the extra security check, and I'm still locked out. I need someone who can actually do something.",
      brief:
        'Ruth has already called once about the extra sign-in check and is still locked out. Her patience is short, and she expects action.',
    },
    closure: {
      opening:
        "I'm calling about the case on the extra security check. I can sign in again, and I'd like to understand what happened before you close it.",
      brief:
        'This is a closure call. Ruth can sign in again and wants to understand what happened before the case closes.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier today',
      summary:
        'Ruth phoned about not being able to complete the extra sign-in check. A case was opened and she was asked to restart her laptop and try again.',
    },
    {
      when: 'Since then',
      summary: 'She tried again and still cannot sign in. No engineer has been assigned.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: "I put my password in, and then it wants me to approve something on my phone. I can't, so I'm stuck on that screen.",
      intents: ['problem_description', 'error_message'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration: "I've been round it four times now. It just sits there waiting for my phone.",
      simple:
        'I enter my password. Then it asks me to approve on my phone. I cannot do that, so I am stuck on that screen.',
    },
    {
      id: 'kf-problem-closure',
      text: "Before, I couldn't get past the extra security check. I can sign in again now, and I'd like to know what it was.",
      intents: ['problem_description'],
      stages: ['closure'],
      simple:
        'Before, I could not get past the extra security check. I can sign in again now. I would like to know what it was.',
    },
    {
      id: 'kf-started',
      text: "It started the first time I tried to sign in today. I haven't got past it since.",
      intents: ['timing_onset'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      cues: [
        'when did it start',
        'when did this start',
        'when did it begin',
        'when did this begin',
        'since when',
        'how long has',
        'what time did',
      ],
      simple: 'It started the first time I tried to sign in today. I have not got past it since.',
    },
    {
      id: 'kf-wants',
      text: "I want that extra check switched off for me. I don't see why I need it.",
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple: 'I want the extra check switched off for me. I do not see why I need it.',
    },
    {
      id: 'kf-outcome-closure',
      text: "I want to know what happened, and I want to be sure it won't catch me out again.",
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple: 'I want to know what happened. I want to be sure it does not stop me again.',
    },
    {
      id: 'kf-device',
      text: "I'm on my work laptop in the regional office. It's the same in the browser and in the apps.",
      intents: ['environment'],
      cues: [
        'device',
        'laptop',
        'browser',
        'where are you',
        'which computer',
        'what are you using',
      ],
      simple:
        'I am on my work laptop in the regional office. It is the same in the browser and in the apps.',
    },
    {
      id: 'kf-phone',
      text: "It's an iPhone. It's the company one.",
      intents: ['environment'],
      cues: [
        'what phone',
        'which phone',
        'what kind of phone',
        'what type of phone',
        'iphone',
        'android',
        'which model',
        'what make',
      ],
      simple: 'It is an iPhone. It is the company phone.',
    },
    {
      id: 'kf-worked-before',
      text: "It's worked every other time. This is the first time it's got in my way.",
      intents: ['timing_onset', 'reproducibility'],
      cues: ['before', 'ever', 'first time', 'always', 'every time', 'worked'],
      simple: 'It has worked every other time. This is the first time it stops me.',
    },
    {
      id: 'kf-tried',
      text: "I've tried it four times, restarted the laptop and tried another browser. Same screen every time.",
      intents: ['already_tried'],
      simple:
        'I tried it four times. I restarted the laptop and tried another browser. It is the same screen every time.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-last-success',
      intents: ['timing_onset'],
      cues: ['last time', 'last signed', 'last work', 'when did you last', 'last got in'],
      text: "I think it was Friday. Friday morning, maybe. I can't be sure.",
      confirmedText:
        "It was Friday, first thing, before the leadership meeting. I'm sure of that now.",
    },
  ],
  checkableFacts: [
    {
      id: 'cf-screen',
      intents: ['error_message'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      checking: "Hold on, it's on the screen in front of me. I'll read it.",
      text: "It says it's sent a request to my phone, and I should approve it. There's a small link underneath about signing in another way.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-who-decided',
      intents: ['account_details'],
      cues: [
        'who decided',
        'who requires',
        'who set',
        'why do you need',
        'why is it required',
        'who made',
      ],
      text: "I've no idea who decided we need it. IT made us do it, I know that much.",
      whoKnows: 'the IT team',
    },
    {
      id: 'uf-set-up',
      intents: ['account_details', 'environment'],
      cues: [
        'registered',
        'which methods',
        'what methods',
        'set up on your account',
        'which number',
        'what number',
        'on file',
        'what is set up',
      ],
      text: "I couldn't tell you what's set up on my account for it. I did what I was told at the time and never looked again.",
      whoKnows: 'the IT team',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-lift',
      text: "The lift in this building has been out all week, so I've been up and down the stairs with a laptop bag.",
    },
    {
      id: 'if-uniforms',
      text: "We've got new uniforms coming in this season, and I've spent half of this week on that.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-phone-swap',
      importance: 'critical',
      label: 'Her company phone was replaced on Friday',
      statement:
        "I got a new company phone on Friday afternoon. The old one went back to the supplier in a box, so I don't have it any more.",
      revealWhen:
        'Asks whether anything changed recently, for example with her devices or her account, or when the check last worked for her.',
      intents: ['recent_changes', 'timing_onset'],
      cues: [
        'change',
        'anything new',
        'new phone',
        'old phone',
        'with your phone',
        'last work',
        'last time it',
        'replaced',
        'upgraded',
        'new device',
      ],
      hint: "It's something to do with my phone, I think.",
      statementTerse:
        'New company phone on Friday afternoon. The old one went back to the supplier.',
      statementSimple:
        'I got a new company phone on Friday afternoon. The old one went back to the supplier. I do not have it now.',
      missedConsequence:
        'The engineer misses that her phone was replaced, so the engineer treats it as a fault with the sign-in or the laptop instead of a change to her phone.',
      betterQuestion:
        'Has anything changed recently with your phone, and when did the check last work for you?',
    },
    {
      id: 'hf-only-option',
      importance: 'important',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'The only other option goes to an old number',
      statement:
        "There's a link for another way to sign in, but it only offers a text message to a number I don't use any more.",
      revealWhen:
        'Asks what other ways the sign-in screen offers to prove who she is, or what the other option does.',
      intents: ['error_message', 'workaround'],
      cues: [
        'another way',
        'other way',
        'other option',
        'alternative',
        'text message',
        'what else does',
        'what does it offer',
      ],
      statementTerse: "It only offers a text to a number I don't use now.",
      statementSimple:
        'There is a link for another way to sign in. It only sends a text message to a number I do not use now.',
      missedConsequence:
        'The engineer never learns that the only other option leads nowhere, so the engineer may suggest that she tries it again or waits for a code that cannot arrive.',
      betterQuestion: 'What other ways does the sign-in screen offer to prove who you are?',
    },
    {
      id: 'hf-deadline',
      importance: 'important',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'A customer presentation and a flight today',
      statement:
        "I'm presenting a travel proposal to a big corporate customer at half past two, and I fly out tonight. The slides and the pricing sheets are in my files.",
      byImpact: {
        low: {
          statement:
            "There's no meeting today. I've got a customer proposal to finish by Friday, and the slides and the pricing sheets are in my files.",
          statementTerse:
            'No meeting today. A customer proposal is due Friday. The slides are in my files.',
          statementSimple:
            'There is no meeting today. I must finish a customer proposal by Friday. The slides and the prices are in my files.',
        },
        medium: {
          statement:
            "I'm meeting a big corporate customer at half past two. The slides and the pricing sheets are in my files.",
          statementTerse: 'Customer meeting at half past two. The slides are in my files.',
          statementSimple:
            'I meet a big customer at half past two. The slides and the prices are in my files.',
        },
      },
      revealWhen:
        'Asks what she needs access for today, when she needs to be back in, or what is riding on it.',
      intents: ['urgency_deadline', 'business_impact'],
      cues: [
        'deadline',
        'when do you need',
        'by when',
        'how urgent',
        'how soon',
        'what do you need access',
        'what do you need it for',
        'what do you have on',
        'what is riding',
        'meeting',
        'presentation',
      ],
      statementTerse:
        'Customer presentation at half past two. Slides are in my files. I fly tonight.',
      statementSimple:
        'I present to a big customer at half past two. The slides and the prices are in my files. I fly out tonight.',
      missedConsequence:
        'The engineer never learns the real deadline, so the engineer cannot judge what to protect first, and the afternoon is lost to a fix that cannot be done in time.',
      betterQuestion: 'What do you need access for today, and when do you need to be back in by?',
    },
    {
      id: 'hf-admin-person',
      importance: 'important',
      minDifficulty: 'standard',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'Who looks after sign-in at her company',
      statement:
        "IT at head office looks after that. A man called Teodor set up my phone for work last year, but I don't know who actually runs it, and I haven't rung them.",
      revealWhen:
        'Asks who looks after sign-in at her company, whether she has spoken to her IT team or administrator, or who she could contact.',
      intents: ['account_details', 'already_tried'],
      cues: [
        'administrator',
        'admin',
        'it team',
        'it department',
        'help desk',
        'service desk',
        'who looks after',
        'who manages',
        'who can reset',
        'who can change',
        'spoken to your',
        'spoken to anyone',
      ],
      statementTerse: "Head office IT. Teodor did my phone last year. I haven't rung them.",
      statementSimple:
        'Head office IT looks after it. A man called Teodor set up my phone for work last year. I do not know who runs it. I did not call them.',
      missedConsequence:
        'The engineer never works out who can actually act, so Ruth leaves the call believing Microsoft can switch the check off, and no one contacts the right team.',
      betterQuestion:
        'Who looks after your sign-in at work, and have you been able to speak to them yet?',
    },
    {
      id: 'hf-team-phones',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Others had new phones too',
      statement:
        "The whole leadership team had new phones on Friday afternoon, twelve of us. A few of them have told me they're stuck on the same screen.",
      byImpact: {
        low: {
          statement:
            "I think the rest of the team had new phones too, but I haven't heard that anyone else is stuck.",
          statementTerse: "Others had new phones too. Nobody else has said they're stuck.",
          statementSimple:
            'I think the rest of the team had new phones too. Nobody else has told me they are stuck.',
        },
        medium: {
          statement:
            "Two of my regional managers had new phones on Friday afternoon as well, and both have told me they're stuck on the same screen.",
          statementTerse: 'Two regional managers had new phones too. Both are stuck.',
          statementSimple:
            'Two of my regional managers had new phones on Friday afternoon as well. Both told me they are stuck on the same screen.',
        },
      },
      revealWhen:
        'Asks whether anyone else is affected, or how many people are in the same position.',
      intents: ['affected_scope'],
      cues: [
        'anyone else',
        'anybody else',
        'someone else',
        'only you',
        'just you',
        'other people',
        'how many people',
        'how many of you',
        'everyone',
        'your team',
        'colleagues',
        'affected',
      ],
      statementTerse: 'Whole leadership team had new phones. A few are stuck too.',
      statementSimple:
        'The whole leadership team had new phones on Friday afternoon. There are twelve of us. A few of them told me they are stuck on the same screen.',
      missedConsequence:
        'The engineer treats it as one person with a problem, and misses that others who had the same change are likely to meet it, which matters to whoever looks after sign-in.',
      betterQuestion: 'Is it only you, or are other people affected too?',
    },
    {
      id: 'hf-assistant-copy',
      importance: 'helpful',
      minDifficulty: 'standard',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'Her assistant has a copy of the slides',
      statement:
        "Kofi, my assistant, has the latest slides on his own computer. I haven't asked him to send them to me.",
      revealWhen:
        'Asks whether someone else already has what she needs, or whether there is a way to keep the afternoon on track in the meantime.',
      intents: ['workaround'],
      cues: [
        'assistant',
        'colleague who',
        'in the meantime',
        'work around',
        'workaround',
        'a copy',
        'another way to get',
        'keep going',
        'get the slides',
        'get the files',
      ],
      statementTerse: 'Kofi, my assistant, has the latest slides on his own computer.',
      statementSimple:
        'My assistant, Kofi, has the latest slides. He is signed in on his own computer. I did not ask him to send them to me.',
      missedConsequence:
        'The engineer misses a safe way to protect the afternoon without touching the check, so the whole call turns on something nobody on it can promise.',
      betterQuestion:
        'Is there a way to get what you need for this afternoon in the meantime, for example from your assistant?',
    },
    {
      id: 'hf-can-vouch',
      importance: 'helpful',
      minDifficulty: 'challenge',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'Her manager can confirm who she is',
      statement:
        'My manager, Pilar, is in the building and can vouch for me. My staff pass is at home, though, if that matters.',
      revealWhen:
        'Asks how her company could confirm it is really her, or who could vouch for her.',
      intents: ['account_details'],
      cues: [
        'vouch',
        'who can confirm',
        'confirm who you are',
        'confirm it is you',
        'confirm it is really you',
        'identity',
        'staff pass',
        'know it is you',
      ],
      statementTerse:
        'Pilar, my manager, is in the building and can vouch for me. My pass is at home.',
      statementSimple:
        'My manager, Pilar, is in the building. She can vouch for me. My staff pass is at home. I do not know if that matters.',
      missedConsequence:
        'The engineer never finds the quick way to confirm who she is, which her administrator will need, so the boundary sounds like a refusal instead of a step she can take.',
      betterQuestion:
        'If someone has to confirm it is really you, is there a colleague or a manager nearby to vouch for you today?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-switch-off',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement: "It's just a setting. You can switch it off for me from your side, can't you?",
      truth:
        "In this story the extra check is her company's requirement, and what happens to it for her account is her own administrator's decision once they have confirmed who she is. The engineer cannot switch it off on this call.",
    },
    {
      id: 'ia-service-broken',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement: 'Your system has gone wrong. It was fine on Friday.',
      truth:
        'Nothing suggests a fault in the service. In this story the check is waiting for a phone that she no longer has.',
    },
  ],

  curveballs: [
    {
      id: 'cb-yes-or-no',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 10 },
      statement: 'Just give me a yes or a no. Can I rely on this?',
      followUp: 'A yes or a no. Can I rely on this?',
      expectedResponse:
        'Do not promise a time. Say what you can commit to, such as who has to act, what she should tell them and when you will check in, and be honest that you cannot confirm her identity or change her sign-in yourself.',
      minDifficulty: 'standard',
      effects: { temperature: 6, patience: -6 },
    },
    {
      id: 'cb-your-manager',
      type: 'ask-manager',
      trigger: { earliestTurn: 6, latestTurn: 11, whenOwnershipUnclear: true },
      statement: 'Put your manager on the phone. I want someone senior to hear this.',
      followUp: 'Who is your manager, and how do I get them?',
      expectedResponse:
        'Do not get defensive. Say what you can do now, offer to bring in a senior colleague alongside you if she still wants one, and keep working on who has to act on her side.',
      minDifficulty: 'challenge',
      effects: { temperature: 8, trust: -8, patience: -6 },
    },
  ],
  allowedCurveballs: ['unsupported-guarantee', 'ask-manager', 'challenge-credibility'],

  expectedDiscoveryAreas: [
    'What she sees after entering her password',
    'What changed recently',
    'What she needs access for today',
    'Who looks after sign-in at her company',
    'Who else is affected',
    'How her company could confirm who she is',
    'Ways to protect her day in the meantime',
  ],
  successCriteria: [
    'Acknowledges the pressure in one plain sentence, then asks what she sees after her password, without jargon.',
    'Finds out what changed recently, including her phone, and when the check last worked.',
    'Holds a kind, firm boundary: says that her company has to confirm who she is, and that they, not the engineer, can act on her sign-in.',
    'Finds who looks after sign-in at her company and what is riding on today, and helps her protect the afternoon without bypassing the check.',
    'Makes no promise about a time they cannot keep, and handles the demand for a yes or no, and for a manager, calmly.',
    'Agrees who does what by when, gives her something short to say to her administrator, and summarises before ending.',
  ],
  coachingFocus: ['empathy-deescalation', 'ownership-next-steps', 'clarity'],
  careExpectations: {
    communicate: [
      'Uses everyday words such as "the extra check" and "your phone", explains any other term, and answers a demand for a yes or no plainly instead of hiding behind jargon.',
      'Summarises who does what and when in two or three plain sentences before the call ends.',
    ],
    accountable: [
      'Is honest about what they cannot do on this call and why, and says what they will do instead.',
      'Refuses to promise a sign-in time they cannot control, and gives a time when she will hear from them.',
    ],
    resourceful: [
      'Finds the phone change, the deadline and the person who can act, with a few specific questions.',
      'Finds another route to keep her afternoon moving without bypassing the check, such as a colleague who already has the files.',
    ],
    empathetic: [
      'Acknowledges the pressure of a customer waiting and a locked laptop in one sentence, without sounding scripted.',
      'Stays calm and kind when she pushes for a yes or no, or for a manager.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Agreeing to switch the check off, or hinting that it can be, to calm her down.',
    'Explaining how sign-in checks work, or naming settings and methods without explaining them.',
    'Promising that she will be signed in by a time that depends on someone else.',
    'Asking questions she cannot answer, such as which method is registered on her account, instead of asking what she sees and what changed.',
    'Telling her to contact her administrator and ending the call, without saying who that is, what to say or when to follow up.',
    'Asking for her password, or for any code that appears on her phone.',
  ],
  goodBehaviours: [
    'Acknowledging the pressure first, in one plain sentence.',
    'Asking what she sees after her password and whether anything changed recently, including her phone.',
    'Saying kindly and clearly that her company must confirm who she is before anything about her sign-in changes.',
    'Asking what she needs access for today and whether someone else already has it.',
    'Saying what they can do, what they cannot, and when she will hear from them.',
    'Giving her a short message to pass on to her administrator.',
  ],
  expectedOutcome:
    'Ruth understands in plain words that her phone change is the likely reason she is stuck, that her company must confirm who she is before anything changes, and that the engineer cannot switch the check off. She knows who to contact and what to tell them, has a way to protect her afternoon, and has a time when she will hear back.',
  evaluatorNotes:
    'Root cause in the story (plausible, not confirmed on the call): on Friday afternoon, after Ruth had signed in, her company phone was replaced and the old one went back to the supplier, and the extra sign-in check was never set up on the new one. The only other way the screen offers is a text to a number she no longer has. Her own administrator, after confirming who she is, decides what happens to her check. A strong call acknowledges the pressure in one sentence, keeps its words plain, holds a kind boundary, finds the phone change, the deadline and the person who can act, protects the afternoon without bypassing the check, promises no time, and agrees who does what by when.',
} satisfies ScenarioInput;

export default scenario;
