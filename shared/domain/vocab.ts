// Shared vocabulary for scenarios, state and coaching. Used by the server, the web app and
// the tests. Everything here is plain data: no runtime dependencies.

// Firefly simulates support calls for Microsoft products only. Scenarios name a product from this
// list; the family groups products in the scenario filters.
export const PRODUCT_FAMILIES = ['microsoft-365', 'windows', 'azure', 'dynamics-365'] as const;
export type ProductFamily = (typeof PRODUCT_FAMILIES)[number];

export const PRODUCT_FAMILY_LABELS: Record<ProductFamily, string> = {
  'microsoft-365': 'Microsoft 365',
  windows: 'Windows',
  azure: 'Azure',
  'dynamics-365': 'Dynamics 365',
};

export const PRODUCT_IDS = [
  'teams',
  'outlook',
  'exchange-online',
  'sharepoint-online',
  'onedrive-business',
  'm365-apps',
  'entra-id',
  'intune',
  'defender-office-365',
  'power-platform',
  'windows-11',
  'azure',
  'dynamics-365',
] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

export const PRODUCT_INFO: Record<ProductId, { name: string; family: ProductFamily }> = {
  teams: { name: 'Microsoft Teams', family: 'microsoft-365' },
  outlook: { name: 'Outlook', family: 'microsoft-365' },
  'exchange-online': { name: 'Exchange Online', family: 'microsoft-365' },
  'sharepoint-online': { name: 'SharePoint Online', family: 'microsoft-365' },
  'onedrive-business': { name: 'OneDrive for Business', family: 'microsoft-365' },
  'm365-apps': { name: 'Microsoft 365 Apps', family: 'microsoft-365' },
  'entra-id': { name: 'Microsoft Entra ID', family: 'microsoft-365' },
  intune: { name: 'Microsoft Intune', family: 'microsoft-365' },
  'defender-office-365': { name: 'Defender for Office 365', family: 'microsoft-365' },
  'power-platform': { name: 'Power Platform', family: 'microsoft-365' },
  'windows-11': { name: 'Windows 11', family: 'windows' },
  azure: { name: 'Azure', family: 'azure' },
  'dynamics-365': { name: 'Dynamics 365', family: 'dynamics-365' },
};

export const ISSUE_TYPES = [
  'sign-in-access',
  'permissions',
  'service-outage',
  'slow-performance',
  'data-missing',
  'billing-licence',
  'how-to',
  'feature-not-working',
  'setup-deployment',
  'policy-security',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  'sign-in-access': 'Sign-in or access problem',
  permissions: 'Permissions or visibility',
  'service-outage': 'Service outage',
  'slow-performance': 'Slow performance',
  'data-missing': 'Data missing',
  'billing-licence': 'Billing or licence question',
  'how-to': 'How-to question',
  'feature-not-working': 'Feature not working as expected',
  'setup-deployment': 'Setup or deployment problem',
  'policy-security': 'Blocked by a policy or security rule',
};

export const IMPACTS = ['low', 'medium', 'high'] as const;
export type BusinessImpact = (typeof IMPACTS)[number];

export const IMPACT_LABELS: Record<BusinessImpact, { label: string; description: string }> = {
  low: { label: 'Low', description: 'One user affected, a workaround exists, limited urgency.' },
  medium: {
    label: 'Medium',
    description: 'Several users or one team blocked. The customer expects regular updates.',
  },
  high: {
    label: 'High',
    description: 'Production outage or broad impact. Business processes at risk, high urgency.',
  },
};

export const START_TEMPERATURES = ['calm', 'anxious', 'frustrated', 'angry'] as const;
export type StartTemperature = (typeof START_TEMPERATURES)[number];

export const START_TEMPERATURE_LABELS: Record<
  StartTemperature,
  { label: string; description: string; startValue: number }
> = {
  calm: { label: 'Calm', description: 'Cooperative and patient.', startValue: 12 },
  anxious: {
    label: 'Anxious',
    description: 'Worried about consequences and looking for reassurance.',
    startValue: 32,
  },
  frustrated: {
    label: 'Frustrated',
    description: 'Short on patience and expecting progress.',
    startValue: 52,
  },
  angry: {
    label: 'Angry / escalating',
    description: 'Upset, quick to escalate, needs to feel heard.',
    startValue: 72,
  },
};

export const PROFICIENCIES = ['novice', 'intermediate', 'expert'] as const;
export type Proficiency = (typeof PROFICIENCIES)[number];

export const PROFICIENCY_LABELS: Record<Proficiency, { label: string; description: string }> = {
  novice: {
    label: 'Novice',
    description: 'Everyday vocabulary. Unexplained jargon causes confusion.',
  },
  intermediate: {
    label: 'Intermediate',
    description: 'Comfortable with common terms and basic troubleshooting.',
  },
  expert: {
    label: 'Expert',
    description: 'Technical vocabulary and firm opinions. Expects the engineer to keep up.',
  },
};

