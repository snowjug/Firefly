import type { CoachingReport } from './report.ts';
import type { RedactionKind } from './text.ts';
import type { PublicBrief, ScenarioOverrides } from './scenario.ts';
import type { InputMode, SpeechCapabilitiesDTO } from './speech.ts';
import type {
  BusinessImpact,
  CallStage,
  CommunicationStyle,
  CurveballType,
  Difficulty,
  DimensionId,
  EvaluationPhase,
  IssueType,
  PracticeMode,
  Proficiency,
  ProductFamily,
  ProductId,
  SessionStatus,
  StartTemperature,
  TemperatureBandId,
} from './vocab.ts';

// The JSON contract between the Firefly server and the web app.

export type ProviderKind = 'mock' | 'azure-openai' | 'openai-compatible' | 'gemini';

export type ApiErrorCode =
  | 'bad_request'
  | 'validation_failed'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'rate_limited'
  | 'payload_too_large'
  | 'session_not_active'
  | 'turn_limit_reached'
  | 'no_conversation'
  | 'provider_not_configured'
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'provider_bad_output'
  | 'provider_content_filtered'
  | 'speech_unavailable'
  | 'speech_failed'
  | 'speech_timeout'
  | 'speech_rate_limited'
  | 'unsupported_media'
  | 'evaluation_failed'
  | 'internal';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; retryable: boolean; details?: unknown };
}

export interface AppConfigDTO {
  app: { name: string; version: string };
  provider: { kind: ProviderKind; label: string; demo: boolean; notice: string | null };
  /** What the server's speech provider can do. The browser's own speech features are separate. */
  speech: SpeechCapabilitiesDTO;
  limits: { maxMessageChars: number; maxTraineeTurns: number };
  features: { devDiagnostics: boolean; testHooks: boolean };
}

// ---- Scenarios ----------------------------------------------------------------------------

export interface PublicProductDTO {
  id: ProductId;
  name: string; // for example "Microsoft Teams"
  family: ProductFamily;
  familyLabel: string; // for example "Microsoft 365"
  area: string; // for example "Meetings"
}

export interface PublicScenarioDTO {
  id: string;
  version: number;
  title: string;
  /** The title for a scenario card: two to six words, worded only from the title and the brief. */
  shortTitle: string;
  listSummary: string; // one line, at most 18 words, for the scenario list
  summary: string; // at most 60 words, for the detail view
  tags: string[];
  estimatedMinutes: number;
  product: PublicProductDTO;
  caseReference: string | null; // made up; never a real service request number
  issueType: IssueType;
  impact: BusinessImpact;
  startingTemperature: StartTemperature;
  proficiency: Proficiency;
  style: CommunicationStyle;
  callStage: CallStage;
  difficulty: Difficulty;
  persona: { name: string; role: string; organisation: string };
  /** What the trainee may read before the call. It never contains a hidden fact. */
  publicBrief: PublicBrief;
  brief: { situation: string; goal: string; groundRules: string[] };
  /**
   * What the trainee is told about the call stage, by stage (empty for a first contact). A call's
   * brief is `brief.situation` followed by the text for the stage chosen for the call.
   */
  stageBriefs: Record<CallStage, string>;
  expectedDiscoveryAreas: string[];
  coachingFocus: DimensionId[];
  curveballOptions: CurveballType[];
  synthetic: true;
}

// ---- Sessions -----------------------------------------------------------------------------

export interface TurnMarker {
  kind: 'state' | 'discovery' | 'curveball';
  label: string;
  detail?: string;
  delta?: number;
}

export interface TurnDTO {
  index: number; // 1-based position in the whole conversation
  role: 'customer' | 'trainee';
  text: string;
  createdAt: string;
  source: 'opening' | 'live' | 'demo' | 'trainee';
  /** How a trainee turn arrived. Customer turns are always `text`. */
  inputMode: InputMode;
  markers?: TurnMarker[]; // only present once the call is completed
}

