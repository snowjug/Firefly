import type { CalibrationMetrics, CalibrationSource } from './calibration.ts';
import type { CoachingReport } from './report.ts';
import type { RedactionKind } from './text.ts';
import type { ScenarioOverrides } from './scenario.ts';
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
  SessionStatus,
  StartTemperature,
  TemperatureBandId,
} from './vocab.ts';

// The JSON contract between the Firefly server and the web app.

export type ProviderKind = 'mock' | 'azure-openai' | 'openai-compatible';

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
  | 'evaluation_failed'
  | 'internal';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; retryable: boolean; details?: unknown };
}

export interface AppConfigDTO {
  app: { name: string; version: string };
  provider: { kind: ProviderKind; label: string; demo: boolean; notice: string | null };
  limits: { maxMessageChars: number; maxTraineeTurns: number };
  features: { devDiagnostics: boolean; testHooks: boolean };
}

// ---- Scenarios ----------------------------------------------------------------------------

export interface PublicScenarioDTO {
  id: string;
  version: number;
  title: string;
  summary: string;
  tags: string[];
  estimatedMinutes: number;
  issueType: IssueType;
  impact: BusinessImpact;
  startingTemperature: StartTemperature;
  proficiency: Proficiency;
  style: CommunicationStyle;
  callStage: CallStage;
  difficulty: Difficulty;
  persona: { name: string; role: string; organisation: string };
  brief: { situation: string; goal: string; groundRules: string[] };
  expectedDiscoveryAreas: string[];
  coachingFocus: DimensionId[];
  curveballOptions: CurveballType[];
  spotlight: boolean;
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
  markers?: TurnMarker[]; // only present once the call is completed
}

export interface PublicStateDTO {
  band: { id: TemperatureBandId; label: string };
  trend: 'rising' | 'steady' | 'falling';
  discoveredCount: number;
  silent: boolean;
}

export interface SessionScenarioView {
  scenarioId: string;
  title: string;
  summary: string;
  issueType: IssueType;
  tags: string[];
  estimatedMinutes: number;
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
  isSample: boolean;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  traineeTurns: number;
  completion: 'completed' | 'ended-early' | null;
  overallScore: number | null;
  dimensionScores: Partial<Record<DimensionId, number>> | null;
  mentorReviewed: boolean;
}

export interface SessionDTO extends SessionSummaryDTO {
  scenario: SessionScenarioView;
  turns: TurnDTO[];
  state: PublicStateDTO;
  evaluationPhase: EvaluationPhase | null;
  evaluationError: { message: string; retryable: boolean } | null;
  report: CoachingReport | null;
}

export interface CreateSessionRequest {
  scenarioId: string;
  overrides?: ScenarioOverrides;
  mode?: PracticeMode;
  clientRequestId?: string; // makes creation idempotent when the client retries
}

export interface SendMessageRequest {
  text: string;
  clientMessageId: string; // client-generated unique id; resending the same id never duplicates
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

// ---- History, progress, calibration, demo --------------------------------------------------

export interface SessionListDTO {
  sessions: SessionSummaryDTO[];
  total: number;
}

export interface DimensionTrendDTO {
  dimension: DimensionId;
  points: { sessionId: string; at: string; score: number }[];
  average: number | null;
  latest: number | null;
  change: 'up' | 'steady' | 'down' | 'not-enough-data';
}

export interface ProgressDTO {
  totalSessions: number;
  completedSessions: number;
  dimensionTrends: DimensionTrendDTO[];
  strongest: DimensionId | null;
  focus: DimensionId | null;
  focusReason: string | null;
  repeatedOpportunities: { dimension: DimensionId; sessions: number; message: string }[];
  recentChange: 'improving' | 'steady' | 'declining' | 'not-enough-data';
  note: string;
}

export interface MentorScoreRequest {
  reviewer: string;
  scores: Record<DimensionId, number>;
  notes?: string;
}

export interface CalibrationRecordDTO {
  id: number;
  sessionId: string;
  scenarioTitle: string;
  reviewer: string;
  source: CalibrationSource;
  evaluatorVersion: string;
  rubricVersion: string;
  ai: Record<DimensionId, number>;
  mentor: Record<DimensionId, number>;
  notes: string | null;
  createdAt: string;
}

export interface CalibrationDTO {
  metrics: CalibrationMetrics;
  records: CalibrationRecordDTO[];
  includesSamples: boolean;
  reviewable: SessionSummaryDTO[]; // completed sessions without a mentor review yet
}

export interface DemoStatusDTO {
  spotlightScenarioId: string | null;
  practiceSessions: number;
  sampleSessions: number;
  provider: { kind: ProviderKind; label: string; demo: boolean };
}
