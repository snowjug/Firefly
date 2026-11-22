import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario. Everything here is fictional: people, organisation and case. Windows 11 is a
// real product, so the scenario describes only what the customer sees and was told, never how
// Windows manages a Wi-Fi connection.
//
// Story (hidden from the trainee; plausible, and never confirmed on the call): Matthias's new work
// laptop loses its Wi-Fi a few times a day, mostly when he opens the lid after it has been asleep
// between calls, and a little more when it runs on the battery. It only happens at home. At the
// office he is on a cable, and at home his phone and his partner's laptop are fine on the same
// Wi-Fi, and his old laptop never did this. When it drops, the work VPN drops with it, so he
// restarts the whole laptop to get everything back, which is why that is all he has tried. Other
// staff who were given the same laptop may be affected (the colleagues fact carries byImpact
// wordings: nobody else at low, two others at medium, about half the team at high, matching
// affectedUsers). The cause could lie in how the laptop saves power or in its network driver, but
// nothing here confirms it, and his home router is probably not the problem, which he suspects.
//
// Matthias is frustrated, terse and not technical about networks. A strong call asks short questions
// and says briefly why they matter, scopes when, where and on what without leading him, finds that
// it follows the laptop and not the network, does not blame his home Wi-Fi or promise a fix, and
// agrees a next step and a time for the next update.

