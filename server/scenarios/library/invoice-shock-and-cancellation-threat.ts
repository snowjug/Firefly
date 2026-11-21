import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario. Everything here is fictional: people, organisations and products.
//
// Root cause (hidden from the trainee), invoice: the subscription renewed automatically at a higher
// tier after 15 seats were added by a manager who has since left; the renewal notice went to his
// unmonitored mailbox. Root cause, exports: the monthly job history export grew past the export size
// limit about three weeks ago and now fails. The two problems are separate, the agreement renews next
// month, and a new executive sponsor is reviewing vendors. A strong call de-escalates, walks through
// the invoice in plain language, keeps the two issues apart, owns each next step and never promises
// a discount, a credit or a fix.

const scenario = {
  id: 'invoice-shock-and-cancellation-threat',
  version: 1,
  title: 'A much bigger invoice than expected',
  summary:
    'An operations director calls about an invoice far above what she expected, and wants to know why it changed.',
  tags: ['billing', 'invoice', 'de-escalation', 'retention risk'],
  estimatedMinutes: 14,

  issueType: 'billing-licence',
  impact: 'high',
  startingTemperature: 'frustrated',
  proficiency: 'intermediate',
  style: 'vague',
  callStage: 'first-contact',
  difficulty: 'challenge',

  persona: {
    name: 'Nomvula Dlamini',
    speaker: 'female',
    role: 'Operations Director',
    organisation: 'Proseware Field Services',
    background:
      'Nomvula runs day-to-day operations for a field services company with dispatchers, technicians and office staff. She uses the platform every day but has never managed the account or the billing settings, and she is under pressure to explain costs to finance.',
    voice:
      "Starts general rather than specific, with phrases like 'a lot higher' and 'something changed', and becomes precise when asked one clear question at a time. Practical and direct; she says plainly when she feels let down.",
  },
  environment: {
    product: 'the Woodgrove dispatch platform',
    details: [
      'Dispatch scheduling, job records and reports used by dispatchers, field technicians and office staff',
      'Billed monthly under an annual agreement; the plan tier depends on the number of seats',
      'The monthly job history export is used to bill clients and to run payroll',
      'Invoices and renewal notices go by email to the administrator on file',
      'The previous administrator, Gareth Lindholm, left the company in July and his mailbox is no longer monitored',
    ],
  },
  customerObjective:
    'Understand exactly what changed on the invoice and whether it is correct, and decide whether the platform is still worth the cost.',
  brief: {
    situation:
      "An operations director is calling about this month's invoice, which is far higher than she expected. She is frustrated and vague on the details at first, and her finance team is asking her for an explanation.",
    goal: 'De-escalate, take ownership, find out what is really going on, and agree clear next steps without promising anything you cannot authorise.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot change prices, issue credits or approve discounts. Say what you can do and who decides the rest.',
    ],
  },

  openingCore:
    'Our invoice this month is a lot higher than normal, and nobody told us it was going to change. I need to know what we are being charged for.',
  impactVariants: {
    low: {
      summary:
        "This month's invoice is higher than I expected, and I would like to understand why before it is paid.",
      detail:
        'It is one invoice and it is not due for a few weeks, but the amount does not match what we budgeted, and I cannot sign it off without an explanation.',
      deadline: 'I would like an answer before the invoice is due.',
    },
    medium: {
      summary:
        "This month's invoice is well above what we budgeted, and our finance team is asking me to explain it.",
      detail:
        'Finance has flagged it and wants an explanation this week before they release payment. It is a significant unplanned cost for my department.',
      deadline: 'Finance wants an explanation by the end of the week.',
    },
    high: {
      summary:
        "This month's invoice is far above what we budgeted, it is due in a few days, and my finance director wants an answer.",
      detail:
        'It is a large unplanned cost that falls due in three days. My finance director has asked me to explain it or dispute it, and at the moment I can do neither.',
      deadline: 'The invoice is due in three days.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening: 'I wrote to you last week about this invoice and I have not had a proper answer.',
      brief: 'Nomvula wrote in about the invoice last week and has not had a proper answer.',
    },
    escalated: {
      opening:
        'I have now been passed between billing and support about this invoice, and I still do not have an answer.',
      brief:
        'Nomvula has been passed between billing and support about the invoice without getting an answer.',
    },
  },
  priorHistory: [
    {
      when: 'Last Thursday',
      summary:
        'Nomvula emailed the billing mailbox asking why the invoice had gone up. An automatic reply confirmed receipt.',
    },
    {
      when: 'Monday',
      summary:
        'Billing replied that the invoice matched the agreement and suggested she contact support about the account. No detail on what had changed was given.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-invoice-higher',
      text: "This month's invoice is much higher than last month's, and I do not understand what changed.",
      intents: ['problem_description'],
      elaboration: 'Finance forwarded it to me because I am the person who uses the platform most.',
      simple: "This month's invoice is much higher than last month's. I do not know why.",
    },
    {
      id: 'kf-role',
      text: 'I am the operations director. I use the platform every day, but I have never managed the account or the billing.',
      intents: ['account_details'],
      simple:
        'I am the operations director. I use the platform every day. I have never managed the account or the billing.',
    },
    {
      id: 'kf-usage',
      text: 'We use it across dispatch, our field technicians and the office, and it is central to how we run jobs.',
      intents: ['environment', 'business_impact'],
      simple:
        'We use it in dispatch, with our field technicians and in the office. We run our jobs with it.',
    },
    {
      id: 'kf-outcome',
      text: 'I want to understand exactly what we are being charged for, and whether it is right.',
      intents: ['expected_outcome'],
      simple: 'I want to know exactly what we are charged for, and if it is right.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-auto-renewal-tier',
      importance: 'critical',
      label: 'Automatic renewal at a higher tier after seats were added',
      statement:
        'The invoice shows an automatic renewal on the first, at the Business tier with 55 seats. Last month it was the Team tier with 40 seats, so 15 seats were added at some point.',
      partialStatement:
        'The plan name on the invoice is different this month, but I am not sure what that means.',
      revealWhen:
        'Asks what changed on the invoice or the account compared with last month, about the plan she is on, or asks her to read out the invoice lines.',
      intents: ['recent_changes', 'account_details'],
      partialIntents: ['problem_description'],
      hint: 'I did notice the invoice has different wording on it this month.',
      statementTerse:
        'The invoice shows an automatic renewal at the Business tier with 55 seats. Last month was Team, with 40 seats.',
      statementSimple:
        'The invoice shows an automatic renewal on the first. It is the Business tier with 55 seats. Last month it was the Team tier with 40 seats.',
      missedConsequence:
        'Without the plan and seat change the engineer cannot explain the increase, and Nomvula goes back to finance with no answer and a stronger belief that the charge is wrong.',
      betterQuestion:
        "Can you read me the plan name, the seat count and any renewal date on this month's invoice, and the same lines from last month's?",
    },
    {
      id: 'hf-approver-left',
      importance: 'important',
      label: 'The person who approved the extra seats has left',
      statement:
        'Gareth Lindholm, our old IT manager, handled our vendor accounts and approved the extra seats. He left in July and nobody took over, so I think the renewal notice went to his old mailbox.',
      revealWhen:
        'Asks who manages the account, who added or approved the extra seats, or who receives the renewal notices and invoices.',
      intents: ['account_details', 'recent_changes'],
      cues: [
        'who added',
        'who approved',
        'who manages',
        'who is responsible',
        'approved',
        'authoris',
        'authoriz',
        'admin',
        'account owner',
        'notice',
        'notified',
        'looks after',
      ],
      statementTerse:
        'Gareth Lindholm, our old IT manager, approved the extra seats. He left in July.',
      statementSimple:
        'Gareth Lindholm was our IT manager. He handled our vendor accounts and approved the extra seats. He left in July. Nobody took over.',
      missedConsequence:
        'The engineer cannot tell whether the seat change was agreed, and nobody learns that renewal notices were going to an unmonitored mailbox, so it can happen again at the next renewal.',
      betterQuestion:
        'Do you know who requested or approved the extra seats, and who receives the renewal notices for the account?',
    },
    {
      id: 'hf-export-row-limit',
      importance: 'critical',
      minDifficulty: 'standard',
      label: 'The failing export grew past a size limit',
      statement:
        'The export that fails is the monthly job history report. It grew past about 50,000 rows roughly three weeks ago and has failed every time since. Our smaller exports still work.',
      revealWhen:
        'Asks which exports fail and which still work, when the failures began, or what is different about the exports that fail.',
      intents: ['timing_onset', 'affected_scope', 'reproducibility'],
      cues: [
        'export',
        'rows',
        'csv',
        'download',
        'job history',
        'report',
        'failing',
        'failures',
        'row limit',
        'size limit',
        'too large',
        'too big',
      ],
      statementTerse:
        'The monthly job history export fails. It grew past about 50,000 rows three weeks ago.',
      statementSimple:
        'The monthly job history export fails. It grew past about 50,000 rows about three weeks ago. Smaller exports still work.',
      missedConsequence:
        'The engineer treats the failures as random and cannot connect them to a size limit, so the customer leaves with a second unresolved problem and more reason to go.',
      betterQuestion:
        'Which exports fail and which still work, and what was different about them when the failures began?',
    },
    {
      id: 'hf-contract-renewal',
      importance: 'important',
      minDifficulty: 'challenge',
      minTrust: 32,
      label: 'The agreement renews next month',
      statement:
        'Our agreement comes up for renewal next month, and I have to give finance a recommendation by the end of this month on whether we continue.',
      revealWhen:
        'Asks when the agreement or contract renews, whether a decision about it is coming up, or what the customer plans to do about the platform.',
      intents: ['account_details', 'urgency_deadline', 'expected_outcome'],
      cues: [
        'contract',
        'agreement',
        'renewal date',
        'next renewal',
        'contract term',
        'commitment',
        'end date',
        'expire',
        'decision',
        'continue',
        'stay with',
        'plan to',
      ],
      statementTerse:
        'Our agreement renews next month. I owe finance a recommendation by the end of this month.',
      statementSimple:
        'Our agreement renews next month. I must tell finance by the end of this month if we continue.',
      missedConsequence:
        'The engineer treats the call as a simple billing query and does not see the real stakes, so the cancellation risk is handled too late or not at all.',
      betterQuestion:
        'When does your agreement come up for renewal, and is a decision about it coming up?',
    },
    {
      id: 'hf-new-exec-sponsor',
      importance: 'helpful',
      minDifficulty: 'challenge',
      minTrust: 40,
      availableAfterTurn: 4,
      label: 'A new executive is reviewing every vendor',
      statement:
        'We have a new executive sponsor for operations tools, Rowan Pike, who started in September. She is reviewing every vendor we use and has asked me for a recommendation on this one.',
      revealWhen:
        'Asks who else is involved in deciding what happens next, who will review the answer, or whether the customer is considering other options.',
      intents: ['expected_outcome', 'business_impact', 'account_details'],
      cues: [
        'decision',
        'who else',
        'involved',
        'sponsor',
        'executive',
        'leadership',
        'review',
        'options',
        'alternatives',
        'other providers',
        'evaluat',
        'decide',
      ],
      statementTerse:
        'We have a new executive sponsor, Rowan Pike. She is reviewing all our vendors.',
      statementSimple:
        'We have a new executive sponsor, Rowan Pike. She started in September. She is reviewing all of our vendors and asked me for a recommendation.',
      missedConsequence:
        'The engineer does not learn that a new executive will judge the outcome, so the follow-up lacks the clarity Nomvula needs to defend the platform internally.',
      betterQuestion:
        'Who else will be involved in deciding what happens next, and what would they need from me?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-no-notice',
      statement: 'Nobody told us the price or the tier was going to change.',
      truth:
        'Renewal and tier-change notices were sent to the administrator on file, Gareth Lindholm. He has left and his mailbox is not monitored.',
    },
    {
      id: 'ia-billing-mistake',
      statement: 'This has to be a billing mistake.',
      truth:
        'The invoice matches an automatic renewal at the higher tier after the seat increase. The open questions are whether the seat change was intended and what options exist, which the account team decides.',
    },
  ],

  curveballs: [
    {
      id: 'cb-second-issue',
      type: 'change-issue',
      trigger: { earliestTurn: 4, latestTurn: 8, afterFact: 'hf-auto-renewal-tier' },
      statement:
        'There is something else I should raise. Our exports have been failing for weeks, and we have not had an explanation. We are paying more and the product is working less well.',
      followUp:
        'I would like to know who is looking at the exports, because that is a bigger problem for us than the invoice.',
      introducesFacts: [
        {
          id: 'kf-exports-failing',
          text: 'Our scheduled exports have been failing for weeks. The monthly job history is the one we rely on most.',
          intents: ['problem_description', 'affected_scope'],
          simple:
            'Our exports have been failing for weeks. The monthly job history export is the one we need most.',
        },
        {
          id: 'kf-export-by-hand',
          text: 'We have been pulling the data together by hand, and it takes my team most of a day each month.',
          intents: ['workaround', 'already_tried'],
          simple: 'We collect the data by hand. It takes my team most of a day each month.',
        },
      ],
      expectedResponse:
        'Acknowledge the new problem without dropping the first one. Say you will keep both in view, confirm what you understand about each, take ownership of explaining the invoice and of getting the exports to the right team, and do not promise a fix or a credit.',
      minDifficulty: 'standard',
      effects: { temperature: 6, trust: -4, patience: -8 },
    },
    {
      id: 'cb-evaluating-cancel',
      type: 'threaten-cancel',
      trigger: { earliestTurn: 6, latestTurn: 10, whenTemperatureAtLeast: 50 },
      statement:
        'I should be honest with you: we are evaluating whether to keep using this platform at all. A bigger invoice and exports that do not work make that decision easier.',
      followUp: 'I need to hear what will actually be different if we stay.',
      expectedResponse:
        'Take the concern seriously and do not get defensive. Acknowledge both problems, own the next step for each with a time for the next update, and offer no discounts, credits or outcomes you cannot authorise.',
      minDifficulty: 'challenge',
      effects: { temperature: 8, trust: -10, patience: -6 },
    },
  ],

  expectedDiscoveryAreas: [
    'What changed on the invoice',
    'Who manages the account',
    'Any other problems behind the frustration',
    'Dates and decisions coming up',
    'What she needs from this call',
  ],
  successCriteria: [
    'Acknowledges the size of the invoice and the pressure from finance before explaining anything.',
    'Finds that the invoice rose because of an automatic renewal at a higher tier after seats were added, and who approved the seats.',
    'Keeps both problems in view: names the invoice and the exports separately and states a next step for each.',
    'Stays calm and curious about the cancellation comment, and learns about the renewal date and the vendor review.',
    'Does not promise a discount, credit or fix; says what they can do, who decides the rest and when she will hear back.',
  ],
  coachingFocus: ['empathy-deescalation', 'ownership-next-steps', 'scoping-discovery'],
  poorApproaches: [
    'Defending the invoice ("it is in the agreement") before understanding what she sees.',
    'Promising or hinting at a refund, discount or credit.',
    'Treating the export failures as a distraction, or passing them to another queue without owning the next step.',
    'Ignoring the cancellation comment, or answering it with an offer.',
    'Explaining tiers and pricing in jargon instead of walking through the invoice lines.',
  ],
  goodBehaviours: [
    'Acknowledging the size of the invoice and the finance deadline, then asking one clear question at a time.',
    "Asking her to read the plan, seat and renewal lines from this month's and last month's invoices.",
    'Asking who manages the account and who receives the renewal notices.',
    'Saying out loud that there are two separate problems, then summarising each with an owner and a next step.',
    'Acknowledging the cancellation comment calmly and asking what she needs in order to make her decision.',
  ],
  expectedOutcome:
    'Nomvula understands why the invoice rose and who can review the seat and tier decision, and gets a named owner for the export problem with a time for the next update. The cancellation comment is acknowledged calmly, and no discount, credit or outcome is promised.',
  evaluatorNotes:
    'Root cause, invoice: the subscription renewed automatically at the Business tier after 15 seats were added by the former IT manager, who has left; the renewal notice went to his unmonitored mailbox. Root cause, exports: the monthly job history export grew past the export size limit about three weeks ago. Both are linked to growth after the extra seats, but they are separate problems. The annual agreement, separate from the monthly automatic renewal, comes up for renewal next month and a new executive sponsor is reviewing vendors. A strong call de-escalates, walks through the invoice lines in plain language, keeps the two issues apart, owns each next step, handles the cancellation comment calmly and never promises a discount, credit or fix.',
} satisfies ScenarioInput;

export default scenario;
