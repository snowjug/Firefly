import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario, set at a follow-up call. Everything here is fictional: people, organisation and
// case. Teams is a real product, so the scenario describes only what the customer sees and was told,
// never how Teams stores or shows a recording.
//
// Case context in the story (hidden from the trainee; plausible, never confirmed on the call): the
// monthly programme steering meeting was not booked from Radek's own calendar this time. The
// programme office sent the invitation from its shared mailbox, and Hana, one of its coordinators,
// started the recording at the beginning. Nothing appeared in the meeting chat afterwards. Radek's
// own files hold the recordings of earlier steering meetings, which he booked himself, but not this
// one. For a meeting scheduled from a shared mailbox, a current public Learn page says the recording
// goes to a co-organiser's or the recorder's OneDrive, so it may sit with Hana, who has been on leave
// since Friday and is not answering (not confirmed on the call). Fourteen people attended, three of
// them from a partner company. When Radek raised the case last Wednesday he was told he would have
// an update within two working days, and nothing has come, so that fact is limited to follow-up and
// escalated calls (stages), as are Hana being away and the lines that say nothing has come: on a
// closure call the recording has turned up. How many people need the recording and by when is in the
// impact variants and affectedUsers, not in a hidden fact.
//
// Radek is terse and short on patience. A strong call acknowledges the wait without excuses, owns the
// case, reads the case notes instead of making him start again, finds who booked, started and attended
// the meeting and whether earlier meetings were fine, stays honest that nobody can yet say where the
// recording is, handles the request for a manager and the deadline calmly, and agrees a first step, an
// owner and a time for the next update.

