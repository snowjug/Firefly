import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario. Everything here is fictional: people, organisation and case. The product is
// real, so the customer only describes what she sees and was told, in everyday words.
//
// Root cause (hidden from the trainee; plausible, not validated product behaviour): in the sales
// reorganisation the administrator moved people into new regional teams in one go over a weekend. The
// customer accounts those people worked with were looked after by their old teams, and nobody
// reassigned them to the new teams. The people who were moved can no longer see those accounts (they
// can still see accounts they created themselves); colleagues who stayed in the old teams still can.
// Nobody checked what people could see afterwards, and a few affected reps are emailing customer
// lists around to keep working. Amara guesses it is a licence problem, or that it will sort itself
// out.
//
// A strong call is patient with a vague, anxious caller: it asks one focused question at a time,
// finds the pattern in who is and is not affected, finds how the move was done, notices the data
// sharing risk, reassures her honestly without promising a fix time, explains in plain words what her
// administrator needs to check, and confirms the next contact.

const scenario = {
  id: 'dynamics-records-not-visible-after-role-change',
  version: 1,
  title: "Some sales staff can't see customer records after a reorganisation",
  shortTitle: 'Sales staff cannot see records',
  listSummary:
    'A sales operations lead reports some staff cannot see customer records their colleagues can, after teams were reorganised.',
  summary:
    'A sales operations lead at VanArsdel is calling because some sales staff cannot see customer records that colleagues can see. It began after the sales teams were reorganised. She is worried about customers and deadlines, and she finds it hard to put the problem into words at first.',
  tags: ['dynamics 365', 'security roles', 'permissions', 'sales', 'reorganisation'],
  estimatedMinutes: 10,

  product: { id: 'dynamics-365', area: 'Security roles' },
  caseReference: 'SIM-440003',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    productFamily: 'dynamics-365',
    sourceCategories: ['author-experience'],
    behaviourCheck: 'not-checked',
    syntheticConfirmed: true,
    review: 'unreviewed',
  },

  issueType: 'permissions',
  impact: 'medium',
  startingTemperature: 'anxious',
  proficiency: 'intermediate',
  style: 'vague',
  callStage: 'first-contact',
  difficulty: 'standard',

  persona: {
    name: 'Amara Idowu',
    speaker: 'female',
    role: 'Sales Operations Lead',
    organisation: 'VanArsdel',
    background:
      "Amara keeps VanArsdel's sales teams running day to day: targets, forecasts and the customer records they work from. She is not a system administrator and is nervous about saying the wrong thing, so she tends to describe the problem loosely at first.",
    voice:
      "A little hesitant and careful with her words. Starts general ('some people can't see some things') and gets specific when asked one clear question at a time. Apologises for being vague and checks she is making sense. Settles noticeably when given a plan she can follow.",
  },
  environment: {
    details: [
      'Customer records, opportunities and activities live in Dynamics 365.',
      'Sales staff are organised into regional teams, and the teams were reorganised recently.',
      'A separate administrator looks after access to the system. Amara does not have administrator rights.',
      'Staff use the system on laptops and phones, and everything else in it works normally.',
    ],
  },
  affectedUsers: {
    low: { count: 2, summary: 'Two sales reps.' },
    medium: { count: 11, summary: 'Eleven sales reps across two regions.' },
    high: { count: 40, summary: 'About forty sales reps across all the regions.' },
  },
  customerObjective:
    "Get everyone who works with a customer able to see that customer's records again, and understand what went wrong so it doesn't happen again.",
  customerExpectation:
    'A clear explanation she can pass on to her team, a plan that tells her what her administrator needs to check, and a time when she will hear back.',
  desiredOutcome:
    'The pattern behind who is affected is found, Amara knows what her administrator needs to check and by when, and she has a time for the next update.',
  previousTroubleshooting: [
    'Asked two affected reps to sign out and back in; nothing changed.',
    'Asked a colleague who can see a missing customer to confirm it is still there; it is.',
  ],
  recentChanges: [
    'The sales teams were reorganised into new regional teams at the end of last month.',
  ],

  publicBrief: {
    issue:
      'Some sales staff cannot see customer records that colleagues can see, after a team reorganisation.',
    impact: {
      low: 'A couple of reps are affected, and they can still do other work.',
      medium: 'About a dozen reps cannot prepare renewals or follow up on open deals.',
      high: 'Most regional sales teams are affected during the last week of the quarter.',
    },
    objective:
      'Help her describe the problem, find out who is affected and why, and agree clear next steps.',
    knownContext:
      'VanArsdel reorganised its sales teams recently. The caller coordinates sales operations but is not a system administrator.',
    environment:
      'Customer records live in Dynamics 365. Sales staff work in regional teams, and a separate administrator manages access.',
  },
  brief: {
    situation:
      'A sales operations lead at VanArsdel is calling because some sales staff cannot see customer records that their colleagues can see. It began after the sales teams were reorganised. She is worried and finds it hard to put the problem into words at first.',
    goal: 'Help her describe the problem clearly, work out who is affected and why, reassure her honestly, and agree what happens next.',
    groundRules: [
      'The customer, organisation and case are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      "You cannot see the customer's system in this practice call, so rely on what she tells you.",
    ],
  },

  openingCore:
    "Some of our sales team can't see customer records that their colleagues can see. It started after we reorganised the teams.",
  impactVariants: {
    low: {
      summary: "It's only a couple of people so far, and they can still do other work.",
      detail:
        "Two reps have told me. They can still run their meetings and tasks, so it's more of a nuisance than a crisis, but I don't want it to spread.",
      deadline: "I'd like it sorted this week, but nothing is due yet.",
    },
    medium: {
      summary: "About a dozen reps can't prepare for renewals or follow up open deals.",
      detail:
        'Eleven reps have told me so far, from two of the regions. Their renewals and open deals are on hold until they can see their customers.',
      deadline: 'Two renewals are due on Friday, and the owners are among the people affected.',
    },
    high: {
      summary: "Most of the regional teams are affected, and it's the last week of the quarter.",
      detail:
        "About forty reps across all the regions are affected, in the last week of the quarter. We can't forecast or follow up properly, and the sales director is asking me what's going on.",
      deadline:
        'The quarter closes on Friday, and the sales director wants this sorted before then.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case I raised after our sales reorganisation. The problem is still happening, and I haven't heard anything.",
      brief:
        'Amara raised a case about customer records some sales staff cannot see and has not had an update.',
    },
    escalated: {
      opening:
        "I've already contacted support twice about our customer records. The problem is still there, and I need someone to own this.",
      brief:
        'Two earlier contacts have not restored the missing records. Amara is anxious and wants someone to own it.',
    },
    closure: {
      opening:
        "I'm calling to check that everyone can see their customer records again, so we can close the case. I'd also like to understand what went wrong.",
      brief:
        'Amara expects confirmation that the records are visible again and a plain explanation before the case closes.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier this week',
      summary:
        'Amara reported that some sales staff could not see customer records after the reorganisation. A case was logged and she was told someone would look into it.',
    },
    {
      when: 'Yesterday',
      summary:
        'Amara called for an update. She was told the case was with another team and would be reviewed.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-what',
      text: "Some of our sales team can't see customer records their colleagues can see. They can sign in and use everything else.",
      intents: ['problem_description'],
      elaboration: "It isn't an error. The customers are just missing from their lists.",
      simple:
        'Some people in my sales team cannot see some customer records. Other people can see them.',
    },
    {
      id: 'kf-no-error',
      text: "There's no error message. The customers are just missing from their lists.",
      intents: ['error_message'],
      cues: [
        'error',
        'message',
        'what do they see',
        'what does it say',
        'what happens',
        'what are they seeing',
        'screen',
      ],
      simple: 'There is no error message. The customers are not in their lists.',
    },
    {
      id: 'kf-reorg',
      text: 'We reorganised our sales teams recently, into new regional teams.',
      intents: ['recent_changes'],
      cues: ['change', 'reorganis', 'restructur', 'anything new', 'what happened'],
      simple: 'We changed our sales teams not long ago. There are new regional teams now.',
    },
    {
      id: 'kf-tried',
      text: 'I asked two of them to sign out and back in. It made no difference.',
      intents: ['already_tried'],
      simple: 'I asked two people to sign out and sign in again. Nothing changed.',
    },
    {
      id: 'kf-admin',
      text: "Our administrator looks after access. I don't have administrator rights myself.",
      intents: ['account_details'],
      cues: [
        'administrator',
        'admin',
        'who manages access',
        'who looks after access',
        'who handles access',
        'who looks after the system',
        'who runs the system',
        'access',
      ],
      simple: 'Our administrator looks after access. I am not an administrator.',
    },
    {
      id: 'kf-outcome',
      text: "I want everyone who works with a customer to see that customer's records again.",
      intents: ['expected_outcome'],
      simple: 'I want everyone who works with a customer to see that customer again.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-reorg-date',
      intents: ['timing_onset'],
      cues: [
        'reorganis',
        'restructur',
        'new teams',
        'when was the change',
        'when did the change',
        'when did the teams',
      ],
      text: "The reorganisation went through at the end of last month, I think. I'd need to check the exact day.",
      confirmedText: 'The new teams went live on a Monday, the first week of this month.',
    },
    {
      id: 'vf-first-noticed',
      intents: ['timing_onset'],
      cues: [
        'first notice',
        'first noticed',
        'when did it start',
        'when did this start',
        'when did people',
        'when did it begin',
        'how long',
        'since when',
        'start to',
        'begin',
      ],
      text: "People started noticing a few days after the new teams went live. Well, maybe sooner. I'm not sure which day.",
      confirmedText: 'It was the Monday after. The first person to say something was in the north.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-example',
      intents: ['reproducibility', 'problem_description'],
      cues: [
        'example',
        'for instance',
        'one of the people',
        'one of them',
        'ask one',
        'affected person',
        'what does she see',
        'what does he see',
        'their list',
        'their screen',
        'look at one',
      ],
      checking: "Hold on, I'll ask one of the affected reps.",
      text: 'She says her customer list is shorter than it was, but she can still open her own tasks and meetings.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-admin-changes',
      intents: ['recent_changes'],
      cues: [
        'what exactly did',
        'what did the admin',
        'what did the administrator',
        'what was changed',
        'what changes',
        'which changes',
        'which settings',
        'what settings',
        'how were the teams set up',
        'what permissions',
      ],
      text: "I don't know exactly what the administrator changed in the system. You'd have to ask them.",
      whoKnows: 'our administrator',
    },
    {
      id: 'uf-access-rules',
      intents: ['account_details'],
      cues: [
        'what access',
        'what role',
        'which role',
        'what permissions',
        'security role',
        'access level',
        'what can each team',
      ],
      text: "I don't know what access each team gets. That's an administrator thing.",
      whoKnows: 'our administrator',
    },
    {
      id: 'uf-licences',
      intents: ['account_details'],
      cues: ['licence', 'license', 'licences', 'licenses'],
      text: "I'm not sure how our licences are arranged. Our administrator would know.",
      whoKnows: 'our administrator',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-kickoff',
      text: 'Our regional sales kickoff was last week, so everyone is still catching up.',
    },
    {
      id: 'if-desks',
      text: 'The north office also got new desks, which has nothing to do with this.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-affected-were-moved',
      importance: 'critical',
      label: 'Everyone affected was moved teams',
      statement:
        "Everyone who can't see them was moved to a new regional team in the reorganisation. The colleagues who can still see them stayed in their old teams.",
      partialStatement:
        "It does seem to be certain people rather than everyone, but I couldn't say why.",
      revealWhen:
        'Compares who can see the records with who cannot, or asks what the affected people have in common or whether anyone is unaffected.',
      intents: ['affected_scope', 'reproducibility'],
      partialIntents: ['affected_scope'],
      cues: [
        'who can see',
        'who can still',
        "who can't",
        'who cannot',
        'can anyone',
        'in common',
        "what's different",
        'what is different',
        'difference between',
        'compare',
        'those who can',
        'still see',
      ],
      hint: 'It seems to be the people who moved teams.',
      minDifficulty: 'starter',
      statementTerse:
        'Everyone affected was moved to a new team. The ones who can still see the records were not.',
      statementSimple:
        'All the people who cannot see the records were moved to a new regional team. The people who can still see them stayed in their old teams.',
      missedConsequence:
        'The pattern that ties the problem to the reorganisation stays hidden, so the engineer treats it as a random fault and offers generic fixes.',
      betterQuestion:
        "Who can still see those records, and what do the people who can't have in common?",
    },
    {
      id: 'hf-accounts-belonged-to-old-team',
      importance: 'important',
      label: 'Missing customers belonged to the old team',
      statement:
        "The customers they can't see were all looked after by their old team. Nobody has moved those accounts across to the new teams.",
      revealWhen:
        'Asks who the missing customer records belong to, who looks after those customers, or whether ownership of the records changed in the reorganisation.',
      intents: ['account_details'],
      cues: [
        'who owns',
        'owner',
        'ownership',
        'belong to',
        'assigned to',
        'which team',
        'old team',
        'who looks after those',
        'reassigned',
        'who manages those',
      ],
      hint: 'Those customers used to be handled by their old team.',
      minDifficulty: 'starter',
      statementTerse:
        'Their old team looked after those customers. Nobody reassigned the accounts.',
      statementSimple:
        'The customers they cannot see were looked after by their old team. Nobody has moved these accounts to the new teams.',
      missedConsequence:
        'The link between the old teams and the missing records stays hidden, so the engineer cannot point her administrator at the right thing to check.',
      betterQuestion:
        'Who do those missing customer records belong to, and did that change in the reorganisation?',
    },
    {
      id: 'hf-bulk-move-no-check',
      importance: 'important',
      label: 'Everyone was moved in one go, unchecked',
      statement:
        'Our administrator moved everybody into the new teams in one go over the reorganisation weekend. Nobody checked afterwards what each person could still see.',
      revealWhen:
        'Asks how or by whom the team changes were carried out in the system, or whether anyone checked the result afterwards.',
      intents: ['recent_changes'],
      cues: [
        'who carried out',
        'who made the change',
        'who made the changes',
        'who did the move',
        'who moved them',
        'how were they moved',
        'how was it done',
        'how was the move',
        'how did the move',
        'checked afterwards',
        'checked after',
        'anyone checked',
      ],
      minDifficulty: 'standard',
      statementTerse:
        'Our administrator moved everyone in one go that weekend. Nobody checked afterwards.',
      statementSimple:
        'Our administrator moved everyone to the new teams in one go, over the weekend. Nobody checked what people could see after that.',
      missedConsequence:
        'The engineer never learns the change was done in bulk without a check, so the useful next step, asking her administrator to review the people who moved, is missing.',
      betterQuestion:
        'Who carried out the team changes in the system, and did anyone check the result afterwards?',
    },
    {
      id: 'hf-emailing-lists',
      importance: 'helpful',
      label: 'Some reps are emailing customer lists',
      statement:
        "A few of them have started asking colleagues to email customer lists across so they can keep working. I'm not comfortable with that.",
      byImpact: {
        low: {
          statement:
            "One of them has started asking a colleague to email customer lists across so they can keep working. I'm not comfortable with that.",
          statementTerse:
            "One of them is asking a colleague to email customer lists. I'm not comfortable with it.",
          statementSimple:
            'One person asks a colleague to send customer lists by email so they can work. I am not comfortable with this.',
        },
        high: {
          statement:
            "Quite a lot of them have started asking colleagues to email customer lists across so they can keep working, in every region. I'm not comfortable with that.",
          statementTerse:
            "Many are asking colleagues to email customer lists. I'm not comfortable with it.",
          statementSimple:
            'Many people ask their colleagues to send customer lists by email so they can work. I am not comfortable with this.',
        },
      },
      revealWhen:
        'Asks how the affected people are managing in the meantime, or whether any workaround is in use.',
      intents: ['workaround'],
      cues: [
        'workaround',
        'work around',
        'in the meantime',
        'meantime',
        'how are they working',
        'how are they managing',
        'getting on',
        'carry on',
        'cope',
        'keep working',
      ],
      minDifficulty: 'standard',
      statementTerse:
        "Some are asking colleagues to email customer lists. I'm not comfortable with it.",
      statementSimple:
        'A few people ask their colleagues to send customer lists by email so they can work. I am not comfortable with this.',
      missedConsequence:
        'A risk to customer data goes unnoticed, and the engineer misses a reason to move quickly and to advise against sharing lists.',
      betterQuestion: 'How are the affected people getting their work done in the meantime?',
    },
    {
      id: 'hf-sees-own-created',
      importance: 'helpful',
      label: 'They can still see accounts they created',
      statement:
        "They can still see the customers they created themselves. It's the older ones that are missing.",
      revealWhen:
        'Asks which customer records the affected people can and cannot see, or whether they can see any records at all.',
      intents: ['reproducibility', 'problem_description'],
      cues: [
        'which records',
        'which accounts',
        'which customers',
        'any records',
        'any at all',
        'what can they see',
        'can they see any',
        'some of them',
        'only some',
        'their own',
      ],
      minDifficulty: 'challenge',
      statementTerse: 'They can see customers they created themselves. The older ones are missing.',
      statementSimple:
        'The people affected can see the customers they created themselves. They cannot see the older customers.',
      missedConsequence:
        'A useful detail about which records are missing never comes out, so the cause stays harder to explain and to hand to her administrator.',
      betterQuestion:
        'Which customer records can the affected people still see, and which are missing?',
    },
  ],
  incorrectAssumptions: [
    {
      id: 'ia-licence',
      statement: "I'm guessing it's a licence problem for the people affected.",
      truth:
        'Nothing in this scenario points to a licence problem. The pattern follows who was moved in the reorganisation and which team looked after the records.',
    },
    {
      id: 'ia-catch-up',
      statement: "I expect it'll sort itself out once everything has had time to catch up.",
      truth:
        'Nothing suggests the missing records will return on their own. The affected people were moved and the records were never reassigned, so waiting will not fix it.',
    },
  ],
  curveballs: [
    {
      id: 'cb-promise-everyone',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        'Can you promise me everyone will have their records back by tomorrow? I need to tell my team something.',
      followUp: "I just need to know I can tell them it'll be fixed.",
      expectedResponse:
        'Do not promise a fix time you cannot know. Reassure her honestly that the pattern is a useful clue, say what happens next and who needs to act, and give a time for the next update.',
      minDifficulty: 'starter',
    },
    {
      id: 'cb-renewals-time-limit',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 7, whenImpactUnacknowledged: true },
      statement:
        "I should say there's a time limit. We have renewals coming up, and some of the people affected own them.",
      followUp: "I'm worried about those renewals. What can be done before the end of the week?",
      expectedResponse:
        'Acknowledge the worry, be honest about what you can and cannot commit to, say what you will do first and by when, and ask how the people affected can keep working safely in the meantime.',
      minDifficulty: 'standard',
    },
  ],
  allowedCurveballs: ['unsupported-guarantee', 'deadline', 'go-silent', 'ask-manager'],

  expectedDiscoveryAreas: [
    'What the affected people actually see',
    'Who is affected, and who is not',
    'When it started and what changed',
    'How people are working in the meantime',
    'Who looks after access on her side',
  ],
  successCriteria: [
    'Puts a worried, vague caller at ease and helps her become specific with one focused question at a time.',
    'Finds what the affected people have in common compared with colleagues who can still see the records.',
    'Finds how the reorganisation was carried out and which team the missing customers belonged to.',
    'Asks how people are coping in the meantime and notices the risk in emailing customer lists.',
    'Does not promise a fix time. Explains in plain words who needs to do what next, including her administrator.',
    'Summarises the situation back to her and confirms when she will hear back.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity', 'empathy-deescalation'],
  careExpectations: {
    communicate: [
      'Asks one focused question at a time, offers examples to help a vague caller become specific, and summarises back what she said.',
    ],
    accountable: [
      'Says who will do what next, including what her administrator needs to check, and when she will hear back, without promising a fix time.',
    ],
    resourceful: [
      'Looks for the pattern in who is affected and for a safe way for people to keep working, instead of generic sign-out and sign-in advice.',
    ],
    empathetic: [
      'Reassures her honestly that the pattern is a useful clue, and acknowledges the worry about customers and renewals.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Asking only open questions and letting her stay vague instead of offering specific choices to narrow things down.',
    'Telling her to reinstall, clear the cache or sign out and back in before understanding who is affected.',
    'Using terms such as "security roles" or "business units" as if she already knows them.',
    'Promising the records will be back by a certain time without knowing the cause.',
    'Reassuring her that it will sort itself out without checking anything.',
  ],
  goodBehaviours: [
    'Reassuring her that it is fine to start vague and offering to go through it step by step.',
    'Asking who can see the records and who cannot, and what the second group has in common.',
    'Asking how and when the teams were changed in the system, and who did it.',
    'Asking how the affected people are working now, and gently flagging the risk in sharing customer lists.',
    'Explaining in plain words what her administrator should check, and agreeing when to speak again.',
  ],
  expectedOutcome:
    'Amara understands that the problem follows who was moved in the reorganisation, knows her administrator needs to check what the moved people can reach, has a plan to stop emailing customer lists, and has a time for the next update.',
  evaluatorNotes:
    'Root cause (plausible, not validated product behaviour): in the reorganisation the administrator moved people into new regional teams in one go. The customers they worked with were looked after by their old teams and were never reassigned, so the moved reps cannot see them while colleagues in the old teams can. Nobody checked afterwards, and some reps email customer lists to keep working. A strong call is patient with a vague, anxious caller, finds the pattern in who is and is not affected, finds how the move was done, notices the data risk, reassures her without promising a time, and explains what her administrator should check.',
} satisfies ScenarioInput;

export default scenario;
