import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario (closure call). Everything here is fictional: people, organisation and case.
//
// Root cause (hidden from the trainee): two Tuesdays ago a colleague, Tobias, cleaned up the device
// groups and a batch of managed laptops ended up in a group with stricter requirements. They began
// to be flagged as not meeting requirements, and their users were blocked from email and the shared
// drive for a day or so. Last Friday Callum moved the laptops back and asked them to check in
// again, and most of them turned fine. The ones still flagged are probably the pop-up team's
// laptops, which are only switched on at events and have likely not checked in since he moved them
// back. That team has an event this Saturday and takes orders on them. Callum has only looked at the
// dashboard summary since Friday and told his team lead on Monday that it was sorted. This is a
// plausible story for the case, not a claim about how the product works. A strong call verifies
// instead of assuming, turns his vague answers into specifics one question at a time, does not
// confirm what nobody has checked, finds the Saturday event, agrees an owner and a date for the open
// laptops, and slows down if he cools.

const scenario = {
  id: 'intune-devices-not-compliant-closure',
  version: 1,
  title: 'Closing a case on laptops that showed as not compliant',
  shortTitle: 'Laptops showed as not compliant',
  listSummary:
    'An endpoint engineer wants to be sure the managed laptops are fine before closing the case.',
  summary:
    'Callum is an endpoint engineer. A group of managed laptops showed as not meeting requirements, and the numbers look better now. He has called back to be sure before the case is closed. He is calm but imprecise at first and becomes specific when asked focused questions. He cools quickly if he feels rushed.',
  tags: ['closure', 'device compliance', 'verification', 'vague customer'],
  estimatedMinutes: 12,

  product: { id: 'intune', area: 'Device compliance' },
  caseReference: 'SIM-420004',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    revisedOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-learn'],
    behaviourCheck: 'checked-partly',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    review: 'assistant-reviewed',
    notes:
      "Reviewed on 22 Nov 2026 against current public Microsoft Learn pages on device compliance policies, monitoring them and the sync action. The offline-laptop explanation stays a hypothesis; blocking is tied to Conditional Access; wording hedged. AI-assisted review, not a mentor's.",
  },
  issueType: 'setup-deployment',
  impact: 'medium',
  startingTemperature: 'calm',
  proficiency: 'intermediate',
  style: 'vague',
  callStage: 'closure',
  difficulty: 'standard',

  persona: {
    name: 'Callum Reid',
    speaker: 'male',
    role: 'Endpoint Engineer',
    organisation: 'Fourth Coffee',
    background:
      "Callum looks after the laptops used by Fourth Coffee's stores and head-office teams. He is comfortable with common device-management terms and basic troubleshooting, and he is busy. He would like to close the case, but he does not want a second round of complaints.",
    voice:
      "Relaxed and easygoing, but imprecise. Says 'a few', 'most of them', 'I think' and 'sometime last week' until asked something specific, then answers precisely, often after checking. Becomes shorter and cooler if the engineer rushes to close without checking. Never rude.",
  },
  environment: {
    details: [
      'Fourth Coffee manages laptops with Intune; security uses Conditional Access to require compliant devices for email and shared cloud files',
      'A clean-up of the device groups by a colleague put a batch of laptops, used by the store support team and the pop-up team, into a group with stricter requirements',
      'The pop-up team laptops are only switched on at events, and some have not been on since Callum moved the batch back',
      'While the laptops were flagged, their users reported being blocked from company email and the shared drive',
      'Last Friday Callum moved the laptops back to their usual group and asked them to check in again from the management console, and most then showed as fine',
      'The dashboard summary looks mostly healthy. Callum has not been through the full device list since Friday',
    ],
  },
  affectedUsers: {
    low: { count: 6, summary: 'Six laptops in the store support team and the pop-up team' },
    medium: {
      count: 40,
      summary: 'About forty laptops used by the store support and pop-up teams',
    },
    high: {
      count: 300,
      summary: 'About three hundred laptops across the stores, the pop-up teams and head office',
    },
  },
  customerObjective:
    'Be sure every laptop in the group really is fine before he agrees to close the case, and avoid a second round of complaints.',
  customerExpectation:
    'An honest check rather than a quick close, a clear view of anything still open, and an agreed way to finish it off if some laptops are not yet fine.',
  desiredOutcome:
    'Callum knows exactly which laptops are still open and why, and has agreed with the engineer either to close the case or to keep it open with a named owner and a date.',
  previousTroubleshooting: [
    'Waited a few days to see whether the laptops would sort themselves out, on support advice',
    'On Friday moved the laptops back to their usual group and asked them to check in again from the management console, after which most showed as fine',
    'Looked at the dashboard summary on Monday and this morning, but not the full device list',
  ],
  recentChanges: [
    'A colleague cleaned up the device groups two Tuesdays ago, and a batch of laptops ended up in a group with stricter requirements, so they began to be flagged that day or the next',
    'No other change to the laptops that Callum knows of',
  ],

  publicBrief: {
    issue:
      'Managed laptops showed as not meeting requirements. Things look better, and he wants to be sure before closing.',
    impact: {
      low: 'A handful of laptops were affected. Low pressure, but he wants it done properly.',
      medium: 'A group of laptops was affected and the users were disrupted. He wants certainty.',
      high: 'A large share of the company laptops was affected, so closing too early is risky.',
    },
    objective:
      'Confirm what is really resolved, find anything still open, and agree whether the case can close.',
    knownContext:
      'Callum is relaxed but imprecise. Focused questions get specific answers, and rushing him makes him less forthcoming.',
    previousContact:
      'Callum opened the case last week. Support advised waiting for the laptops to check in again. The case is open pending his confirmation.',
    environment:
      'Company laptops managed centrally. Callum looks after the laptops used by the stores and head office.',
  },
  brief: {
    situation:
      'Callum is an endpoint engineer. A group of managed laptops showed as not meeting requirements, and support advised him last week. He says things look better now and wants to be sure before the case is closed.',
    goal: 'Find out what has really been confirmed, check for anything still open, and agree whether the case can close or what must happen first.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'You cannot see his device list in this practice call. Ask what he sees and rely on his answers.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'What has actually been confirmed is for you to find out.',
    ],
  },

  openingCore:
    "I've had a bunch of our managed laptops showing up as not meeting the requirements.",
  impactVariants: {
    low: {
      summary:
        "It's only a handful of laptops, so it's not a big deal, but I'd like it properly sorted.",
      detail:
        "Six laptops, I think, across two teams. Their users couldn't get into a few things for a day, but they coped.",
      deadline: "No date has been set for closing the case, but I'd rather not leave it hanging.",
    },
    medium: {
      summary:
        "It's a good number of laptops, and people have been a bit stuck, so I'd like it properly sorted.",
      detail:
        "About forty laptops, I think, across a couple of teams. For a day or so people couldn't get into email or the shared drive, and a couple of store managers complained.",
      deadline: 'My team lead wants an answer by the end of the week.',
    },
    high: {
      summary:
        "It's a large chunk of the laptops, and lots of people have been stuck, so I need it properly sorted.",
      detail:
        "Around three hundred laptops, across the stores and head office. For a day or two people couldn't get into email or the shared drive, and it went all the way up to the directors.",
      deadline: 'The directors want to hear it is closed by the end of the week.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on my case about the laptops that showed as not meeting requirements, because I haven't had an update since last week. Could you tell me where we've got to?",
      brief:
        'This is a follow-up call. Callum wants an update on his case about laptops that showed as not meeting requirements.',
    },
    escalated: {
      opening:
        "This is my second call about the laptops that showed as not meeting requirements, and I still don't have a clear answer. Could you tell me where this actually stands?",
      brief:
        'Callum has called twice about the laptops and still has no clear answer. He is polite but wants certainty.',
    },
    closure: {
      opening:
        "I'm calling about my case on the laptops that showed as not meeting requirements. Things look a lot better now, I think, so before it's closed I'd like to go through where we've got to.",
      brief:
        'This is a closure call. Callum thinks the laptops are fine now and wants to be sure before the case is closed. Check what has really been confirmed.',
    },
  },
  priorHistory: [
    {
      when: 'Last Thursday',
      summary:
        'Callum phoned support because a group of managed laptops showed as not meeting requirements. A case was opened. Support advised waiting for the laptops to check in again and looking at the list again after a few days.',
    },
    {
      when: 'Last Friday',
      summary:
        'Callum emailed to say he had taken some steps on his side and that most of the laptops now looked fine. Support replied that the case would stay open until he confirmed.',
    },
    {
      when: 'Monday',
      summary: 'Callum asked for a call back to confirm things before the case is closed.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-what-happened',
      text: 'A bunch of our managed laptops showed up as not meeting the requirements, and their users got blocked from a few things.',
      intents: ['problem_description'],
      simple:
        'Some of our managed laptops showed as not meeting the requirements. Their users were blocked from some things.',
    },
    {
      id: 'kf-looks-better',
      text: 'It looks a lot better now. Most of the laptops are showing as fine on the dashboard.',
      intents: ['problem_description', 'error_message'],
      stages: ['closure'],
      simple: 'It looks much better now. Most laptops show as fine on the dashboard.',
    },
    {
      id: 'kf-case',
      text: 'I opened the case last week, and support gave me some advice on the phone.',
      intents: ['previous_contact'],
      stages: ['follow-up', 'escalated', 'closure'],
      simple: 'I opened the case last week. Support gave me some advice on the phone.',
    },
    {
      id: 'kf-friday-checkin',
      text: 'On Friday I sorted a few things on the admin side and asked the laptops to check in again. Most of them went green after that.',
      intents: ['already_tried'],
      stages: ['closure'],
      simple:
        'On Friday I did a few things on the admin side and asked the laptops to check in again. Most of them went green after that.',
    },
    {
      id: 'kf-environment',
      text: "They're all company laptops that we manage through Intune. Some are for the stores, some for head office.",
      intents: ['environment'],
      simple:
        'They are company laptops that we manage through Intune. Some are for stores and some are for head office.',
    },
    {
      id: 'kf-outcome',
      text: "I'd like to close it, but only if I'm sure it's actually sorted. I don't want a second round of complaints.",
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple: 'I want to close the case, but only if it is fixed. I do not want more complaints.',
    },
    {
      id: 'kf-outcome-open',
      text: "I want those laptops sorted properly, and I don't want a second round of complaints.",
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple: 'I want the laptops fixed properly. I do not want more complaints.',
    },
  ],

  vagueFacts: [
    {
      id: 'vf-when-flagged',
      intents: ['timing_onset'],
      text: 'It was sometime the week before last, I think. Tuesday or Wednesday? I would have to check the date.',
      confirmedText:
        'The first complaints came in on the Wednesday morning, so it may have started on the Tuesday.',
    },
    {
      id: 'vf-support-advice',
      intents: ['previous_contact', 'already_tried'],
      cues: [
        'advice',
        'told you',
        'support said',
        'what were you told',
        'recommended',
        'suggested',
      ],
      stages: ['follow-up', 'escalated', 'closure'],
      text: 'Support said something about waiting for them to check in again. And maybe looking at the list again after a few days? I would have to check my notes.',
      confirmedText:
        'Yes: wait for the laptops to check in again, then look at the list again after a few days.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-device-list',
      intents: ['affected_scope', 'problem_description'],
      cues: [
        'full list',
        'device list',
        'filter',
        'by group',
        'look at the list',
        'pull up',
        'which ones are',
      ],
      stages: ['closure'],
      checking: 'Hang on, let me open the list and filter it.',
      text: 'Right. The ones still marked as not meeting the requirements are all in the pop-up group. None from the stores or head office.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-requirement-detail',
      intents: ['account_details', 'environment'],
      cues: [
        'what are the requirements',
        'which requirements',
        'what requirement',
        'what does it check',
        'what rules',
      ],
      text: "I don't know the detail of the requirements, or the reasons behind them. That's our security team's side.",
      whoKnows: 'our security team',
    },
    {
      id: 'uf-other-teams',
      intents: ['affected_scope'],
      cues: ['other sites', 'other stores', 'other regions', 'other teams'],
      text: "I only look after these laptops, so I don't know whether other teams saw the same.",
      whoKnows: 'the other endpoint teams',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-standup',
      text: "I've got a team stand-up later, so I'm half watching the clock.",
    },
    {
      id: 'if-printer',
      text: "We've also had a printer saga at head office this week, which is a different story.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-not-looked-at-list',
      importance: 'critical',
      label: 'He has only looked at the dashboard summary',
      statement:
        "To be honest, I've only looked at the summary on the dashboard since Friday. I haven't been through the full list, so I can't say for sure that every laptop is fine.",
      revealWhen:
        'Asks how he knows the laptops are fine now, what he has actually checked since Friday, or whether he has looked at every laptop.',
      intents: ['already_tried', 'reproducibility'],
      cues: [
        'how do you know',
        'have you checked',
        'have you looked',
        'did you check',
        'how have you checked',
        'full list',
        'device list',
        'every laptop',
        'all the laptops',
        'all of them',
        'are you sure',
        'confirmed',
      ],
      hint: "I've mostly been going by the dashboard, if I'm honest.",
      statementTerse: "I've only looked at the dashboard summary since Friday. Not the full list.",
      statementSimple:
        'I only looked at the dashboard summary since Friday. I did not go through the full list. So I cannot be sure about every laptop.',
      missedConsequence:
        'The case closes on a summary figure nobody has checked, and any laptop that is still flagged comes back as a new complaint.',
      betterQuestion:
        'How do you know that every laptop is fine now, and what have you actually looked at since Friday?',
    },
    {
      id: 'hf-group-cleanup',
      importance: 'important',
      label: 'A clean-up put a batch of laptops in the wrong group',
      statement:
        "Tobias on our team did a clean-up of the device groups two Tuesdays ago, and a batch of the laptops ended up in a group with stricter requirements. That's when they started getting flagged. I moved them back on Friday.",
      revealWhen:
        'Asks what changed before the laptops were flagged, including anything his own team did, or what exactly he did on Friday to get most of them fixed.',
      intents: ['recent_changes'],
      hint: "There was a bit of a tidy-up on our side before this started, but I don't think it matters.",
      statementTerse:
        'A clean-up of the device groups two Tuesdays ago put a batch in the wrong group. I moved them back on Friday.',
      statementSimple:
        'Tobias on our team cleaned up the device groups two Tuesdays ago. A batch of laptops went into a group with stricter requirements. They were flagged then. I moved them back on Friday.',
      missedConsequence:
        'What changed stays unexplained, so the closing explanation is a guess and Callum cannot tell his team lead why it happened or what was done to fix it.',
      betterQuestion:
        'Did anything change before the laptops were flagged, such as a rule, a setting or something somebody on your team did?',
    },
    {
      id: 'hf-popup-offline',
      importance: 'important',
      minDifficulty: 'standard',
      label: "The laptops still flagged are probably the pop-up team's",
      statement:
        "The ones I'd worry about are the pop-up team's laptops. They're only switched on at events, so I doubt they've checked in at all since I moved them back. I haven't confirmed that, mind.",
      revealWhen:
        'Asks which laptops are still not fine, what they have in common, or why some might not have recovered.',
      intents: ['affected_scope', 'environment'],
      cues: [
        'which ones',
        'which laptops',
        'in common',
        'pattern',
        'any left',
        'still showing',
        'still flagged',
        'still red',
        'still open',
        'remaining',
        'outstanding',
        'stragglers',
      ],
      statementTerse: "The pop-up team's laptops. Only switched on at events. Not confirmed.",
      statementSimple:
        'I think the laptops still flagged belong to the pop-up team. They are only switched on at events. So they probably did not check in since I moved them back. I have not confirmed this.',
      missedConsequence:
        'The group most likely to still be open is never identified, so the engineer cannot suggest a targeted check or a way to deal with them.',
      betterQuestion:
        'Which laptops are still showing as flagged, and what do they have in common?',
    },
    {
      id: 'hf-event-saturday',
      importance: 'important',
      minDifficulty: 'standard',
      availableAfterTurn: 2,
      label: 'The pop-up team needs those laptops on Saturday',
      statement:
        "The pop-up team has an event this Saturday, and they take orders on those laptops. If they're still blocked when they switch them on, the staff will be stuck.",
      revealWhen:
        'Asks when the affected laptops are next needed, whether anything is coming up, or what happens if some are still not fine.',
      intents: ['urgency_deadline', 'business_impact'],
      cues: [
        'any events',
        'an event',
        'saturday',
        'coming up',
        'this weekend',
        'next used',
        'when are they',
        'next week',
        'deadline',
        'if some are',
        'if any are',
      ],
      statementTerse:
        "The pop-up team's event is this Saturday. They take orders on those laptops.",
      statementSimple:
        'The pop-up team has an event this Saturday. They take orders on those laptops. If the laptops are still blocked, the staff cannot work.',
      missedConsequence:
        'The Saturday event, which makes the open laptops urgent, stays hidden, so the case closes or drifts with no date that matters.',
      betterQuestion:
        'When will the laptops that are still flagged next be used, and what happens if they are still blocked then?',
    },
    {
      id: 'hf-told-team-lead',
      importance: 'helpful',
      minDifficulty: 'challenge',
      minTrust: 42,
      availableAfterTurn: 3,
      label: 'He has already told his team lead it was sorted',
      statement:
        "I told my team lead on Monday that it was sorted, going by the dashboard. I'd rather not go back and say 'not quite', but I'd rather that than be caught out.",
      revealWhen:
        'Asks who else knows the situation, what he has told colleagues or managers, or who is waiting for the case to be closed.',
      intents: ['previous_contact', 'affected_scope'],
      cues: [
        'team lead',
        'your manager',
        'told anyone',
        'who have you told',
        'who else knows',
        'who is waiting',
        'reported',
      ],
      statementTerse: 'I told my team lead on Monday it was sorted, from the dashboard.',
      statementSimple:
        'On Monday I told my team lead it was fixed. I looked at the dashboard. I do not want to go back and say it is not fixed, but I prefer that to being wrong.',
      byImpact: {
        high: {
          statement:
            "I told my team lead on Monday that it was sorted, going by the dashboard, and he passed that up to the directors. I'd rather not go back and say 'not quite', but I'd rather that than be caught out.",
          statementTerse:
            'I told my team lead on Monday it was sorted, from the dashboard. He told the directors.',
          statementSimple:
            'On Monday I told my team lead it was fixed. I looked at the dashboard. He told the directors. I do not want to go back and say it is not fixed, but I prefer that to being wrong.',
        },
      },
      missedConsequence:
        'The pressure that makes him want to close is missed, and the engineer cannot help him word an accurate update for his team lead.',
      betterQuestion:
        'Who else is expecting this case to be closed, and what have you told them so far?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-rest-will-sort-itself',
      statement: "I'd say the rest will just sort themselves out. They usually do.",
      truth:
        "Some laptops remain flagged. They may be the pop-up team's and may not have checked in; check the device list and last contact before Saturday.",
    },
  ],

  curveballs: [
    {
      id: 'cb-confirm-all-fine',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 10 },
      statement:
        "So can you confirm every laptop's fine now? I need to be able to say that to my team lead.",
      followUp: "Can you say that, or can't you?",
      expectedResponse:
        'Do not confirm what has not been checked. Say honestly what you can and cannot see from here, agree how the remaining laptops will be verified and by whom, and say what you will do next and when.',
      minDifficulty: 'standard',
      effects: { temperature: 5, patience: -4 },
    },
    {
      id: 'cb-goes-quiet',
      type: 'go-silent',
      trigger: { earliestTurn: 3, latestTurn: 8, whenOwnershipUnclear: true },
      statement: 'Hm. Right, okay.',
      followUp: "Sorry, I'm still here. I'm just not sure we've actually checked anything yet.",
      expectedResponse:
        'Notice that he has gone quiet, check in gently with an open question about what is bothering him, and slow down instead of pushing on to close the case. Offer to go through what has and has not been checked.',
      minDifficulty: 'standard',
      effects: { patience: -4 },
    },
    {
      id: 'cb-closed-too-soon-before',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 4, latestTurn: 9, whenOwnershipUnclear: true },
      statement:
        "Last time a case got closed on me quickly, the same laptops came back a week later and I had to start all over again. I don't want that.",
      followUp: 'So what are you going to do differently this time?',
      expectedResponse:
        'Acknowledge the earlier experience without defending it, say that you will not close until the remaining laptops are verified, and say what you will do and by when.',
      minDifficulty: 'challenge',
      effects: { temperature: 6, trust: -6 },
    },
  ],
  allowedCurveballs: ['unsupported-guarantee', 'go-silent', 'previous-bad-experience'],

  expectedDiscoveryAreas: [
    'How he has checked the laptops are back to normal',
    'Which laptops, if any, are still open',
    'What changed before the laptops were flagged',
    'What the laptops are used for and when',
    'What he has told others',
  ],
  successCriteria: [
    'Confirms why Callum has called and what he needs from the call, without rushing to close.',
    'Asks how he knows every laptop is fine, and finds that he has only looked at the dashboard summary.',
    'Finds out which laptops, if any, are still open, why that might be, and when they will next be used.',
    'Asks what changed before the laptops were flagged and what has been done since.',
    'Does not confirm anything that has not been checked, and agrees how the remaining laptops will be verified, by whom and by when.',
    'Summarises what is confirmed and what is not, and agrees whether the case closes or stays open with an owner and a date.',
  ],
  coachingFocus: ['scoping-discovery', 'ownership-next-steps', 'closing'],
  careExpectations: {
    communicate: [
      'Asks focused questions one at a time that turn his vague answers into specifics, instead of stacking several questions at once.',
      'Summarises what is confirmed and what is not in plain words before proposing to close.',
    ],
    accountable: [
      'Does not agree to close until the remaining laptops are verified, or until the open items have an owner and a date.',
      'Refuses to confirm that every laptop is fine when that has not been checked, and says what they will do next and when.',
    ],
    resourceful: [
      'Suggests a concrete way for Callum to verify, such as looking at the full list for the group instead of the dashboard summary, and checking when the offline laptops next come on.',
      'Links the laptops that are still open to the event on Saturday and proposes how to deal with them before then.',
    ],
    empathetic: [
      'Acknowledges that he is busy and does not want a second round of complaints.',
      'Notices when he goes quiet or short, and slows down instead of pushing on to close.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Closing the case as soon as he says things look better, without asking how he knows or what he has actually looked at.',
    'Confirming that every laptop is fine when only the summary has been seen.',
    'Accepting vague answers such as "a few" and "most of them" without asking for specifics.',
    'Rushing to wrap up and sounding relieved to end the call, which makes him go quiet and less forthcoming.',
    'Leaving the open laptops without an owner or a date.',
  ],
  goodBehaviours: [
    'Confirming the reason for the call and not assuming that the case can close.',
    'Asking how he knows every laptop is fine and whether he has looked at the full list.',
    'Turning "a few" into a number and a group with one focused question at a time.',
    'Asking what the laptops are used for and when the ones still open will next be needed.',
    'Being honest about what cannot be confirmed on the call, and agreeing how and when it will be.',
    'Summarising what is confirmed, what is open and who owns it, then checking he is comfortable.',
  ],
  expectedOutcome:
    'Callum has looked beyond the dashboard summary, knows which laptops are still flagged and what might explain it, and understands that the Saturday event is the deadline. The engineer has not confirmed anything unchecked, and they have agreed either to keep the case open with a named owner and a date, or to close it once the laptops are verified.',
  evaluatorNotes:
    "Root cause (a plausible story, not a product claim): two Tuesdays ago a colleague's clean-up of the device groups put a batch of laptops in a group with stricter requirements, so they were flagged and their users blocked. Last Friday Callum moved them back and asked them to check in, and most turned fine. The ones still flagged are probably the pop-up team's laptops, switched on only at events and needed this Saturday. Callum has only looked at the dashboard summary and told his team lead it was sorted. A strong call verifies instead of assuming, turns vague answers into specifics, confirms nothing unchecked, agrees an owner and a date for the open laptops, and slows down if he cools.",
} satisfies ScenarioInput;

export default scenario;
