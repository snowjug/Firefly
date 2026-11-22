import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario (first contact). Everything here is fictional: people, organisation and case.
// Teams is a real product, so the scenario describes only what the customer sees and was told, never
// how Teams or a home network works.
//
// Root cause in the story (hidden from the trainee; plausible, never confirmed on the call): three
// weeks ago Beatriz moved her home-day desk from the dining table, which is close to the broadband
// box in the hall, to a box room at the back of the house upstairs. Calls from there break up, and
// they are worst in the late afternoon when the rest of the household is online. In the office, with
// the same headset, the sound is fine, and a colleague who works from home on the same days has no
// trouble. Beatriz thinks her headset is on its way out and has not linked the sound to the move,
// because she has never thought about how a call reaches her laptop. The fact that depends on how many
// people are affected (hf-colleague-fine) carries byImpact wordings for medium and high, matching
// affectedUsers and impactVariants. At those levels the others who are affected also work from home on
// some days, so the story still holds, and Teodoro, who works from home on the same days, is the one
// who is fine.
//
// Beatriz is calm, chatty and not technical, and tells the whole story before the point. A strong call
// lets her tell it, then turns it into a short list of facts with one plain question at a time (what
// the sound is like, where and when it happens, what changed), uses everyday words, suggests one simple
// thing to try, does not blame her equipment or promise the calls will be fixed, and agrees when she
// will hear next.