export interface PublicStateDTO {
  band: { id: TemperatureBandId; label: string };
  trend: 'rising' | 'steady' | 'falling';
  discoveredCount: number;
  silent: boolean;
  /**
   * How many times the conversation has changed direction (a curveball landed). It is only a count:
   * the kind of change is never sent, and only guided practice shows it.
   */
  shifts: number;
}

export interface SessionScenarioView {
  scenarioId: string;
  title: string;
  summary: string;
  issueType: IssueType;
  tags: string[];
  estimatedMinutes: number;
  /** Null for a call saved before Firefly became a Microsoft-only simulator. */
  product: PublicProductDTO | null;
  caseReference: string | null;
  publicBrief: PublicBrief | null;
  persona: { name: string; role: string; organisation: string };
  brief: { situation: string; goal: string; groundRules: string[] };
  config: {
    impact: BusinessImpact;
    startingTemperature: StartTemperature;
    proficiency: Proficiency;
    style: CommunicationStyle;
    callStage: CallStage;
    difficulty: Difficulty;
    mode: PracticeMode;
    curveballsEnabled: boolean;
  };
  expectedDiscoveryAreas: string[];
  coachingFocus: DimensionId[];
}

export interface SessionSummaryDTO {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  issueType: IssueType;
  difficulty: Difficulty;
  startingTemperature: StartTemperature;
  impact: BusinessImpact;
  style: CommunicationStyle;
  mode: PracticeMode;
  providerKind: ProviderKind;
  providerLabel: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  traineeTurns: number;
  completion: 'completed' | 'ended-early' | null;
  overallScore: number | null;
  dimensionScores: Partial<Record<DimensionId, number>> | null;
}

export interface SessionDTO extends SessionSummaryDTO {
  scenario: SessionScenarioView;
  turns: TurnDTO[];
  state: PublicStateDTO;
  // Set when the last trainee message was saved but the customer has not replied (for example after
  // a provider failure). Resending it with this id resumes the exchange without duplicating it.
  awaitingReply: { clientMessageId: string; turnIndex: number } | null;
  evaluationPhase: EvaluationPhase | null;
  evaluationError: { message: string; retryable: boolean } | null;
  report: CoachingReport | null;
}

export interface CreateSessionRequest {
  scenarioId: string;
  overrides?: ScenarioOverrides;
  mode?: PracticeMode;
  /**
   * The part of the day where the trainee is, from their own clock, so that the customer's
   * greeting ("Good morning") fits. Left out, the server chooses one from the call's seed.
   */
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  clientRequestId?: string; // makes creation idempotent when the client retries
}

// A review copy of a call: the conversation only, with nothing that reveals how it was scored.
export interface TranscriptDTO {
  sessionId: string;
  scenarioTitle: string;
  persona: { name: string; role: string; organisation: string };
  status: SessionStatus;
  turns: { index: number; role: 'customer' | 'trainee'; text: string; createdAt: string }[];
}

/**
 * A neutral look at an active call, for the moment the trainee presses End call: whether a plan, an
 * owner and a time for the next update have been stated, and whether the customer accepted them.
 * Yes or no only. It carries no quotes, no wording to use, no score and nothing about the scenario.
 */
export interface ClosingCheckDTO {
  sessionId: string;
  traineeTurns: number;
  checks: { plan: boolean; owner: boolean; updateTime: boolean; agreement: boolean };
}

export interface SendMessageRequest {
  text: string;
  clientMessageId: string; // client-generated unique id; resending the same id never duplicates
  /** `voice` when the text was recognised from the trainee's speech. Defaults to `text`. */
  inputMode?: InputMode;
}

export interface SendMessageResponse {
  traineeTurn: TurnDTO;
  customerTurn: TurnDTO;
  state: PublicStateDTO;
  redactions: RedactionKind[];
  turnsRemaining: number;
}

export interface EndSessionRequest {
  reason?: 'finished' | 'ended-early';
}
