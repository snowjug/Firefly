import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario (closure call). Everything here is fictional: people, organisation and case.
// Outlook is a real product, so the scenario describes only what the customer sees and was told,
// never how delegate access works.
//
// Story (hidden from the trainee; plausible, never confirmed on the call): Leona looks after the
// calendars of two directors, Saskia and Obinna. Last week she could not add or change meetings in
// either of them, but she reported only Saskia's, the one that matters most. On an engineer's advice
// Saskia set up Leona's access again and Leona restarted Outlook. Saskia's calendar now works: Leona
// added one test meeting and took it out again. She has not tried Obinna's calendar, which had the
// same trouble and was never part of the fix, and she has checked nothing else. Since the fix,
// meeting invitations for Saskia reach Saskia's own inbox and no longer reach Leona. The trouble
// happened once before, in the summer, and sorted itself out after a few days. Obinna flies out on a
// Wednesday evening, and she needs his diary right before then. If it came back she would not know
// whether to ring support or her own IT desk. This is a plausible story for the case, not a claim about
// how the product works. The facts that depend on the impact level (hf-travel) carry byImpact
// wordings for low and high, matching affectedUsers and impactVariants. Facts that only make sense
// after the fix (what she tested, the invitations, who to ring, the calendar she has not tried) are
// limited to the call-back stages; the second calendar and the earlier episode are told in words that
// hold at any stage.
//
// A strong call does not close on "it seems fine". It asks how she knows and what exactly she tried,
// which of the calendars she looks after she has checked, whether anything else has changed since,
// whether it has happened before and what she would do if it came back. It finds the untested
// calendar and the changed invitations, does not promise that it will never return, gives a clear
// route back and checks that she is happy to close.

