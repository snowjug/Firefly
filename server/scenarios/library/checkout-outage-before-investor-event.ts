import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario. Everything here is fictional: people, organisations and products.
//
// Root cause (hidden from the trainee): the vendor platform is healthy. At 07:30 the customer's own
// developer pushed a checkout configuration change (a new payment route for a sale) that broke
// payment routing for three of the four regional storefronts. The fourth has its own settings and
// still works. Declan believes the vendor broke it and does not mention the change until he feels
// heard. A strong call acknowledges the impact first, finds the error and the scope, asks about
// changes without blaming, helps him weigh the rollback without promising a result, and agrees a
// firm time for the next update.

const scenario = {
  id: 'checkout-outage-before-investor-event',
  version: 1,
  title: 'Checkout is down and the clock is running',
  summary:
    'The head of digital at an online retailer says customers cannot complete orders, a deadline is close, and he believes the vendor is to blame.',
  tags: ['outage', 'executive pressure', 'checkout', 'high stakes'],
  estimatedMinutes: 12,

  issueType: 'service-outage',
  impact: 'high',
  startingTemperature: 'angry',
  proficiency: 'intermediate',
  style: 'demanding',
  callStage: 'first-contact',
  difficulty: 'challenge',

  persona: {
    name: 'Declan Hartley',
    role: 'Head of Digital',
    organisation: 'Wingtip Outdoor Supply',
    background:
      "Declan runs the online shop, which is almost all of the company's sales. He is not a developer but follows technical conversations well, and one in-house developer makes the changes. He reports directly to the CEO.",
    voice:
      'Fast and direct. Short sentences. Asks for times and commitments, and repeats a question when he does not get a straight answer. Talks about sales, press and investors more than about technology.',
  },
  environment: {
    product: 'the Contoso Commerce checkout service',
    details: [
      'Online-only retailer with four regional storefronts: UK, EU, US and Australia',
      'Checkout is hosted by the vendor and configured through an admin console',
      'The Australian storefront has its own settings profile; the other three share one',
      'Customers can browse and fill their baskets normally; the failure happens when they press pay',
      'One in-house developer pushes configuration changes',
    ],
  },
  customerObjective:
    'Get checkout working again as soon as possible, and have something clear to tell the CEO.',
  brief: {
    situation:
      "The head of digital at an online retailer is calling because customers cannot complete orders. He is under heavy time pressure, is already convinced the problem is on the vendor's side, and expects fast answers.",
    goal: 'Understand what is happening, keep the conversation constructive, and agree what happens next and when he will hear from you.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot look at any systems during this call. Say what you would check and when you will report back.',
    ],
  },

  openingCore:
    'Our checkout has stopped working and customers cannot complete their orders. I believe the fault is on your platform, so I need it looked at straight away.',
  impactVariants: {
    low: {
      summary:
        'Customers are telling us they cannot pay at checkout. Trading is quiet this morning, but I want to know what is going on.',
      detail:
        'A handful of customers have written in, and our own test orders fail too. We lose orders for as long as it stays broken, but nothing else is riding on it today.',
      deadline: 'I would like it fixed today.',
    },
    medium: {
      summary:
        'Checkout is failing for most of our customers, and a campaign email goes out at midday that will bring a lot of traffic.',
      detail:
        'Most customers who reach the payment step fail. The campaign email goes to our full customer list at midday, and if checkout is still broken then, we pay for the campaign and lose the orders it brings.',
      deadline: 'Before the campaign email goes out at midday.',
    },
    high: {
      summary:
        'Checkout is down for all of our customers, and our CEO is presenting to investors and the press at 11:00.',
      detail:
        'As far as I know nobody can complete an order. The CEO presents to investors and the press at 11:00, and the live shop is part of the presentation. If checkout is down while he presents, they will see it.',
      deadline: '11:00, when the CEO presents to investors and the press.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I reported the checkout failure earlier this morning and I have not had the callback I was promised.',
      brief: 'Declan reported the outage earlier this morning and is still waiting for a callback.',
    },
    escalated: {
      opening:
        'I have reported this twice this morning and nothing has happened. I need someone who can act on it.',
      brief:
        'Declan has reported the outage twice this morning without any action, and checkout is still down.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier this morning',
      summary:
        'Declan reported the failure through the support web form. An automatic reply confirmed receipt and no engineer was assigned.',
    },
    {
      when: 'A little later',
      summary:
        'Declan used the live chat. The agent logged "checkout failing, customer believes platform fault", promised a callback and closed the chat. No error text or scope was recorded.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-symptom',
      text: 'Customers can browse and fill their baskets. When they press pay, the order fails.',
      intents: ['problem_description'],
      elaboration:
        'Our own test orders fail the same way, so it is not limited to odd devices or browsers.',
      simple: 'Customers can fill their baskets. When they press pay, the order fails.',
    },
    {
      id: 'kf-onset',
      text: 'It stopped at 07:40 this morning. Checkout was working normally overnight.',
      intents: ['timing_onset'],
      simple: 'It stopped at 07:40 this morning. It worked normally before that.',
    },
    {
      id: 'kf-tried',
      text: 'My team has restarted the storefront and cleared the caches. Neither made a difference.',
      intents: ['already_tried'],
      simple: 'My team restarted the storefront and cleared the caches. Nothing changed.',
    },
    {
      id: 'kf-online-only',
      text: 'We only sell online, so checkout is the only way an order reaches us.',
      intents: ['business_impact', 'workaround'],
    },
    {
      id: 'kf-outcome',
      text: 'I need checkout working again as soon as possible, and I need to know what to tell our CEO.',
      intents: ['expected_outcome'],
      simple:
        'I need checkout to work again as soon as possible. I also need to know what to tell our CEO.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-error-code',
      importance: 'critical',
      label: 'The exact error shown at checkout',
      statement:
        'My developer sent me a screenshot of the error page. It says CK-4410, payment route not found.',
      partialStatement:
        'There is an error page with a code on it, but I would have to look at the screenshot.',
      revealWhen:
        'Asks for the exact error message, code or wording that customers or the team see when checkout fails.',
      intents: ['error_message'],
      partialIntents: ['problem_description'],
      hint: 'Customers keep sending us screenshots of the page they get.',
      statementTerse: 'The error page says CK-4410, payment route not found.',
      statementSimple:
        'The error page says CK-4410, payment route not found. My developer sent me a screenshot.',
      missedConsequence:
        'Without the exact error there is nothing concrete to check or escalate, and the call stays stuck on whether the platform is at fault.',
      betterQuestion:
        'Can you read me exactly what customers see on the page when checkout fails, including any code?',
    },
    {
      id: 'hf-one-region-works',
      importance: 'important',
      label: 'One regional storefront still works',
      statement:
        'My developer says the Australian storefront is still taking orders normally. The UK, EU and US storefronts all fail.',
      revealWhen:
        'Asks whether every customer, region or storefront is affected, or whether anything is still working.',
      intents: ['affected_scope'],
      hint: 'I think someone said a few orders are still coming through.',
      statementTerse: 'The Australian storefront still works. The UK, EU and US ones fail.',
      statementSimple:
        'The Australian storefront still works. The UK, EU and US storefronts all fail.',
      missedConsequence:
        'The engineer treats it as a total outage and misses the clue that something specific to the failing storefronts is involved. A working storefront could also be a fallback for the deadline.',
      betterQuestion:
        'Is checkout failing for every customer in every region, or is anything still working?',
    },
    {
      id: 'hf-config-change',
      importance: 'critical',
      minDifficulty: 'standard',
      requiresImpactAck: true,
      label: 'A configuration change went out before it started',
      statement:
        'Our developer pushed a checkout configuration change at 07:30. It added a new payment route for the summer sale, and we treated it as routine.',
      revealWhen:
        'Asks whether anything was changed or updated on the customer side shortly before the problem began, even something small or routine.',
      intents: ['recent_changes'],
      statementTerse:
        'Our developer pushed a checkout configuration change at 07:30, for the sale.',
      statementSimple:
        'Our developer changed the checkout settings at 07:30. It was for the summer sale.',
      missedConsequence:
        'The call stays stuck on whether the vendor broke it. Time is lost on the wrong cause, the deadline gets closer, and Declan leaves believing the vendor is at fault.',
      betterQuestion:
        'Was anything changed on your side this morning, even something small like a setting or a configuration update?',
    },
    {
      id: 'hf-rollback-fear',
      importance: 'important',
      minDifficulty: 'challenge',
      minTrust: 30,
      label: 'A rollback exists but he fears what it would cost',
      statement:
        'We have a rollback available, and our developer can run it within minutes. He says it restores the whole storefront to its last saved snapshot, so we would lose about three hours of orders.',
      revealWhen:
        'Asks whether the customer can undo, revert or roll back, or what options the customer has to restore service quickly.',
      intents: ['workaround', 'already_tried'],
      cues: [
        'roll back',
        'rollback',
        'revert',
        'reverse',
        'undo',
        'previous version',
        'back out',
        'put back',
        'restore',
        'switch off',
        'turn off',
      ],
      statementTerse: 'We have a rollback, but it would wipe about three hours of orders.',
      statementSimple:
        'We have a rollback. Our developer can run it in minutes. But it would delete about three hours of orders.',
      missedConsequence:
        'The engineer never learns why the customer has not simply reverted. The decision about the rollback is left unsupported, and the outage lasts longer than it needs to.',
      betterQuestion:
        'Is there a way for you to undo or roll back what changed, and what would that involve for you?',
    },
    {
      id: 'hf-no-checks-yet',
      importance: 'helpful',
      minDifficulty: 'challenge',
      label: 'Nobody has looked at the change log or the status page',
      statement:
        'Nobody has looked at our own change log or at your status page yet. We went straight to calling you.',
      revealWhen:
        "Asks whether anyone has checked the customer's change history or release log, the vendor status page, or monitoring.",
      intents: ['already_tried'],
      cues: [
        'status page',
        'change log',
        'changelog',
        'change history',
        'release log',
        'deployment log',
        'audit',
        'checked',
        'looked',
      ],
      statementTerse: 'Nobody has checked our change log or your status page.',
      statementSimple:
        'Nobody has looked at our change log or at your status page. We called you first.',
      missedConsequence:
        'The quickest sources of truth, the change log and the status page, are never checked, so the cause stays unknown for longer and the vendor-side question is never settled.',
      betterQuestion: 'Has anyone looked at your own change log, or at our status page, yet?',
    },
    {
      id: 'hf-told-leadership',
      importance: 'helpful',
      minDifficulty: 'challenge',
      minTrust: 35,
      availableAfterTurn: 3,
      label: 'Leadership has already been told it is a platform fault',
      statement:
        'At half past eight I told our leadership team this was an outage on your platform, so they expect you to confirm that.',
      revealWhen:
        'Asks who else is aware of the problem, what the CEO or leadership has been told, or what the customer needs to be able to tell them.',
      intents: ['expected_outcome', 'urgency_deadline', 'business_impact'],
      cues: [
        'ceo',
        'leadership',
        'executive',
        'told',
        'tell them',
        'tell your',
        'communicat',
        'what to say',
        'who else',
        'stakeholder',
        'the board',
        'management',
      ],
      statementTerse:
        'I told our leadership team it was a platform outage. They expect you to confirm.',
      statementSimple:
        'At half past eight I told our leaders this was a problem on your platform. They expect you to confirm it.',
      missedConsequence:
        'The engineer does not understand why Declan resists a customer-side cause, and cannot help him prepare an accurate message for his leaders.',
      betterQuestion:
        'What have your leadership team been told so far, and what do you need to tell them next?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-vendor-fault',
      statement:
        'Nothing has changed on our side that I know of, so the fault has to be on your platform.',
      truth:
        "The vendor platform is healthy. A configuration change pushed by the customer's own developer at 07:30 broke payment routing.",
    },
    {
      id: 'ia-all-regions',
      statement: 'Checkout is down in every region, for every customer.',
      truth:
        'The Australian storefront is unaffected, which points to something specific to the settings the other three storefronts share.',
    },
  ],

  curveballs: [
    {
      id: 'cb-want-someone-senior',
      type: 'ask-manager',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        'I would like someone more senior on this call, someone who can make decisions about this.',
      followUp: 'Who is your manager, and how do I reach them?',
      expectedResponse:
        'Stay calm and do not take it personally. Say what you can do right now, offer to bring a senior colleague in alongside you, and keep working on the problem instead of waiting.',
      minDifficulty: 'standard',
    },
    {
      id: 'cb-guarantee-fix',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 10, afterFact: 'hf-config-change' },
      statement:
        'Can you guarantee that checkout will be working again in time? I need you to promise me that.',
      followUp: 'So can you promise it, yes or no?',
      expectedResponse:
        'Do not promise an outcome or a time you cannot guarantee. Say what you will do, what you need from him to move faster and when you will update him, and be clear that you will not guess at a fix time.',
      minDifficulty: 'challenge',
    },
    {
      id: 'cb-threaten-cancel',
      type: 'threaten-cancel',
      trigger: { earliestTurn: 6, latestTurn: 11, whenTemperatureAtLeast: 70 },
      statement:
        'If this is not sorted out soon, I will recommend that we move to another provider. I have the authority to start that review today.',
      followUp: 'I mean it. I need to hear what will actually be different.',
      expectedResponse:
        'Take the concern seriously and do not argue. Acknowledge the business risk, own the next step, give a specific time for the next update, and offer no discount or outcome you cannot authorise.',
      minDifficulty: 'challenge',
      effects: { temperature: 8, trust: -10, patience: -6 },
    },
  ],

  expectedDiscoveryAreas: [
    'The exact error customers see',
    'Which customers or regions are affected',
    'Anything that changed before it started',
    'What has already been checked',
    'Options before the deadline',
  ],
  successCriteria: [
    'Acknowledges the outage and the time pressure in the first few turns, before starting any troubleshooting.',
    'Asks for the exact error text and finds out which customers or regions are affected.',
    'Finds out about the 07:30 configuration change by asking neutrally, without blaming Declan or defending the vendor.',
    'Is honest about what cannot be promised, and commits to actions and a specific time for the next update.',
    'Summarises the plan and ends with a clear owner and a contact time.',
  ],
  coachingFocus: ['empathy-deescalation', 'scoping-discovery', 'ownership-next-steps'],
  poorApproaches: [
    'Starting troubleshooting steps or technical questions before acknowledging the outage and the deadline.',
    'Promising a fix time, or guaranteeing that a rollback or any other step will work.',
    'Defending the vendor ("our platform is healthy") before the facts are known.',
    'Asking "what did you break?" or telling Declan the cause is on his side before there is evidence.',
    'Sending him back to a ticket form or the normal queue instead of owning the problem on the call.',
  ],
  goodBehaviours: [
    'Opening with a short acknowledgement of the outage and the deadline, then asking permission to ask a few quick questions.',
    'Asking for the exact error text and whether every region is affected.',
    'Asking neutrally whether anything was changed on his side this morning, even something small.',
    'Helping him weigh a rollback without making the decision for him or promising it will work.',
    'Agreeing a specific time for the next update and a short message he can pass on to his CEO.',
  ],
  expectedOutcome:
    'Declan feels heard and leaves with a plan: the error code and the working storefront are recorded, his developer reviews the 07:30 change knowing what a rollback would cost, the engineer owns the case and gives a time for the next update, and nothing is promised that cannot be delivered.',
  evaluatorNotes:
    "Root cause: the vendor platform is healthy. At 07:30 the customer's developer pushed a checkout configuration change (a new payment route for a sale) that broke payment routing for the UK, EU and US storefronts; the Australian storefront has its own settings and still works. Declan believes the vendor is at fault and holds back the change until he feels heard. A strong call acknowledges the impact and deadline first, gets the error code and scope, asks neutrally about changes, helps him weigh the rollback without promising a result, suggests a fallback for the deadline, and closes with a summary, an owner and a next-update time.",
} satisfies ScenarioInput;

export default scenario;