export const STYLES = ['talkative', 'terse', 'demanding', 'vague', 'non-native'] as const;
export type CommunicationStyle = (typeof STYLES)[number];

export const STYLE_LABELS: Record<CommunicationStyle, { label: string; description: string }> = {
  talkative: { label: 'Talkative', description: 'Long answers with context and tangents.' },
  terse: { label: 'Terse', description: 'Short answers. Shares only what is asked.' },
  demanding: { label: 'Demanding', description: 'Direct. Asks for commitments and timelines.' },
  vague: {
    label: 'Vague',
    description: 'Imprecise at first. Becomes specific when asked focused questions.',
  },
  'non-native': {
    label: 'Non-native English speaker',
    description: 'Simple vocabulary and measured pacing. Clarification helps. Not penalised.',
  },
};

export const CALL_STAGES = ['first-contact', 'follow-up', 'escalated', 'closure'] as const;
export type CallStage = (typeof CALL_STAGES)[number];

export const CALL_STAGE_LABELS: Record<CallStage, { label: string; description: string }> = {
  'first-contact': {
    label: 'First contact',
    description: 'The customer is explaining the issue for the first time.',
  },
  'follow-up': {
    label: 'Follow-up on an open case',
    description: 'An existing case where the customer expects progress.',
  },
  escalated: {
    label: 'Escalated case',
    description: 'Earlier contacts have not resolved it. Trust is already strained.',
  },
  closure: {
    label: 'Closure call',
    description: 'The customer expects a wrap-up and confirmation.',
  },
};

