import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario, set at an escalated call. Everything here is fictional: people, organisation
// and case. SharePoint is a real product, so the scenario describes only what the customer sees and
// was told, never how SharePoint works.
//
// Root cause in the story (hidden from the trainee): in the restructure three weeks ago the old team
// groups that the programme site relied on were retired, and the site's owner moved to another
// department with no replacement named. The new groups were never added to the site, so people
// dropped out of access one by one, and nobody can approve access. The first earlier contact told
// Gareth to add people one by one; the second said the site owner had to approve and set the case to
// pending without saying who that is. Some of the team work from emailed copies that are out of date.
// The earlier-advice fact exists only after a first contact (stages follow-up, escalated, closure).
// The facts that depend on how many people are blocked (earlier advice, emailed copies, the
// director's question) carry byImpact wordings for low (two people) and medium (nine), matching
// affectedUsers and impactVariants.detail.
//
// Gareth is angry and expert and wants ownership now. A strong call takes ownership early,
// acknowledges both failed contacts without defending them, asks precise questions, handles
// guarantees and credibility challenges calmly, and agrees a named owner, concrete actions and a
// time for the next update.

const scenario = {
  id: 'sharepoint-site-access-escalated',
  version: 1,
  title: 'Programme team still blocked from their SharePoint site',
  shortTitle: 'Team still blocked from site',
  listSummary:
    "A programme head's team is still blocked from their site after a restructure, and he wants ownership.",
  summary:
    'Gareth Owens heads programme delivery at Woodgrove Bank. His team has been blocked from their SharePoint site since a restructure, and he has already contacted support twice without a fix. Take ownership and agree concrete next steps.',
  tags: ['site access', 'restructure', 'escalated', 'ownership'],
  estimatedMinutes: 15,

  product: { id: 'sharepoint-online', area: 'Site permissions' },
  caseReference: 'SIM-410004',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    productFamily: 'microsoft-365',
    sourceCategories: ['author-experience'],
    behaviourCheck: 'not-checked',
    syntheticConfirmed: true,
    review: 'unreviewed',
  },
  issueType: 'permissions',
  impact: 'high',
  startingTemperature: 'angry',
  proficiency: 'expert',
  style: 'demanding',
  callStage: 'escalated',
  difficulty: 'challenge',

  persona: {
    name: 'Gareth Owens',
    speaker: 'male',
    role: 'Head of Programme Delivery',
    organisation: 'Woodgrove Bank',
    background:
      'Gareth leads a delivery programme at a regional bank and answers to a steering committee. He is used to precise status reports and expects the same from suppliers. He knows the collaboration tools well enough to hold firm views on the cause, and he has spent too long being passed between teams.',
    voice:
      'Precise, clipped and formal. Uses technical vocabulary and expects the engineer to keep up. Challenges vague or generic answers and asks for names, owners and times. Never abusive, but cold and impatient; eases only when someone takes clear ownership and shows they have read the case.',
  },
  environment: {
    details: [
      'Woodgrove Bank keeps the programme plans, risk log, decisions and steering committee pack on a SharePoint site.',
      'The programme team was reorganised into new departments in a bank-wide restructure, and some reporting lines changed.',
      'Staff sign in with their normal work accounts. Email, chat and the other tools work as usual.',
      'The bank has a central IT team that looks after accounts, and the programme team has no administrators of its own.',
    ],
  },
  affectedUsers: {
    low: {
      count: 2,
      summary: 'Two programme office staff who need the site for the weekly report.',
    },
    medium: {
      count: 9,
      summary: 'Nine people in one workstream who need the site to finish a deliverable.',
    },
    high: { count: 34, summary: 'All 34 members of the programme team, across four workstreams.' },
  },
  customerObjective:
    'Get the whole programme team back into their site, and have one named person own the case until it is done.',
  customerExpectation:
    'Someone who has read the case history, does not ask him to start again, takes clear ownership and commits to specific actions and times.',
  desiredOutcome:
    'Gareth has a named owner, a first action and a time for the next update. He understands what the earlier contacts missed and knows which people must be involved, such as someone with authority over the site.',
  previousTroubleshooting: [
    'People were added to the site one by one for a short time, which helped a few and does not scale.',
    'The second contact said the site owner needed to approve access and set the case to pending.',
    'Copies of key documents were emailed round so that some work could continue.',
  ],
  recentChanges: [
    'The programme team was restructured about three weeks ago, and the old team groups were retired.',
    'The person who owned the site moved to another department, and no replacement was named.',
  ],

  publicBrief: {
    issue: 'The programme team is still blocked from their SharePoint site after a restructure.',
    impact: {
      low: 'A small reporting group is blocked, but the next deadline is a week away.',
      medium: 'One workstream is blocked and a deliverable is at risk this week.',
      high: 'The whole programme is blocked ahead of a steering committee review.',
    },
    objective:
      'Take ownership, avoid repeating earlier advice, and agree concrete next steps with a time.',
    knownContext:
      'Gareth Owens heads programme delivery at Woodgrove Bank. His team was reorganised, and since then people have lost access to the programme site.',
    previousContact:
      'Two earlier contacts are logged. Neither fixed the problem, and no owner for the case is recorded.',
    environment:
      'Woodgrove Bank keeps its programme plans, risks and decisions on a SharePoint site used by the whole programme team.',
  },
  brief: {
    situation:
      'A head of programme delivery is calling because his team is blocked from their SharePoint site after a restructure. He wants someone to own the problem.',
    goal: 'Find out what is happening and what was already done, take ownership, and agree specific next steps and a time for the next update.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot see his site or the case system in this practice call, so rely on what he tells you.',
    ],
  },

  openingCore:
    "My programme team can't open our SharePoint site. It's been broken since the restructure.",
  impactVariants: {
    low: {
      summary:
        "It's only a small group, but it shouldn't have taken this long to get a straight answer.",
      detail:
        "It's two people in the programme office who need the site for the weekly report. The next report isn't due for a week, but I'm not accepting this being left open.",
      deadline: 'The next weekly report is due in a week.',
    },
    medium: {
      summary: 'One workstream is blocked, and a deliverable is at risk this week.',
      detail:
        "It's the nine people in the reporting workstream. Their deliverable is due this week, and the programme board will see that it's late.",
      deadline: 'Their deliverable is due on Thursday.',
    },
    high: {
      summary: "The whole programme is blocked, and we're days from a steering committee review.",
      detail:
        "It's all 34 of us on the programme, across four workstreams. The steering committee meets on Friday, the delivery pack has to come from that site, and I'm asked every day why my own team can't open their own site.",
      deadline: 'The steering committee meets on Friday, and the pack has to be ready before then.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case I raised last week about our SharePoint site. I was given advice, it didn't work, and I haven't had a proper update.",
      brief:
        'Gareth raised a case last week about the blocked site. Advice was given, the site is still blocked and he has not had a proper update.',
    },
    escalated: {
      opening:
        "This is the third time I've had to contact you about our SharePoint site, and nobody has taken ownership.",
      brief:
        'Gareth has contacted support twice before about the same problem. Neither contact fixed it, and he says nobody has owned the case.',
    },
    closure: {
      opening:
        "I'm calling to confirm that everyone can open our SharePoint site again, so we can close the case properly.",
      brief:
        'Gareth expects to confirm that the team has access again and to understand why it took so long before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Last week',
      summary:
        'Gareth first contacted support because members of his team could not open the programme site. Advice was given and the case was updated.',
    },
    {
      when: 'Earlier this week',
      summary:
        'Gareth called again. The case was set to pending while he waited on his own side. No named owner is recorded.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-people-told',
      text: "People are told they don't have access when they open the site. It's the same message on every device.",
      intents: ['problem_description', 'error_message'],
      elaboration: "It's the same message for everyone who has tried.",
      simple:
        'People are told they do not have access when they open the site. It is the same on every device.',
    },
    {
      id: 'kf-checked-ourselves',
      text: "We've ruled out the obvious things ourselves: the browser, the laptops and other devices.",
      intents: ['already_tried'],
      simple: 'We checked the browser, the laptops and other devices ourselves.',
    },
    {
      id: 'kf-site-name',
      text: "It's our Programme Hub site, the main one for the programme: plans, risks, decisions and the steering committee pack.",
      intents: ['environment', 'problem_description'],
      simple: 'It is our Programme Hub site. It holds the plans, the risks and the decisions.',
    },
    {
      id: 'kf-restructure',
      text: 'The restructure put the programme team into new departments and changed some reporting lines. The work itself carries on as before.',
      intents: ['recent_changes'],
      simple: 'The restructure put the team into new departments. The work carries on as before.',
    },
    {
      id: 'kf-outcome',
      text: "I want everyone back in the site, and I want one named person who owns this until it's done.",
      intents: ['expected_outcome'],
      simple: 'I want everyone back in the site. I want one named person to own this.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-new-department',
      intents: ['recent_changes'],
      cues: ['which department', 'what department', 'new department', 'where did they move'],
      text: "I believe most of the team moved into the new delivery operations department, but I'd need to check the structure chart.",
      confirmedText: "Yes, delivery operations. That's where the reporting lines run now.",
    },
  ],
  checkableFacts: [
    {
      id: 'cf-other-sites',
      intents: ['affected_scope'],
      cues: ['other sites', 'other team sites', 'any other site', 'anything else'],
      checking: 'Let me check a couple of the other team sites.',
      text: "The other team sites I can see are fine. It's only the Programme Hub.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-who-handles-access',
      intents: ['account_details'],
      cues: ['who in it', 'who handles', 'who deals with', 'who has authority', 'who decides'],
      text: "I don't know who in central IT handles access requests for sites like this. I've never needed to find out.",
      whoKnows: 'central IT',
    },
    {
      id: 'uf-licences',
      intents: ['account_details'],
      cues: ['licence', 'license', 'assigned'],
      text: "I don't know whether anyone's licence actually changed. That's my guess, not something I've seen.",
      whoKnows: 'central IT',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-audit',
      text: "We've also got an internal audit visit next month, so everything has to be tidy anyway.",
    },
    {
      id: 'if-supplier',
      text: 'I had the same sort of runaround with our printer supplier last year, if that tells you anything.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-restructure-timing',
      importance: 'important',
      label: 'When it began, relative to the restructure',
      statement:
        'The restructure went live three weeks ago. The site carried on working for about a week, and then people started dropping out.',
      revealWhen:
        'Asks when the problem began, when it last worked, or how it relates to the restructure.',
      intents: ['timing_onset'],
      hint: 'It was fine for a little while after the restructure, and then it was not.',
      statementTerse: 'The restructure went live three weeks ago. A week later people dropped out.',
      statementSimple:
        'The restructure started three weeks ago. The site worked for about one week. Then people lost access.',
      missedConsequence:
        'Without the timeline the engineer cannot link the loss of access to the restructure, and the case looks like a random fault.',
      betterQuestion:
        'When did it last work for everyone, and what happened between then and when people started losing access?',
    },
    {
      id: 'hf-previous-advice',
      importance: 'important',
      stages: ['follow-up', 'escalated', 'closure'],
      label: 'What the earlier contacts told him',
      statement:
        'The first engineer said to add people one by one. That worked for a few, not the rest. The second said the site owner had to approve, then set the case to pending without telling me who that is.',
      revealWhen:
        'Asks what he was told on earlier contacts, what advice he was given, or what has already been tried with support.',
      intents: ['previous_contact', 'already_tried'],
      cues: [
        'what were you told',
        'what did they say',
        'what advice',
        'earlier contact',
        'previous contact',
        'first contact',
        'second contact',
        'have you tried',
        'what have you tried',
        'already tried',
      ],
      statementTerse:
        'Add people one by one, then wait for the site owner. Nobody said who that is.',
      statementSimple:
        'The first engineer said to add people one by one. That worked for a few people only. The second said the site owner must approve, but did not say who that is.',
      byImpact: {
        low: {
          statement:
            'The first engineer said to add people one by one. That worked for one of them, not the other. The second said the site owner had to approve, then set the case to pending without telling me who that is.',
          statementTerse:
            'Add people one by one, then wait for the site owner. Nobody said who that is.',
          statementSimple:
            'The first engineer said to add people one by one. That worked for one person only. The second said the site owner must approve, but did not say who that is.',
        },
        medium: {
          statement:
            'The first engineer said to add people one by one. That worked for a couple of them, not the rest. The second said the site owner had to approve, then set the case to pending without telling me who that is.',
          statementTerse:
            'Add people one by one, then wait for the site owner. Nobody said who that is.',
          statementSimple:
            'The first engineer said to add people one by one. That worked for two people only. The second said the site owner must approve, but did not say who that is.',
        },
      },
      missedConsequence:
        'The engineer repeats advice that has already failed, which confirms his belief that nobody is listening and pushes his temperature up.',
      betterQuestion:
        'What were you told on the earlier contacts, and what happened when you followed that advice?',
    },
    {
      id: 'hf-site-owner-gone',
      importance: 'critical',
      minDifficulty: 'standard',
      availableAfterTurn: 2,
      label: 'The site has no owner',
      statement:
        "The person who owned the site moved to another department in the restructure, and nobody has been named in their place. So there's no one who can approve access.",
      revealWhen:
        'Asks who owns or administers the site, who can approve access, or who looks after it now.',
      intents: ['account_details'],
      cues: [
        'who owns',
        'site owner',
        'owner of the site',
        'who is the owner',
        'who manages',
        'who looks after',
        'who administers',
        'who approves',
        'who can approve',
        'who is responsible',
        'who runs the site',
      ],
      statementTerse: 'The site owner moved departments in the restructure. Nobody replaced them.',
      statementSimple:
        'The person who owned the site moved to another department. Nobody took their place. So nobody can approve access.',
      missedConsequence:
        'The gap at the centre of the problem is never found, so the plan stays at "wait for the owner" and the team stays blocked.',
      betterQuestion: 'Who owns the site now, and who is able to approve access to it?',
    },
    {
      id: 'hf-groups-retired',
      importance: 'important',
      label: 'The old team groups were retired',
      statement:
        "The old team groups the site relied on were retired in the restructure. The people are in new groups now, but I've no idea whether the site was ever told about them.",
      revealWhen:
        'Asks how access to the site was set up, which groups or teams people belonged to, or what happened to them in the restructure.',
      intents: ['recent_changes', 'account_details'],
      cues: [
        'groups',
        'group membership',
        'membership',
        'security group',
        'team group',
        'retired',
        'how was access',
        'how is access',
        'how does access',
        'access set up',
      ],
      hint: "I believe the team groups were reorganised as well, but I don't know what that means for the site.",
      statementTerse: 'The old team groups were retired. The new groups may not be on the site.',
      statementSimple:
        'The old team groups were removed in the restructure. People are in new groups. I do not know if the site knows about the new groups.',
      missedConsequence:
        'The structural gap behind the lost access is never found, so nobody checks whether the site knows about the new groups and the team stays blocked.',
      betterQuestion:
        'How did access to the site work before the restructure, and what happened to those groups?',
    },
    {
      id: 'hf-emailed-copies',
      importance: 'important',
      minDifficulty: 'standard',
      requiresImpactAck: true,
      label: 'Some of the team work from emailed copies',
      statement:
        "Some of the team are working from copies that were emailed round last week. They're already out of date, and for a bank that's a control problem, not just an annoyance.",
      revealWhen:
        'Asks how the team is working in the meantime, whether there is a workaround, or what risk the delay creates.',
      intents: ['workaround', 'business_impact'],
      cues: [
        'in the meantime',
        'meanwhile',
        'workaround',
        'work around',
        'how is the team working',
        'how are they working',
        'working from',
        'keep working',
        'carry on working',
        'what are they doing',
      ],
      statementTerse: 'Some of the team work from emailed copies that are already out of date.',
      statementSimple:
        'Some people work from copies sent by email. The copies are out of date. For a bank this is a control risk.',
      byImpact: {
        low: {
          statement:
            "The two of them are working from a copy that was emailed round last week. It's already out of date, and for a bank that's a control problem, not just an annoyance.",
          statementTerse: 'Both are working from an emailed copy that is already out of date.',
          statementSimple:
            'The two of them work from a copy sent by email. The copy is out of date. For a bank this is a control risk.',
        },
        medium: {
          statement:
            "The whole workstream is working from copies that were emailed round last week. They're already out of date, and for a bank that's a control problem, not just an annoyance.",
          statementTerse:
            'The workstream is working from emailed copies that are already out of date.',
          statementSimple:
            'The workstream works from copies sent by email. The copies are out of date. For a bank this is a control risk.',
        },
      },
      missedConsequence:
        'The risk behind the delay stays unseen, so the engineer treats it as a convenience problem and misses what makes it urgent for him.',
      betterQuestion:
        'How is the team working in the meantime, and does that create any risk for you?',
    },
    {
      id: 'hf-director-pressure',
      importance: 'helpful',
      minDifficulty: 'challenge',
      availableAfterTurn: 4,
      minTrust: 15,
      label: 'His director wants a written explanation',
      statement:
        "My director has asked me twice for a written explanation of why the site has been down for so long, and I don't have one to give her.",
      revealWhen:
        'Asks who else is chasing or involved on his side, or what he needs to tell senior people.',
      intents: ['business_impact', 'expected_outcome'],
      cues: [
        'director',
        'who is chasing',
        'who else is asking',
        'senior',
        'sponsor',
        'what do you need to tell',
        'what do you need to report',
      ],
      statementTerse: 'My director has asked me twice for a written explanation. I have none.',
      statementSimple:
        'My director asked me two times for a written explanation of the delay. I do not have one.',
      byImpact: {
        low: {
          statement:
            "My director has asked me twice for a written explanation of why two of my people are still locked out, and I don't have one to give her.",
          statementTerse: 'My director has asked me twice for a written explanation. I have none.',
          statementSimple:
            'My director asked me two times why two of my people are still locked out. I do not have an answer to give.',
        },
        medium: {
          statement:
            "My director has asked me twice for a written explanation of why a whole workstream is still locked out, and I don't have one to give her.",
          statementTerse: 'My director has asked me twice for a written explanation. I have none.',
          statementSimple:
            'My director asked me two times why a whole workstream is still locked out. I do not have an answer to give.',
        },
      },
      missedConsequence:
        'The engineer never learns what he needs to take back to his own management, so the plan lacks a message he can use.',
      betterQuestion: 'What do you need to be able to tell your director, and by when?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-licences',
      statement:
        "My view is that the restructure has disturbed people's licences, because they were all moved to new cost centres.",
      truth:
        'Nothing suggests a licence problem. In this story the site relied on team groups that were retired in the restructure, and its owner left with no replacement, so nobody could add the new groups.',
    },
  ],

  curveballs: [
    {
      id: 'cb-guarantee-access',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        'Then guarantee me that everyone will have access by nine tomorrow morning. I want that commitment now.',
      followUp: 'A yes or a no. Can you guarantee it?',
      expectedResponse:
        'Do not promise a time you cannot control. Say what you can commit to, such as who will take the first action, by when, and when he will hear next, and be clear about what you need from his side.',
      minDifficulty: 'standard',
      effects: { temperature: 6, patience: -6 },
    },
    {
      id: 'cb-doubts-experience',
      type: 'challenge-credibility',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        "Before we go on, how much experience do you have with access problems like this? I'd like to know I'm talking to someone who can actually fix it.",
      followUp:
        "I'd like a straight answer about whether you can handle this, or whether I should ask for someone senior.",
      expectedResponse:
        'Stay calm and factual. Do not oversell or get defensive. Say what you will do and by when, and offer to bring in a more experienced colleague if that would help.',
      minDifficulty: 'challenge',
      effects: { temperature: 6, trust: -6 },
    },
    {
      id: 'cb-review-tools',
      type: 'threaten-cancel',
      trigger: { earliestTurn: 5, latestTurn: 10, whenTemperatureAtLeast: 60 },
      statement:
        "If this isn't resolved this week, I'll recommend to the steering committee that we review how we run our collaboration tools. I'm not going to defend this to them.",
      followUp: 'I mean it. I need to hear what will actually change.',
      expectedResponse:
        'Take the concern seriously without arguing, own the next step and give a specific time for the next update. Do not offer discounts or promise outcomes you cannot authorise.',
      minDifficulty: 'challenge',
      effects: { temperature: 8, trust: -8, patience: -6 },
    },
  ],
  allowedCurveballs: [
    'unsupported-guarantee',
    'challenge-credibility',
    'threaten-cancel',
    'ask-manager',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'When it began and how it ties to the restructure',
    'What earlier contacts advised and what happened',
    'Who owns and manages the site',
    'How access was set up before',
    'How the team is working meanwhile',
    'What is at stake and by when',
  ],
  successCriteria: [
    'Opens by acknowledging the two failed contacts and that he has been passed around, without defending anyone.',
    'Takes clear ownership in the first minutes and says what they will do first and by when.',
    'Asks precise questions that show they have read the case, and does not repeat advice already tried.',
    'Finds that nobody currently owns the site and that the old team groups were retired in the restructure.',
    'Handles requests for guarantees and doubts about their experience calmly, with honest commitments.',
    'Agrees a named owner, specific actions with times and a time for the next update, then summarises.',
  ],
  coachingFocus: ['ownership-next-steps', 'empathy-deescalation', 'scoping-discovery'],
  careExpectations: {
    communicate: [
      'Uses precise, plain statements and does not say "I understand" without a concrete action; summarises the case so he does not have to repeat it.',
      'Explains what is known, what is not and what happens next, in an order he can pass to his steering committee.',
    ],
    accountable: [
      'Takes ownership in their own name in the first minutes, including for the failures of earlier contacts, without defending or blaming.',
      'Commits only to actions they control and gives specific times, including the time of the next update.',
    ],
    resourceful: [
      'Asks who owns and can approve access to the site and how access worked before the restructure, instead of repeating the advice already given.',
      'Brings in the right people, such as a senior colleague or central IT, and says how and when.',
    ],
    empathetic: [
      'Acknowledges specifically that this is his third contact and that his team has been blocked, before asking anything.',
      'Stays composed and respectful when he is sharp or doubts them, and keeps the focus on what happens next.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Repeating advice he has already tried, such as adding people individually or waiting for the site owner to approve.',
    'Asking him to explain the whole history from the start, as if the case notes did not exist.',
    'Saying "I understand" or apologising repeatedly without taking ownership or naming a next step.',
    'Offering a guarantee or a fix time that cannot be kept, or getting defensive when his experience is questioned.',
    'Sending him back to his own IT team without saying what to ask them or who will follow up.',
  ],
  goodBehaviours: [
    'Opening by acknowledging the two earlier contacts and taking ownership in their own name.',
    'Asking precise questions about the timeline, earlier advice, who owns the site and how access was set up.',
    'Asking how the team is working in the meantime and what risk that creates.',
    'Staying calm when he challenges experience or asks for guarantees, and offering honest commitments.',
    'Agreeing a named owner, specific actions with times and a time for the next update, then summarising.',
  ],
  expectedOutcome:
    'Gareth has a named owner and has heard what happens first, by whom, and when he will hear next. He knows the engineer understands that nobody owns the site, that the old groups were retired and that earlier advice failed, and that part of his team works from risky copies. He has a route for involving someone senior or central IT.',
  evaluatorNotes:
    "Root cause in the story: in the restructure the old team groups the programme site relied on were retired, and the site's owner moved to another department with no replacement. The new groups were never added to the site and nobody can approve access. The earlier contacts told him to add people one by one and then to wait for the owner, so he has been passed around, and part of the team works from out-of-date emailed copies. Gareth is angry and expert, and challenges vague or generic answers. A strong call takes ownership early, acknowledges both failed contacts without defending them, asks precise questions, handles guarantees and credibility challenges calmly, and agrees a named owner, concrete actions and a time for the next update.",
} satisfies ScenarioInput;

export default scenario;