const scenario = {
  id: 'outlook-delegate-calendar-closure',
  version: 1,
  title: 'Closing a case on a calendar she could not edit',
  shortTitle: 'Calendar she could not edit',
  listSummary:
    "An executive assistant calls to confirm she can edit her director's calendar again before the case closes.",
  summary:
    "Leona Whitcombe is an executive assistant at Contoso. She could not edit a director's calendar in Outlook, and it seems to work again. She has called to confirm it before the case is closed. Expect a warm, thorough customer who likes to give background.",
  tags: ['closure', 'calendar', 'delegate', 'confirming a fix', 'talkative customer'],
  estimatedMinutes: 10,

  product: { id: 'outlook', area: 'Calendar and delegates' },
  caseReference: 'SIM-410204',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-support', 'microsoft-learn'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    revisedOn: '2026-11-22',
    review: 'assistant-reviewed',
    notes:
      "Re-read current public pages on delegates, permission levels, who receives meeting requests and delegate troubleshooting. The story is the scenario's own; the earlier fix was not checked. Stage-limited post-fix facts and lines. AI-assisted review, not a mentor's.",
  },
  issueType: 'feature-not-working',
  impact: 'medium',
  startingTemperature: 'calm',
  proficiency: 'intermediate',
  style: 'talkative',
  callStage: 'closure',
  difficulty: 'standard',

  persona: {
    name: 'Leona Whitcombe',
    speaker: 'female',
    role: 'Executive Assistant',
    organisation: 'Contoso',
    background:
      'Leona is an executive assistant at a large company, and she keeps diaries, travel and meetings in order for its leadership team. She is organised, uses Outlook all day and knows it well from daily use. She likes to give the full picture, and she dislikes loose ends.',
    voice:
      "Warm, thorough and organised. Gives the full picture before the point, and likes to confirm things in order. Speaks in complete, tidy sentences, with the occasional 'sorry, let me start again'. Friendly throughout, and relaxes when the engineer is just as methodical.",
  },
  environment: {
    details: [
      'Leona uses Outlook on a company laptop all day, for her own mail and calendar and for her work for the leadership team.',
      'She books and changes meetings on behalf of the leadership team she supports, and sends a summary of the next day every evening.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Leona, whose directors rely on her to keep their diaries right.' },
    medium: { count: 3, summary: 'Leona and the two directors whose calendars she manages.' },
    high: {
      count: 5,
      summary: 'Leona, two directors and two deputies, who all depend on the diaries.',
    },
  },
  customerObjective:
    "Be sure she can manage her director's calendar properly again, and have the case closed with confidence.",
  customerExpectation:
    'A clear confirmation that it works, a short explanation she can follow of what was done, a chance to raise anything still on her mind, and a warm, tidy close.',
  desiredOutcome:
    'Leona confirms what she has checked, understands what was done in plain words, knows what to do if the problem returns, and agrees that the case can be closed.',
  previousTroubleshooting: [
    'Leona closed and reopened Outlook, and restarted her laptop. It made no difference.',
  ],
  recentChanges: [],

  publicBrief: {
    issue: "Leona could not add or change meetings in a director's calendar in Outlook.",
    impact: {
      low: 'Only Leona was affected, and she is in no hurry to close the case.',
      medium: 'A busy week of meetings depends on her calendar work, so she wants to be sure.',
      high: 'A board week depends on her calendar work, so closing too early could be costly.',
    },
    objective:
      'Confirm it is resolved, explain what was done, check for loose ends, and close warmly.',
    knownContext:
      'Leona is an executive assistant who likes things done properly. She is warm and thorough, and gives plenty of background.',
    previousContact:
      'Leona called last week. An engineer helped her over the phone and it seems fine now. The case stays open until she confirms.',
    environment:
      'Outlook on a company laptop, used all day for her own calendar and for the calendar she looks after. You cannot see it in this practice call.',
  },
  brief: {
    situation:
      "An executive assistant is calling back about a case on a director's calendar that she could not edit. It seems to work again, and she wants to confirm before the case is closed.",
    goal: 'Confirm the problem is really resolved, explain what was done in plain words, check for loose ends and close the case warmly.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot see her calendars in this practice call, so rely on what she tells you.',
    ],
  },

  openingCore:
    "I've been having trouble adding and changing meetings in my director's calendar in Outlook.",
  impactVariants: {
    low: {
      summary: "It's only my own work that's affected, but it's still a nuisance.",
      detail:
        "It's only me who's affected, and I can work around most things. I'd just like to know it's properly sorted.",
      deadline: "There's no rush, but I'd like it settled this week.",
    },
    medium: {
      summary: "I've got a busy week of meetings to book, so I need to be able to rely on it.",
      detail:
        "My director's whole week depends on it, and I'd hate to find a problem on Monday. I'd like to be certain it's right.",
      deadline: "I'd like to know today, because next week's diary needs finalising.",
    },
    high: {
      summary:
        "It's board week, and the diary has to be exactly right, so I need to be able to rely on it.",
      detail:
        "The board meets on Thursday, and my director's diary is packed with preparation. If something goes wrong with the calendar, it's very visible.",
      deadline: 'I need to be sure by tomorrow morning.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on my case about not being able to edit my director's calendar. I haven't had an update since the engineer's call.",
      brief:
        "Leona called about a director's calendar that she could not edit. An engineer helped, and she is waiting to hear what happens next.",
    },
    escalated: {
      opening:
        "This is my second call about my director's calendar, and it still isn't right. I'd like someone to take charge of it.",
      brief:
        'Leona has called twice about the calendar, and it is still not right. She is polite but wants it owned.',
    },
    closure: {
      opening:
        "I'm calling about the case on my director's calendar. It seems to be working again, so I wanted to confirm everything before you close it.",
      brief:
        'Leona expects to confirm that the calendar works, to understand what was done and to know what to do if it returns, before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Last week',
      summary:
        "Leona reported that she could not add or change meetings in a director's calendar. A case was logged.",
    },
    {
      when: 'Last week',
      summary:
        'An engineer asked the director to check how Leona was set up on the calendar. The director did, and Leona restarted Outlook.',
    },
    {
      when: 'Since then',
      summary: 'Leona asked for a call to confirm it is working before the case is closed.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: "I couldn't add or change anything in my director's calendar. I could see it, but I couldn't edit it.",
      intents: ['problem_description', 'error_message'],
      elaboration:
        "I'd open it and everything was there, but the moment I tried to add a meeting it told me I didn't have permission.",
      simple:
        "I could not add or change anything in my director's calendar. I could see it, but I could not edit it.",
    },
    {
      id: 'kf-works-now',
      text: 'It seems to be working now.',
      intents: ['problem_description', 'reproducibility'],
      stages: ['closure'],
      simple: 'It seems to be working now.',
    },
    {
      id: 'kf-rang-before',
      text: 'I rang last week, and an engineer talked me through what to ask my director to do.',
      intents: ['previous_contact'],
      stages: ['follow-up', 'escalated', 'closure'],
      simple: 'I called last week. An engineer told me what to ask my director to do.',
    },
    {
      id: 'kf-uses-outlook',
      text: "I use Outlook on my laptop all day, for my own diary and for my director's.",
      intents: ['environment'],
      simple: "I use Outlook on my laptop all day, for my own diary and for my director's.",
    },
    {
      id: 'kf-outcome',
      text: "I want to be sure it's all working properly, and I'd like to understand what happened.",
      intents: ['expected_outcome'],
      simple: 'I want to be sure it is all working properly. I want to understand what happened.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-what-was-done',
      intents: ['previous_contact', 'already_tried', 'recent_changes'],
      cues: [
        'what was done',
        'what did the engineer',
        'what did you do',
        'what did your director',
        'what happened last',
        'the steps',
        'talked you through',
        'walked you through',
        'what was the fix',
        'how was it fixed',
      ],
      stages: ['follow-up', 'escalated', 'closure'],
      text: "My director had to do something with how I'm listed on the calendar, I think. I'd have to check my notes.",
      confirmedText:
        'My notes say she removed me and added me again as a delegate, and then I restarted Outlook.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-notes',
      intents: ['previous_contact', 'already_tried'],
      cues: [
        'notes',
        'written down',
        'wrote down',
        'case number',
        'what you were told',
        'advice',
        'any email from',
      ],
      stages: ['follow-up', 'escalated', 'closure'],
      checking: "Hold on, I've got my notes from the call.",
      text: 'I wrote down the case number, and that Saskia had to do something on her side.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-what-changed',
      intents: ['recent_changes'],
      cues: [
        'what exactly changed',
        'what was changed',
        'what did the engineer change',
        'behind the scenes',
        'on the system',
        'on the server',
      ],
      stages: ['follow-up', 'escalated', 'closure'],
      text: "I don't know exactly what was changed on the system side. Saskia just said she'd done what she was asked.",
      whoKnows: 'the engineer who helped',
    },
    {
      id: 'uf-why-it-happened',
      intents: ['problem_description', 'recent_changes'],
      cues: ['why did', 'what caused', 'the cause', 'the reason', 'root cause'],
      text: "I couldn't tell you why it stopped. Nobody's said.",
      whoKnows: 'the engineer who helped',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-office-move',
      text: "We're moving the executive floor next month, so everything's in boxes at the moment.",
    },
    {
      id: 'if-plant',
      text: 'The plant on my desk finally flowered this week, which is the highlight of my month.',
    },
    {
      id: 'if-expenses',
      text: 'Travel expense claims are my least favourite part of the job.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-second-calendar',
      importance: 'critical',
      label: 'A second calendar was left out',
      statement:
        "I look after Obinna's calendar as well. It was the same for his, but I only mentioned Saskia's, because it matters most. So nobody's looked at his.",
      partialStatement: "There's one more thing, but I'm not sure it matters.",
      revealWhen:
        'Asks which calendars she looks after, or whether she has checked every calendar that was affected, not only the one in the case.',
      intents: ['affected_scope', 'reproducibility', 'already_tried'],
      partialIntents: ['problem_description'],
      cues: [
        'other calendar',
        'another calendar',
        'second calendar',
        'every calendar',
        'all of the calendars',
        'which calendars',
        'how many calendars',
        'else you look after',
        'else you manage',
        'other director',
        'both calendars',
        'both directors',
      ],
      hint: "I've only really mentioned the one so far.",
      statementTerse: "I look after Obinna's calendar too. Same trouble. Nobody's looked at his.",
      statementSimple:
        "I also look after Obinna's calendar. It had the same problem. I only told you about Saskia's calendar, because it matters most. Nobody has looked at his.",
      missedConsequence:
        'The second calendar is left out, so the plan covers one diary and the same trouble is still there on the other when she needs it.',
      betterQuestion: 'Which calendars do you look after, and have you checked all of them?',
    },
    {
      id: 'hf-how-checked',
      importance: 'important',
      label: 'Tested with a single meeting',
      stages: ['follow-up', 'escalated', 'closure'],
      statement:
        "I added one test meeting to Saskia's calendar and took it out again. That's all I've done so far.",
      revealWhen:
        'Asks how she knows it works, what exactly she checked, or what she tried after the fix.',
      intents: ['reproducibility', 'already_tried'],
      cues: [
        'how do you know',
        'how did you check',
        'how have you checked',
        'how did you test',
        'have you checked',
        'have you tested',
        'what did you test',
        'what have you tested',
        'what have you checked',
        'what did you try',
        'what exactly did you',
        'what exactly have you',
      ],
      statementTerse: "One test meeting in Saskia's calendar. Then I deleted it.",
      statementSimple:
        "I added one test meeting to Saskia's calendar and took it out again. That is all I have done so far.",
      missedConsequence:
        'The engineer accepts "it seems fine" without learning that one test meeting is all it rests on, so the case closes on a thin check.',
      betterQuestion: 'How have you checked that it works now, and what exactly did you try?',
    },
    {
      id: 'hf-invitations-changed',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Meeting invitations stopped reaching her',
      stages: ['follow-up', 'escalated', 'closure'],
      statement:
        'Since Monday, meeting invitations for Saskia go to her own inbox and not to mine. I used to get them too, so I could respond for her. I only noticed yesterday.',
      revealWhen:
        'Asks whether anything else has changed or behaved differently since it was fixed, for example in what she receives.',
      intents: ['recent_changes', 'problem_description'],
      cues: [
        'anything different',
        'anything changed',
        'changed since',
        'else changed',
        'behaved differently',
        'behaving differently',
        'invitation',
        'invite',
        'meeting request',
        'side effect',
        'anything odd',
        'anything unusual',
      ],
      statementTerse:
        "Since Monday, Saskia's invitations don't reach me. They go to her inbox only.",
      statementSimple:
        'Since Monday, meeting invitations for Saskia go to her own inbox and not to mine. I used to get them too, so I could answer for her. I only noticed yesterday.',
      missedConsequence:
        'A side effect of the fix goes unnoticed, so the case closes while invitations for her director keep bypassing her.',
      betterQuestion:
        'Since it started working again, has anything else changed or behaved differently for you?',
    },
    {
      id: 'hf-happened-before',
      importance: 'important',
      label: 'It did this once before in the summer',
      statement:
        "It did this once before, in the summer, and sorted itself out after a few days. I don't know if that's relevant.",
      revealWhen: 'Asks whether this has happened before, and what happened then.',
      intents: ['reproducibility', 'timing_onset'],
      cues: [
        'happened before',
        'has this happened',
        'first time this',
        'ever had this',
        'recur',
        'previously',
        'in the past',
        'ever done this',
        'done this before',
        'once before',
        'ever happened',
        'come back before',
      ],
      hint: "I've seen something like this before, now I think about it.",
      statementTerse: 'It did it once before, in the summer. It came right by itself.',
      statementSimple:
        'It did this once before, in the summer. It got better by itself after a few days. I do not know if that matters.',
      missedConsequence:
        'The earlier episode is missed, so the engineer treats it as new, or promises more than anyone can know, and she is left unsure whether it will return.',
      betterQuestion: 'Has this happened before, and what happened then?',
    },
    {
      id: 'hf-who-to-call',
      importance: 'helpful',
      label: 'Unsure who to ring if it returns',
      stages: ['follow-up', 'escalated', 'closure'],
      statement:
        "If it comes back, I honestly wouldn't know whether to ring you or our own IT desk.",
      revealWhen:
        'Asks what she would do if the problem came back, or whether she knows who to contact.',
      intents: ['expected_outcome', 'previous_contact'],
      cues: [
        'if it comes back',
        'if it happens again',
        'if it returns',
        'if it recurs',
        'who would you call',
        'who would you ring',
        'who would you contact',
        'who to contact',
        'who to call',
        'what would you do if',
        'would you know who',
        'who should you',
      ],
      statementTerse: "If it comes back, I wouldn't know who to ring.",
      statementSimple: 'If it comes back, I do not know if I should call you or our own IT desk.',
      missedConsequence:
        'She leaves without a clear route back, so a repeat becomes a new complaint and she has to work out who to call.',
      betterQuestion: 'If it came back, would you know who to contact, and what to have ready?',
    },
    {
      id: 'hf-travel',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Obinna flies out on Wednesday evening',
      statement:
        'Obinna flies out on Wednesday evening for a week, so I need to rearrange his meetings before he goes.',
      byImpact: {
        low: {
          statement:
            "Obinna's away for a week from Wednesday evening, but his diary is fairly quiet, so there's no real rush.",
          statementTerse: "Obinna's away from Wednesday evening. His diary is quiet.",
          statementSimple:
            'Obinna is away for a week from Wednesday evening. His diary is quiet, so there is no real rush.',
        },
        high: {
          statement:
            'Obinna flies out on Wednesday evening, the day before the board meets, so I need his meetings in order before he goes.',
          statementTerse: 'Obinna flies out Wednesday evening. The board meets the day after.',
          statementSimple:
            'Obinna flies out on Wednesday evening, the day before the board meets. I must put his meetings in order before he goes.',
        },
      },
      revealWhen:
        'Asks whether anything is coming up soon that depends on the calendars working, or how urgent it is.',
      intents: ['urgency_deadline', 'business_impact'],
      cues: [
        'deadline',
        'coming up',
        'travel',
        'how urgent',
        'depends on',
        'anything happening',
        'week ahead',
        'time pressure',
        'in the diary',
        'any rush',
        'is anyone away',
        'by when',
      ],
      statementTerse: 'Obinna flies out Wednesday evening. I need his diary right before then.',
      statementSimple:
        'Obinna flies out on Wednesday evening for one week. I must change his meetings before he goes.',
      missedConsequence:
        'The one real time limit is missed, so the untested calendar waits until after he has gone.',
      betterQuestion:
        'Is there anything in the diary over the next few days that depends on these calendars working?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-glitch',
      stages: ['follow-up', 'escalated', 'closure'],
      statement: 'I think it was probably just a glitch on my laptop that needed a restart.',
      truth:
        "Nothing suggests her laptop was at fault. In this story the trouble was with how she was set up on the director's calendar, which her director put right.",
    },
  ],

  curveballs: [
    {
      id: 'cb-reminders-stopped',
      type: 'change-issue',
      trigger: { earliestTurn: 5, latestTurn: 10 },
      statement:
        "While I've got you, there's one more thing. The reminders for Saskia's meetings haven't been popping up on my screen this week. Is that connected?",
      followUp: "I don't want to leave it, because I rely on those reminders.",
      introducesFacts: [
        {
          id: 'kf-reminders',
          text: "The reminders used to pop up on my screen a few minutes before each of her meetings. This week there's been nothing.",
          intents: ['problem_description', 'affected_scope'],
          simple:
            'The reminders used to appear on my screen before each of her meetings. This week there has been nothing.',
        },
      ],
      expectedResponse:
        'Acknowledge it without dismissing it, ask what she sees, and say honestly whether it looks related. Agree how it will be handled, for example by keeping the case open or logging it separately, and do not close the case while a second problem is unclear.',
      minDifficulty: 'standard',
      effects: { temperature: 3, patience: -3 },
    },
    {
      id: 'cb-needs-it-today',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 10, afterFact: 'hf-second-calendar' },
      statement:
        "I'd really like this settled today, to be honest. His week is full, and I'd rather not find out on the day that I can't edit it.",
      followUp: "Could someone check it with me today, while I'm here?",
      expectedResponse:
        'Acknowledge the urgency, be honest about what can be checked today and by whom, and do not promise a fix. Offer to check what she has not yet tried with her on the call, or agree a specific time for the next update, and keep the case open until it is confirmed.',
      minDifficulty: 'standard',
      effects: { temperature: 4, patience: -4 },
    },
  ],
  allowedCurveballs: [
    'change-issue',
    'deadline',
    'unsupported-guarantee',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'How she knows it works now',
    'What exactly she has tested',
    'Anything that changed since the fix',
    'Whether it has happened before',
    'What she would do if it came back',
    'What is coming up that depends on it',
  ],
  successCriteria: [
    'Greets Leona warmly, confirms why she called and what she hopes to get from the call.',
    'Confirms that it really works by asking how she knows and what exactly she tried, not by accepting "it seems fine".',
    'Finds that one calendar has not been tried, and checks it with her before closing, or agrees a time to do so.',
    'Asks whether anything else has changed since the fix, and notes what she reports.',
    'Explains in plain words what was done, without blame, and does not promise that it will never return.',
    'Gives a clear route back if it returns, summarises, and checks that she is happy for the case to close.',
  ],
  coachingFocus: ['closing', 'scoping-discovery', 'clarity'],
  careExpectations: {
    communicate: [
      'Says in plain words what was done and what is still open, and keeps the summary to a few sentences.',
      'Gives her the route back in one clear line: who to contact, the case reference and what to note.',
    ],
    accountable: [
      'Does not close the case until she has said what she has actually checked and nothing is left open.',
      'Says what will be recorded on the case, and does not promise that the problem will never return.',
    ],
    resourceful: [
      'Asks how she knows it works, and which of the calendars she looks after she has tried, and offers to check the rest with her on the call.',
      'Asks whether anything else has changed since the fix, so that a side effect does not close with the case.',
    ],
    empathetic: [
      'Recognises that she wants to be thorough, and does not rush her or hurry her stories.',
      'Acknowledges the worry about a repeat, and answers in her own warm, methodical style.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Closing the case as soon as she says it seems to work, without asking what she has actually tested.',
    'Explaining with technical terms about permissions, or implying that she or her director did something wrong.',
    'Promising that it will never come back, or that nothing else can be affected.',
    'Rushing a talkative customer, so that she stops mentioning what is still on her mind.',
    'Listing what to do if it returns, without saying who to contact or what to have ready.',
  ],
  goodBehaviours: [
    'Confirming why she called and what she hopes to get from the call.',
    'Asking how she has checked that it works, and what exactly she tried.',
    'Asking whether anything else has changed since it was fixed.',
    'Asking what she would do if it came back, and giving a clear route.',
    'Asking whether anything is coming up that depends on it.',
    'Summarising, and checking that she is happy for the case to close.',
  ],
  expectedOutcome:
    'Leona has confirmed what she has checked, has found that one calendar is still untested, and has either checked it with the engineer or agreed a clear next step and time. She understands in plain words what was done, knows who to contact if the problem returns, and agrees whether the case can be closed.',
  evaluatorNotes:
    "Closure call. Story (a plausible possibility, not confirmed on the call): Leona manages two directors' calendars. Saskia's was put right after Saskia set up Leona's access again, and Leona tested it with one meeting. Obinna's had the same trouble, but she mentioned only Saskia's and has not tried his. Since the fix, invitations for Saskia no longer reach Leona. A strong call does not close on \"it seems fine\": it asks how she knows, finds the second calendar and the changed invitations, avoids promising it will not return, gives a route back and checks she is happy to close.",
} satisfies ScenarioInput;

export default scenario;