export const DIFFICULTIES = ['starter', 'standard', 'challenge'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_RANK: Record<Difficulty, number> = {
  starter: 0,
  standard: 1,
  challenge: 2,
};

export const CURVEBALL_TYPES = [
  'ask-manager',
  'threaten-cancel',
  'deadline',
  'change-issue',
  'go-silent',
  'previous-bad-experience',
  'unsupported-guarantee',
  'challenge-credibility',
] as const;
export type CurveballType = (typeof CURVEBALL_TYPES)[number];

export const CURVEBALL_LABELS: Record<CurveballType, { label: string; description: string }> = {
  'ask-manager': {
    label: 'Asks for a manager',
    description: 'The customer asks to speak to someone more senior.',
  },
  'threaten-cancel': {
    label: 'Threatens to cancel',
    description: 'The customer says they may cancel or leave.',
  },
  deadline: {
    label: 'Imposes a deadline',
    description: 'The customer introduces a hard deadline.',
  },
  'change-issue': {
    label: 'Changes the issue',
    description: 'The customer raises a second problem mid-call.',
  },
  'go-silent': {
    label: 'Goes quiet',
    description: 'The customer becomes minimally responsive until re-engaged.',
  },
  'previous-bad-experience': {
    label: 'Mentions a bad experience',
    description: 'The customer recalls a poor earlier support experience.',
  },
  'unsupported-guarantee': {
    label: 'Demands a guarantee',
    description: 'The customer asks for a promise the engineer cannot make.',
  },
  'challenge-credibility': {
    label: 'Challenges credibility',
    description: 'The customer doubts the engineer\u2019s experience or authority.',
  },
};

export const PRACTICE_MODES = ['immersive', 'guided'] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

export const PRACTICE_MODE_LABELS: Record<PracticeMode, { label: string; description: string }> = {
  immersive: { label: 'Immersive', description: 'Feels like a real call. Minimal on-screen cues.' },
  guided: {
    label: 'Guided practice',
    description: 'Shows light cues: discovery areas, uncovered facts and a temperature label.',
  },
};

// ---------------------------------------------------------------------------------------
// Coaching dimensions

export const DIMENSION_IDS = [
  'opening-rapport',
  'scoping-discovery',
  'empathy-deescalation',
  'clarity',
  'ownership-next-steps',
  'closing',
] as const;
export type DimensionId = (typeof DIMENSION_IDS)[number];

export const CARE_BEHAVIOURS = ['communicate', 'accountable', 'resourceful', 'empathetic'] as const;
export type CareBehaviour = (typeof CARE_BEHAVIOURS)[number];

export const CARE_LABELS: Record<CareBehaviour, string> = {
  communicate: 'Communicate effectively',
  accountable: 'Be accountable',
  resourceful: 'Be resourceful',
  empathetic: 'Be empathetic',
};

// Working mapping used for coaching conversations; it is not an official standard.
export const DIMENSIONS: Record<
  DimensionId,
  { label: string; short: string; care: CareBehaviour[]; description: string }
> = {
  'opening-rapport': {
    label: 'Opening & Rapport',
    short: 'Opening',
    care: ['communicate', 'empathetic'],
    description:
      'How the call starts: greeting, introduction, confirming why the customer called, and early connection.',
  },
  'scoping-discovery': {
    label: 'Scoping & Discovery',
    short: 'Discovery',
    care: ['resourceful'],
    description:
      'Asking focused questions to understand the problem, its timing, its scope, recent changes and business impact.',
  },
  'empathy-deescalation': {
    label: 'Empathy & De-escalation',
    short: 'Empathy',
    care: ['empathetic'],
    description:
      'Recognising the customer\u2019s situation and responding in ways that lower tension.',
  },
  clarity: {
    label: 'Clarity',
    short: 'Clarity',
    care: ['communicate'],
    description:
      'Plain language suited to the customer, clear explanations and checking understanding.',
  },
  'ownership-next-steps': {
    label: 'Ownership & Next Steps',
    short: 'Ownership',
    care: ['accountable'],
    description:
      'Taking responsibility, setting realistic expectations and agreeing specific next steps.',
  },
  closing: {
    label: 'Closing',
    short: 'Closing',
    care: ['accountable', 'communicate'],
    description:
      'Summarising agreements, confirming the next contact and ending the call professionally.',
  },
};

export const SCORE_LABELS = [
  'Not demonstrated',
  'Emerging',
  'Developing',
  'Strong',
  'Excellent',
] as const;
export type ScoreLabel = (typeof SCORE_LABELS)[number];

export const SCORE_DESCRIPTIONS: Record<number, string> = {
  1: 'Critical behaviours were absent or counterproductive.',
  2: 'Some attempt was made, but major gaps affected the conversation.',
  3: 'Core behaviour was demonstrated inconsistently.',
  4: 'Behaviour was effective, specific and appropriate.',
  5: 'Behaviour was consistent, adaptive and supported by strong evidence.',
};

export function scoreLabel(score: number): ScoreLabel {
  const rounded = Math.min(5, Math.max(1, Math.round(score)));
  return SCORE_LABELS[rounded - 1] as ScoreLabel;
}

// ---------------------------------------------------------------------------------------
// Discovery intents: the fixed vocabulary shared by scenario authors, the turn classifier
// (rules or model) and the discovery engine.

export const DISCOVERY_INTENTS = [
  'problem_description',
  'error_message',
  'timing_onset',
  'recent_changes',
  'affected_scope',
  'business_impact',
  'workaround',
  'already_tried',
  'environment',
  'reproducibility',
  'previous_contact',
  'urgency_deadline',
  'expected_outcome',
  'account_details',
] as const;
export type DiscoveryIntent = (typeof DISCOVERY_INTENTS)[number];

export const DISCOVERY_INTENT_LABELS: Record<DiscoveryIntent, string> = {
  problem_description: 'What is happening',
  error_message: 'Exact error or symptom',
  timing_onset: 'When it started',
  recent_changes: 'Recent changes',
  affected_scope: 'Who is affected',
  business_impact: 'Business impact',
  workaround: 'Workarounds',
  already_tried: 'What was already tried',
  environment: 'Environment',
  reproducibility: 'How to reproduce it',
  previous_contact: 'Earlier contacts',
  urgency_deadline: 'Deadlines and urgency',
  expected_outcome: 'Desired outcome',
  account_details: 'Account and licence details',
};

export const FACT_IMPORTANCE = ['critical', 'important', 'helpful'] as const;
export type FactImportance = (typeof FACT_IMPORTANCE)[number];
export const FACT_WEIGHT: Record<FactImportance, number> = {
  critical: 3,
  important: 2,
  helpful: 1,
};

// ---------------------------------------------------------------------------------------
// Customer temperature bands (0-100)

export const TEMPERATURE_BANDS = [
  { id: 'calm', label: 'Calm', min: 0, max: 20 },
  { id: 'concerned', label: 'Concerned', min: 21, max: 40 },
  { id: 'frustrated', label: 'Frustrated', min: 41, max: 60 },
  { id: 'angry', label: 'Angry', min: 61, max: 80 },
  { id: 'escalating', label: 'Escalating', min: 81, max: 100 },
] as const;
export type TemperatureBandId = (typeof TEMPERATURE_BANDS)[number]['id'];

export function temperatureBand(value: number): (typeof TEMPERATURE_BANDS)[number] {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return (TEMPERATURE_BANDS.find((band) => v >= band.min && v <= band.max) ??
    TEMPERATURE_BANDS[0]) as (typeof TEMPERATURE_BANDS)[number];
}

export const SESSION_STATUSES = ['active', 'completing', 'completed', 'evaluation_failed'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const EVALUATION_PHASES = [
  'transcript_locked',
  'discovery_review',
  'scoring',
  'building_report',
  'saved',
] as const;
export type EvaluationPhase = (typeof EVALUATION_PHASES)[number];
