import type { AppConfigDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import {
  SPEECH_LANGUAGES,
  type SpeechCapabilitiesDTO,
  type SpeechVoiceDTO,
} from '#shared/domain/speech.ts';
import { VOICE_CHOICES, type VoiceId } from '#shared/domain/voices.ts';
import {
  PRODUCT_FAMILY_LABELS,
  PRODUCT_INFO,
  type BusinessImpact,
  type CallStage,
  type CommunicationStyle,
  type CurveballType,
  type Difficulty,
  type IssueType,
  type ProductId,
  type Proficiency,
  type StartTemperature,
} from '#shared/domain/vocab.ts';

// Test data for this feature. The scenarios are written here, typed against the public DTO, so no
// test depends on the real library: people and organisations are made up, and so are the case
// numbers. The products are real Microsoft products, described only as a customer would report.

interface Seed {
  id: string;
  title: string;
  /** The card title: two to six words. */
  short: string;
  product: ProductId;
  area: string;
  difficulty: Difficulty;
  issue: IssueType;
  impact: BusinessImpact;
  mood: StartTemperature;
  proficiency: Proficiency;
  style: CommunicationStyle;
  stage: CallStage;
  minutes: number;
  who: readonly [name: string, role: string, organisation: string];
  list: string;
  summary: string;
  brief: {
    issue: string;
    impact: readonly [low: string, medium: string, high: string];
    objective: string;
    known?: string;
    previous?: string;
    environment?: string;
  };
  curveballs: readonly CurveballType[];
}

const SEEDS: readonly Seed[] = [
  {
    id: 'teams-recordings-missing',
    title: 'Meeting recordings missing after a policy change',
    short: 'Meeting recordings missing',
    product: 'teams',
    area: 'Meetings',
    difficulty: 'standard',
    issue: 'data-missing',
    impact: 'medium',
    mood: 'frustrated',
    proficiency: 'intermediate',
    style: 'talkative',
    stage: 'first-contact',
    minutes: 10,
    who: ['Priya Nair', 'Customer onboarding lead', 'Contoso Retail'],
    list: "An onboarding lead cannot find last week's workshop recordings in Teams or OneDrive.",
    summary:
      "Priya runs customer onboarding at a retailer. Recordings from last week's workshops no longer appear in Teams, and she needs them for a review on Friday. She believes an administrator changed a meeting policy but is not sure what changed.",
    brief: {
      issue: "Recordings from last week's meetings no longer appear for the organiser.",
      impact: [
        'One organiser is missing a few recordings.',
        'A team cannot finish a Friday review without the recordings.',
        'Several teams have lost recordings needed for a compliance deadline.',
      ],
      objective: 'Find out what changed and agree how to get the recordings back.',
      known:
        'Recordings were visible until Monday. An administrator updated a meeting policy that week.',
      environment: 'Microsoft 365 E3, Windows 11 laptops, Teams desktop app.',
    },
    curveballs: ['ask-manager', 'deadline'],
  },
  {
    id: 'teams-calls-break-up',
    title: 'Calls break up on the sales floor',
    short: 'Calls break up',
    product: 'teams',
    area: 'Calling',
    difficulty: 'challenge',
    issue: 'slow-performance',
    impact: 'high',
    mood: 'angry',
    proficiency: 'expert',
    style: 'demanding',
    stage: 'escalated',
    minutes: 12,
    who: ['Kenji Watanabe', 'Head of sales operations', 'Woodgrove Bank'],
    list: 'Sales calls in Teams drop and echo every afternoon, and the issue was already escalated.',
    summary:
      'Kenji leads sales operations at a bank. Teams calls on the sales floor break up and echo most afternoons. The case was escalated last week after two earlier contacts, and his team is losing deals. He expects a clear owner and a firm update time.',
    brief: {
      issue: 'Teams calls drop and echo for the whole sales floor most afternoons.',
      impact: [
        'A few calls need to be repeated each week.',
        'A sales team repeats calls every afternoon.',
        'Forty sales staff are losing client calls during peak hours.',
      ],
      objective: 'Take ownership, gather call details and agree a firm update time.',
      previous: 'Two earlier contacts collected logs. No cause was shared and nobody called back.',
      environment: 'Teams desktop on Windows 11, wired and Wi-Fi desks, one office site.',
    },
    curveballs: ['ask-manager', 'deadline', 'go-silent', 'threaten-cancel'],
  },
  {
    id: 'outlook-shared-mailbox-send',
    title: 'Cannot send from the shared mailbox',
    short: 'Cannot send from shared mailbox',
    product: 'outlook',
    area: 'Shared mailboxes',
    difficulty: 'starter',
    issue: 'feature-not-working',
    impact: 'low',
    mood: 'calm',
    proficiency: 'novice',
    style: 'talkative',
    stage: 'first-contact',
    minutes: 8,
    who: ['Hannah Brooks', 'Office manager', 'Wingtip Studios'],
    list: 'An office manager sees the shared mailbox in Outlook but sending as it fails.',
    summary:
      "Hannah manages a small studio's front desk. The shared mailbox appears in her Outlook, but messages sent from it return an error. A colleague can send without trouble. Hannah is new to the role and wants clear, plain explanations.",
    brief: {
      issue: 'Sending as the shared mailbox returns an error for one user.',
      impact: [
        'One person cannot send from the shared address.',
        'The front desk cannot reply to customers on time.',
        'Customer enquiries are going unanswered across the whole office.',
      ],
      objective: 'Confirm the error, check the permission and explain the fix plainly.',
      environment: 'Outlook for Windows, Exchange Online shared mailbox, new starter account.',
    },
    curveballs: ['change-issue'],
  },
  {
    id: 'exchange-partner-mail-delay',
    title: 'Mail to a partner organisation is delayed',
    short: 'Partner mail is delayed',
    product: 'exchange-online',
    area: 'Mail flow',
    difficulty: 'standard',
    issue: 'service-outage',
    impact: 'high',
    mood: 'anxious',
    proficiency: 'intermediate',
    style: 'terse',
    stage: 'first-contact',
    minutes: 10,
    who: ['Tomás Herrera', 'IT lead', 'Adatum Health'],
    list: 'Messages to one partner arrive hours late, and clinical staff are starting to worry.',
    summary:
      'Tomás is the IT lead at a health provider. Email to one partner domain has arrived hours late since this morning. Other recipients are fine. Clinical staff are anxious because referrals depend on that mail. He gives short answers and wants fast direction.',
    brief: {
      issue: 'Email to one partner domain is delayed by several hours.',
      impact: [
        'A few messages to one partner are late.',
        'Referrals to one partner are delayed by hours.',
        'Urgent patient referrals are reaching a partner hours late.',
      ],
      objective: 'Scope who is affected, check recent changes and set expectations.',
      known: 'Other recipients receive mail normally. The delay began this morning.',
      environment: 'Exchange Online tenant with a third-party mail gateway.',
    },
    curveballs: ['deadline', 'go-silent'],
  },
  {
    id: 'sharepoint-guests-denied',
    title: 'External guests cannot open a shared site',
    short: 'Guests cannot open site',
    product: 'sharepoint-online',
    area: 'Sites',
    difficulty: 'standard',
    issue: 'permissions',
    impact: 'medium',
    mood: 'frustrated',
    proficiency: 'intermediate',
    style: 'vague',
    stage: 'follow-up',
    minutes: 11,
    who: ['Aisha Rahman', 'Project coordinator', 'Northwind Traders'],
    list: 'Three outside consultants get access denied on a project site, days after being invited.',
    summary:
      'Aisha coordinates a supplier project. Three external consultants were invited to the project site last week but still see access denied. She is following up on an open case and describes the problem vaguely at first. She needs them working by Thursday.',
    brief: {
      issue: 'Invited external guests see access denied on the project site.',
      impact: [
        'One guest is waiting for access.',
        'Three consultants cannot start work on the project.',
        'A supplier delivery stalls until every consultant has access.',
      ],
      objective: 'Review what was tried, confirm sharing settings and agree next steps.',
      previous:
        'An earlier contact resent the invitations. The consultants still cannot open the site.',
      environment: 'SharePoint Online team site shared with external consultants.',
    },
    curveballs: ['deadline', 'previous-bad-experience'],
  },
  {
    id: 'onedrive-empty-folders-new-laptop',
    title: 'Files stuck syncing after a laptop swap',
    short: 'Files stuck syncing',
    product: 'onedrive-business',
    area: 'Sync',
    difficulty: 'starter',
    issue: 'data-missing',
    impact: 'low',
    mood: 'anxious',
    proficiency: 'novice',
    style: 'talkative',
    stage: 'first-contact',
    minutes: 8,
    who: ['Ben Adeyemi', 'Editor', 'Lucerne Publishing'],
    list: "An editor's new laptop shows a sync error and his folders look empty.",
    summary:
      'Ben edits manuscripts for a publisher and received a new laptop yesterday. OneDrive shows a sync error and his work folders look empty. He worries that files were lost before an editorial deadline. He talks at length and needs reassurance as well as steps.',
    brief: {
      issue: 'OneDrive shows a sync error and folders look empty on the new laptop.',
      impact: [
        'One editor cannot see his files for now.',
        'An editorial team waits on files for a deadline.',
        'Several editors cannot reach manuscripts before a print deadline.',
      ],
      objective: 'Reassure the customer, confirm where the files are and fix the sync.',
      environment: 'OneDrive sync app on a new Windows 11 laptop, Microsoft 365 Business Premium.',
    },
    curveballs: [],
  },
  {
    id: 'excel-protect-workbook-howto',
    title: 'How to share a protected workbook safely',
    short: 'Share a protected workbook',
    product: 'm365-apps',
    area: 'Excel',
    difficulty: 'starter',
    issue: 'how-to',
    impact: 'low',
    mood: 'calm',
    proficiency: 'intermediate',
    style: 'non-native',
    stage: 'first-contact',
    minutes: 8,
    who: ['Elena Petrova', 'Finance analyst', 'Coho Winery'],
    list: 'A finance analyst wants to share an Excel workbook with limited editing rights.',
    summary:
      'Elena prepares budgets for a winery and speaks English as a second language. She wants to share a workbook so colleagues can edit only the input cells. She has not done this before and prefers simple wording and a confirmation of each step.',
    brief: {
      issue: 'The customer needs to let colleagues edit only certain cells.',
      impact: [
        'No deadline; the budget review is next week.',
        'The finance team waits on the shared budget file.',
        'Budget submission is blocked until colleagues can edit the file.',
      ],
      objective: 'Check what she needs, explain each step simply and confirm it worked.',
    },
    curveballs: [],
  },
  {
    id: 'entra-mfa-prompts-repeat',
    title: 'Staff are prompted for MFA again and again',
    short: 'Repeated MFA prompts',
    product: 'entra-id',
    area: 'Authentication',
    difficulty: 'challenge',
    issue: 'sign-in-access',
    impact: 'high',
    mood: 'angry',
    proficiency: 'expert',
    style: 'demanding',
    stage: 'escalated',
    minutes: 14,
    who: ['Jonas Weber', 'Security operations manager', 'Trey Research'],
    list: 'Hundreds of staff are asked for multifactor sign-in several times an hour.',
    summary:
      'Jonas runs security operations at a research firm. Since Monday, staff are prompted for multifactor sign-in repeatedly, and the case has already been escalated once. He is technical, short on patience and expects specific answers and commitments.',
    brief: {
      issue: 'Users are prompted for multifactor sign-in repeatedly throughout the day.',
      impact: [
        'A few users find the prompts annoying.',
        'A department loses time to repeated sign-in prompts.',
        'About 600 staff are interrupted all day and productivity is falling.',
      ],
      objective: 'Acknowledge the escalation, scope the problem and commit to an update time.',
      previous:
        'The case was escalated once. The previous engineer promised a call that never happened.',
      environment: 'Microsoft Entra ID P1 tenant, mixed Windows and Mac devices.',
    },
    curveballs: ['ask-manager', 'unsupported-guarantee', 'threaten-cancel'],
  },
  {
    id: 'entra-contractor-cannot-sign-in',
    title: 'New contractor cannot sign in on day one',
    short: 'Contractor cannot sign in',
    product: 'entra-id',
    area: 'Sign-in',
    difficulty: 'starter',
    issue: 'sign-in-access',
    impact: 'medium',
    mood: 'anxious',
    proficiency: 'novice',
    style: 'talkative',
    stage: 'first-contact',
    minutes: 9,
    who: ['Chloe Martin', 'HR coordinator', "Margie's Travel"],
    list: 'A contractor starts today and cannot sign in. The HR coordinator is anxious to fix it.',
    summary:
      'Chloe is an HR coordinator at a travel agency. A contractor starts today but cannot sign in with the new account. Chloe is not technical and worries about the first impression. She is happy to follow steps if they are explained clearly.',
    brief: {
      issue: "A new contractor's account cannot sign in on the first day.",
      impact: [
        'One contractor is idle for a short while.',
        'A contractor cannot start paid work until access is fixed.',
        "A team's project start slips until the contractor has access.",
      ],
      objective: 'Confirm the account details, find the blocker and explain each step clearly.',
      known: 'The account was created yesterday. The contractor has a company laptop.',
    },
    curveballs: ['change-issue'],
  },
  {
    id: 'intune-laptops-stall-enrolment',
    title: 'New laptops stall during enrolment',
    short: 'Laptops stall during enrolment',
    product: 'intune',
    area: 'Enrolment',
    difficulty: 'standard',
    issue: 'setup-deployment',
    impact: 'medium',
    mood: 'frustrated',
    proficiency: 'intermediate',
    style: 'terse',
    stage: 'first-contact',
    minutes: 11,
    who: ['Omar Haddad', 'Endpoint engineer', 'Alpine Ski House'],
    list: 'Twenty new laptops stop at the enrolment screen and will not finish setup.',
    summary:
      'Omar manages devices for a ski resort. Twenty new laptops stop at the enrolment screen and never reach the desktop. He needs them handed out on Monday. He gives short answers, wants to skip basics and expects the engineer to keep up.',
    brief: {
      issue: 'New laptops stall at the enrolment screen and never finish setup.',
      impact: [
        'One laptop is delayed for a new starter.',
        'Twenty laptops cannot be handed out on Monday.',
        'A seasonal workforce cannot start without working laptops.',
      ],
      objective: 'Scope the problem, review what was tried and agree the next action.',
      environment:
        'Intune enrolment with Windows Autopilot, twenty identical laptops, office network.',
    },
    curveballs: ['deadline', 'challenge-credibility'],
  },
  {
    id: 'defender-invoices-quarantined',
    title: 'Supplier invoices keep landing in quarantine',
    short: 'Invoices keep being quarantined',
    product: 'defender-office-365',
    area: 'Anti-spam',
    difficulty: 'standard',
    issue: 'policy-security',
    impact: 'medium',
    mood: 'frustrated',
    proficiency: 'expert',
    style: 'demanding',
    stage: 'follow-up',
    minutes: 11,
    who: ['Ruth Eze', 'Finance operations manager', 'Fourth Coffee'],
    list: 'Legitimate supplier invoices are quarantined daily, and payments are now running late.',
    summary:
      'Ruth runs finance operations for a coffee chain. Invoices from three suppliers are quarantined every day, so payments run late and suppliers are chasing. This is a follow-up on an open case with no update yet. She expects a named owner and a clear plan.',
    brief: {
      issue: 'Invoices from trusted suppliers are quarantined every day.',
      impact: [
        'A few invoices need releasing each week.',
        'Late payments are straining three supplier relationships.',
        'Suppliers threaten to pause deliveries over late payments.',
      ],
      objective: 'Check progress on the case, confirm scope and agree an update time.',
      previous: 'The case was opened five days ago. The customer has had no update since.',
    },
    curveballs: ['ask-manager', 'previous-bad-experience'],
  },
  {
    id: 'power-automate-approval-stopped',
    title: 'An approval flow stopped running on Tuesday',
    short: 'Approval flow stopped',
    product: 'power-platform',
    area: 'Power Automate',
    difficulty: 'challenge',
    issue: 'feature-not-working',
    impact: 'high',
    mood: 'frustrated',
    proficiency: 'intermediate',
    style: 'vague',
    stage: 'escalated',
    minutes: 13,
    who: ['Sofia Lindqvist', 'Operations analyst', 'Litware'],
    list: 'A purchase approval flow stopped running, and the escalation has had no real answer.',
    summary:
      'Sofia is an operations analyst at a manufacturer. A purchase approval flow stopped running on Tuesday and purchase orders are piling up. The case was escalated, and she describes the flow loosely, expecting the engineer to work out the details. Her patience is limited.',
    brief: {
      issue: 'A purchase approval flow stopped running and orders are waiting.',
      impact: [
        'A few approvals are waiting for manual handling.',
        'Purchase orders are delayed across one department.',
        'Orders are blocked across the plant and suppliers are waiting.',
      ],
      objective: 'Gather flow details, set realistic expectations and confirm ownership.',
      previous:
        'The case was escalated after two contacts. The customer was asked for the same details twice.',
    },
    curveballs: ['go-silent', 'challenge-credibility'],
  },
  {
    id: 'windows-update-fails-forty-laptops',
    title: 'A feature update fails on forty laptops',
    short: 'Update fails on forty laptops',
    product: 'windows-11',
    area: 'Updates',
    difficulty: 'challenge',
    issue: 'setup-deployment',
    impact: 'high',
    mood: 'anxious',
    proficiency: 'expert',
    style: 'terse',
    stage: 'first-contact',
    minutes: 12,
    who: ['Mateo Silva', 'Desktop services lead', 'VanArsdel Ltd'],
    list: 'A Windows 11 feature update fails with an error on forty managed laptops.',
    summary:
      'Mateo leads desktop services at a retailer. A Windows 11 feature update fails with the same error on forty managed laptops, and a store opening depends on them. He is anxious but precise, and he expects the engineer to know the error codes.',
    brief: {
      issue: 'The Windows 11 feature update fails with one error on forty laptops.',
      impact: [
        'A few laptops stay on an older build.',
        'Forty laptops miss a required security update.',
        'A store opening is at risk because forty laptops cannot update.',
      ],
      objective: 'Capture the exact error, scope the affected devices and agree next steps.',
      environment:
        'Windows 11 managed with Intune, forty laptops of one model, wired office network.',
    },
    curveballs: ['deadline', 'unsupported-guarantee'],
  },
  {
    id: 'azure-vm-backups-failing',
    title: 'Overnight VM backups keep failing',
    short: 'VM backups keep failing',
    product: 'azure',
    area: 'Backup',
    difficulty: 'standard',
    issue: 'service-outage',
    impact: 'high',
    mood: 'anxious',
    proficiency: 'expert',
    style: 'demanding',
    stage: 'follow-up',
    minutes: 12,
    who: ["Liam O'Connor", 'Platform engineer', 'Tailspin Toys'],
    list: 'Nightly backups of production virtual machines fail, and a recovery audit is next week.',
    summary:
      'Liam is a platform engineer at a toy maker. Nightly backups of production virtual machines have failed for three days, and an audit of recovery readiness is next week. This is a follow-up on an open case, and he wants a clear status and a date for the fix.',
    brief: {
      issue: 'Nightly backups of production virtual machines have failed for three days.',
      impact: [
        'Test machines are unprotected for a few days.',
        'Production machines have no recent restore point.',
        'Production has no recent backup and an audit is next week.',
      ],
      objective: 'Review the case history, confirm the current status and set an update time.',
      previous:
        'The case was opened three days ago. The last update asked for logs that were sent.',
      environment: 'Azure Backup for virtual machines in two regions, one vault per region.',
    },
    curveballs: ['ask-manager', 'unsupported-guarantee'],
  },
  {
    id: 'azure-trial-unexpected-charge',
    title: 'An unexpected charge after a free trial',
    short: 'Unexpected charge after trial',
    product: 'azure',
    area: 'Billing',
    difficulty: 'starter',
    issue: 'billing-licence',
    impact: 'low',
    mood: 'anxious',
    proficiency: 'novice',
    style: 'vague',
    stage: 'first-contact',
    minutes: 9,
    who: ['Ana Pereira', 'Founder', 'Proseware'],
    list: 'A founder sees an unexpected Azure charge after her free trial ended.',
    summary:
      "Ana founded a small software company and used an Azure free trial. This month's invoice shows a charge she did not expect. She is not sure which service caused it and describes it vaguely. She is worried about further charges and wants to understand before she acts.",
    brief: {
      issue: 'A charge appeared on the invoice after the free trial ended.',
      impact: [
        'A small unexpected charge on one invoice.',
        'Recurring charges the small business had not budgeted for.',
        'Rising charges could exhaust the monthly budget within days.',
      ],
      objective: 'Clarify the charge, explain what to check and what happens next.',
    },
    curveballs: ['change-issue'],
  },
  {
    id: 'dynamics-dashboard-confirm-fix',
    title: 'Sales dashboard shows no opportunities',
    short: 'Dashboard shows no opportunities',
    product: 'dynamics-365',
    area: 'Sales',
    difficulty: 'standard',
    issue: 'permissions',
    impact: 'medium',
    mood: 'calm',
    proficiency: 'intermediate',
    style: 'talkative',
    stage: 'closure',
    minutes: 10,
    who: ['Daniel Osei', 'Sales manager', 'Proseware Consulting'],
    list: "After a role change, a sales manager's dashboard is empty. The fix is waiting for confirmation.",
    summary:
      'Daniel manages a sales team at a consultancy. After his role changed, his Dynamics 365 dashboard showed no opportunities. A fix was applied last week and he is calling to confirm everything works and close the case. He is friendly and chatty.',
    brief: {
      issue: 'A fix was applied for an empty sales dashboard and needs confirming.',
      impact: [
        'One manager had a quiet week without pipeline data.',
        'A sales team planned forecasts without pipeline data.',
        'Month-end forecasting is at risk without pipeline data.',
      ],
      objective: 'Confirm the fix, check nothing is outstanding and close the case properly.',
      previous: 'A role fix was applied last week. The customer has not yet confirmed it works.',
    },
    curveballs: ['change-issue'],
  },
];

const STAGE_BRIEFS: Record<CallStage, string> = {
  'first-contact': '',
  'follow-up': 'This is a follow-up on an open case. The customer expects progress.',
  escalated: 'The case was escalated after earlier contacts. Expect strained trust.',
  closure: 'This is a closure call. The customer expects a wrap-up.',
};

function toScenario(seed: Seed, index: number): PublicScenarioDTO {
  const info = PRODUCT_INFO[seed.product];
  const [name, role, organisation] = seed.who;
  const [low, medium, high] = seed.brief.impact;
  return {
    id: seed.id,
    version: 1,
    title: seed.title,
    shortTitle: seed.short,
    listSummary: seed.list,
    summary: seed.summary,
    tags: [info.name, seed.area],
    estimatedMinutes: seed.minutes,
    product: {
      id: seed.product,
      name: info.name,
      family: info.family,
      familyLabel: PRODUCT_FAMILY_LABELS[info.family],
      area: seed.area,
    },
    caseReference: `SIM-${String(410200 + index * 37).padStart(6, '0')}`,
    issueType: seed.issue,
    impact: seed.impact,
    startingTemperature: seed.mood,
    proficiency: seed.proficiency,
    style: seed.style,
    callStage: seed.stage,
    difficulty: seed.difficulty,
    persona: { name, role, organisation },
    publicBrief: {
      issue: seed.brief.issue,
      impact: { low, medium, high },
      objective: seed.brief.objective,
      ...(seed.brief.known ? { knownContext: seed.brief.known } : {}),
      ...(seed.brief.previous ? { previousContact: seed.brief.previous } : {}),
      ...(seed.brief.environment ? { environment: seed.brief.environment } : {}),
    },
    brief: { situation: seed.summary, goal: seed.brief.objective, groundRules: [] },
    stageBriefs: STAGE_BRIEFS,
    expectedDiscoveryAreas: ['What changed', 'Who is affected', 'What was tried'],
    coachingFocus: ['scoping-discovery'],
    curveballOptions: [...seed.curveballs],
    synthetic: true,
  };
}

export function publicScenarios(): PublicScenarioDTO[] {
  return SEEDS.map(toScenario);
}

export function scenarioById(id: string): PublicScenarioDTO {
  const found = publicScenarios().find((scenario) => scenario.id === id);
  if (!found) throw new Error(`No fixture scenario "${id}"`);
  return found;
}

/** Fixture scenarios by what a test needs from them. */
export const SAMPLE = {
  starter: 'outlook-shared-mailbox-send',
  standard: 'teams-recordings-missing',
  challenge: 'teams-calls-break-up',
  followUp: 'sharepoint-guests-denied',
  closure: 'dynamics-dashboard-confirm-fix',
  /** Has no optional context at all: only the six rows. */
  bare: 'excel-protect-workbook-howto',
  /** Has known context and environment, but no previous contact. */
  withContext: 'exchange-partner-mail-delay',
  /** Has previous contact and environment. */
  withHistory: 'teams-calls-break-up',
} as const;

/**
 * The four voices as a server lists them in every language. `shared` names the choices that a
 * provider makes with an earlier choice's synthetic voice, told apart by pace alone.
 */
export function speechVoices(shared: readonly VoiceId[] = [], styles = false): SpeechVoiceDTO[] {
  return VOICE_CHOICES.map(({ id, label, trait, description }) => {
    const languages: SpeechVoiceDTO['languages'] = {};
    for (const language of SPEECH_LANGUAGES) {
      languages[language] = { voice: shared.includes(id) ? 'shared' : 'own', styles };
    }
    return { id, label, trait, description, languages };
  });
}

export const NO_SPEECH: SpeechCapabilitiesDTO = {
  provider: 'none',
  label: 'Not configured',
  demo: false,
  transcribe: false,
  synthesize: false,
  expressiveStyles: false,
  notice: null,
  voices: [],
  limits: { maxAudioBytes: 2_000_000, maxAudioSeconds: 30, sampleRate: 16000 },
};

export const AZURE_SPEECH: SpeechCapabilitiesDTO = {
  ...NO_SPEECH,
  provider: 'azure-speech',
  label: 'Azure AI Speech',
  transcribe: true,
  synthesize: true,
  expressiveStyles: true,
  voices: speechVoices([], true),
};

/** A real speech service that has fewer than four voices in the language: two choices share one. */
export const AZURE_SHARED_SPEECH: SpeechCapabilitiesDTO = {
  ...AZURE_SPEECH,
  voices: speechVoices(['voice-c', 'voice-d'], true),
};

/** A server from before voices could be chosen: it lists none, and speaks as it always did. */
export const OLD_SERVER_SPEECH: SpeechCapabilitiesDTO = (() => {
  const { voices: _omitted, ...rest } = AZURE_SPEECH;
  return rest;
})();

/** The demonstration provider: it has no voices to choose between, so three share the first. */
export const DEMO_SPEECH: SpeechCapabilitiesDTO = {
  ...NO_SPEECH,
  provider: 'mock',
  label: 'Demo speech (scripted)',
  demo: true,
  transcribe: true,
  synthesize: true,
  voices: speechVoices(['voice-b', 'voice-c', 'voice-d']),
};

export function appConfig(overrides: Partial<AppConfigDTO> = {}): AppConfigDTO {
  return {
    app: { name: 'Firefly', version: '0.1.0' },
    provider: { kind: 'mock', label: 'Demo mode', demo: true, notice: null },
    speech: NO_SPEECH,
    limits: { maxMessageChars: 1000, maxTraineeTurns: 60 },
    features: { devDiagnostics: false, testHooks: false },
    ...overrides,
  };
}
