import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario (first contact). Everything here is fictional: people, organisation and case.
// SharePoint is a real product, so the scenario describes only what the customer sees and was told,
// never how sharing works.
//
// Root cause in the story (hidden from the trainee): Mei-Ling shared a folder of new label artwork
// with an outside designer by link. Her manager wants the new label kept private, so she chose the
// setting where only the people she names can open the link, and typed the studio address from an old
// email. The designer signs in on his computer with a different address, so the link does not open for
// him. It opens for her and her manager, who are inside the winery. It is the first time she has
// shared a whole folder outside the company, because the files were too big to attach. The printer
// needs the finished files by Thursday. Nothing is wrong with the folder or the link.
//
// Mei-Ling is calm, careful and not technical. English is her second language: she uses simple words
// and may ask for a word to be explained. A strong call uses short, plain sentences with no idioms,
// checks understanding often, finds who the link was made for and which address was used without
// leading her, does not suggest opening the link to everyone before the owner of the folder has said
// so, does not promise a time, and agrees who will do what and when she will hear next.

const scenario = {
  id: 'sharepoint-shared-link-not-opening',
  version: 1,
  title: 'Shared link will not open for the person it was sent to',
  shortTitle: 'Shared link not opening',
  listSummary:
    'A marketing assistant says a link she shared will not open for the person she sent it to.',
  summary:
    'Mei-Ling Tran is a marketing assistant at Coho Winery. A link she shared will not open for the person she sent it to. English is her second language, so simple words and clear checks will help. Find out what is happening and agree what happens next.',
  tags: ['sharing link', 'access', 'non-native speaker', 'plain language', 'first contact'],
  estimatedMinutes: 9,

  product: { id: 'sharepoint-online', area: 'Sharing' },
  caseReference: 'SIM-410302',
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
      "Re-read current public pages on specific-people links, external sharing and access-denied errors. Terms fit; the story is its own. Made the error line less revealing, stage-limited closure lines. AI-assisted review, not a mentor's.",
  },
  issueType: 'permissions',
  impact: 'medium',
  startingTemperature: 'calm',
  proficiency: 'novice',
  style: 'non-native',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Mei-Ling Tran',
    speaker: 'female',
    role: 'Marketing Assistant',
    organisation: 'Coho Winery',
    background:
      'Mei-Ling helps the marketing team at a family winery with labels, leaflets and the website. She uses work files every day but has never thought about how sharing is set up. English is her second language, which she speaks carefully and well. She would rather ask than guess.',
    voice:
      'Polite, calm and careful. Uses simple, everyday words and short sentences, and avoids idioms. Sometimes asks the engineer to explain a word or to say something more slowly. She says so politely when she is not sure she has understood, and relaxes when things are explained step by step.',
  },
  environment: {
    details: [
      'Mei-Ling uses a work computer at the winery office, with email and the company files kept online.',
      'The marketing team keeps its design files in a shared folder online.',
      'The marketing team works with a freelance designer on its new wine labels.',
      'The winery has an IT person who looks after accounts and settings. Mei-Ling does not.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'One person outside the winery, who is waiting for the files.' },
    medium: { count: 3, summary: 'The designer and two people at his studio, who are waiting.' },
    high: {
      count: 6,
      summary: 'The designer, his studio team and the people who print the labels.',
    },
  },
  customerObjective:
    'Let her designer open the folder, so that the new label work can start, and understand why it did not open.',
  customerExpectation:
    'Someone who speaks simply, explains each step and checks she has understood, tells her what to do next, and says when she will hear back.',
  desiredOutcome:
    'Mei-Ling understands in simple words why the link does not open for the designer, knows what will be done and by whom, and knows when she will hear back.',
  previousTroubleshooting: [
    'Mei-Ling sent the link again by email, and then in a chat message, with the same result.',
    'The designer tried another browser, and it was the same.',
  ],
  recentChanges: [
    'Mei-Ling shared a whole folder by link for the first time, instead of attaching files to an email.',
  ],

  publicBrief: {
    issue: 'Mei-Ling shared a link, and the person she sent it to cannot open it.',
    impact: {
      low: 'One person is waiting for the files, but nothing is urgent.',
      medium: 'A few people are waiting for the files and want to start.',
      high: 'The whole label project is held up while people wait for the files.',
    },
    objective:
      'Explain things in simple words, find out what happened and agree what happens next.',
    knownContext:
      'Mei-Ling Tran is a marketing assistant at Coho Winery. English is her second language, so simple words and checking that she has understood will help.',
    environment:
      'Mei-Ling uses a work computer at the winery office. The marketing team keeps its design files online and shares them with people by link.',
  },
  brief: {
    situation:
      'A marketing assistant is calling because a link she shared will not open for the person she sent it to. She uses work files every day but does not manage how sharing is set up. English is her second language.',
    goal: 'Find out what happened, explain things in simple words, check she has understood, and agree what happens next and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; she answers simply and will not volunteer much.',
      'You cannot see the folder or the link in this practice call, so rely on what she tells you.',
    ],
  },

  openingCore:
    'I sent a link to a folder, but the person I sent it to cannot open it. I do not know why.',
  impactVariants: {
    low: {
      summary: 'It is not very urgent, but I would like the designer to see the folder soon.',
      detail: 'Only one person cannot open it, our designer. He is waiting, but we have some time.',
      deadline: 'I would like it to work this week.',
    },
    medium: {
      summary: 'My designer cannot open the folder, and he is waiting to start the new labels.',
      detail:
        'Three people cannot open it: the designer and two people at his studio. They are all waiting to start.',
      deadline: 'We would like it to work today, so they can start.',
    },
    high: {
      summary:
        'The new label work is stopped, because the people who need the folder cannot open it.',
      detail:
        'Six people cannot open it: the designer, his team and the people who print for us. Everything is waiting.',
      deadline: 'We need it to work today. The labels are already late.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I called yesterday about a link that does not open for the person I sent it to. I have not had any news since then.',
      brief:
        'Mei-Ling called yesterday about a shared link that does not open for the person she sent it to. A case was logged and she has had no update.',
    },
    escalated: {
      opening:
        'This is my second call about the link that does not open for the person I sent it to. It is still not working.',
      brief:
        'Mei-Ling has contacted support twice about the shared link, and it still does not open for the person she sent it to.',
    },
    closure: {
      opening:
        'I am calling to check that the person I sent the link to can open it now, so we can close the case.',
      brief:
        'Mei-Ling expects to confirm that the link now opens for the person she sent it to, and to understand what happened before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday',
      summary:
        'Mei-Ling reported that a link she shared would not open for the person she sent it to. A case was logged and no update has been sent.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: 'I sent a link to a folder with our new label designs, and the person I sent it to cannot open it.',
      intents: ['problem_description'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration: 'I have sent it two times, and it is the same each time.',
      simple: 'I sent a link to a folder with our new label designs. The person cannot open it.',
    },
    {
      id: 'kf-problem-closure',
      text: 'My designer says he can open the folder now. I want to understand what was wrong, and to be sure it will keep working.',
      intents: ['problem_description', 'expected_outcome'],
      stages: ['closure'],
      simple:
        'My designer says he can open the folder now. I want to understand what was wrong. I want to be sure it will keep working.',
    },
    {
      id: 'kf-how-sent',
      text: 'I made the link from our shared files online, and I sent it to him by email.',
      intents: ['problem_description', 'environment'],
      cues: [
        'how did you send',
        'how did you get the link',
        'how was it sent',
        'by email',
        'which app',
      ],
      simple: 'I made the link from our files online. I sent it to him by email.',
    },
    {
      id: 'kf-computer',
      text: 'I use my work computer at the winery. Everything else works well for me.',
      intents: ['environment'],
      simple: 'I use my work computer at the winery. Everything else works for me.',
    },
    {
      id: 'kf-tried',
      text: 'I sent the link again two times, once by email and once in a chat message. He also tried another browser. It was the same.',
      intents: ['already_tried'],
      simple:
        'I sent the link again two times, by email and in a chat message. He tried another browser. It was the same.',
    },
    {
      id: 'kf-outcome',
      text: 'I want my designer to open the folder, so he can start work on the labels.',
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple: 'I want the designer to open the folder. Then he can start work on the labels.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-what-he-sees',
      intents: ['error_message'],
      text: 'He told me he could not open it. I think there was a message about permission, but I did not see it myself.',
      confirmedText:
        'He sent me a picture of the message. It says he does not have permission. There is more text, but the words are long and I did not understand them.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-company-rules',
      intents: ['environment', 'account_details'],
      cues: [
        'company allow',
        'company rules',
        'sharing rules',
        'sharing policy',
        'allowed to share',
        'allow sharing',
        'outside sharing',
        'external sharing',
      ],
      text: 'I do not know what our company allows for sharing with people outside. I never needed to know.',
      whoKnows: 'our IT person',
    },
    {
      id: 'uf-designer-signin',
      intents: ['environment', 'account_details'],
      cues: [
        'how does he sign in',
        'how does he log in',
        'his computer',
        'his studio',
        'his setup',
        'his account',
      ],
      text: 'I do not know how the computer at his studio signs in. You would need to ask him.',
      whoKnows: 'the designer',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-fox',
      text: 'The new label has a small fox on it. Everybody in the office likes it.',
    },
    {
      id: 'if-newsletter',
      text: 'I am also learning a new program for our newsletter, and it takes me a long time.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-named-people',
      importance: 'critical',
      label: 'The link was made for named people only',
      statement:
        'When I made the link, I picked the option where only the people I choose can open it. My manager said the new label must stay private for now.',
      revealWhen:
        'Asks how the link was shared, which sharing choice she picked, or who the link was meant to work for.',
      intents: ['environment', 'account_details'],
      cues: [
        'who can open',
        'who should be able',
        'sharing options',
        'sharing setting',
        'link setting',
        'which option',
        'what option',
        'what did you choose',
        'who did you choose',
        'how did you share',
        'how did you set',
        'who is the link for',
      ],
      hint: 'My manager asked me to keep the new label private.',
      statementTerse:
        'I picked that only the people I choose can open it. The label must stay private.',
      statementSimple:
        'When I made the link, I picked that only the people I choose can open it. My manager said the new label must be private for now.',
      missedConsequence:
        'The engineer never learns that the link was made for named people on purpose, so a quick fix that opens it to everyone is offered without checking what her manager wants.',
      betterQuestion:
        'How did you share the folder, and who did you choose to be able to open the link?',
    },
    {
      id: 'hf-address-differs',
      importance: 'critical',
      label: 'The address she typed is not the one he uses',
      statement:
        'I wrote the email address of his studio, from an old email. He told me his computer uses a different address when he signs in.',
      revealWhen:
        'Asks which email address she shared the link with, or whether it is the address the designer signs in with.',
      intents: ['account_details'],
      cues: [
        'which email',
        'what email',
        'which address did',
        'what address did',
        'which address was',
        'what address was',
        'email address',
        'same address',
        'same email',
        'signs in with',
        'signed in with',
        'who did you share',
      ],
      statementTerse: 'I used his studio address. He signs in with a different one.',
      statementSimple:
        'I wrote the email address of his studio. He told me his computer uses a different address to sign in.',
      missedConsequence:
        'The mismatch between the address she used and the one he signs in with is never found, so the case goes round in circles and the designer keeps waiting.',
      betterQuestion:
        'Which email address did you share the link with, and is that the address he uses to sign in?',
    },
    {
      id: 'hf-others-can',
      importance: 'important',
      label: 'It opens for people inside the winery',
      statement:
        'It always opened for me, and for my manager. It was only the people outside the winery who had trouble.',
      revealWhen:
        'Asks whether anyone else can open the link, whether it opens for her, or who exactly has the problem.',
      intents: ['affected_scope', 'workaround'],
      cues: [
        'anyone else',
        'anybody else',
        'someone else',
        'other people',
        'does it open for you',
        'can you open',
        'open for you',
        'works for you',
        'work for you',
        'colleagues',
        'your manager',
        'only him',
      ],
      statementTerse:
        'It opened for me and my manager. Only people outside the winery had trouble.',
      statementSimple:
        'It always opened for me, and it opened for my manager. Only the people outside the winery had trouble.',
      byImpact: {
        low: {
          statement: 'It always opened for me, and for my manager. Only the designer had trouble.',
          statementTerse: 'It opened for me and my manager. Only the designer had trouble.',
          statementSimple:
            'It opened for me, and it opened for my manager. Only the designer had trouble.',
        },
        high: {
          statement:
            'It always opened for me, and for my manager. Everybody outside the winery had trouble.',
          statementTerse:
            'It opened for me and my manager. Nobody outside the winery could open it.',
          statementSimple:
            'It opened for me, and it opened for my manager. Nobody outside the winery could open it.',
        },
      },
      missedConsequence:
        'The pattern that only outside people are affected stays hidden, so the engineer treats it as a fault with the folder or the link instead of a question about who the link is for.',
      betterQuestion:
        'Can anyone else open the link, for example you or a colleague at the winery?',
    },
    {
      id: 'hf-deadline',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'The printing day is close',
      statement:
        'The printer needs the finished label files by Thursday. If the designer cannot start soon, we will miss our printing day.',
      revealWhen:
        'Asks whether there is a deadline, when the designer needs to start, or what depends on the link working.',
      intents: ['urgency_deadline', 'business_impact'],
      cues: [
        'deadline',
        'how urgent',
        'by when',
        'when do you need',
        'how soon',
        'is due',
        'is it due',
        'need it by',
        'time pressure',
        'what depends on',
        'need to start',
        'when does he need',
      ],
      statementTerse: 'The printer needs the files by Thursday. We must not miss our printing day.',
      statementSimple:
        'The printer needs the finished files by Thursday. If the designer cannot start soon, we will miss our printing day.',
      byImpact: {
        low: {
          statement: 'The printer needs the files by the end of next week, so we have some time.',
          statementTerse: 'The printer needs the files by the end of next week.',
          statementSimple:
            'The printer needs the files by the end of next week. We have some time.',
        },
        high: {
          statement:
            'The printer needs the finished label files by Thursday. If we miss that day, the new wine goes on sale without its new label.',
          statementTerse: 'The printer needs the files by Thursday, or the new wine has no label.',
          statementSimple:
            'The printer needs the finished files by Thursday. If we miss that day, the new wine goes on sale without its new label.',
        },
      },
      missedConsequence:
        'The real time limit stays hidden, so the case is handled as having no rush and nobody plans for the day the files are needed.',
      betterQuestion: 'Is there a deadline for the designer to start, and what depends on it?',
    },
    {
      id: 'hf-first-time',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'It was her first time sharing outside',
      statement:
        'This is the first time I have shared a whole folder with someone outside. Before, I attached small files to an email, but these files are too big.',
      revealWhen:
        'Asks whether she has shared a folder this way before, or whether this is the first time.',
      intents: ['timing_onset', 'reproducibility', 'recent_changes'],
      cues: [
        'first time',
        'shared before',
        'done this before',
        'done it before',
        'ever shared',
        'used this before',
        'worked before',
        'sent it before',
        'happened before',
        'sent files before',
      ],
      statementTerse:
        'First time I shared a folder with someone outside. The files are too big to attach.',
      statementSimple:
        'This is the first time I have shared a whole folder with someone outside. Before, I attached small files to an email. These files are too big.',
      missedConsequence:
        'The engineer never learns that this is new for her, so the explanation assumes she knows the sharing choices and she is left unsure what to do the next time.',
      betterQuestion: 'Have you shared a folder this way before, or is this the first time?',
    },
    {
      id: 'hf-owner',
      importance: 'helpful',
      label: 'Her manager owns the folder',
      statement:
        'The folder belongs to our marketing team, and my manager is the owner. I only work in it.',
      revealWhen: 'Asks who owns the folder or who decides who may see the files in it.',
      intents: ['account_details'],
      cues: [
        'who owns',
        'who is the owner',
        'who decides who',
        'whose folder',
        'who manages the folder',
        'who controls',
        'owner',
        'responsible for the folder',
        'who set up the folder',
        'who created the folder',
      ],
      statementTerse: 'My manager owns the folder. I only work in it.',
      statementSimple:
        'The folder belongs to our marketing team. My manager is the owner. I only work in it.',
      missedConsequence:
        'Nobody asks who owns the folder, so a change to who can open it is made or suggested without the person who decides.',
      betterQuestion: 'Who owns the folder, and who decides who may see the files in it?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-link-broken',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement: 'I think something is wrong with the link, or with the folder.',
      truth:
        'Nothing suggests the link or the folder is faulty. In this story the link was made for named people, and the designer opens it with an address that is not one of them.',
    },
  ],

  curveballs: [
    {
      id: 'cb-goes-quiet',
      type: 'go-silent',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: 'Mm. Yes. I see.',
      followUp: 'Sorry. I did not understand the last part. Could you say it in simpler words?',
      expectedResponse:
        'Notice the pause, check gently whether the last point was clear, and say it again in shorter, plainer words without idioms.',
      minDifficulty: 'standard',
      effects: { patience: -2 },
    },
    {
      id: 'cb-today',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: 'Can you promise me it will work for him? I told my manager that it would.',
      followUp: 'So will it work, yes or no?',
      expectedResponse:
        'Do not promise a time. Say in simple words what you will do, who needs to act and when she will next hear from you, and check that she knows what she can tell her manager.',
      minDifficulty: 'standard',
      effects: { temperature: 4, patience: -4 },
    },
  ],
  allowedCurveballs: [
    'go-silent',
    'unsupported-guarantee',
    'ask-manager',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'What the other person sees',
    'How the link was shared',
    'Who else can open it',
    'Who it was shared with',
    'Whether there is a deadline',
    'Who owns the folder',
  ],
  successCriteria: [
    'Greets Mei-Ling warmly, speaks in short, plain sentences with no idioms, and checks that she has understood.',
    'Finds out what the designer sees and whether the link opens for anyone else.',
    'Finds out how the link was shared, who it was made for and which email address was used, without leading her.',
    'Explains what is probably happening in simple words, and does not suggest opening the link to everyone before the owner of the folder has said so.',
    'Agrees who will do what, and when she will hear next, without promising a time for the designer.',
    'Summarises the plan in simple words and checks that she is comfortable with it.',
  ],
  coachingFocus: ['clarity', 'scoping-discovery'],
  careExpectations: {
    communicate: [
      'Uses short sentences and everyday words, and avoids idioms.',
      'Explains a word such as "permission" in a few simple words when she asks, and checks that she has understood.',
    ],
    accountable: [
      'Says clearly what they will do and when she will hear next.',
      'Does not promise when the designer will be able to open the link.',
    ],
    resourceful: [
      'Asks who else can open the link and how it was shared, before suggesting anything.',
      'Finds out who owns the folder, so that any change to who can open the link is agreed with the person who decides.',
    ],
    empathetic: [
      'Recognises that waiting for the designer is stressful, in simple and sincere words.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Using words such as "permissions", "external" or "tenant" without explaining them, or using idioms she may not know.',
    'Telling her to make the link open to everyone without asking why it was set up that way or who owns the folder.',
    'Giving several steps at once, or speaking quickly, without checking that she has followed.',
    'Treating her English as the problem instead of simply using clear words.',
    'Promising that the designer will be able to open the link today.',
  ],
  goodBehaviours: [
    'Asking what the designer sees and whether the link opens for anyone else, in simple words.',
    'Asking how the link was shared and which email address she used, without suggesting the answer.',
    'Explaining a word again more simply when she asks, and checking understanding often.',
    'Asking who owns the folder before suggesting any change to who can open it.',
    'Agreeing a clear next step, an owner and a time for the next contact, then summarising in plain words.',
  ],
  expectedOutcome:
    'Mei-Ling understands in simple words that the link was probably made only for the people she named, and that the designer signs in with a different address. She knows who needs to act, that her manager decides who may see the folder, and when she will hear next. She ends the call calm and clear.',
  evaluatorNotes:
    'Root cause in the story: Mei-Ling shared a folder of new label files with an outside designer by link. Her manager wants the label kept private, so she chose the setting where only the people she names can open it and typed the studio address from an old email. The designer signs in with another address. The link opens for her and her manager. It is her first time sharing a folder outside, and the printer needs the files by Thursday. Nothing is wrong with the folder or the link. A strong call is simple and kind, checks understanding, finds who the link was made for and which address was used, involves the owner of the folder before widening access, and promises no time.',
} satisfies ScenarioInput;

export default scenario;