const scenario = {
  id: 'teams-meeting-recording-missing-follow-up',
  version: 1,
  title: 'Teams meeting recording is missing',
  shortTitle: 'Meeting recording missing',
  listSummary: 'A programme manager chases a case about a Teams meeting recording he cannot find.',
  summary:
    'Radek Soukup runs programmes at Northwind Traders. A Teams meeting was meant to be recorded, and he cannot find the recording. He raised a case last week and has heard nothing. Own the case, find out what he knows and agree what happens next, with a time.',
  tags: ['recording', 'follow-up', 'no update', 'ownership', 'terse customer'],
  estimatedMinutes: 11,

  product: { id: 'teams', area: 'Meeting recordings' },
  caseReference: 'SIM-410202',
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
      "Re-read current public pages on where recordings are stored, including meetings scheduled from a shared mailbox, and who can record. The story fits; tenant settings and processing times not checked. Made closure and curveball lines stage-neutral. AI-assisted review, not a mentor's.",
  },
  issueType: 'data-missing',
  impact: 'medium',
  startingTemperature: 'frustrated',
  proficiency: 'intermediate',
  style: 'terse',
  callStage: 'follow-up',
  difficulty: 'standard',

  persona: {
    name: 'Radek Soukup',
    speaker: 'male',
    role: 'Programme Manager',
    organisation: 'Northwind Traders',
    background:
      'Radek runs a programme that spans several teams and a partner company, and he chairs its monthly steering meeting. He uses Teams all day and knows the basics, but he has never needed to think about where a recording goes. He has waited days for an answer and has stopped expecting one.',
    voice:
      'Terse and formal. Short sentences, exact days and times, no small talk. Impatient with questions the case already answers, and quick to ask who owns this and when he will hear. Softens a little when someone owns it, apologises for the wait without excuses and gives a specific time.',
  },
  environment: {
    details: [
      'Northwind Traders uses Microsoft Teams for its meetings, mostly through the desktop app on company laptops.',
      'Radek co-chairs the monthly programme steering meeting and writes up the minutes afterwards.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Radek, who wants the recording for his own notes.' },
    medium: {
      count: 6,
      summary: 'The six board members who could not attend and are waiting for the minutes.',
    },
    high: {
      count: 25,
      summary:
        'The steering board and the wider programme team, about 25 people who need the decisions in writing.',
    },
  },
  customerObjective:
    'Get hold of the recording of the programme steering meeting, and have one named person own the case until he has it.',
  customerExpectation:
    'Someone who takes charge of the case, says sorry for the silence without excuses, explains what is known and what is not, and gives a time for the next update, so that he can tell his managers where it stands.',
  desiredOutcome:
    'Radek knows who owns the case and what will be checked first, has a time for the next update, and has something to tell the steering board in the meantime.',
  previousTroubleshooting: [
    'Radek looked in the meeting chat for the recording and found nothing.',
    'Radek looked through his own files. They hold recordings of earlier meetings, but not this one.',
  ],
  recentChanges: [
    'The programme office started booking the steering meetings from its own shared mailbox this month.',
  ],

  publicBrief: {
    issue: 'Radek cannot find the recording of a Teams meeting that he expected to be saved.',
    impact: {
      low: 'The recording is for his own notes, and there is no firm date for it.',
      medium: 'People who missed the meeting are waiting for the recording and the minutes.',
      high: 'Decision-makers who missed the meeting need the recording before a key decision.',
    },
    objective:
      'Own the case, find out what happened to the recording, and agree next steps with a time.',
    knownContext:
      'Radek Soukup is a programme manager at Northwind Traders. He is short on patience and gives short answers, so ask clearly.',
    previousContact:
      'Radek raised a case last week about the recording. It has had no update, and nobody has contacted him since.',
    environment:
      'Northwind Traders uses Teams for its meetings, mostly the desktop app on company laptops. You cannot see his meeting, chat or files in this practice call.',
  },
  brief: {
    situation:
      'A programme manager is calling back about a case he raised last week. The recording of an important Teams meeting cannot be found, and he has had no update. He is short on patience and gives brief answers.',
    goal: 'Own the case, acknowledge the wait without excuses, find out what he knows without making him start again, and agree a first step and a time for the next update.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer gives short answers and will not volunteer much.',
      'You cannot see his meeting, chat or files in this practice call, so rely on what he tells you and on the case notes.',
    ],
  },

  openingCore:
    "A Teams meeting was supposed to be recorded, and I can't find the recording anywhere.",
  impactVariants: {
    low: {
      summary: "It's for my own notes, so it isn't urgent. I'd still like it found.",
      detail:
        "I'm the only one who needs it, to write up my own notes. Nobody else is waiting on it.",
      deadline: 'Some time this week would be fine.',
    },
    medium: {
      summary:
        'The steering board is waiting on the minutes, and they expect the recording with them.',
      detail:
        "Six board members couldn't be at the meeting, and they want to hear the discussion themselves. I've told them it's coming.",
      deadline: 'The board pack goes out on Friday at noon.',
    },
    high: {
      summary:
        'The sponsor is waiting on the decisions from that meeting, and I have nothing to give them.',
      detail:
        'About twenty-five people are waiting on what was decided, and the sponsor has asked me for the recording twice.',
      deadline: 'The sponsor wants it by nine tomorrow morning.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I raised a case last Wednesday about a Teams meeting recording I can't find, and I haven't heard a word since.",
      brief:
        'Radek raised a case last week about a missing meeting recording. No update has been sent, and nobody has contacted him.',
    },
    escalated: {
      opening:
        "This is my second call about the missing meeting recording, and I still don't have an answer. I raised the case last week and rang again on Friday.",
      brief:
        'Radek has contacted support twice about the missing recording and still has no answer. His trust is low.',
    },
    closure: {
      opening:
        "I'm calling about the recording I couldn't find. I've been told it has turned up, and I want to check it's the right one before we close the case.",
      brief:
        'Radek expects to confirm that he has the right recording and to understand what happened before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Last Wednesday',
      summary:
        'Radek phoned to say that a Teams meeting recording could not be found. A case was logged.',
    },
    { when: 'Since then', summary: 'No update has been sent, and no engineer has contacted him.' },
  ],

  knownFacts: [
    {
      id: 'kf-cannot-find',
      text: "I can't find the recording. It should have been saved after the meeting.",
      intents: ['problem_description', 'error_message'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration: "I've looked everywhere I can think of.",
      simple: 'I cannot find the recording. It should have been saved after the meeting.',
    },
    {
      id: 'kf-found-now',
      text: "I'm told it has been found. I want to be sure it's the right one.",
      intents: ['problem_description', 'error_message'],
      stages: ['closure'],
      simple: 'I am told it has been found. I want to be sure it is the right one.',
    },
    {
      id: 'kf-meeting',
      text: 'It was our monthly programme steering meeting. It runs for two hours.',
      intents: ['problem_description', 'environment', 'timing_onset'],
      cues: ['meeting', 'how long', 'length', 'duration'],
      simple: 'It was our monthly programme steering meeting. It runs for two hours.',
    },
    {
      id: 'kf-earlier-contact',
      text: "I raised a case last Wednesday. I've had nothing since.",
      intents: ['previous_contact'],
      stages: ['follow-up', 'escalated'],
      simple: 'I raised a case last Wednesday. I have had nothing since.',
    },
    {
      id: 'kf-earlier-contact-closure',
      text: 'I raised a case last Wednesday. I only heard back when they said it had turned up.',
      intents: ['previous_contact'],
      stages: ['closure'],
      simple: 'I raised a case last Wednesday. I only heard back when they said it had turned up.',
    },
    {
      id: 'kf-needs-it',
      text: 'I need it to write up the minutes.',
      intents: ['business_impact', 'expected_outcome'],
      simple: 'I need it to write up the minutes.',
    },
    {
      id: 'kf-teams',
      text: 'We use Teams on company laptops, the desktop app.',
      intents: ['environment'],
      simple: 'We use Teams on company laptops, the desktop app.',
    },
    {
      id: 'kf-outcome',
      text: 'I want the recording found, and I want to know who is dealing with it.',
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple: 'I want the recording found. I want to know who is dealing with it.',
    },
    {
      id: 'kf-outcome-closure',
      text: "I want to be sure it's the right recording, and to know what went wrong.",
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple: 'I want to be sure it is the right recording. I want to know what went wrong.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-meeting-day',
      intents: ['timing_onset'],
      cues: [
        'when was',
        'when did',
        'which day',
        'what day',
        'what date',
        'date',
        'how long ago',
        'last week',
      ],
      text: 'Last week. Tuesday, I think.',
      confirmedText: 'Tuesday afternoon. It started at two.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-chat',
      intents: ['error_message', 'already_tried'],
      cues: ['chat', 'message', 'notification', 'card', 'link'],
      checking: "Hold on, I'll scroll back through the chat.",
      text: "After the meeting there's only a thank-you message from one of the attendees. There's nothing about a recording.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-where-saved',
      intents: ['environment', 'account_details'],
      cues: [
        'where are recordings',
        'where is it saved',
        'where is the recording',
        'where would',
        'stored',
        'saved',
        'onedrive',
        'sharepoint',
        'folder',
      ],
      text: "I don't know where recordings get saved. They just show up in the chat.",
      whoKnows: 'our IT team',
    },
    {
      id: 'uf-expiry',
      intents: ['environment', 'account_details', 'timing_onset'],
      cues: [
        'expire',
        'expiry',
        'retention',
        'kept',
        'keep recordings',
        'how long are recordings',
        'how long do recordings',
        'automatically delete',
        'auto-delete',
        'policy',
      ],
      text: "I don't know how long the company keeps recordings. IT would know.",
      whoKnows: 'our IT team',
    },
    {
      id: 'uf-who-can-record',
      intents: ['account_details'],
      cues: ['allowed to record', 'permission to record', 'licence', 'license', 'who can record'],
      text: "I couldn't say who in the company is allowed to record. I've never had a problem before.",
      whoKnows: 'our administrator',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-reorg',
      text: 'The programme office is being restructured, so nobody is sure who reports to whom at the moment.',
    },
    {
      id: 'if-flight',
      text: "I'm travelling next week, and half my packing is still on my desk.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-office-mailbox',
      importance: 'critical',
      label: 'Booked from the programme office mailbox',
      statement:
        "This one wasn't booked from my calendar. The programme office sent the invite from their shared mailbox, because Hana was doing the bookings that month.",
      partialStatement: "I didn't set that one up myself.",
      revealWhen:
        'Asks who booked or organised the meeting, who sent the invitation, or which calendar or account it was set up from.',
      intents: ['account_details', 'environment'],
      partialIntents: ['problem_description'],
      cues: [
        'booked',
        'who set up',
        'who created',
        'who organised',
        'who organized',
        'organiser',
        'organizer',
        'scheduled',
        'invite',
        'invitation',
        'channel meeting',
        'whose calendar',
      ],
      hint: "It wasn't quite the usual way that meeting got set up.",
      statementTerse:
        'Not from my calendar. The programme office sent it from their shared mailbox.',
      statementSimple:
        'The meeting was not booked from my calendar. The programme office sent the invite from their shared mailbox. Hana was doing the bookings that month.',
      missedConsequence:
        'The one difference from his earlier meetings is never found, so nobody works out whose files might hold the recording, and he keeps chasing a place it was never going to be.',
      betterQuestion:
        'Who booked the meeting, and from which calendar or account was the invitation sent?',
    },
    {
      id: 'hf-earlier-fine',
      importance: 'important',
      label: 'Earlier meetings were recorded properly',
      statement:
        'The earlier steering meetings were fine. I booked those myself, and the recordings turned up in the chat afterwards.',
      revealWhen:
        'Asks whether this has worked before, for example for earlier steering meetings, and what was different this time.',
      intents: ['reproducibility', 'timing_onset'],
      cues: [
        'worked before',
        'happened before',
        'earlier meeting',
        'previous meeting',
        'other meeting',
        'earlier one',
        'last month',
        'first time this',
        'ever had',
        'in the past',
        'ever recorded',
        'recorded before',
      ],
      hint: "It's not the first time we've recorded one of these.",
      statementTerse: 'Earlier ones were fine. I booked those. Recordings showed in the chat.',
      statementSimple:
        'The earlier steering meetings were fine. I booked those myself. The recordings appeared in the chat afterwards.',
      missedConsequence:
        'Without the comparison with earlier meetings, nobody learns that something was different this time, and the call stays on "Teams lost it".',
      betterQuestion:
        'Has this worked before, for example for earlier steering meetings, and what was different this time?',
    },
    {
      id: 'hf-hana-started',
      importance: 'important',
      label: 'Hana started the recording',
      statement:
        "Hana started the recording right at the beginning. She saw the banner come up. I was presenting, so I didn't look.",
      revealWhen:
        'Asks who started the recording, or whether anyone is sure that the recording was actually started.',
      intents: ['reproducibility', 'already_tried'],
      cues: [
        'who started the recording',
        'who pressed',
        'who recorded',
        'start the recording',
        'started the recording',
        'was it started',
        'was started',
        'did anyone start',
        'was the meeting recorded',
        'was it recorded',
        'recorded at all',
        'banner',
      ],
      hint: "I believe somebody started it, but I wasn't the one.",
      statementTerse: 'Hana started it at the beginning. She saw the banner. I was presenting.',
      statementSimple:
        'Hana started the recording at the beginning. She saw the banner. I was presenting, so I did not look.',
      missedConsequence:
        'Nobody learns whether the recording was ever started, or by whom, so there is no one to ask and no place to look first.',
      betterQuestion: 'Do you know whether anyone started the recording, and who it was?',
    },
    {
      id: 'hf-hana-away',
      importance: 'important',
      minDifficulty: 'standard',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'Hana is on leave and not answering',
      statement:
        "Hana's one of the coordinators in the programme office. She's been on leave since Friday, and she's back next Thursday. I've messaged her, but she hasn't answered.",
      revealWhen:
        'Asks whether the person who started the recording can be reached, or whether anyone else can check.',
      intents: ['account_details', 'environment'],
      cues: [
        'ask hana',
        'check with hana',
        'contact hana',
        'reach hana',
        'speak to hana',
        'talk to hana',
        'who is hana',
        'is hana',
        'is she available',
        'is she around',
        'can she check',
        'ask her',
      ],
      statementTerse:
        "Hana's a coordinator in the programme office. On leave until Thursday. No reply.",
      statementSimple:
        'Hana is one of the coordinators in the programme office. She has been on leave since Friday. She is back next Thursday. I sent her a message, but she did not answer.',
      missedConsequence:
        'The person who may hold the recording is away for days and nobody plans around it, so the next step stalls.',
      betterQuestion: 'Could we ask Hana to check, and is she available?',
    },
    {
      id: 'hf-attendees',
      importance: 'helpful',
      label: 'Who attended, including outside guests',
      statement:
        'There were fourteen of us. Three were from one of our partner companies, and two joined by phone.',
      revealWhen:
        'Asks who attended, how many people were there, or whether anyone from outside the company joined.',
      intents: ['affected_scope'],
      cues: [
        'attend',
        'who was there',
        'who was on',
        'who was in',
        'who joined',
        'how many people were',
        'how many were there',
        'outside the company',
        'outside guests',
        'partner',
        'guests',
        'dial in',
      ],
      statementTerse: 'Fourteen. Three from our partner. Two by phone.',
      statementSimple:
        'There were fourteen people. Three were from one of our partner companies. Two joined by phone.',
      missedConsequence:
        'Who was there, and whether outside guests joined, is never established, so nobody knows who else might have a copy or who needs the recording.',
      betterQuestion: 'Who attended the meeting, and did anyone from outside the company join?',
    },
    {
      id: 'hf-callback-promise',
      importance: 'important',
      label: 'Told to expect an update within two days',
      stages: ['follow-up', 'escalated'],
      statement:
        "When I raised it I was told I'd have an update within two working days. That was five days ago, and I've had nothing.",
      revealWhen:
        'Asks what he was told when the case was raised, or what has happened since he first contacted support.',
      intents: ['previous_contact'],
      cues: [
        'what were you told',
        'what did they tell you',
        'when you raised',
        'when you called',
        'since you raised',
        'since you called',
        'promised',
        'was told',
        'any update since',
        'heard anything from us',
        'heard anything since',
        'heard from us',
      ],
      statementTerse: "Told two working days. It's been five days.",
      statementSimple:
        'When I raised the case, they told me I would have an update in two working days. That was five days ago. I have had nothing.',
      missedConsequence:
        'The broken promise goes unacknowledged, so the apology he needs never comes and his trust keeps falling.',
      betterQuestion: 'What were you told when you raised the case, and what has happened since?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-teams-lost-it',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        "I assume Teams has lost it, or someone has deleted it. A recording doesn't just vanish.",
      truth:
        'Nothing confirms that anything was lost or deleted. In this story the meeting was set up differently from his earlier ones, so the recording may be saved somewhere he has not looked.',
    },
  ],

  curveballs: [
    {
      id: 'cb-wants-a-manager',
      type: 'ask-manager',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        "I'd like to speak to a manager, please. I want someone senior to know about this.",
      followUp:
        'I still want a manager. Or at least the name of whoever is dealing with this, and how I reach them.',
      expectedResponse:
        'Acknowledge the request without getting defensive, and the wait if there has been one. Say that you own the case, what you will do first and when he will hear from you, and explain how a manager can join if he still wants one.',
      minDifficulty: 'standard',
      effects: { temperature: 6, trust: -6, patience: -5 },
    },
    {
      id: 'cb-board-deadline',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 8, whenImpactUnacknowledged: true },
      statement:
        'I should be clear about the time. I have a hard deadline coming up, and I need to know what you can do before it.',
      followUp: 'I need to be able to tell people something. What can I tell them, and when?',
      expectedResponse:
        'Acknowledge the deadline, be honest about what you cannot promise yet, and say what you will do first and when he will next hear from you. Offer something he can tell the people who are waiting in the meantime.',
      minDifficulty: 'standard',
      effects: { temperature: 5, patience: -6 },
    },
  ],
  allowedCurveballs: [
    'ask-manager',
    'deadline',
    'unsupported-guarantee',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'What he has looked at so far',
    'Who booked and ran the meeting',
    'Who started the recording',
    'Who attended',
    'What he was told when he raised the case',
    'What depends on the recording',
  ],
  successCriteria: [
    'Opens by acknowledging the wait and saying who owns the case, without excuses or blaming an earlier contact.',
    'Reads the case notes and asks only for what is missing, rather than making Radek start again.',
    'Finds who booked the meeting, who started the recording and who attended, and whether earlier meetings were recorded without trouble.',
    'Stays honest that nobody can yet say where the recording is, and does not guess or promise it will be found.',
    'Handles the request for a manager, or the deadline, calmly, without defending or deflecting.',
    'Agrees a first step, an owner and a specific time for the next update, and summarises before the call ends.',
  ],
  coachingFocus: ['ownership-next-steps', 'scoping-discovery', 'empathy-deescalation'],
  careExpectations: {
    communicate: [
      'Gives a short, honest summary of what is known and not known, and says in plain words what will be checked first.',
      'Confirms the plan back to him in order: the first step, who does it and when he hears next.',
    ],
    accountable: [
      'Acknowledges the days of silence and takes ownership of the case, without blaming a colleague or an earlier contact.',
      'Promises only what is in their control, such as their own actions and the time of the next update, not that the recording will be found.',
    ],
    resourceful: [
      'Asks who booked the meeting, who started the recording and who attended, so that the next step points to a place to look.',
      'Asks how earlier meetings went, and whether the person who started the recording can be reached.',
    ],
    empathetic: [
      'Names the wait and the pressure from the board in specific words, not a stock apology.',
      'Stays calm and unhurried when he asks for a manager, and does not take the request personally.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Asking him to describe the whole problem again from the start, as if the case had never been raised.',
    'Blaming the earlier handling, or "the system", for the silence instead of owning it.',
    "Promising that the recording will be found, or that it is definitely in someone's files, without evidence.",
    'Telling him to ask his own IT team to look, with no plan for what support will do.',
    'Ending with "we will look into it" and no named person or time.',
  ],
  goodBehaviours: [
    'Opening by acknowledging the wait and saying who owns the case now.',
    'Reading the case first, so that he does not have to repeat himself, then asking only what is missing.',
    'Asking who booked the meeting, who started the recording and who was there.',
    'Asking whether earlier meetings were recorded and found, and what was different this time.',
    'Saying plainly what is not yet known, without guessing where the recording is.',
    'Agreeing a first step, an owner and a specific time for the next update, then summarising.',
  ],
  expectedOutcome:
    'Radek knows who owns the case and has had an apology for the silence. He understands that this meeting was set up differently from his earlier ones and that the person who started the recording is away. The engineer has agreed a first step, who does it and when Radek will hear next, and he has something to tell the board in the meantime.',
  evaluatorNotes:
    "Case context in the story (a plausible possibility, not confirmed on the call): this meeting was sent from the programme office's shared mailbox rather than Radek's calendar, and Hana started the recording, so the recording may sit with her (a current public page describes where the recording goes when a shared mailbox is the organiser), and she is on leave. Earlier meetings, which he booked himself, were fine. When he raised the case he was promised an update within two working days and has had none. A strong call acknowledges the wait without excuses, owns the case, scopes who booked, started and attended, stays honest about what is unknown, handles the request for a manager calmly and agrees a first step, an owner and a time for the next update.",
} satisfies ScenarioInput;

export default scenario;