const scenario = {
  id: 'windows-wifi-keeps-dropping',
  version: 1,
  title: 'Windows 11 laptop keeps dropping its Wi-Fi connection',
  shortTitle: 'Wi-Fi keeps dropping',
  listSummary:
    "An account executive's Windows 11 laptop keeps dropping its Wi-Fi, and he has been restarting it.",
  summary:
    'Matthias Obermeyer is an account executive at Proseware. The Wi-Fi on his Windows 11 laptop keeps dropping during client calls, and he has just been restarting it. He is short on patience. Find out when and where it happens without leading him, and agree what happens next.',
  tags: ['wi-fi', 'windows 11', 'intermittent', 'terse customer', 'scoping'],
  estimatedMinutes: 9,

  product: { id: 'windows-11', area: 'Networking' },
  caseReference: 'SIM-410503',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-22',
    productFamily: 'windows',
    sourceCategories: ['microsoft-learn', 'microsoft-support'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    revisedOn: '2026-11-22',
    review: 'assistant-reviewed',
    notes:
      "Re-read the current Learn and Support pages on Wi-Fi drops (after sleep or resume, power saving); the pattern is supported. The battery link and the new laptop are the story's own. Revised impact lines, colleagues fact, router detail. AI-assisted review, not a mentor's.",
  },
  issueType: 'feature-not-working',
  impact: 'low',
  startingTemperature: 'frustrated',
  proficiency: 'intermediate',
  style: 'terse',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Matthias Obermeyer',
    speaker: 'male',
    role: 'Account Executive',
    organisation: 'Proseware',
    background:
      'Matthias sells software subscriptions to mid-sized firms and spends most of his day on video calls and in the sales system. He is comfortable with his laptop but not with networks, and he has no patience for anything that interrupts a call. He has been restarting the laptop because it is the quickest way back to work.',
    voice:
      "Clipped and businesslike. Answers in a few words and adds nothing unless asked. Says 'it just drops' and 'I've been restarting it'. Mildly irritated by basic questions, but answers a specific one directly. Warms slightly when someone narrows things down quickly and says why they are asking.",
  },
  environment: {
    details: [
      'Matthias uses a Windows 11 laptop supplied by Proseware, mostly for video calls and the sales system.',
      'He works from home on some days and from the office on others.',
      'Proseware has no full-time IT staff. An outside provider supports the laptops.',
      'Matthias is not technical about networks and describes what he sees, not what it is called.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Matthias only, as far as he knows.' },
    medium: { count: 3, summary: 'Matthias and two colleagues who were given the same laptop.' },
    high: {
      count: 18,
      summary: 'About eighteen people in the sales team, who were all given the same laptop.',
    },
  },
  customerObjective:
    'Stop the Wi-Fi dropping so that he can get through his client calls without having to reconnect.',
  customerExpectation:
    'Someone who asks short, sensible questions, does not make him repeat himself, and says what the next step is and when.',
  desiredOutcome:
    'The engineer works out when and where it drops, finds that it follows the laptop rather than the network, and agrees a clear next step and when Matthias will hear next.',
  previousTroubleshooting: ['Matthias has restarted the laptop each time the connection dropped.'],
  recentChanges: ['Matthias was given a new laptop about a month ago.'],

  publicBrief: {
    issue:
      "Matthias's Windows 11 laptop keeps dropping its Wi-Fi connection. He has been restarting it.",
    impact: {
      low: 'The connection drops now and then, and he loses time reconnecting.',
      medium: 'Client calls are being interrupted, and he is losing time every day.',
      high: 'Client calls keep dropping in the busiest quarter of the year.',
    },
    objective:
      'Find out when and where it drops, without leading him, and agree a clear next step.',
    knownContext:
      'Matthias Obermeyer is an account executive at Proseware. He spends most of his day on client video calls.',
    environment:
      'Matthias uses a Windows 11 laptop supplied by Proseware. You cannot see his laptop or network in this practice call.',
  },
  brief: {
    situation:
      'An account executive is calling because the Wi-Fi on his Windows 11 laptop keeps dropping. He has been restarting the laptop and has little patience for basic questions.',
    goal: 'Find out when and where it happens without leading him, keep the questions short and purposeful, and agree a clear next step and when he will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; he answers briefly and will not volunteer much.',
      'You cannot see his laptop or network in this practice call, so rely on what he tells you.',
    ],
  },

  openingCore:
    'The Wi-Fi on my work laptop keeps dropping, and restarting it only helps for a while.',
  impactVariants: {
    low: {
      summary: "It's a nuisance, mostly. Each time it drops I lose a minute or two.",
      detail:
        "It's my laptop. Reconnecting each time has cost me a few minutes, and it started to happen during calls.",
      deadline: "No hard deadline, but I'd like it sorted this week.",
    },
    medium: {
      summary: "It's dropping during client calls, and that's starting to cost me.",
      detail:
        "I'm on video calls with clients most of the day. When it drops in the middle of one, I look unprofessional and lose several minutes getting back in.",
      deadline: "I'd like it fixed in the next day or two.",
    },
    high: {
      summary: "It's dropping during client calls, and we're in our busiest quarter.",
      detail:
        "Calls to clients have been cutting out across the sales team, and we're all trying to close deals before the end of the quarter.",
      deadline: 'We need it sorted before the quarter closes.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm calling back about my laptop's Wi-Fi dropping, the case I opened a couple of days ago. Nothing has changed.",
      brief:
        "Matthias opened a case a couple of days ago about his laptop's Wi-Fi dropping. He has restarted the laptop each time, and it still drops.",
    },
    escalated: {
      opening:
        "This is my second call about my laptop's Wi-Fi dropping, and it still hasn't been sorted.",
      brief:
        'Matthias has called before about the same problem. It still drops, and he expects something to have changed.',
    },
    closure: {
      opening:
        "I'm calling to check that the Wi-Fi on my laptop has stopped dropping, so you can close my case.",
      brief:
        'Matthias expects to confirm that the Wi-Fi stays connected and to understand what was wrong before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'A couple of days ago',
      summary:
        "Matthias reported that his Windows 11 laptop's Wi-Fi keeps dropping. He was asked to restart the laptop and to call back if it continued.",
    },
  ],

  knownFacts: [
    {
      id: 'kf-what-happens',
      text: "The Wi-Fi keeps dropping on my laptop. Everything stops until it's back.",
      intents: ['problem_description'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration: "Calls freeze first, then I'm told I'm offline.",
      simple: 'The Wi-Fi keeps dropping on my laptop. Everything stops until it comes back.',
    },
    {
      id: 'kf-problem-closure',
      text: "The Wi-Fi kept dropping on my laptop. I'm calling to check it's properly sorted before you close the case.",
      intents: ['problem_description'],
      stages: ['closure'],
      simple:
        'The Wi-Fi kept dropping on my laptop. I am calling to check that it is sorted before you close the case.',
    },
    {
      id: 'kf-tried',
      text: "I've just been restarting it. That sorts it for a while.",
      intents: ['already_tried'],
      simple: 'I have only restarted the laptop. That fixes it for a while.',
    },
    {
      id: 'kf-what-it-shows',
      text: "The Wi-Fi symbol changes and I'm told I'm offline. My calls freeze just before that.",
      intents: ['error_message'],
      simple:
        'The Wi-Fi symbol changes and I am told I am offline. My calls freeze just before that.',
    },
    {
      id: 'kf-laptop',
      text: "It's a Windows 11 laptop from work. I use it for video calls and the sales system all day.",
      intents: ['environment'],
      cues: [
        'what laptop',
        'which laptop',
        'what device',
        'which device',
        'what are you using',
        'what do you use',
        'windows',
      ],
      simple:
        'It is a Windows 11 laptop from work. I use it for video calls and the sales system all day.',
    },
    {
      id: 'kf-outcome',
      text: 'I just want it to stay connected so I can get on with my calls.',
      intents: ['expected_outcome'],
      simple: 'I want it to stay connected. Then I can do my calls.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-frequency',
      intents: ['reproducibility'],
      cues: ['how often', 'how many times', 'how frequently', 'a day', 'per day'],
      text: "A few times a day, I think. Maybe more on busy days? I haven't counted.",
      confirmedText: 'Counting back, it was four times yesterday.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-router',
      intents: ['environment'],
      cues: ['router', 'modem', 'provider', 'network name', 'wifi name', 'wi-fi name', 'how old'],
      checking: 'Hang on, let me go and look at it.',
      text: "It's the one our internet provider gave us. It's a few years old, and I've never touched its settings.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-driver',
      intents: ['environment'],
      cues: ['driver', 'adapter', 'network adapter', 'firmware', 'bios'],
      text: "I couldn't tell you what the network adapter is, or its driver. I just use the laptop.",
      whoKnows: 'the outside IT provider or the laptop maker',
    },
    {
      id: 'uf-why',
      intents: ['problem_description', 'reproducibility'],
      cues: ['why', 'cause', 'reason', 'how come'],
      text: "I don't know why it does it. That's why I'm calling.",
      whoKnows: 'the engineer',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-quarter',
      text: "My numbers for the quarter are looking good, so that's one less worry.",
    },
    {
      id: 'if-desks',
      text: 'The office is changing its desk layout in the new year.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-after-sleep',
      importance: 'critical',
      label: 'It mostly drops after the laptop has been asleep',
      statement:
        "It mostly happens when I open the lid after the laptop's been asleep between calls. Once it's been awake a while it's usually fine.",
      revealWhen:
        'Asks what he is doing when it drops, when during the day it happens or whether it follows any pattern.',
      intents: ['reproducibility', 'timing_onset'],
      cues: [
        'pattern',
        'what are you doing',
        'when does it',
        'time of day',
        'particular time',
        'certain time',
        'every time',
        'sleep',
        'asleep',
        'lid',
        'wake',
        'idle',
      ],
      hint: "It's worse when I come back to it between calls.",
      statementTerse: "After it's been asleep. When I open the lid.",
      statementSimple:
        'It drops most when I open the lid after the laptop has been asleep. After some time awake it is usually fine.',
      missedConsequence:
        'The engineer never finds the one pattern that points at the laptop, so the call stays at generic fixes and he goes away to restart again.',
      betterQuestion:
        'When it drops, what are you doing at the time, and does it follow any pattern?',
    },
    {
      id: 'hf-where-it-happens',
      importance: 'important',
      label: 'Only at home, on the Wi-Fi',
      statement:
        "It only happens at home, on the Wi-Fi. At the office I'm on a cable at my desk, and it never drops there.",
      revealWhen:
        'Asks where he is when it happens, or whether it happens in more than one place or on more than one network.',
      intents: ['environment', 'affected_scope'],
      cues: [
        'where are you',
        'where does it',
        'where do you',
        'which network',
        'what network',
        'at home',
        'at the office',
        'other place',
        'other network',
        'different network',
        'different place',
        'cable',
      ],
      statementTerse: "Only at home, on Wi-Fi. At the office I'm on a cable.",
      statementSimple:
        'It only happens at home, on the Wi-Fi. At the office I use a cable, and it never drops there.',
      missedConsequence:
        'It is never established that the drops are tied to Wi-Fi at one place, so the engineer cannot tell a network problem from a laptop problem.',
      betterQuestion:
        'Where are you when it drops, and does it happen on any other network or only at home?',
    },
    {
      id: 'hf-other-devices',
      importance: 'important',
      label: 'Other devices on the same Wi-Fi are fine',
      statement:
        "My phone and my partner's laptop are fine on the same Wi-Fi, even when mine drops.",
      revealWhen: 'Asks whether other devices on the same network have the same problem.',
      intents: ['environment', 'workaround'],
      cues: [
        'other device',
        'another device',
        'phone',
        'same network',
        'same wi-fi',
        'same wifi',
        'partner',
        'family',
        'tablet',
      ],
      statementTerse: "Phone and my partner's laptop are fine.",
      statementSimple:
        'My phone and my partner laptop are fine on the same Wi-Fi, even when mine drops.',
      missedConsequence:
        'Without knowing that other devices are fine, the engineer may blame his home Wi-Fi and send him to chase his router.',
      betterQuestion:
        'Do other devices on the same home Wi-Fi, like your phone, drop out when the laptop does?',
    },
    {
      id: 'hf-new-laptop',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'It is a new laptop, and the old one was fine',
      statement: 'I got this laptop about a month ago. My old one never dropped on the same Wi-Fi.',
      revealWhen:
        'Asks when it began, whether anything changed around then or whether this laptop is new.',
      intents: ['timing_onset', 'recent_changes'],
      cues: [
        'when did it',
        'when did this',
        'since when',
        'how long has',
        'how long ago',
        'first notice',
        'new laptop',
        'new device',
        'old laptop',
        'laptop new',
        'anything change',
        'anything new',
      ],
      statementTerse: 'A month ago, a new laptop. The old one was fine.',
      statementSimple:
        'I got this laptop one month ago. My old laptop never dropped on the same Wi-Fi.',
      missedConsequence:
        'The engineer never finds the link to the new laptop, so nothing points at the laptop itself and the home network stays the main suspect.',
      betterQuestion: 'When did it start, and did anything change around then?',
    },
    {
      id: 'hf-colleagues',
      importance: 'helpful',
      label: 'Others with the same laptop',
      statement: "As far as I know it's just me. Nobody else on the team has mentioned it.",
      revealWhen:
        'Asks whether colleagues, especially ones with the same laptop, have the same problem.',
      intents: ['affected_scope'],
      cues: [
        'colleague',
        'anyone else',
        'anybody else',
        'anyone at work',
        'other people',
        'how many people',
        'everyone',
        'your team',
        'the team',
        'same laptop',
        'same model',
        'others at',
      ],
      statementTerse: 'Just me, as far as I know.',
      statementSimple: 'As far as I know it is only me. Nobody else on the team has said anything.',
      byImpact: {
        medium: {
          statement: 'Two others who got the same laptop have said theirs drops now and then too.',
          statementTerse: 'Two others with the same laptop say it drops too.',
          statementSimple:
            'Two other people who got the same laptop say theirs drops now and then too.',
        },
        high: {
          statement:
            'We all got the same new laptop last month, and about half of us have the same trouble.',
          statementTerse: 'We all got the same laptop. About half have the problem.',
          statementSimple:
            'We all got the same new laptop last month. About half of us have the same problem.',
        },
      },
      missedConsequence:
        'The engineer never finds out whether it reaches beyond one laptop, so the case is treated as a single odd device and a wider pattern is missed.',
      betterQuestion:
        'Is anyone else at work, especially anyone with the same laptop, seeing the same thing?',
    },
    {
      id: 'hf-vpn',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'The work VPN drops with it',
      statement:
        "When it drops, the work VPN drops too, so I have to reconnect that as well. That's why I restart everything.",
      revealWhen:
        'Asks what he does to get back online, or whether anything else drops or needs reconnecting.',
      intents: ['already_tried', 'workaround'],
      cues: [
        'vpn',
        'how do you get',
        'how do you reconnect',
        'get back online',
        'get back on',
        'reconnect',
        'connect again',
        'what else stops',
        'what else drops',
        'work again',
      ],
      statementTerse: 'The VPN drops too. I restart everything to get it back.',
      statementSimple:
        'When it drops, the work VPN drops too. I must connect that again. So I restart everything.',
      missedConsequence:
        'The engineer never finds why he restarts everything, so the extra reconnecting that costs him time is missed.',
      betterQuestion:
        'How do you get back online when it drops, and what else stops working at the same time?',
    },
    {
      id: 'hf-battery',
      importance: 'helpful',
      minDifficulty: 'challenge',
      label: 'It seems worse on battery',
      statement: "It seems worse when I'm on the battery than when it's plugged in.",
      revealWhen:
        'Asks whether it makes any difference whether the laptop is plugged in or running on the battery.',
      intents: ['reproducibility', 'environment'],
      cues: ['battery', 'plugged', 'charger', 'on power', 'power saving', 'mains', 'charging'],
      statementTerse: 'Worse on battery.',
      statementSimple:
        'It seems worse when the laptop runs on the battery. It is better when it is plugged in.',
      missedConsequence:
        'The engineer never finds a second pattern that points at how the laptop is running, so the picture stays thin.',
      betterQuestion:
        'Does it make any difference whether the laptop is plugged in or running on the battery?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-blames-router',
      statement: "I'm fairly sure it's my home router. It's quite old.",
      truth:
        'Other devices are fine on the same Wi-Fi, which points away from the router, though nothing here confirms the cause.',
    },
  ],

  curveballs: [
    {
      id: 'cb-demo-tomorrow',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 8, whenImpactUnacknowledged: true },
      statement:
        "I should say I've got a client demo tomorrow morning. I need it to stay up for that.",
      followUp: 'So what can you do before then?',
      expectedResponse:
        'Acknowledge the demo and be honest about what can and cannot be promised. Suggest a sensible fallback only if you know one, and agree a time to follow up before the demo.',
      minDifficulty: 'starter',
      effects: { temperature: 5, patience: -6 },
    },
    {
      id: 'cb-standard-script',
      type: 'challenge-credibility',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        "Is this just the standard script? I've already restarted it more times than I can count.",
      followUp: 'I need someone who can tell me what is actually wrong.',
      expectedResponse:
        'Stay calm and factual. Say briefly why the questions matter, that they narrow down where the problem is, and what you will do with the answers. Do not get defensive.',
      minDifficulty: 'standard',
      effects: { temperature: 6, trust: -6 },
    },
  ],
  allowedCurveballs: ['deadline', 'challenge-credibility', 'ask-manager', 'go-silent'],

  expectedDiscoveryAreas: [
    'When it drops and what he is doing',
    'Where it happens',
    'Other devices on the same network',
    'When it started and what changed',
    'What he does to get back online',
    'Whether colleagues are affected',
  ],
  successCriteria: [
    'Greets Matthias briefly and asks short questions that show why they matter, because he has little patience for basics.',
    'Finds what he is doing when it drops and whether it follows a pattern, without suggesting the answer.',
    'Finds where it happens and whether other devices on the same network are affected.',
    'Finds when it started and what changed around then, including whether the laptop is new.',
    'Does not blame his home network or promise a fix, and agrees a clear next step and a time for the next update.',
    'Summarises in a sentence or two before ending.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity', 'ownership-next-steps'],
  careExpectations: {
    communicate: [
      'Keeps questions short and says in a few words why each one matters, so a customer in a hurry stays with them.',
      'Summarises what was learned in a sentence or two before ending.',
    ],
    accountable: [
      'Takes ownership of the next step in their own name and gives a time for the next update.',
    ],
    resourceful: [
      'Asks when, where and on what it drops, and whether other devices and colleagues are affected, before offering generic fixes.',
      'Asks what else drops with it and what he does to get back online.',
    ],
    empathetic: [
      'Acknowledges briefly and specifically that calls dropping while he works with clients is costly, without a long apology.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Starting with generic fixes such as restarting the router, when he has already been restarting things.',
    'Leading him to an answer, for example asking only "Does it happen after sleep?" without first asking when it happens.',
    'Blaming his home Wi-Fi or router before finding out whether other devices are affected.',
    'Asking a long list of questions at once, which a terse customer answers with one word.',
    'Ending with "try restarting again" and no next step or time.',
  ],
  goodBehaviours: [
    'Asking when it drops and what he is doing at the time, in one short question.',
    'Asking where he is when it happens and whether other devices on the same Wi-Fi are affected.',
    'Asking when it started and whether the laptop or network changed around then.',
    'Asking what he does to get back online and what else drops with it.',
    'Agreeing a next step and a time for the next update, then summarising briefly.',
  ],
  expectedOutcome:
    'Matthias has a clear next step and a time for the next update. He knows what the engineer has learned about when and where it drops, which points at his laptop rather than his home Wi-Fi, without any promise of a fix, and he has not been asked to repeat the restarts.',
  evaluatorNotes:
    "Story (plausible, never confirmed on the call): the new work laptop loses its Wi-Fi mostly when it wakes from sleep, and a little more on battery. It only happens at home; at the office he is on a cable, his phone and his partner's laptop are fine on the same Wi-Fi, and his old laptop never did this. The VPN drops with it, so he restarts everything. The cause could lie in power saving or the network driver, but nothing confirms it. A strong call scopes when, where and on what with short questions, finds that it follows the laptop, does not blame his home Wi-Fi or promise a fix, and agrees a next step and a time for the next update.",
} satisfies ScenarioInput;

export default scenario;
