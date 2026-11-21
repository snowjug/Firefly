import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario. Everything here is fictional: people, organisation and case number.
//
// Root cause (hidden from the trainee; plausible, and never confirmed on the call): several small
// things rather than one fault. Arjun never shuts the laptop down and keeps postponing the restart
// the update is asking for, he installed a free itinerary planner on the day of the update that
// starts with the laptop, and the main drive is nearly full. He half suspects the update itself.
// A strong call is friendly and structured: it turns "slow" into specifics, finds what else
// changed, does not blame the update early, keeps the chat on track kindly, explains one simple
// next step in plain words and agrees a follow-up time.

const scenario = {
  id: 'windows-11-slow-after-update',
  version: 1,
  title: 'Laptop has felt slow since an update',
  listSummary: 'A travel consultant says his laptop has felt slow since an update a few days ago.',
  summary:
    'A travel consultant says his work laptop has felt slow since an update a few days ago. He is friendly and chatty, which gives the call plenty of detail to sort through. Practise scoping a vague symptom, asking about what changed, and agreeing clear next steps.',
  tags: ['slow laptop', 'update', 'scoping a vague symptom', 'talkative customer'],
  estimatedMinutes: 8,

  product: { id: 'windows-11', area: 'Performance' },
  caseReference: 'SIM-430004',

  issueType: 'slow-performance',
  impact: 'low',
  startingTemperature: 'calm',
  proficiency: 'intermediate',
  style: 'talkative',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Arjun Mehta',
    speaker: 'male',
    role: 'Travel Consultant',
    organisation: "Margie's Travel",
    background:
      'Arjun plans holidays and group trips for clients at a small travel agency. He uses his laptop all day for the booking system, email and itineraries, and he enjoys a chat with a client or a colleague. He knows his way around everyday apps but has never looked after a computer beyond closing the lid at the end of the day.',
    voice:
      'Relaxed and chatty. Enjoys a story, drifts into clients, trips and colleagues, and comes back when gently steered. Comfortable with everyday apps, so he can say what he has tried, but he is not technical. Easy-going and never rude, even when kept waiting.',
  },
  environment: {
    details: [
      'A work laptop running Windows 11 that Arjun uses all day for the booking system, email and itineraries.',
      'He usually closes the lid at the end of the day rather than shutting the laptop down.',
      'The agency is a small team of consultants, each with their own laptop. IT support comes from an outside company.',
      'The laptop is a few years old and holds years of saved itineraries, photos and PDF documents.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Only Arjun notices it, and he can still do all of his work.' },
    medium: {
      count: 3,
      summary:
        'Arjun and two colleagues notice slowness, and bookings take longer than they should.',
    },
    high: {
      count: 6,
      summary: 'All six consultants have slow laptops during the busiest booking week of the year.',
    },
  },
  customerObjective:
    'Get his laptop feeling quick again, and understand whether the update is to blame.',
  customerExpectation:
    'A friendly, clear explanation of what might be going on, something simple he can try himself, and to know what happens if it does not help.',
  desiredOutcome:
    'The engineer scopes the vague symptom with open questions, finds what changed around the update, explains a simple next step in plain words, and agrees a follow-up so he knows what happens if it does not improve.',
  previousTroubleshooting: [
    'He closed some browser tabs and programs, which made no real difference.',
    'He has not shut the laptop down since the update, as far as he remembers.',
    'He asked a colleague, who said it was probably the update.',
  ],
  recentChanges: [
    'The laptop installed an update a few days ago.',
    "He installed a free itinerary planner the same day, on a colleague's recommendation.",
  ],

  publicBrief: {
    issue: 'His laptop has felt slow since an update a few days ago.',
    impact: {
      low: 'Only his laptop feels slow, and he can still do all of his work.',
      medium: 'A few colleagues notice it too, and bookings are taking longer than they should.',
      high: 'Most of the team has slow laptops during a busy booking period.',
    },
    objective:
      'Scope a vague symptom with open questions, then agree clear next steps and a follow-up.',
    knownContext:
      'Arjun is friendly and chatty, and he is comfortable with everyday apps. He will describe the slowness loosely until you ask what exactly is slow.',
    environment:
      'A work laptop running Windows 11, used all day for the booking system and email. You cannot see it in this practice call.',
  },
  brief: {
    situation:
      'A travel consultant is calling because his work laptop has felt slow since an update a few days ago. Nothing is broken, and he is friendly and chatty. He gives lots of detail, not all of it useful.',
    goal: 'Find out what exactly is slow and what changed, keep the call on track kindly, and agree clear next steps and a follow-up.',
    groundRules: [
      'The customer and organisation are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot see his laptop in this practice call, so rely on what Arjun tells you.',
    ],
  },

  openingCore:
    "My laptop's been feeling slow since it had an update, and I wondered if you could help me work out why.",
  impactVariants: {
    low: {
      summary: "It's not stopping me working, it's just a bit annoying.",
      detail:
        "It's only me, as far as I know. I can still do everything, it just takes longer than it used to, so it's more annoying than anything.",
      deadline: 'No rush at all. Any time this week is fine.',
    },
    medium: {
      summary:
        'A couple of my colleagues have slow laptops as well, and bookings are taking longer.',
      detail:
        "Two colleagues have said theirs feels slow as well, so it's three of us. Bookings take longer than they should, and we're busy this week, so clients are noticing the wait.",
      deadline: 'It would help to have it sorted before the weekend rush.',
    },
    high: {
      summary: "The whole team's laptops are slow, and it's our busiest week for bookings.",
      detail:
        "It's all six of us at the shop. The booking system is crawling, clients are standing at the desk waiting, and it's the busiest week of our year.",
      deadline: 'We need it fixed today. Clients are waiting.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I called the other day about my slow laptop, and I wanted to see how things are going.',
      brief: 'Arjun called a few days ago about the same slow laptop and is checking on progress.',
    },
    escalated: {
      opening:
        "This is my second call about my slow laptop. It's still no better, and I was told someone would look into it.",
      brief:
        'Arjun has called before about this. The laptop is no better, and he expected more progress by now.',
    },
    closure: {
      opening:
        "I'm calling about my slow laptop, to see where things stand so we can probably close the case.",
      brief:
        'Arjun expects to confirm the laptop is quicker and to understand what made the difference.',
    },
  },
  priorHistory: [
    {
      when: 'A few days ago',
      summary:
        'Arjun called to say his laptop had felt slow since an update. A case was logged and an automatic acknowledgement was sent.',
    },
    { when: 'Since then', summary: 'No engineer has contacted Arjun.' },
  ],

  knownFacts: [
    {
      id: 'kf-since-update',
      text: "It's been slow since the update went on, which was a few days ago. Before that it seemed fine.",
      intents: ['timing_onset'],
      simple: 'It has been slow since the update, a few days ago. Before that it seemed fine.',
    },
    {
      id: 'kf-laptop-use',
      text: "I use it all day for the booking system, my email and my itineraries. It's the only computer I've got at work.",
      intents: ['environment', 'problem_description'],
      elaboration:
        "I've usually got the booking system open, plus my email and a couple of client documents.",
      simple: 'I use it all day for bookings, email and itineraries. It is my only work computer.',
    },
    {
      id: 'kf-still-works',
      text: "Everything still works, it's just slow. Nothing's crashed, and I haven't seen any errors.",
      intents: ['error_message', 'problem_description'],
      simple: 'Everything works, but it is slow. Nothing crashed. I did not see any errors.',
    },
    {
      id: 'kf-tried',
      text: "I closed a few tabs and programs, but it didn't help much.",
      intents: ['already_tried'],
      simple: 'I closed some tabs and programs. It did not help much.',
    },
    {
      id: 'kf-colleague-view',
      text: "My colleague thinks it's the update, but I don't know. I'm not very technical.",
      intents: ['already_tried'],
    },
    {
      id: 'kf-outcome',
      text: "I'd just like it to feel quick again, like it used to.",
      intents: ['expected_outcome'],
      simple: 'I want it to feel quick again, like before.',
    },
    {
      id: 'kf-laptop-age',
      text: "It's a few years old now. I got it when I joined the agency.",
      intents: ['environment'],
    },
  ],
  vagueFacts: [
    {
      id: 'vf-which-day',
      intents: ['timing_onset'],
      text: "I think the update went on at the end of last week, maybe Thursday? I'd have to look at my calendar.",
      confirmedText:
        'My calendar says I had a client call on Friday and it was slow then, so the update must have been Thursday.',
    },
    {
      id: 'vf-how-much-slower',
      intents: ['problem_description', 'reproducibility'],
      cues: [
        'how much slower',
        'how slow',
        'how long does it take',
        'how long it takes',
        'compared to before',
      ],
      text: "It's hard to say how much slower. Maybe twice as slow? I haven't timed it.",
      confirmedText:
        "If I think about it, the booking system used to open in a few seconds, and now it's more like half a minute.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-specs',
      intents: ['environment'],
      cues: [
        'memory',
        'processor',
        'specs',
        'specification',
        'how powerful',
        'how much memory',
        'what model',
        'which model',
        'make and model',
      ],
      text: "I don't know the make or the model, or what's inside it. I just use it.",
      whoKnows: 'our outside IT support',
    },
    {
      id: 'uf-update-name',
      intents: ['recent_changes'],
      cues: [
        'which update',
        'what update',
        'update name',
        'update called',
        'what was the update',
        'what version',
        'which version',
      ],
      text: "I don't know what the update was called. It just said something about Windows when it went on.",
      whoKnows: 'our outside IT support',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-honeymoon',
      text: "I'm planning a honeymoon in Italy for a lovely couple this week, which is the nicest part of the job.",
    },
    {
      id: 'if-marta-laptop',
      text: 'Marta just got a brand new laptop, and she keeps showing it off.',
    },
    {
      id: 'if-coffee-machine',
      text: "Our coffee machine's been broken all week, so nobody is at their best.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-restart-nag',
      importance: 'critical',
      label: 'Never shuts down, keeps postponing the restart',
      statement:
        'I never actually shut it down, I just close the lid at night. A message kept popping up asking me to restart to finish the update, and I kept choosing later.',
      revealWhen:
        'Asks when the laptop was last restarted or shut down, or whether it shows any message about the update.',
      intents: ['recent_changes', 'reproducibility', 'error_message'],
      cues: [
        'restart',
        'reboot',
        'shut down',
        'shutdown',
        'shut it down',
        'turn it off',
        'turned off',
        'switch it off',
        'switched off',
        'finish the update',
        'any message',
        'message about the update',
      ],
      hint: 'I do keep getting a message about the update, actually.',
      statementTerse:
        'I never shut it down. A message kept asking me to restart, and I kept saying later.',
      statementSimple:
        'I do not shut the laptop down. I close the lid. A message kept asking me to restart to finish the update. I kept choosing later.',
      missedConsequence:
        'The most likely contributor goes unnoticed, so the call ends with vague advice and Arjun still has a pending restart he does not know matters.',
      betterQuestion:
        'When did you last restart or shut the laptop down, and is it showing any message about the update?',
    },
    {
      id: 'hf-what-is-slow',
      importance: 'important',
      label: 'What is slowest, and when',
      // Once the laptop is quicker again (a closure call) this is no longer how it behaves.
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        "It's slowest first thing when I switch on, and when I open the booking system with a few tabs. Typing an email is fine.",
      byImpact: {
        medium: {
          statement:
            'It drags first thing when I switch on, and the booking system takes ages to open, even with only a few tabs. Typing an email is fine, but most other things lag a bit.',
          statementTerse:
            'Slow when I switch on, and the booking system takes ages to open. Typing is fine, the rest lags.',
          statementSimple:
            'It is slow when I switch the laptop on. The booking system takes a long time to open, even with a few tabs. Typing is fine. Other things are a little slow.',
        },
        high: {
          statement:
            "It's slow all day now, not just when I switch on. The booking system crawls every time I open it, and even switching between tabs lags.",
          statementTerse:
            'Slow all day now, not just at start. The booking system crawls, and switching tabs lags.',
          statementSimple:
            'It is slow all day now, not only when I switch on. The booking system is very slow to open. Switching between tabs is slow too.',
        },
      },
      revealWhen:
        'Asks what exactly is slow, when it is at its worst, or whether it happens all the time or only with certain programs.',
      intents: ['problem_description', 'reproducibility'],
      cues: [
        'what exactly',
        'what is slow',
        "what's slow",
        'what feels slow',
        'which program',
        'which app',
        'every program',
        'when does it',
        'when is it slow',
        'slowest',
        'at its worst',
        'every time',
      ],
      hint: 'Some things are slower than others, if that helps.',
      statementTerse:
        'Slowest when I switch on, and when I open the booking system with a few tabs. Typing is fine.',
      statementSimple:
        'It is slowest when I switch the laptop on. It is also slow when I open the booking system with a few tabs. Typing is fine.',
      missedConsequence:
        "'Slow' stays unscoped, so any advice is a guess, and the follow-up cannot say whether anything improved.",
      betterQuestion: 'What exactly feels slow, and when is it at its worst?',
    },
    {
      id: 'hf-new-planner-app',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Installed a planner app the same day',
      statement:
        'The same day as the update, I installed a free itinerary planner that my colleague Isla recommended. It opens by itself when I switch on and sits in the corner.',
      revealWhen:
        'Asks whether anything else changed around the same time, such as something new installed or downloaded.',
      intents: ['recent_changes'],
      cues: [
        'install',
        'installed',
        'new app',
        'new program',
        'new software',
        'anything new',
        'anything change',
        'download',
        'downloaded',
        'added',
        'same day',
        'recommended',
      ],
      hint: 'I did add something new around then, if that matters.',
      statementTerse:
        'I installed a free itinerary planner the same day as the update. It opens by itself at start.',
      statementSimple:
        'On the same day as the update, I installed a free itinerary planner. My colleague Isla told me about it. It opens by itself when I switch on.',
      missedConsequence:
        'Something new that starts with the laptop is never found, so the update takes all the blame and the advice stays thin.',
      betterQuestion:
        'Did anything else change around the same time, such as an app you installed or downloaded?',
    },
    {
      id: 'hf-storage-nearly-full',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'The main drive looks nearly full',
      statement:
        "The storage bar for the main drive looks nearly full. I've got years of itineraries, photos and PDFs on there.",
      revealWhen:
        'Asks how much storage or free space the laptop has left, or what is saved on it.',
      intents: ['environment'],
      cues: [
        'storage',
        'disk space',
        'free space',
        'space left',
        'how full',
        'hard drive',
        'main drive',
        'drive is full',
        'running out of space',
        'saved on it',
        'what is on it',
        'files on it',
      ],
      knowledge: 'after-checking',
      checking: "Give me a second, I'll open it up and look.",
      statementTerse: 'The main drive looks nearly full. Years of itineraries, photos and PDFs.',
      statementSimple:
        'The storage bar for the main drive is almost full. I have years of itineraries, photos and PDFs on it.',
      missedConsequence:
        'Something that might be contributing is never checked, so the advice stays thin.',
      betterQuestion: 'How much free storage is left on the laptop?',
    },
    {
      id: 'hf-slow-before-too',
      importance: 'helpful',
      minDifficulty: 'challenge',
      label: 'It was a little sluggish before the update too',
      statement:
        "Now I think about it, it was a bit sluggish in the afternoons before the update too. It just wasn't this bad.",
      revealWhen:
        'Asks whether the laptop was ever slow before the update, or how it compares with how it behaved earlier.',
      intents: ['timing_onset', 'reproducibility'],
      cues: [
        'before the update',
        'was it slow before',
        'ever slow',
        'used to be',
        'compared to before',
        'always been slow',
        'before that',
        'in the past',
      ],
      statementTerse:
        'It was a bit sluggish in the afternoons before the update too. Not this bad.',
      statementSimple:
        'It was a little slow in the afternoons before the update too. It was not as bad as now.',
      missedConsequence:
        'The update takes all the blame, and the engineer never learns that the laptop was already struggling before it.',
      betterQuestion: 'Was the laptop ever slow before the update, even a little?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-update-is-to-blame',
      statement: 'My colleague says the update broke it, so I should just uninstall the update.',
      truth:
        'Nothing is confirmed. The slowness started around the update, but other things changed too, so the engineer should find out what else changed before agreeing with or ruling out the update.',
    },
  ],

  curveballs: [
    {
      id: 'cb-second-problem',
      type: 'change-issue',
      trigger: { earliestTurn: 4, latestTurn: 8 },
      statement:
        "Oh, and while I've got you, the fan's been really loud lately, and the battery doesn't last like it used to. Is that the same thing?",
      followUp: "Sorry, I know I'm going on. Should I mention the battery as well?",
      introducesFacts: [
        {
          id: 'kf-fan-and-battery',
          text: "The fan runs loud and the battery drains faster than before, but I haven't timed either.",
          intents: ['problem_description', 'reproducibility'],
        },
      ],
      expectedResponse:
        'Acknowledge the new detail without dropping the first problem. Note it, ask a short question or two to see whether it is related, and agree what will be handled in this case and what will be logged separately, so nothing is lost.',
      minDifficulty: 'standard',
    },
    {
      id: 'cb-reinstall-memory',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 5, latestTurn: 9, whenOwnershipUnclear: true },
      statement:
        "The last time I rang about a laptop, they had me reinstall everything and I lost my bookmarks. I'd rather not go through that again.",
      followUp: "So you're not going to ask me to wipe anything, are you?",
      expectedResponse:
        'Acknowledge the earlier experience without defending anyone. Do not promise that nothing will be needed; say what you would try first, that you will explain it before he does anything, and that you will check in afterwards.',
      minDifficulty: 'challenge',
    },
  ],
  allowedCurveballs: ['change-issue', 'previous-bad-experience'],

  expectedDiscoveryAreas: [
    'What exactly feels slow',
    'When it started',
    'Anything that changed around the update',
    'When it was last restarted',
    'What has already been tried',
    'How much it affects his work',
  ],
  successCriteria: [
    'Greets Arjun, introduces themselves and lets him settle in before asking questions.',
    "Turns 'slow' into something specific: what is slow, when, and since when.",
    'Finds what changed around the update and when the laptop was last restarted.',
    'Keeps a chatty call on track kindly, picking up useful details without cutting him off.',
    'Explains next steps in plain words and agrees what happens if it does not improve, with a time to follow up.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity', 'closing'],
  careExpectations: {
    communicate: [
      "Asks open questions first, then narrow ones, so 'slow' becomes specific, and sums up what they have heard.",
      'Explains any suggestion in plain words and checks he is comfortable before he does anything.',
    ],
    accountable: [
      'Says what they will do, what Arjun will do and when they will follow up, so he knows what happens if it does not improve.',
    ],
    resourceful: [
      'Looks for what changed around the update, including anything he installed or did differently, rather than assuming the update is to blame.',
    ],
    empathetic: [
      'Welcomes his chat, keeps a friendly tone, and steers back kindly without cutting him off.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Blaming the update straight away, or telling him to uninstall it, before finding out what else changed.',
    'Suggesting a reinstall or a reset as the first step.',
    'Cutting off his stories sharply, or letting the call drift without steering it back.',
    'Giving a list of tips without checking what is actually slow.',
    'Ending the call without saying what happens next or when he will hear back.',
  ],
  goodBehaviours: [
    'Asking what exactly feels slow, and when it is at its worst.',
    'Asking what else changed around the update, such as anything he installed.',
    'Asking when the laptop was last restarted and whether it shows any message about the update.',
    'Picking out the useful detail from his stories and thanking him for it.',
    'Agreeing a simple first step, explaining it in plain words, and offering a time to follow up.',
  ],
  expectedOutcome:
    'Arjun leaves with a clear picture of what feels slow, what might have changed around the update, and a simple first step explained in plain words. The engineer agrees a time to check in, and he knows what happens if it does not improve.',
  evaluatorNotes:
    "Root cause (plausible, not confirmed on the call): several small things rather than one fault. Arjun never shuts the laptop down and keeps postponing a restart that the update is asking for, installed a free itinerary planner on the day of the update that starts with the laptop, and has a nearly full main drive. A strong call is friendly and structured: it turns 'slow' into specifics, finds what else changed, does not blame the update early, keeps the chat on track kindly, explains one simple next step in plain words and agrees a follow-up time.",
} satisfies ScenarioInput;

export default scenario;
