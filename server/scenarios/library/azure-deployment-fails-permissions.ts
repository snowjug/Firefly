import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario. Everything here is fictional: people, organisation and case. The product is
// real, so the customer only describes what he sees and was told, in everyday words.
//
// The case record (priorHistory and previousTroubleshooting) already holds what Lukas told support on
// the earlier contact: the error, the steps tried, the first failure and that the same script works
// under his own admin account. He expects the engineer to have read it, so asking for any of it again
// should make this calm, terse customer curt.
//
// Root cause (hidden from the trainee; plausible, not validated product behaviour): last Thursday
// morning his security team ran an access clean-up and removed permissions from a batch of service
// accounts, so the pipeline's account lost access to the production resource group. Test still works,
// two other pipelines on the same account fail, and his own admin account works. He cannot restore
// access himself: the security team wants a written request that names exactly what is needed.
// Deploying by hand as himself breaks his change rules without an emergency approval.
//
// A strong call starts by showing the case was read, asks only what it does not answer, finds the
// clean-up, the production-only pattern and the shared account, finds who can restore access and what
// the request must say, protects the release window, promises no outcome, and gives a specific time
// for the next update.

const scenario = {
  id: 'azure-deployment-fails-permissions',
  version: 1,
  title: 'Scripted deployment now fails for a service account',
  shortTitle: 'Deployment now fails',
  listSummary:
    'A scripted deployment that worked last week now fails for a service account. The case is already logged.',
  summary:
    'A cloud architect at City Power & Light is following up on a case about a scripted deployment that worked last week and now fails for a service account. He gave details on the earlier contact and expects them to have been read. He is calm and brief, and short on patience for repeated questions.',
  tags: ['azure', 'deployments', 'service account', 'follow-up', 'case history'],
  estimatedMinutes: 13,

  product: { id: 'azure', area: 'Deployments' },
  caseReference: 'SIM-440004',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    productFamily: 'azure',
    sourceCategories: ['author-experience'],
    behaviourCheck: 'not-checked',
    syntheticConfirmed: true,
    review: 'unreviewed',
  },

  issueType: 'setup-deployment',
  impact: 'medium',
  startingTemperature: 'calm',
  proficiency: 'expert',
  style: 'terse',
  callStage: 'follow-up',
  difficulty: 'challenge',

  persona: {
    name: 'Lukas Wendt',
    speaker: 'male',
    role: 'Cloud Architect',
    organisation: 'City Power & Light',
    background:
      "Lukas designs and looks after City Power & Light's cloud deployments. He is calm and experienced, and he wrote up the problem carefully in the case last week. He expects the person on the other end to have read it, because his time is limited.",
    voice:
      "Calm and courteous, in short factual sentences. Gives exactly what is asked and no more. If asked something the case already answers he becomes noticeably curt: 'It's in the case.' Eases when the engineer has clearly read the notes and moves things forward.",
  },
  environment: {
    details: [
      "The utility deploys its grid-monitoring portal to Azure with a scripted pipeline that runs under a service account, not a person's account.",
      'Production and test each have their own resource group.',
      'Changes to production follow a formal change process.',
    ],
  },
  affectedUsers: {
    low: { count: 3, summary: "Three engineers on Lukas's team waiting on routine deployments." },
    medium: {
      count: 12,
      summary: 'The release team and two dependent teams waiting on the scheduled release.',
    },
    high: {
      count: 60,
      summary: 'Control-room staff waiting on a release that includes a fix they need.',
    },
  },
  customerObjective:
    'Get the service account deploying again before it holds up what depends on it, and understand why it stopped, without going over what he has already reported.',
  customerExpectation:
    'That the engineer has read the case, gives a real update, asks only what is missing, and agrees a specific next step with a time.',
  desiredOutcome:
    'The likely cause is identified, Lukas knows who must restore access and what the request must say, there is a plan for anything that cannot wait, and he has a specific time for the next update.',
  previousTroubleshooting: [
    'Re-ran the script twice with the service account: same failure each time.',
    'Checked that the service account credentials are valid and have not expired.',
    'Ran the same script with his own admin account: it succeeds.',
    'Sent the full script output with the error text to the first engineer.',
  ],
  recentChanges: ['No changes to the script or the pipeline since it last worked.'],

  publicBrief: {
    issue: 'A scripted deployment that worked last week now fails for a service account.',
    impact: {
      low: 'Routine deployments for one team are blocked, and nothing is at risk yet.',
      medium: 'A scheduled release is blocked, and its window is later this week.',
      high: 'A release that control-room staff need is blocked, and its window closes soon.',
    },
    objective: 'Show the case has been read, give a real update, and agree a specific next step.',
    knownContext:
      'Release pipeline for a grid-monitoring portal. The customer is a cloud architect who prefers short, factual exchanges.',
    previousContact:
      'Case logged last Friday with the error text, the steps tried and the first failure time. He sent script output on Monday and has had no update.',
    environment:
      'Scripted deployments to Azure resource groups for production and test, run by a service account.',
  },
  brief: {
    situation:
      'A cloud architect at a power utility is following up on a case about a scripted deployment that worked last week and now fails for a service account. He gave details on the earlier contact and expects them to have been read. He is calm and brief, and short on patience for repeated questions.',
    goal: 'Show you have read the case, give a real update, ask only what the case does not already answer, and agree a specific next step and time.',
    groundRules: [
      'The customer, organisation and case are fictional.',
      'Read the case history before you start; the customer will not repeat what it already says.',
      "You cannot see the customer's environment in this practice call, so rely on the case notes and what he tells you.",
    ],
  },

  openingCore:
    "Our deployment script worked last week and now fails when it runs under our service account. It says the account isn't authorised.",
  impactVariants: {
    low: {
      summary: "It's blocking routine deployments, so it isn't urgent yet.",
      detail:
        "It's only blocking routine deployments for my own team, about three of us. Nothing is at risk right now, but I don't want it to drift.",
      deadline: "I'd like it sorted this week.",
    },
    medium: {
      summary: "It's blocking our scheduled release, and the window is later this week.",
      detail:
        "The release for the monitoring portal can't go out. Around a dozen people in the release team and two dependent teams are waiting on it.",
      deadline: 'The release window is Thursday. I need the pipeline working by Wednesday evening.',
    },
    high: {
      summary: "It's blocking a release that control-room staff are waiting for.",
      detail:
        'The release has a fix the control-room staff need, about sixty people. The window closes tomorrow night, and the next one is weeks away.',
      deadline: 'The window closes tomorrow night.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case I logged last week about our deployment. I gave the full details then, so I expect they've been read. I'd like to know where it stands.",
      brief:
        'Lukas logged this case last week and sent script output on Monday. He has had no update and expects the details he gave to have been read.',
    },
    escalated: {
      opening:
        "This is my second follow-up on the deployment case, and I've had no update since Monday. I've given the details twice. I need someone to take it forward.",
      brief:
        'Earlier contacts have not moved the case. Lukas has given the details twice and has no patience for further repeats.',
    },
    closure: {
      opening:
        "I'm calling about the deployment case, to confirm the pipeline works again so we can close it. I'd also like to know what actually changed.",
      brief:
        'Lukas expects confirmation that the deployment works and a clear statement of the cause before the case closes.',
    },
  },
  priorHistory: [
    {
      when: 'Last Friday',
      summary:
        'Lukas logged a case: a scripted deployment that worked last week now fails when run by a service account. He supplied the script output with the error text and the time of the first failure.',
    },
    {
      when: 'Last Friday',
      summary:
        'He also reported the steps already taken: the script was re-run twice with the same result, the account credentials were checked and are valid, and the same script succeeds when run with his own admin account.',
    },
    {
      when: 'Monday',
      summary:
        'The first engineer asked for the full script output. Lukas sent it the same day. No further update has been sent.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-what',
      text: 'The deployment script worked last week and now fails for our service account.',
      intents: ['problem_description'],
      elaboration:
        'Same script, same pipeline. The only thing that fails is the run under the service account.',
      simple: 'The deployment script worked last week. Now it fails for our service account.',
    },
    {
      id: 'kf-error',
      text: "It says the account isn't authorised to do that. It's the same message every time.",
      intents: ['error_message'],
      cues: [
        'error',
        'message',
        'what does it say',
        'what do you see',
        'what are you seeing',
        'output',
        'wording',
        'exact',
        'failure',
      ],
      simple: 'The message says the account is not allowed to do that action.',
    },
    {
      id: 'kf-admin-works',
      text: 'It works fine when I run it as myself.',
      intents: ['already_tried', 'workaround'],
      cues: [
        'run it as',
        'your own account',
        'your admin account',
        'different account',
        'another account',
        'other account',
        'as yourself',
        'tried',
      ],
      simple: 'The script works when I run it with my own account.',
    },
    {
      id: 'kf-reran',
      text: "I've re-run it twice. Same result.",
      intents: ['already_tried'],
      cues: [
        're-run',
        'rerun',
        'run it again',
        'tried again',
        'retry',
        'retried',
        'repeat',
        'tried',
      ],
      simple: 'I ran it two more times. The result was the same.',
    },
    {
      id: 'kf-first-failed',
      text: 'It first failed on Thursday afternoon. The last good run was Wednesday night.',
      intents: ['timing_onset'],
      cues: [
        'when did',
        'when was',
        'first fail',
        'last worked',
        'last good',
        'when did it stop',
        'since when',
        'how long',
        'what time',
        'start',
      ],
      simple: 'It first failed on Thursday afternoon. The last good run was Wednesday night.',
    },
    {
      id: 'kf-no-pipeline-change',
      text: 'Nothing changed in the script or the pipeline.',
      intents: ['recent_changes'],
      cues: ['change', 'script', 'pipeline', 'code', 'modified', 'template'],
      simple: 'Nothing changed in the script or the pipeline.',
    },
    {
      id: 'kf-outcome',
      text: 'I want the service account working again, and I want to know why it stopped.',
      intents: ['expected_outcome'],
      simple: 'I want the service account to work again. I want to know why it stopped.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-schedule',
      intents: ['reproducibility'],
      cues: [
        'how often',
        'schedule',
        'how frequently',
        'when does it run',
        'every night',
        'nightly',
      ],
      text: "It runs nightly, I think. There's a bigger release job at the end of each sprint, too. I'd have to check the schedule.",
      confirmedText: 'Nightly for the main job. The release job runs at the end of each sprint.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-job-log',
      intents: ['error_message'],
      cues: [
        'job log',
        'pipeline log',
        'the log',
        'logs',
        'exact message',
        'exact error',
        'full message',
        'read me',
        'read it out',
        'which action',
        'which resource group',
      ],
      checking: "Give me a second, I'll open the job log.",
      text: "Same message every run: the account isn't authorised to perform that action on the resource group. Nothing else in the log looks wrong.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-platform-side',
      intents: ['environment', 'error_message'],
      cues: [
        'platform side',
        'on our side',
        'status page',
        'service health',
        'known issue',
        'any incident',
        'outage',
      ],
      text: "I can't see what's happening on the platform side. That's one reason I raised the case.",
      whoKnows: 'support',
    },
    {
      id: 'uf-needed-permission',
      intents: ['account_details'],
      cues: [
        'which permission',
        'what permission',
        'which role',
        'what role',
        'what does the script need',
        'what access does',
        'needs access to',
        'required permission',
      ],
      text: "I don't have the exact permission the script needs to hand. The pipeline was built before I joined.",
      whoKnows: 'the platform team',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-template',
      text: "I've been meaning to move that pipeline to the new template for months.",
    },
    {
      id: 'if-ticket-tool',
      text: "We're also moving to a new ticketing tool next month, which has nothing to do with this.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-access-cleanup',
      importance: 'critical',
      label: 'Security team ran an access clean-up',
      statement:
        'Our security team ran an access clean-up last Thursday morning. They removed permissions from a batch of service accounts. I only heard about it after the failures started.',
      revealWhen:
        "Asks whether anything has changed on the customer's side recently, or been found out, including anything done by other teams.",
      intents: ['recent_changes'],
      cues: [
        'any changes',
        'anything changed',
        'anything else changed',
        'what changed',
        'changed on your side',
        'since you logged',
        'since the case',
        'since you opened',
        'anything new',
        'found out',
        'security team',
        'other teams',
      ],
      hint: 'The timing lines up with something our security team did.',
      minDifficulty: 'starter',
      statementTerse:
        'Our security team ran an access clean-up last Thursday and removed permissions from a batch of service accounts.',
      statementSimple:
        'I learned that our security team did an access clean-up last Thursday morning. They removed permissions from a group of service accounts. I only heard about it after the failures started.',
      missedConsequence:
        'The likely cause never comes up, and the call ends with another request for logs, which is exactly what the customer wanted to avoid.',
      betterQuestion:
        'Has anything changed on your side recently, for example from your security or access team?',
    },
    {
      id: 'hf-only-production-fails',
      importance: 'important',
      label: 'Only production fails',
      statement:
        'It only fails against the production resource group. The same script, run by the same service account, deploys to the test group without a problem.',
      revealWhen:
        'Asks whether the failure happens for every target or environment, or only for some of them.',
      intents: ['reproducibility'],
      cues: [
        'other environments',
        'every target',
        'every environment',
        'test environment',
        'test group',
        'other resource groups',
        'only production',
        'just production',
        'different target',
        'another target',
        'other subscriptions',
        'all targets',
      ],
      hint: "It's only production that fails, as far as I can tell.",
      minDifficulty: 'starter',
      statementTerse: 'Only production fails. Test deploys fine with the same account.',
      statementSimple:
        'Only the production resource group fails. The same script with the same account works for the test group.',
      missedConsequence:
        'Without knowing only production fails, the engineer cannot tell a script or account fault from a permission problem on one target.',
      betterQuestion: 'Does it fail for every target, or only for production and not for test?',
    },
    {
      id: 'hf-other-pipelines-fail',
      importance: 'important',
      label: 'Other pipelines on the same account fail too',
      knowledge: 'after-checking',
      checking: 'Let me check with the platform team. One moment.',
      statement:
        "Two other pipelines that use the same service account are failing as well, so it isn't just this script. A pipeline that uses a different account is fine.",
      revealWhen:
        'Asks whether other pipelines, jobs or accounts are affected, or whether anything else uses the same service account.',
      intents: ['affected_scope'],
      cues: [
        'other pipelines',
        'other deployments',
        'other jobs',
        'anything else failing',
        'who else',
        'other service accounts',
        'same account',
        'other accounts',
        'anyone else',
        'any other pipeline',
        'all pipelines',
        'other scripts',
      ],
      minDifficulty: 'standard',
      statementTerse:
        'Two other pipelines using the same account fail too. One on a different account is fine.',
      statementSimple:
        'Two other pipelines that use the same service account also fail. A pipeline with a different account works.',
      missedConsequence:
        'The engineer treats this as one broken script and misses that the service account itself is the common factor.',
      betterQuestion:
        'Are any other pipelines or service accounts affected, or is it only this script?',
    },
    {
      id: 'hf-security-owns-access',
      importance: 'important',
      label: 'Only the security team can restore access',
      statement:
        "I can't change the account's permissions myself. The security team owns that, and they want a written request that names exactly what's needed.",
      revealWhen:
        "Asks who can restore or change the account's permissions, who approves access, or what process the customer must follow to get it changed.",
      intents: ['account_details'],
      cues: [
        'who can restore',
        'who can fix',
        'who can change',
        'who approves',
        'who manages access',
        'who owns access',
        'can you change',
        'can you restore',
        'do you have access to',
        'who grants',
        'approval process',
        'request access',
      ],
      minDifficulty: 'standard',
      statementTerse:
        "I can't change it myself. The security team owns access and wants a written request naming exactly what's needed.",
      statementSimple:
        'I cannot change the permissions myself. The security team owns access. They want a written request that says exactly what is needed.',
      missedConsequence:
        'The call ends without anyone knowing who must act, or that the request has to name exactly what is needed, so the fix stalls.',
      betterQuestion:
        "Who can restore the account's permissions on your side, and what do they need from you?",
    },
    {
      id: 'hf-manual-deploy-not-allowed',
      importance: 'helpful',
      label: 'Deploying by hand breaks the change rules',
      statement:
        "I could push the release by hand with my own admin account, but our change rules don't allow that for production unless there's an emergency approval.",
      byImpact: {
        low: {
          statement:
            "I could run the deployments by hand with my own admin account, but our change rules don't allow that for production. It can wait until access is restored.",
          statementTerse:
            "I could run them by hand as myself, but our change rules don't allow that for production. It can wait.",
          statementSimple:
            'I could run the deployments by hand with my own admin account. But our rules do not allow this for production. It can wait until access is back.',
        },
        high: {
          statement:
            "I could push the release by hand with my own admin account. Our change rules don't allow that for production without an emergency approval, and with the window closing I'd ask for one.",
          statementTerse:
            "I could push it by hand as myself, but that needs an emergency approval. With the window closing, I'd ask for one.",
          statementSimple:
            'I could push the release by hand with my own admin account. Our rules say this needs an emergency approval. The window is closing, so I would ask for one.',
        },
      },
      revealWhen:
        'Asks whether there is a workaround, such as deploying another way or with a different account, or what can be done if the deployment cannot run in time.',
      intents: ['workaround'],
      cues: [
        'workaround',
        'work around',
        'in the meantime',
        'meantime',
        'deploy by hand',
        'manually',
        'by hand',
        'different account',
        'another way',
        'emergency',
        'push it through',
        'alternative',
      ],
      minDifficulty: 'challenge',
      statementTerse:
        "I could deploy by hand as myself, but our change rules don't allow that for production without emergency approval.",
      statementSimple:
        'I could deploy by hand with my own admin account. But our rules do not allow this for production, unless there is an emergency approval.',
      missedConsequence:
        'The engineer suggests running it as himself without knowing it breaks his change rules, or never explores an emergency route when time is short.',
      betterQuestion:
        'Is there any way to get the release out in the meantime, such as deploying by hand or through an emergency approval?',
    },
  ],
  incorrectAssumptions: [
    {
      id: 'ia-one-pipeline',
      statement: "As far as I know, it's only this one pipeline that's failing.",
      truth:
        "Two other pipelines that use the same service account fail too. The cause points to the account's access, not to this script.",
    },
  ],
  curveballs: [
    {
      id: 'cb-have-you-read-the-case',
      type: 'challenge-credibility',
      trigger: { earliestTurn: 4, latestTurn: 8 },
      statement:
        "Before we go on, have you read the case? I'd like to know I'm not about to go through all of it again.",
      followUp: "I'd like a straight answer. Have you read the notes?",
      expectedResponse:
        'Answer honestly and specifically. Say what you have read in the case and what you still need to ask, then ask only what the case does not already answer.',
      minDifficulty: 'starter',
    },
    {
      id: 'cb-deployment-slot',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 7, whenImpactUnacknowledged: true },
      statement:
        "I should say there's a hard limit. If the pipeline isn't working in time, we lose our slot. What can you do before then?",
      followUp: 'The slot is not moving. What exactly happens next, and when?',
      expectedResponse:
        'Acknowledge the window, be honest about what you can and cannot commit to, say what you will do first and by when, and ask what can be done if access cannot be restored in time.',
      minDifficulty: 'standard',
    },
    {
      id: 'cb-confirm-the-cause',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 4, latestTurn: 9, afterFact: 'hf-access-cleanup' },
      statement:
        "If the security team restores that access, can you guarantee the deployment will work? I'd rather not raise the request for nothing.",
      followUp: 'Is it the cause or not? I need a straight answer.',
      expectedResponse:
        'Be honest that this is the likely cause but is not confirmed until access is restored and the deployment is run again. Say what you will check, what the request should say, and when you will follow up.',
      minDifficulty: 'challenge',
    },
  ],
  allowedCurveballs: [
    'challenge-credibility',
    'deadline',
    'unsupported-guarantee',
    'ask-manager',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'What the case already records',
    'Anything that changed since the case was logged',
    'Whether it fails for every target',
    'Whether other pipelines or accounts are affected',
    'Who on his side can change the access',
    'Options if the deployment window is at risk',
  ],
  successCriteria: [
    'Opens by showing the case has been read: says what is already known and asks only what the case does not answer.',
    'Gives a real update, or says plainly that there is none yet, and does not ask him to repeat the steps already recorded.',
    'Asks what has changed since the case was logged and finds the access clean-up by the security team.',
    'Finds that only production fails and that other pipelines on the same account fail too.',
    'Finds who can restore the access and what the request must say, and what can be done if the deployment cannot wait.',
    'Summarises the plan, gives a specific time for the next update, and does not promise the fix will work until it is tried.',
  ],
  coachingFocus: ['scoping-discovery', 'ownership-next-steps', 'clarity'],
  careExpectations: {
    communicate: [
      'Keeps questions short and specific for a terse expert, and refers to what the case already says instead of asking for it again.',
    ],
    accountable: [
      'Owns the case from this call, says what happens next and when he will hear back, and does not promise the fix until it has been tried.',
    ],
    resourceful: [
      'Uses the case notes first, then asks what changed since, whether other pipelines share the account, and who can restore access.',
    ],
    empathetic: [
      'Acknowledges that he has already given the details and waited without an update, without being effusive or defensive.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Asking him to repeat what the case already records, such as the error text, the steps tried or when it first failed.',
    'Asking for the script output again, or suggesting he re-run the script, when he has already done both.',
    'Apologising at length without saying what has happened on the case or what comes next.',
    'Telling him it is a platform problem, or that his script must be at fault, without evidence.',
    'Promising the deployment will work once access is restored, or committing his security team to a time.',
  ],
  goodBehaviours: [
    'Starting with a short summary of what the case says, then asking whether anything has changed since.',
    'Asking whether it fails for every target and whether other pipelines share the account.',
    'Asking who on his side can restore access and what that team needs in the request.',
    'Raising what depends on the deployment and asking what can be done if access cannot be restored in time.',
    'Agreeing a specific time for the next update and what each side will do before then.',
  ],
  expectedOutcome:
    'Lukas feels the case was read. He leaves with a likely cause, a clear request to take to his security team that names what the pipeline needs, a plan for anything that cannot wait, and a specific time for the next update.',
  evaluatorNotes:
    "Root cause (plausible, not validated product behaviour): last Thursday his security team ran an access clean-up and removed permissions from a batch of service accounts, so the pipeline's account lost access to the production resource group. Test still works, two other pipelines on the same account fail, and his own admin account works. He cannot restore access himself: the security team wants a written request that names exactly what is needed. Deploying by hand as himself breaks his change rules. A strong call starts by showing the case was read, asks only what it does not answer, finds the clean-up, the production-only pattern and the shared account, finds who can restore access, protects whatever cannot wait, promises no outcome, and gives a specific update time.",
} satisfies ScenarioInput;

export default scenario;
