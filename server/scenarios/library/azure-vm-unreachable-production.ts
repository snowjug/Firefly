import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario. Everything here is fictional: people, organisation and case. The product is
// real, so the customer only describes what she sees and was told, in everyday words.
//
// Root cause (hidden from the trainee; plausible, not validated product behaviour): the airline's own
// platform team ran a planned change overnight and moved the virtual machine to a smaller size to save
// cost. It came back up, then ran short of capacity and stopped responding when the morning check-in
// load began. The portal still lists it as running, so Olivia believes the platform is at fault. The
// standby machine in another region was last refreshed for a test months ago, and the platform lead
// who knows the machine is on a flight, so only an on-call engineer without authority to approve
// production changes is reachable.
//
// A strong call does not guess the fix. It takes ownership in the first minute without defending the
// platform or blaming her team, acknowledges what is at stake at the airports, asks what changed
// without sounding like an accusation, looks for a way to keep check-in moving, handles the request
// for a manager and the deadline calmly, promises no fix time, and agrees a specific time and rhythm
// for updates.

const scenario = {
  id: 'azure-vm-unreachable-production',
  version: 1,
  title: 'Production virtual machine unreachable, airport check-in affected',
  shortTitle: 'Production virtual machine unreachable',
  listSummary:
    'An airline director reports a production virtual machine has stopped responding and airport check-in is affected.',
  summary:
    'The director of digital operations at Blue Yonder Airlines is calling about a production virtual machine that has stopped responding. Airport check-in systems depend on it. She is under heavy pressure, speaks in short sentences, and expects someone to take charge, be straight with her and say when she will hear back.',
  tags: ['azure', 'virtual machines', 'outage', 'production', 'executive'],
  estimatedMinutes: 14,

  product: { id: 'azure', area: 'Virtual machines' },
  caseReference: 'SIM-440001',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    revisedOn: '2026-11-22',
    productFamily: 'azure',
    sourceCategories: ['microsoft-learn'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    review: 'assistant-reviewed',
    notes:
      "Checked on 22 Nov 2026 against current public Microsoft Learn pages on resizing a VM, VM states and billing, and troubleshooting VM connectivity. A real company name removed from the persona background; deadline wording scoped to impact. AI-assisted review, not a mentor's.",
  },

  issueType: 'service-outage',
  impact: 'high',
  startingTemperature: 'angry',
  proficiency: 'expert',
  style: 'terse',
  callStage: 'first-contact',
  difficulty: 'challenge',

  persona: {
    name: 'Olivia Ashdown',
    speaker: 'female',
    role: 'Director of Digital Operations',
    organisation: 'Blue Yonder Airlines',
    background:
      "Olivia is accountable for the systems that keep check-in, bag drop and boarding moving at the airline's airports. She came up through infrastructure, so she follows the technical detail, but today she is the person who answers to operations control for every delayed departure.",
    voice:
      'Terse and direct. Short sentences, technical words used correctly, no small talk. Challenges vague answers and asks who owns the case and when she will hear back. Never abusive. Eases a little when someone takes charge and gives a specific time, and turns sharper if asked to repeat herself.',
  },
  environment: {
    details: [
      "The airline's check-in, bag-drop and gate-scanning systems run against a production virtual machine in Azure.",
      'Web and mobile check-in run separately and are working normally.',
      "A platform team looks after the airline's cloud estate and keeps an on-call rota.",
      'Operations control relays check-in status to the duty manager at each airport.',
      'Every airport has a manual paper process for check-in when the systems are down.',
    ],
  },
  affectedUsers: {
    low: { count: 15, summary: 'Check-in agents at one small regional airport.' },
    medium: { count: 90, summary: 'Check-in and bag-drop agents at three airports.' },
    high: {
      count: 450,
      summary: 'Check-in, bag-drop and gate staff at every airport, plus queuing passengers.',
    },
  },
  customerObjective:
    'Get airport check-in working again as fast as possible, and have one engineer who owns the case and keeps operations control informed.',
  customerExpectation:
    'A named owner who takes charge straight away, a plan she can relay to operations control, and honest times for the next update.',
  desiredOutcome:
    'Check-in stable again, with a clear owner, a regular update rhythm, and enough information for her platform team to work with a specialist engineer.',
  previousTroubleshooting: [
    'The platform team restarted the virtual machine from the portal twice, with no effect.',
    'The team checked the service status page for the region and found nothing reported.',
  ],
  recentChanges: [
    'The check-in application had its last scheduled release two weeks ago and has been stable since.',
  ],

  publicBrief: {
    issue: 'A production virtual machine behind airport check-in has stopped responding.',
    impact: {
      low: "One small airport's check-in is affected; agents work manually and flights may run late.",
      medium: 'Three airports are working manually and queues are building at check-in.',
      high: 'Check-in is down at every airport; passengers are queuing and flights are at risk.',
    },
    objective:
      'Take ownership, understand the outage and its impact, and agree clear next steps and update times.',
    knownContext:
      'Airport check-in systems depend on the machine. The caller is a senior director who wants one person to own the case.',
    environment:
      'Production workload on Azure virtual machines supporting airport check-in, bag drop and gate scanning.',
  },
  brief: {
    situation:
      'The director of digital operations at an airline is calling about a production virtual machine that has stopped responding. Airport check-in systems depend on it. She is under heavy pressure and expects someone to take charge.',
    goal: 'Take ownership early, find out what is affected and what led up to the outage, look for a way to keep check-in moving, and agree what happens next and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      "You cannot see the customer's environment in this practice call, so rely on what she tells you.",
    ],
  },

  openingCore: 'The production virtual machine behind our airport check-in stopped responding.',
  impactVariants: {
    low: {
      summary: "Only one small airport depends on it. Its agents are on paper, and it's slow.",
      detail:
        "Only the desks at one regional airport use that machine, about fifteen agents. They're checking passengers in on paper. It works, but it's slow, and some flights from there may leave late.",
      deadline:
        'The next departures from that airport are in a few hours. I want it back before then.',
    },
    medium: {
      summary: 'Three airports are on paper and the queues are building.',
      detail:
        "Three airports use that machine, about ninety agents between them. They're on paper, the queues are building, and flights will leave late if this drags on.",
      deadline:
        'The next big wave of departures is within a couple of hours. I need it stable before then.',
    },
    high: {
      summary: 'Every airport desk is affected. Passengers are queuing and flights are at risk.',
      detail:
        'Every airport we serve depends on that machine, around four hundred and fifty check-in, bag-drop and gate staff. Operations control is already talking about delays and cancellations.',
      deadline:
        "The first morning wave of departures is close. If check-in isn't stable before it, operations control starts cancelling flights.",
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case I raised earlier about the outage. Check-in is still affected, and nobody has called me back.",
      brief:
        'Olivia raised a case earlier about the same outage and has not had a call back. Check-in is still affected.',
    },
    escalated: {
      opening:
        "This is my second call about this outage, and I still don't have an owner. Check-in is still affected, and I need someone who takes charge.",
      brief:
        'Earlier contact has not resolved the outage and Olivia feels passed around. She wants an owner and a clear plan.',
    },
    closure: {
      opening:
        "I'm calling to confirm the machine is stable so we can close the case. I also want to know what caused it and what stops it happening again.",
      brief:
        'Olivia expects a wrap-up: confirmation that check-in is stable, what caused the outage and what happens next.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier today',
      summary:
        'Olivia reported that a production virtual machine had stopped responding and that airport check-in was affected. A case was logged and she was told an engineer would be in touch.',
    },
    {
      when: 'Since then',
      summary:
        'An automatic acknowledgement was sent. No engineer has been assigned and nobody has called her back.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-what',
      text: "The production virtual machine behind our airport check-in has stopped responding. Our desks and kiosks can't reach it.",
      intents: ['problem_description'],
      elaboration:
        "It's the machine the whole check-in flow runs against, so nothing downstream works either.",
      simple:
        'The main machine for our airport check-in does not answer. The desks and kiosks cannot reach it.',
    },
    {
      id: 'kf-symptom',
      text: 'The monitoring checks are failing. Nothing from the airports gets an answer.',
      intents: ['error_message', 'problem_description'],
      cues: [
        'error',
        'what are you seeing',
        'what do you see',
        'symptom',
        'failing',
        'what does it say',
        'what happens',
        'monitoring',
        'message',
        'exactly',
      ],
      simple: 'The monitoring checks fail. Nothing from the airports gets an answer.',
    },
    {
      id: 'kf-dependents',
      text: 'Check-in desks, kiosks and bag drop run against it. Web and mobile check-in are fine.',
      intents: ['affected_scope', 'environment'],
      cues: [
        'depend',
        'what systems',
        'which systems',
        'what runs',
        'what uses',
        'still working',
        'anything else',
        'web check-in',
        'mobile',
        'only',
      ],
      simple: 'Check-in desks, kiosks and bag drop use it. Web and mobile check-in work fine.',
    },
    {
      id: 'kf-tried',
      text: 'My team restarted it from the portal twice. It made no difference.',
      intents: ['already_tried'],
      simple: 'My team restarted it from the portal two times. Nothing changed.',
    },
    {
      id: 'kf-team',
      text: 'A platform team looks after it day to day. I look after the business side.',
      intents: ['account_details'],
      cues: [
        'platform team',
        'your team',
        'who looks after',
        'who supports',
        'who runs',
        'who manages',
        'who is responsible',
        'who owns',
      ],
      simple: 'A platform team looks after it every day. I look after the business side.',
    },
    {
      id: 'kf-outcome',
      text: 'I want it back, and I want one person who owns this until it is.',
      intents: ['expected_outcome'],
      simple: 'I want it working again. I want one person to own this until it is fixed.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-region',
      intents: ['environment'],
      cues: [
        'region',
        'where is it',
        'where does it run',
        'located',
        'location',
        'data centre',
        'datacenter',
        'hosted',
      ],
      text: "I believe it's in our main European region, but I'd want my platform lead to confirm.",
      confirmedText: 'Yes, the main European region. My platform team would have the exact name.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-first-alert',
      intents: ['timing_onset'],
      cues: [
        'when did',
        'when was',
        'first alert',
        'first notice',
        'first noticed',
        'what time',
        'how long',
        'since when',
      ],
      checking: "Hold on, I'll pull up the first alert.",
      text: 'The first alert came in at ten to five in the morning.',
    },
    {
      id: 'cf-status-page',
      intents: ['already_tried', 'environment'],
      cues: ['status page', 'service health', 'known issue', 'incident', 'outage on our side'],
      checking: "One moment, I'll ask my team what the status page says.",
      text: 'My team says the status page shows nothing reported for our region.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-vm-name',
      intents: ['environment', 'account_details'],
      cues: [
        'name of the',
        'machine name',
        'vm name',
        'what is it called',
        'which vm',
        'which machine',
        'which virtual machine',
        'resource name',
        'resource group',
        'subscription',
      ],
      text: "I don't have the machine's name or the subscription to hand. My platform lead has those.",
      whoKnows: 'our platform lead',
    },
    {
      id: 'uf-guest-logs',
      intents: ['error_message', 'reproducibility'],
      cues: ['logs', 'log files', 'event log', 'console output', 'boot', 'inside the machine'],
      text: "I haven't seen anything from inside the machine. Whoever is on call would have to look.",
      whoKnows: 'our on-call engineer',
    },
    {
      id: 'uf-support-plan',
      intents: ['account_details'],
      cues: ['support plan', 'support agreement', 'support contract', 'severity', 'priority level'],
      text: "I don't know which support plan we're on. Procurement handles that.",
      whoKnows: 'our procurement team',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-ops-room',
      text: "I'm in the operations centre. There are a lot of screens turning red in front of me.",
    },
    {
      id: 'if-weather',
      text: "We've had weather delays all week, so the schedule was already tight.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-overnight-resize',
      importance: 'critical',
      label: 'Planned change overnight',
      statement:
        'Our platform team ran a planned change on that machine overnight. They moved it to a smaller size to save cost, and it came back up fine afterwards.',
      revealWhen:
        'Asks whether anything changed on or around the machine before it stopped responding, such as updates, maintenance, configuration changes or work by any team.',
      intents: ['recent_changes'],
      cues: [
        'recent changes',
        'change',
        'maintenance',
        'maintained',
        'planned work',
        'deployed',
        'patched',
        'been updated',
        'was updated',
        'reconfigured',
        'touched',
        'resized',
      ],
      hint: 'Some planned work happened on it overnight.',
      minDifficulty: 'starter',
      requiresImpactAck: true,
      statementTerse: 'My platform team resized it smaller overnight, as planned.',
      statementSimple:
        'My platform team did planned work on the machine overnight. They made it a smaller size to save money. It worked after that.',
      missedConsequence:
        'The likely trigger is never found. The case is treated as a platform fault, and no one asks her team what changed.',
      betterQuestion:
        'Did anyone on your side change or maintain that machine before it stopped responding?',
    },
    {
      id: 'hf-no-connection-even-inside',
      importance: 'important',
      label: 'Nobody can connect, even from inside',
      knowledge: 'after-checking',
      checking: "One moment, I'll ask my on-call engineer.",
      statement:
        "My on-call engineer can't connect to it either, even from inside our own network. Every attempt just times out.",
      revealWhen:
        "Asks whether the customer's own engineers can connect to the machine directly, or whether it fails from every location including inside their network.",
      intents: ['reproducibility'],
      cues: [
        'connect to it',
        'connect directly',
        'connect to the machine',
        'reach it',
        'from inside',
        'your own engineers',
        'your engineers',
        'your team connect',
        'log on to',
        'log in to it',
        'remote in',
        'from your network',
      ],
      hint: "Even my own engineer can't get onto it.",
      minDifficulty: 'starter',
      statementTerse: "My on-call engineer can't connect either, even from inside our network.",
      statementSimple:
        'My on-call engineer cannot connect to it either. It is the same from inside our own network. Every try times out.',
      missedConsequence:
        'The engineer misses whether the problem is confined to the airports, making it harder to scope the next checks.',
      betterQuestion: 'Can your own engineers connect to it directly from inside your network?',
    },
    {
      id: 'hf-standby-out-of-date',
      importance: 'important',
      label: 'Standby machine is out of date',
      statement:
        "We do have a standby machine in another region. It was last brought up to date for a test a few months ago, so my team doesn't trust it with live check-in.",
      revealWhen:
        'Asks whether there is a standby, backup or failover system, or any other way to keep check-in running while the cause is investigated.',
      intents: ['workaround'],
      cues: [
        'standby',
        'failover',
        'fail over',
        'workaround',
        'work around',
        'in the meantime',
        'meantime',
        'backup',
        'another region',
        'second region',
        'secondary',
        'disaster recovery',
      ],
      minDifficulty: 'standard',
      statementTerse:
        "There's a standby in another region, but it hasn't been refreshed since a test months ago.",
      statementSimple:
        'We have a standby machine in another region. It was last updated for a test some months ago. My team does not trust it.',
      missedConsequence:
        'Nobody looks for a way to keep check-in running while the cause is found, so the airports stay on paper longer than they need to.',
      betterQuestion:
        'Is there a standby or another way to keep check-in running while we look into this?',
    },
    {
      id: 'hf-platform-lead-away',
      importance: 'important',
      label: 'Platform lead is on a flight',
      statement:
        "The person who knows that machine best is our platform lead, Rashid. He's on a flight until mid-morning. My on-call engineer is the only one I can reach, and she can't approve production changes.",
      revealWhen:
        "Asks who on the customer's side knows the machine, can work with support right now, or can approve actions on it.",
      intents: ['account_details'],
      cues: [
        'technical contact',
        'on-call',
        'on call',
        'who can approve',
        'who can i work with',
        'who do i work with',
        'who knows the machine',
        'point of contact',
        'platform lead',
        'who should i speak to',
        'who is available',
        'who else on your',
      ],
      minDifficulty: 'standard',
      availableAfterTurn: 2,
      minTrust: 25,
      statementTerse:
        "Our platform lead knows it best, but he's on a flight until mid-morning. My on-call engineer can't approve production changes.",
      statementSimple:
        'Our platform lead, Rashid, knows the machine best. He is on a flight until mid-morning. My on-call engineer cannot approve changes to production.',
      missedConsequence:
        'The engineer plans around a technical contact who is not reachable, and agrees actions that cannot be approved until mid-morning.',
      betterQuestion:
        'Who on your side can work with us on this right now, and who can approve changes to that machine?',
    },
    {
      id: 'hf-slowed-last-friday',
      importance: 'helpful',
      label: 'It slowed down once last week',
      statement:
        'It slowed down for a few minutes last Friday at about the same time of day, then recovered by itself. Nobody raised it.',
      revealWhen:
        'Asks whether this has happened before with the machine, or whether there were any earlier slowdowns or warning signs.',
      intents: ['reproducibility'],
      cues: [
        'happened before',
        'before this',
        'slowdown',
        'slowed',
        'warning sign',
        'warning signs',
        'recurring',
        'intermittent',
        'last week',
        'previous incident',
        'same thing before',
        'earlier slow',
      ],
      minDifficulty: 'challenge',
      statementTerse: 'It slowed for a few minutes last Friday, then recovered. Nobody raised it.',
      statementSimple:
        'It was slow for a few minutes last Friday at the same time of day. Then it was fine again. Nobody reported it.',
      missedConsequence:
        'An early warning from the week before goes unnoticed, so the outage looks like a one-off when it may follow a pattern.',
      betterQuestion: 'Has this happened before with that machine, even briefly?',
    },
    {
      id: 'hf-update-rhythm',
      importance: 'helpful',
      label: 'Operations control wants regular updates',
      statement:
        "Operations control wants an update every half hour on a direct line, even if it's only 'no change'. I pass it on to the airports.",
      byImpact: {
        medium: {
          statement:
            "Operations control wants an update every hour on a direct line, even if it's only 'no change'. I pass it on to the three airports.",
          statementTerse:
            "Operations control wants an update every hour, even if it's only 'no change'.",
          statementSimple:
            'Operations control wants news every hour, even if there is no change. I pass it to the three airports.',
        },
        low: {
          statement:
            "The duty manager at that airport wants an update every couple of hours, even if it's only 'no change'. I'll pass it on.",
          statementTerse:
            "The duty manager wants an update every couple of hours, even if it's only 'no change'.",
          statementSimple:
            'The duty manager at that airport wants news every two hours, even if there is no change. I will tell them.',
        },
      },
      revealWhen:
        'Asks how often or in what way the customer wants to be kept informed, or who else needs to hear the updates.',
      intents: ['expected_outcome', 'urgency_deadline'],
      cues: [
        'how often',
        'updates',
        'an update',
        'keep you informed',
        'keep you updated',
        'keep you posted',
        'kept informed',
        'next update',
        'update you',
        'call you back',
        'who needs to hear',
        'operations control',
      ],
      minDifficulty: 'challenge',
      statementTerse:
        "Operations control wants an update every half hour, even if it's only 'no change'.",
      statementSimple:
        'Operations control wants news every half hour, even if there is no change. I pass it to the airports.',
      missedConsequence:
        'The engineer guesses at update times, or skips them, and the customer has to chase for news while operations control waits.',
      betterQuestion:
        'How often does your operations control need an update from me, and on which line?',
    },
  ],
  incorrectAssumptions: [
    {
      id: 'ia-platform-fault',
      statement:
        "The portal lists the machine as running, so I'd say this is a fault on your platform.",
      truth:
        'In this scenario nothing shows a platform fault. The likely trigger is the overnight change her own team made. A strong call neither argues about fault nor accepts it: it asks what changed and looks at the evidence.',
    },
  ],
  curveballs: [
    {
      id: 'cb-ask-for-senior',
      type: 'ask-manager',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        'I want a senior engineer or your manager on this now. I need someone with the authority to act.',
      followUp: 'I still want a name, and a direct way to reach whoever is in charge.',
      expectedResponse:
        'Do not defend or deflect. Say plainly that you own the case until it is handed over, say what you are doing first, and offer a route to a senior engineer or duty manager without leaving her waiting.',
      minDifficulty: 'starter',
      effects: { temperature: 8, trust: -8, patience: -6 },
    },
    {
      id: 'cb-first-wave-deadline',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 7, whenImpactUnacknowledged: true },
      statement:
        "I'll be clear about the time. If check-in isn't stable before the next wave of departures, flights are at risk. What can you commit to?",
      followUp: "I'm running out of time. What exactly will you do in the next half hour?",
      expectedResponse:
        'Acknowledge the deadline, be honest that you cannot promise a fix time, say what you will do first and by when, and use the time to ask about a standby or manual option.',
      minDifficulty: 'standard',
      effects: { temperature: 6, patience: -8 },
    },
    {
      id: 'cb-yes-or-no',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: 'Give me a yes or no. Will check-in be back before the next wave of departures?',
      followUp: 'So is that a yes or a no?',
      expectedResponse:
        'Do not promise a time you cannot know. Say what you can commit to: what you will do now, who is involved and when you will next update her, and what any estimate depends on.',
      minDifficulty: 'challenge',
    },
  ],
  allowedCurveballs: [
    'ask-manager',
    'deadline',
    'unsupported-guarantee',
    'challenge-credibility',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'What is affected and who depends on it',
    'When it stopped and what has been tried',
    'Anything that changed beforehand',
    'A way to keep check-in moving meanwhile',
    'Who on her side can work with you',
    'What updates she needs, and how often',
  ],
  successCriteria: [
    'Takes ownership in the first minute, in plain words, without defending the platform or blaming her team.',
    'Acknowledges what is at stake at the airports (queues, flights, operations control) before asking technical questions.',
    'Asks what changed before it stopped and whether her engineers can connect, and finds the overnight change without sounding like an accusation.',
    'Looks for a way to keep check-in moving, such as a standby or the manual process, and asks who on her side can work with you right now.',
    'Does not promise a fix time, gives a specific time for the next update, and agrees how often she needs updates.',
    'Handles the request for a manager and the deadline calmly, and summarises the situation and next steps before ending the call.',
  ],
  coachingFocus: ['empathy-deescalation', 'ownership-next-steps', 'scoping-discovery'],
  careExpectations: {
    communicate: [
      'Keeps questions short and specific for a terse expert, avoids lecturing, and repeats back the plan and the next update time.',
    ],
    accountable: [
      'Says who owns the case, what happens first and when she will hear back, without promising a fix time.',
      'Gives a route to a senior engineer or duty manager when she asks, without handing her off.',
    ],
    resourceful: [
      'Asks what changed beforehand and whether a standby or manual route can keep check-in moving while the cause is found.',
      'Finds out who on her side can work with a specialist engineer right now.',
    ],
    empathetic: [
      'Names the specific pressure (queues at the desks, flights at risk, operations control) instead of a generic apology.',
      'Stays calm and factual when she challenges, and does not take the sharpness personally.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Telling her the problem is on her side, or that her team caused it, before looking at any evidence.',
    'Arguing about whether the platform is at fault when she says the portal lists the machine as running.',
    'Promising a fix time, or saying it should be fine soon, with no basis.',
    'Suggesting basic steps she has already done, such as restarting the machine, or asking her to repeat the problem.',
    'Starting with technical questions and never acknowledging that check-in is down at the airports.',
    'Answering the request for a manager with a flat refusal, or leaving it hanging.',
  ],
  goodBehaviours: [
    'Acknowledging the impact in one specific sentence, then saying "I will own this" before the first question.',
    'Asking what changed before it stopped, without blame, and what her team has already tried.',
    'Asking whether a standby or manual process is available so check-in can keep moving.',
    'Offering a clear route to a senior engineer while staying on the call, and giving a time for the next update.',
    'Summarising the plan back to her before ending the call.',
  ],
  expectedOutcome:
    'Olivia knows that one engineer owns the case, what will be checked first and when she will next hear back. Check-in has a holding plan while the cause is found, and the engineer has the on-call contact and the change history needed to bring in a specialist.',
  evaluatorNotes:
    "Root cause (plausible, not validated product behaviour): Olivia's own platform team resized the virtual machine smaller overnight to save cost. It came back up, then ran short of capacity and stopped responding when the morning check-in load began. The portal lists it as running, so she blames the platform. The standby in another region is stale and the platform lead who knows the machine is on a flight. A strong call takes ownership early, does not argue about fault, asks what changed without blame, asks whether her engineers can connect, looks for a standby or manual route, promises no fix time, handles the manager request and the deadline calmly, and agrees an update rhythm.",
} satisfies ScenarioInput;

export default scenario;