const scenario = {
  id: 'teams-choppy-audio-on-calls',
  version: 1,
  title: 'Choppy audio on Teams calls',
  shortTitle: 'Choppy audio on calls',
  listSummary: 'A sales coordinator says the sound on her Teams calls keeps breaking up.',
  summary:
    'Beatriz Falcao coordinates sales at Wingtip Toys. The sound on her Microsoft Teams calls keeps breaking up, and she wants to understand why. She is friendly, chatty and not technical. Practise gentle scoping, plain language and agreeing simple next steps.',
  tags: ['call quality', 'audio', 'plain language', 'talkative customer', 'starter'],
  estimatedMinutes: 9,

  product: { id: 'teams', area: 'Calls and meetings audio' },
  caseReference: 'SIM-410201',
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
      "Re-read current public pages on improving the connection for Teams calls and on call health: terms and symptom fit. Headset behaviour and live call data not checked. Made closure and curveball lines stage-neutral, tightened cues. AI-assisted review, not a mentor's.",
  },
  issueType: 'feature-not-working',
  impact: 'low',
  startingTemperature: 'calm',
  proficiency: 'novice',
  style: 'talkative',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Beatriz Falcao',
    speaker: 'female',
    role: 'Sales Coordinator',
    organisation: 'Wingtip Toys',
    background:
      'Beatriz keeps the sales team at a toy company organised: orders, samples and the weekly calls with retail buyers. She uses Teams all day and is cheerful and not technical. She has never wondered how a call reaches her laptop, and she would rather ask than guess.',
    voice:
      "Warm and chatty. Tells the story from the beginning, wanders off, then says 'where was I?' and comes back. Uses her own words, such as 'the little box with the lights', and apologises for rambling. Relaxes when asked one simple question at a time, and loses the thread when given several.",
  },
  environment: {
    details: [
      'Beatriz uses Microsoft Teams on a work laptop for calls with retail buyers and with the sales team, several times a day.',
      'She works in a small sales team, and her colleagues use Teams for their calls too.',
      'Her calls are a mix of one-to-one conversations and meetings with a handful of people.',
      'The company IT team looks after the laptops and the Teams settings. Beatriz does not.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Beatriz only, as far as she knows.' },
    medium: { count: 4, summary: 'Four people on the sales team, all with the same trouble.' },
    high: {
      count: 12,
      summary:
        'About a dozen people across sales and customer service, in the week of the big buyer calls.',
    },
  },
  customerObjective:
    'Get her Teams calls sounding normal again, and understand in plain words what is going on, so that she does not feel embarrassed in front of buyers.',
  customerExpectation:
    'Someone patient who lets her explain in her own way, tells her in plain words what might be going on, gives her something simple she can try, and says when she will hear back.',
  desiredOutcome:
    'Beatriz understands in plain words what the engineer has found, has one simple thing to try on her next call, and knows when she will hear back.',
  previousTroubleshooting: [
    'Beatriz restarted her laptop and Teams a couple of times. It made no difference.',
    'Beatriz tried the laptop speakers instead of her headset, and the sound was just as bad.',
  ],
  recentChanges: ['Beatriz moved her desk at home to a different room about three weeks ago.'],

  publicBrief: {
    issue:
      'Beatriz says the sound on her Teams calls keeps breaking up, and she wants to know why.',
    impact: {
      low: 'She keeps having to ask people to repeat themselves, but nothing urgent depends on it.',
      medium: 'Several colleagues have the same trouble, and buyers have started to notice.',
      high: 'Most of the sales team is affected in the week of their biggest buyer calls.',
    },
    objective:
      'Let her tell her story, find out what matters with simple questions, and agree next steps.',
    knownContext:
      'Beatriz Falcao coordinates sales at Wingtip Toys. She is friendly and chatty, and not technical.',
    environment:
      'Beatriz uses Teams on a work laptop for calls with buyers and colleagues. You cannot see her laptop in this practice call.',
  },
  brief: {
    situation:
      'A sales coordinator is calling because the sound on her Microsoft Teams calls keeps breaking up. She is friendly, chatty and not technical, and she tells her story from the beginning.',
    goal: 'Let her tell it, turn it into a few clear facts with simple questions, use everyday words, and agree what happens next and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot see her laptop or her calls in this practice call, so rely on what she tells you.',
    ],
  },

  openingCore: "The sound on my Teams calls keeps breaking up, and I'd love to understand why.",
  impactVariants: {
    low: {
      summary: "It isn't urgent, but it's a bit embarrassing when a call keeps breaking up.",
      detail:
        'I can still do my job, but on a call with a buyer we keep having to say sorry, could you say that again? It makes me feel a bit silly.',
      deadline: "There's no rush, though it would be lovely to have it sorted this week.",
    },
    medium: {
      summary: 'A few of us on the sales team have it, and a couple of buyers have mentioned it.',
      detail:
        "It's four of us now, I think, all on the sales team. We've got a lot of buyer calls this week, and nobody wants to sound like a robot.",
      deadline: "We'd like it sorted in the next day or two, before the buyer calls pile up.",
    },
    high: {
      summary: "Most of the sales team has it, and it's the week of our biggest buyer calls.",
      detail:
        "It's about a dozen of us across sales and customer service. The big buyer calls for the toy fair are all this week, and a few buyers have said they can't hear us properly.",
      deadline: "We've got the first of the big buyer calls tomorrow morning.",
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I rang a few days ago about the sound breaking up on my Teams calls, and I haven't heard anything since.",
      brief:
        'Beatriz called a few days ago about choppy audio on her Teams calls. A case was logged, and she has had no update.',
    },
    escalated: {
      opening:
        "This is my second call about the sound breaking up on my Teams calls, and it's still happening. I explained it all last time, so I'm hoping someone has the notes.",
      brief:
        'Beatriz has called twice about choppy audio on her Teams calls, and it is still happening. She is polite but expects the notes to have been read.',
    },
    closure: {
      opening:
        "I'm ringing about my Teams calls, the ones where the sound kept breaking up. They seem a lot better now, so I wanted to check with you before the case is closed.",
      brief:
        'Beatriz expects to confirm that her calls sound normal again, to understand what changed, and to know what to do if it comes back.',
    },
  },
  priorHistory: [
    {
      when: 'A few days ago',
      summary:
        'Beatriz called to say the sound on her Teams calls kept breaking up. A case was logged and no update has been sent.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-sound',
      text: 'The sound keeps breaking up. Words go missing, then they come back.',
      intents: ['problem_description', 'error_message'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration:
        "It's like driving through a tunnel with the radio on. I can't think what else to compare it to.",
      simple: 'The sound keeps breaking up. Some words go missing. Then they come back.',
    },
    {
      id: 'kf-sound-better',
      text: "It sounds a lot better now. I haven't had a choppy call for a few days.",
      intents: ['problem_description', 'error_message'],
      stages: ['closure'],
      elaboration: "I'm almost afraid to say it out loud, in case I jinx it.",
      simple: 'It sounds a lot better now. I have not had a choppy call for a few days.',
    },
    {
      id: 'kf-teams-calls',
      text: "It's on Teams. I use it for most of my calls, with buyers and with the team.",
      intents: ['problem_description', 'environment'],
      simple: 'It is on Teams. I use it for most of my calls.',
    },
    {
      id: 'kf-laptop',
      text: "It's my work laptop. I've had it about three years.",
      intents: ['environment'],
      simple: 'It is my work laptop. I have had it for about three years.',
    },
    {
      id: 'kf-rang-before',
      text: "I've rung about this before, and someone took my details and said they'd be in touch.",
      intents: ['previous_contact'],
      stages: ['follow-up', 'escalated', 'closure'],
      simple: 'I called about this before. Someone took my details.',
    },
    {
      id: 'kf-outcome',
      text: "I'd just like my calls to sound normal. And I'd like somebody to explain what's going on, in plain English.",
      intents: ['expected_outcome'],
      simple: 'I want my calls to sound normal. I want someone to explain what is going on.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-when-started',
      intents: ['timing_onset'],
      text: "A few weeks back, I think. I couldn't give you the exact day.",
      confirmedText:
        'The first time I really noticed was on a call about the spring catalogue. That was a Thursday.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-internet-speed',
      intents: ['environment', 'account_details'],
      cues: [
        'internet speed',
        'how fast',
        'speed test',
        'broadband speed',
        'megabit',
        'provider',
        'package',
      ],
      text: "I've no idea how fast our internet is. Whoever set up the broadband for us would know.",
      whoKnows: 'whoever set up our broadband',
    },
    {
      id: 'uf-router-details',
      intents: ['environment'],
      cues: [
        'what make',
        'which make',
        'what model',
        'which model',
        'which router',
        'what kind of router',
        'router settings',
        'its settings',
        'channel',
        'ghz',
        'firmware',
      ],
      text: "I couldn't tell you who made it, or anything about its settings. It's white with little green lights.",
      whoKnows: 'whoever set up our broadband',
    },
    {
      id: 'uf-call-numbers',
      intents: ['environment', 'reproducibility'],
      cues: ['call health', 'statistics', 'stats', 'quality information', 'network information'],
      text: "I wouldn't know where to find anything like that. I just join the call and talk.",
      whoKnows: 'whoever looks after Teams for the company',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-toy-fair',
      text: "We've got the toy fair coming up in January, so I'm up to my ears in sample boxes at the moment.",
    },
    {
      id: 'if-fence',
      text: 'Our garden fence has blown down twice this autumn, which is a whole other saga.',
    },
    {
      id: 'if-ukulele',
      text: "I've started ukulele lessons, which my neighbours may or may not be enjoying.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-only-at-home',
      importance: 'critical',
      label: 'Only on days away from the office',
      statement:
        "It's only on the days I work from home. At the office the sound is perfect, which is why it took me ages to notice.",
      partialStatement: "It's better on some days than others, now I think about it.",
      revealWhen:
        'Asks where or when she is on the calls that break up, or whether it happens on every call or only on some.',
      intents: ['reproducibility', 'environment'],
      partialIntents: ['problem_description'],
      cues: [
        'every call',
        'every time',
        'only some',
        'which calls',
        'where are you when',
        'where do you take',
        'working from home',
        'at home or',
        'in the office',
        'which days',
        'particular days',
        'certain days',
      ],
      hint: "It isn't like this every single day, actually.",
      statementTerse: 'Only on my home days. The office is fine.',
      statementSimple:
        'It only happens on the days I work from home. At the office the sound is fine.',
      missedConsequence:
        'Without the pattern, the engineer treats it as a general Teams or headset fault, and she is given generic fixes that miss what is really different.',
      betterQuestion: 'Does it happen on every call, or only in certain places or on certain days?',
    },
    {
      id: 'hf-moved-desk',
      importance: 'important',
      label: 'Moved her desk to another room at home',
      statement:
        "Three weeks ago we had the dining room redecorated, so I moved to the box room at the back of the house. That's about when the sound started to go.",
      revealWhen:
        'Asks whether anything changed around the time it began, in her setup or in how she works.',
      intents: ['recent_changes', 'timing_onset'],
      cues: [
        'change',
        'anything different',
        'anything new',
        'moved',
        'rearrange',
        'redecorat',
        'new room',
        'where you work',
        'where do you work',
        'where are you working',
        'your setup',
        'just before',
      ],
      hint: "I did rearrange a few things at home recently, but I don't see how that would matter.",
      statementTerse: 'Three weeks ago I moved to the box room at the back of the house.',
      statementSimple:
        'Three weeks ago I moved to a small room at the back of my house. That is about when the sound started to break up.',
      missedConsequence:
        'The only change around the start is missed, so the search stays on her equipment and Teams, and nobody looks at where she now works.',
      betterQuestion: 'Did anything change around the time it started, in how or where you work?',
    },
    {
      id: 'hf-late-afternoon',
      importance: 'important',
      label: 'Worse in the late afternoon',
      statement:
        "It's worst in the late afternoon, once the children are home and everyone's on their phones and the telly. First thing in the morning it's much better.",
      revealWhen:
        'Asks whether the problem is the same all day, or whether it is worse at certain times.',
      intents: ['reproducibility', 'timing_onset'],
      cues: [
        'time of day',
        'time of the day',
        'what time does it',
        'certain time',
        'particular time',
        'worse',
        'worst',
        'all day',
        'same all day',
        'during the day',
        'busiest',
      ],
      hint: 'It does seem to come and go through the day.',
      statementTerse: 'Worst in the late afternoon, when the children are home.',
      statementSimple:
        'It is worst in the late afternoon, when the children are home and everyone is online. In the morning it is much better.',
      missedConsequence:
        'The time pattern is missed, along with a possible clue about who else is using the connection at those times.',
      betterQuestion: 'Is it the same all day, or is it worse at certain times?',
    },
    {
      id: 'hf-router-distance',
      importance: 'important',
      label: 'The router is a long way from her desk',
      statement:
        "The broadband box lives in the hall by the front door, downstairs, and I couldn't tell you anything about it. The box room's right at the other end of the house, up the stairs.",
      revealWhen:
        'Asks where her router or broadband box is, or how far it is from where she sits.',
      intents: ['environment'],
      cues: [
        'where is your router',
        "where's your router",
        'where is the router',
        "where's the router",
        'to your router',
        'to the router',
        'from your router',
        'from the router',
        'wi-fi box',
        'internet box',
        'how far is',
        'distance',
      ],
      statementTerse:
        'The broadband box is in the hall downstairs. My room is at the far end, upstairs.',
      statementSimple:
        'The broadband box is in the hall, downstairs, by the front door. My new room is at the other end of the house, upstairs.',
      missedConsequence:
        'The distance between the router and her desk never comes up, so the call stays on guesses about her equipment.',
      betterQuestion: 'Where is your Wi-Fi router, and how far is it from your desk?',
    },
    {
      id: 'hf-same-headset',
      importance: 'helpful',
      label: 'The headset is fine at the office',
      statement:
        "It's a black headset with a lead, the one the company gave me. It's fine in the office, and the laptop's own speakers at home were just as bad.",
      revealWhen:
        "Asks what she uses for her calls, what she has already tried, or whether it happens with a different headset or with the laptop's own speakers.",
      intents: ['already_tried', 'workaround', 'environment'],
      cues: [
        'headset',
        'headphones',
        'earphones',
        'earbuds',
        'microphone',
        'speakers',
        'what do you use',
        'what are you using',
        'tried',
        'swapped',
        'equipment',
      ],
      statementTerse:
        'Black wired headset from the company. Fine at the office. Laptop speakers at home were just as bad.',
      statementSimple:
        'It is a black headset with a lead. The company gave it to me. It is fine at the office. At home I tried the laptop speakers, and they were just as bad.',
      missedConsequence:
        'The engineer never learns what she uses, or that she has already ruled it out, so the call may suggest replacing the headset or simply accept her view that it is the headset.',
      betterQuestion:
        'What do you use for your calls, and have you tried anything else, like the laptop speakers?',
    },
    {
      id: 'hf-direction',
      importance: 'helpful',
      label: 'Mostly the other people break up',
      statement:
        "Mostly it's the other people who go choppy for me. A couple of times they've said I was cutting out as well.",
      revealWhen:
        "Asks whether it is her voice or the other person's that breaks up, or who notices it.",
      intents: ['problem_description', 'error_message'],
      cues: [
        'who breaks up',
        'who sounds',
        'hear them',
        'hear you',
        'they hear',
        'other person',
        'other side',
        'which way',
        'both ways',
        'your end',
        'their end',
        'cutting out',
      ],
      statementTerse: 'Mostly I hear them break up. Twice they said I did too.',
      statementSimple:
        'Mostly I hear the other people break up. Sometimes they say I break up too.',
      missedConsequence:
        'The engineer never learns whether the trouble is on her side, theirs or both, so the first questions about her equipment have nothing to build on.',
      betterQuestion: 'When a call breaks up, is it you who sounds odd to them, or them to you?',
    },
    {
      id: 'hf-colleague-fine',
      importance: 'important',
      label: 'A colleague is fine on the same days',
      statement:
        "From what I can tell it's only me. Teodoro works from home on the same days, and his calls are fine.",
      revealWhen:
        'Asks whether anyone else has the same trouble, and whether they work in the same way.',
      intents: ['affected_scope'],
      cues: [
        'anyone else',
        'anybody else',
        'your colleagues',
        'other colleagues',
        'who else',
        'only you',
        'just you',
        'same days',
        'how many people have',
        'how many people are affected',
        'how many of you',
        'everyone else',
      ],
      byImpact: {
        medium: {
          statement:
            'A few of the others have mentioned it too, on their home days. Teodoro works from home on the same days, and his calls are fine.',
          statementTerse: "A few others have it on home days. Teodoro's calls are fine.",
          statementSimple:
            'A few of the others have it too, on their home days. Teodoro works from home on the same days, and his calls are fine.',
        },
        high: {
          statement:
            'Plenty of us have it, on our home days. Teodoro works from home on the same days, and his calls are fine.',
          statementTerse: "Plenty of us have it on home days. Teodoro's calls are fine.",
          statementSimple:
            'Many of us have it, on our home days. Teodoro works from home on the same days, and his calls are fine.',
        },
      },
      statementTerse: "Only me, as far as I can tell. Teodoro's calls are fine.",
      statementSimple:
        'I think it is only me. Teodoro works from home on the same days, and his calls are fine.',
      missedConsequence:
        'The engineer never learns that a colleague on the same days has no trouble, which says a lot about where to look, so the call stays on Teams itself.',
      betterQuestion:
        'Is anyone else having the same trouble, and are they working in the same way as you?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-headset',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        "I think my headset's on its way out. It's quite old, and I wondered if I should just buy a new one.",
      truth:
        'Nothing suggests the headset is at fault. In this story it sounds fine in the office, so the trouble follows where she works, not the equipment.',
    },
  ],

  curveballs: [
    {
      id: 'cb-long-words',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 4, latestTurn: 8 },
      statement:
        "I'll be honest, I get a bit nervous ringing for help. Last time I rang about something else, they used so many long words that I just said thank you and hung up.",
      followUp:
        'Sorry to go on about it, but I really do get lost when people use technical words.',
      expectedResponse:
        'Acknowledge it without defending anyone, then show what will be different: plain words, one step at a time, and an invitation to stop you whenever a word is unclear.',
      minDifficulty: 'standard',
      effects: { temperature: 4, trust: -6 },
    },
    {
      id: 'cb-big-buyer-call',
      type: 'deadline',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        "Oh, I should say, I've got a call with our biggest buyer on Thursday morning. I do want it to go smoothly.",
      followUp: 'So can I count on it being fine by Thursday?',
      expectedResponse:
        'Acknowledge the call without promising how it will go. Say what you will do, what she can try before Thursday and when she will next hear from you.',
      minDifficulty: 'standard',
      effects: { temperature: 4, patience: -4 },
    },
    {
      id: 'cb-lost-the-thread',
      type: 'go-silent',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: 'Oh. Right. Um...',
      followUp: 'Sorry, I lost you there. Could you go through it again, more slowly?',
      expectedResponse:
        'Notice the pause, check in gently, and say it again in plainer words, one step at a time, instead of adding more detail.',
      minDifficulty: 'standard',
      effects: { patience: -2 },
    },
  ],
  allowedCurveballs: ['previous-bad-experience', 'deadline', 'go-silent', 'unsupported-guarantee'],

  expectedDiscoveryAreas: [
    'What the sound is like',
    'Where and when it happens',
    'What changed recently',
    'What she uses for her calls',
    'Who else has the trouble',
    'What she has already tried',
  ],
  successCriteria: [
    'Greets Beatriz warmly, lets her tell her story without cutting across, then steers back with one simple question at a time.',
    'Finds out where and when it happens, and what changed around the time it began, before suggesting any fix.',
    'Uses everyday words, and explains any other word before using it.',
    'Gives one or two simple things to try, one at a time, and checks that she can follow each.',
    'Says plainly what happens next and when she will hear back, without promising that the calls will be fixed.',
    'Summarises the plan in a few words before ending.',
  ],
  coachingFocus: ['clarity', 'scoping-discovery', 'opening-rapport'],
  careExpectations: {
    communicate: [
      'Uses everyday words and one question at a time, and explains any word she may not know, such as "signal" or "connection".',
      'Repeats back what she has said in a sentence or two, so that she can correct it before the call moves on.',
    ],
    accountable: [
      'Says what they will do, who else may need to be involved and when she will hear next, without promising that the sound will be fixed.',
    ],
    resourceful: [
      'Asks where and when it happens and what changed, so that a long story becomes a short list of facts.',
      'Offers one simple thing she can try on her next call, and asks her to notice what happens.',
    ],
    empathetic: [
      'Recognises that it is embarrassing to keep cutting out in front of buyers, and lets her finish a story kindly before steering back.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Using terms such as "packet loss", "bandwidth" or "latency" without explaining them to someone who has never heard them.',
    'Giving five or six things to try in one go, so that she loses track and does none of them.',
    'Cutting across her stories or hurrying her, which makes her apologise and say less.',
    'Deciding that the headset or Teams is at fault before finding out where and when it happens.',
    'Ending with "try that and call back" and no time for the next contact.',
  ],
  goodBehaviours: [
    'Welcoming her warmly and making it clear that she can take her time.',
    'Asking whether it happens everywhere she takes calls or only in some places or on some days.',
    'Asking what changed around the time it began, in how or where she works.',
    'Asking about her Wi-Fi in everyday words, for example where the box is compared with where she sits.',
    'Suggesting one simple thing to try, and agreeing how she will tell you what happened.',
    'Giving a time for the next contact and a short summary before ending.',
  ],
  expectedOutcome:
    'Beatriz understands in plain words that the trouble seems to follow where she works from home rather than her headset or Teams, has one simple thing to try on her next home-day call, and knows when she will hear from the engineer.',
  evaluatorNotes:
    'Root cause in the story (a plausible possibility, not confirmed on the call): since she moved her home-day desk to a back room a long way from the broadband box, the connection is weak there, and it is worse in the late afternoon when others at home are online. The headset is fine and the office is fine. At medium and high impact other people have it on their home days too, and Teodoro is the one who is fine. Beatriz is calm, chatty and not technical. A strong call lets her tell the story, scopes by place, time and change with one plain question at a time, avoids jargon and blame, suggests one simple thing to try, promises no fix and agrees when she will hear next.',
} satisfies ScenarioInput;

export default scenario;
