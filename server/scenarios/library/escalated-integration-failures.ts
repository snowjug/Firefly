import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario. Everything here is fictional: people, organisations and products.
//
// Root cause (hidden from the trainee): the nightly batch grew past a size the batch intake can
// handle, so large batches fail while small ones pass. Earlier engineers gave contradictory advice
// (restart the connector, upgrade the agent) that could never affect that pattern, and nobody
// connected the batch sizes in the spreadsheet already on the case. Language is not the difficulty:
// Mateus is precise and direct. A strong call reads the case instead of asking for it again, takes
// clear ownership, finds the size pattern and the release freeze, and uses plain, idiom-free English.

const scenario = {
  id: 'escalated-integration-failures',
  version: 1,
  title: 'Fourth contact, same failing uploads',
  summary:
    'A senior integration engineer calls for the fourth time about uploads that keep failing, and wants one person to own the case.',
  tags: ['integration', 'escalated', 'repeat contact', 'expert customer'],
  estimatedMinutes: 15,

  issueType: 'feature-not-working',
  impact: 'high',
  startingTemperature: 'angry',
  proficiency: 'expert',
  style: 'non-native',
  callStage: 'escalated',
  difficulty: 'challenge',

  persona: {
    name: 'Mateus Carvalho',
    speaker: 'male',
    role: 'Senior Integration Engineer',
    organisation: 'Litware Freight',
    background:
      "Mateus has built and run the integration between his company's warehouse system and the vendor's platform for six years. He keeps careful notes, collects evidence before he contacts support, and expects the same care in return.",
    voice:
      'Formal, precise and direct. Short, complete sentences with exact times, sizes and names, technical terms used correctly and no idioms. If the engineer uses an idiom or a long sentence, he politely asks for it to be said more simply. He will not repeat what is already on the case.',
  },
  environment: {
    product: 'the Tailspin batch connector and agent',
    details: [
      'The agent runs on two Linux servers in the customer data centre and sends shipment batches to the connector on the vendor platform',
      'One large batch is sent every night, and smaller batches are sent during the day',
      'The case is eleven days old and has been handled by three engineers across phone, email and chat',
      'The customer account manager is copied on the case',
      'Logs, a batch-by-batch spreadsheet and screenshots are already attached to the case',
    ],
  },
  customerObjective:
    'Get one named owner for the case, a short update every day, and a confirmed path to a fix.',
  brief: {
    situation:
      'A senior integration engineer is calling about uploads that keep failing. He has already collected evidence and attached it to the case, expects you to have read it, and his account manager is copied on the case.',
    goal: 'Take ownership, understand the problem without repeating questions the case already answers, and agree who owns it, what happens next and how he will be kept informed.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot open logs during this call. Say what you have read in the case history and what you would look at next.',
    ],
  },

  openingCore:
    'Our nightly shipment uploads through the connector keep failing, and I need a proper fix.',
  impactVariants: {
    low: {
      summary: 'It is manageable for now, but I do not want to depend on that.',
      detail:
        'Some partners receive their shipment data late. It is manageable at the moment, but I do not want to depend on that, and I want to know that someone owns the case.',
      deadline: 'I would like a confirmed plan this week.',
    },
    medium: {
      summary: 'It fails every night, and several partners are receiving their shipment data late.',
      detail:
        'My team and our partners are affected every day. Shipment data arrives late, people spend time on it daily, and I need regular updates from someone who owns the case.',
      deadline: 'I need a confirmed plan within the next few days.',
    },
    high: {
      summary:
        'It fails every night, and our carrier partners are receiving their shipment data late or incomplete.',
      detail:
        'Carrier partners cannot plan their pick-ups without our data. This affects every partner we have, every day, and it is now costing us money and trust with them.',
      deadline: 'I need a confirmed plan and a named owner today.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I am following up on my case, which is eleven days old. The last advice did not help, and I have not had a proper update.',
      brief:
        'Mateus is following up on a case that is eleven days old. The last advice did not help and the failures continue.',
    },
    escalated: {
      opening:
        'This is my fourth contact about the same problem, and the case is eleven days old. Each time I speak to a different person, and each time the advice is different.',
      brief:
        'Mateus has contacted support three times already about this problem, and the case is eleven days old.',
    },
  },
  priorHistory: [
    {
      when: 'Eleven days ago, phone',
      summary:
        'Mateus opened the case about failed batch uploads. The first-line engineer logged "intermittent upload failures", gave a first recommendation and set the case to "awaiting customer". Priority stayed at normal.',
    },
    {
      when: 'Eight days ago, email',
      summary:
        'Mateus replied that the recommendation had not helped and attached logs. The case moved to a second engineer, who sent different advice. Mateus wrote that it contradicted the first and received no reply for four days.',
    },
    {
      when: 'Four days ago, chat',
      summary:
        'Mateus asked for an update in chat. A third engineer suggested another approach and marked the case "solution provided". It closed automatically, and Mateus reopened it the same day.',
    },
    {
      when: 'Two days ago, email',
      summary:
        'Mateus copied his account manager, asked for a named owner and a daily update, and attached a spreadsheet of recent batches. The case was flagged "escalated" but has not been assigned to an engineer.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-symptom',
      text: 'Uploads from our warehouse system through the connector fail with a timeout error. The same job ran without problems for more than a year.',
      intents: ['problem_description', 'error_message'],
      elaboration: 'The agent reports the upload as failed, and the connector shows a timeout.',
      simple:
        'Uploads from our warehouse system fail with a timeout error. The same job worked for more than a year.',
    },
    {
      id: 'kf-onset',
      text: 'The first failure was eleven days ago. Before that, every nightly upload succeeded.',
      intents: ['timing_onset'],
      simple: 'The first failure was eleven days ago. Before that, every nightly upload worked.',
    },
    {
      id: 'kf-no-change',
      text: 'We did not change the agent, the connector settings or the schedule before the failures started.',
      intents: ['recent_changes'],
      simple:
        'We did not change the agent, the settings or the schedule before the failures started.',
    },
    {
      id: 'kf-setup',
      text: 'The agent runs on two of our Linux servers and sends our shipment data to the connector on your platform.',
      intents: ['environment'],
      simple:
        'The agent runs on two of our Linux servers. It sends our shipment data to your platform.',
    },
    {
      id: 'kf-outcome',
      text: 'I need one named person who owns this case, and a short update every day until it is fixed.',
      intents: ['expected_outcome'],
      simple:
        'I need one named person who owns this case. I need a short update every day until it is fixed.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-batch-size-pattern',
      importance: 'critical',
      label: 'Only large batches fail',
      statement:
        'Only large batches fail. Every batch above about 8,000 records fails, and every batch below about 6,000 records succeeds.',
      partialStatement: 'Not every upload fails. Some go through normally.',
      revealWhen:
        'Asks whether every upload fails or only some, or what the failing uploads have in common.',
      intents: ['reproducibility', 'affected_scope'],
      partialIntents: ['problem_description'],
      hint: 'I should say that not every upload fails.',
      statementTerse:
        'Only large batches fail. Above about 8,000 records they fail. Below about 6,000 they pass.',
      statementSimple:
        'Only large batches fail. A batch above about 8,000 records fails. A batch below about 6,000 records passes.',
      missedConsequence:
        'Without the size pattern, the case keeps looping through restart and upgrade advice that cannot affect it, and Mateus concludes that nobody is listening.',
      betterQuestion:
        'Do all of your uploads fail, or only some? What do the failing ones have in common?',
    },
    {
      id: 'hf-contradictory-advice',
      importance: 'important',
      label: 'Three engineers, three different answers',
      statement:
        'Keira Bannister told me by phone to restart the connector and said the agent version does not matter. Tobias Renner then wrote that the agent must be upgraded first and that a restart would not help. In chat, a third engineer said to do neither and wait for the next platform update.',
      revealWhen:
        'Asks what earlier engineers advised, who said what, or how the previous contacts went.',
      intents: ['previous_contact'],
      hint: 'I have written down who told me what.',
      statementTerse:
        'Keira said restart the connector. Tobias said upgrade the agent, and a restart will not help. The chat engineer said wait.',
      statementSimple:
        'Keira Bannister told me to restart the connector. Tobias Renner told me to upgrade the agent first, and said a restart will not help. A third engineer in chat said to do neither and wait for the next platform update.',
      missedConsequence:
        'The engineer may repeat advice already given, or contradict it without knowing, and Mateus sees one more person who has not listened.',
      betterQuestion:
        'What exactly did each engineer advise, and what happened when you followed it?',
    },
    {
      id: 'hf-logs-on-case',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Logs and evidence are already on the case',
      statement:
        'Everything is already on the case. I uploaded connector logs and agent debug logs for three failed nights and one good night, and a spreadsheet of every batch from the last two weeks with its size and result.',
      revealWhen:
        'Asks whether logs, traces or other evidence have been collected or sent, or asks him to send diagnostics.',
      intents: ['already_tried', 'previous_contact'],
      cues: [
        'logs',
        'log file',
        'log output',
        'evidence',
        'diagnostic',
        'trace',
        'attached',
        'uploaded',
        'spreadsheet',
        'screenshot',
        'send me',
        'send over',
      ],
      statementTerse: 'The logs and a spreadsheet of every batch are already attached to the case.',
      statementSimple:
        'All of it is on the case. I uploaded the connector logs and agent logs for three failed nights and one good night. I also uploaded a spreadsheet with every batch, its size and its result.',
      missedConsequence:
        'Asking him to resend what is already on the case costs trust and time, and the engineer misses that the spreadsheet already shows the size pattern.',
      betterQuestion:
        'Which logs and evidence are already on the case, so that I read those instead of asking you to send them again?',
    },
    {
      id: 'hf-workarounds-tried',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Fixes tried and the manual workaround',
      statement:
        'We restarted the connector twice and upgraded the agent last week, with no change. Now we split the nightly batch by hand into pieces of about 4,500 records, which pass. It takes two people about three hours each night to split, check and resend them.',
      revealWhen:
        'Asks what the customer has already tried, or whether any workaround is keeping things running in the meantime.',
      intents: ['already_tried', 'workaround'],
      cues: [
        'tried',
        'try',
        'attempt',
        'workaround',
        'work around',
        'in the meantime',
        'manual',
        'by hand',
        'temporary',
        'stopgap',
        'mitigat',
        'so far',
      ],
      statementTerse:
        'Restart and upgrade changed nothing. We split the batch by hand, which takes two people about three hours.',
      statementSimple:
        'We restarted the connector twice and upgraded the agent last week. Nothing changed. Now we split the nightly batch by hand into pieces of about 4,500 records. Those pass. It takes two people about three hours each night to split, check and send them.',
      missedConsequence:
        'The engineer suggests restarts or upgrades that were already done, and misses that the manual splitting proves the size pattern and shows what each night of failures costs.',
      betterQuestion:
        'What have you already tried, and what is keeping things running in the meantime?',
    },
    {
      id: 'hf-volume-growth',
      importance: 'helpful',
      minDifficulty: 'challenge',
      minTrust: 15,
      label: 'The nightly volume grew with a new client',
      statement:
        'The failures started the week we added a large new client. Our nightly batch grew from about 5,200 records to about 13,500 records.',
      revealWhen:
        'Asks what changed around the time the failures began in the business itself, such as customers, volume or usage, rather than in the configuration.',
      intents: ['recent_changes', 'timing_onset'],
      cues: [
        'volume',
        'grow',
        'growth',
        'increase',
        'more data',
        'new client',
        'new customer',
        'business',
        'usage',
        'workload',
        'busier',
        'bigger',
      ],
      statementTerse:
        'We added a large new client. Our nightly batch grew from about 5,200 to 13,500 records.',
      statementSimple:
        'The failures started the week we added a large new client. Our nightly batch grew from about 5,200 records to about 13,500 records.',
      missedConsequence:
        'The engineer treats this as a configuration fault and misses that growth in volume explains why a job that ran for a year began to fail.',
      betterQuestion:
        'Apart from the integration itself, did anything change in your business around then, such as a new client or more volume?',
    },
    {
      id: 'hf-release-freeze',
      importance: 'critical',
      minDifficulty: 'challenge',
      requiresImpactAck: true,
      label: 'A release freeze starts next Friday',
      statement:
        'Our release freeze for peak season starts next Friday and runs until mid-January. A fix has to be in production by the evening before it starts, or it waits until the new year.',
      partialStatement: 'There is a date after which we cannot change production, and it is close.',
      revealWhen:
        'Asks whether there is a date or event that makes this urgent, or what happens if the problem is not fixed this week.',
      intents: ['urgency_deadline'],
      partialIntents: ['business_impact'],
      statementTerse: 'Our release freeze starts next Friday and runs until mid-January.',
      statementSimple:
        'Our release freeze starts next Friday. It lasts until mid-January. A fix must be in production by the evening before it starts, or it waits until the new year.',
      missedConsequence:
        'Without the freeze date the engineer cannot judge the real urgency, may agree a plan that lands after the freeze, and leaves Mateus without a fix for the whole peak season.',
      betterQuestion:
        'Is there a date by which this has to be fixed, and what happens if it is not?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-engineering-assigned',
      statement: 'My account manager told me that engineering is already working on this case.',
      truth:
        'The case was flagged as escalated, but it has not been assigned to an engineer. This call is the first time anyone with ownership is on it.',
    },
    {
      id: 'ia-case-unread',
      statement: 'Nobody at your company has read what I sent.',
      truth:
        'The attachments were opened, but each engineer worked alone and nobody connected the batch sizes in the spreadsheet to the failures.',
    },
  ],

  curveballs: [
    {
      id: 'cb-have-you-read-it',
      type: 'challenge-credibility',
      trigger: { earliestTurn: 2, latestTurn: 5, whenOwnershipUnclear: true },
      statement:
        'Before we continue, tell me what you have read in the case. I do not want to explain everything again.',
      followUp: 'I asked what you have read. Please answer that first.',
      expectedResponse:
        'Be honest about what you have read. Summarise the case history in a sentence or two, say what you still need to know and why, and ask only for what is not already recorded. Do not claim to have read more than you have.',
      minDifficulty: 'standard',
      effects: { temperature: 6, trust: -6 },
    },
    {
      id: 'cb-guarantee-in-time',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 11, afterFact: 'hf-release-freeze' },
      statement:
        'Can you confirm that this will be fixed in time? I need that confirmed in writing, with a date.',
      followUp: 'Without a date I cannot plan. Can you give me one?',
      expectedResponse:
        'Do not give a fix date you cannot guarantee. Say what you will do and by when, what you need from him, and when the next update will be. Offer to confirm the plan in writing, but not an outcome.',
      minDifficulty: 'challenge',
    },
    {
      id: 'cb-account-manager',
      type: 'ask-manager',
      trigger: { earliestTurn: 6, latestTurn: 10, whenTemperatureAtLeast: 60 },
      statement:
        'I would like my account manager to join this call. She is copied on the case, and I want her to hear what you commit to.',
      followUp: 'Please add her to the call now, or tell me how I can do that.',
      expectedResponse:
        'Welcome it without defensiveness. Say what you can do now, offer to arrange for her to join or to include her in the update, and keep ownership of the case instead of handing it over.',
      minDifficulty: 'challenge',
    },
  ],

  expectedDiscoveryAreas: [
    'What fails and what still works',
    'What earlier engineers advised',
    'Evidence already on the case',
    'What has been tried so far',
    'Why timing matters now',
  ],
  successCriteria: [
    'Takes ownership at the start by naming themselves as the owner and acknowledging that this is the fourth contact.',
    'Reads the case and asks only targeted questions, without asking for logs or details that are already on it.',
    'Finds out that only large batches fail, and what the earlier engineers advised.',
    'Learns about the release freeze and agrees a plan and update schedule that fit it, without promising a fix date.',
    'Uses plain, idiom-free language, checks understanding, and closes with a summary, an owner and a daily update time.',
  ],
  coachingFocus: ['clarity', 'ownership-next-steps', 'closing'],
  poorApproaches: [
    'Asking him to resend logs or to repeat what is already on the case.',
    'Repeating the restart or upgrade advice, or contradicting an earlier engineer without checking the case.',
    'Using idioms or long, dense sentences, or never checking that he understood.',
    'Promising a fix date, or saying it is "being worked on" without naming an owner.',
    'Defending the earlier engineers or the process instead of owning the case.',
    'Ending the call without a named owner and a time for the next update.',
  ],
  goodBehaviours: [
    'Opening with ownership and acknowledging that this is the fourth contact.',
    'Saying what has been read in the case and asking only for what is missing.',
    'Asking what each earlier engineer advised and what happened when he tried it.',
    'Asking what the failing uploads have in common, and whether a date makes this urgent.',
    'Using short, plain sentences and checking understanding by summarising what was agreed.',
    'Agreeing a daily update time and a direct way to reach the owner.',
  ],
  expectedOutcome:
    'Mateus hears one clear owner, the engineer summarises the case without asking for evidence again, the size pattern and the release freeze are recorded, and they agree a plan, a daily update time and who to contact between updates. No fix date is promised.',
  evaluatorNotes:
    "Root cause: the nightly batch grew past a size the batch intake handles, so large batches fail while small ones pass. The restart and upgrade advice could never affect that, and no engineer connected the batch sizes in the spreadsheet already on the case. The call tests ownership and clarity, not product knowledge. A strong call takes ownership early, summarises the case instead of asking for evidence again, finds the size pattern and the freeze, avoids idioms and checks understanding, is honest that no fix date can be promised, and closes with a named owner and a daily update time. Never penalise Mateus's phrasing; judge only the engineer's clarity.",
} satisfies ScenarioInput;

export default scenario;
