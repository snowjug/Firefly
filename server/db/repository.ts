import type { DatabaseSync } from 'node:sqlite';
import type { TurnClassification } from '#shared/domain/classification.ts';
import { normaliseStoredScenario, type EffectiveScenario } from '#shared/domain/config.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import type { StateEvent } from '#shared/domain/state.ts';
import type {
  DimensionId,
  EvaluationPhase,
  PracticeMode,
  SessionStatus,
} from '#shared/domain/vocab.ts';
import type { ProviderKind } from '#shared/domain/api.ts';
import type { InputMode } from '#shared/domain/speech.ts';
import type { DiscoveryRecord, EngineRuntime } from '../engine/types.ts';
import { normaliseRuntime } from '../engine/runtime.ts';
import type { PromptVersions } from '../providers/types.ts';

// Typed access to the tables. Every session query takes the owning profile id: a session that
// belongs to another profile is indistinguishable from one that does not exist.

export interface SessionRow {
  id: string;
  profileId: string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioVersion: number;
  scenario: EffectiveScenario;
  mode: PracticeMode;
  providerKind: ProviderKind;
  providerLabel: string;
  promptVersions: PromptVersions;
  isSample: boolean;
  status: SessionStatus;
  evaluationPhase: EvaluationPhase | null;
  evaluationError: { message: string; retryable: boolean } | null;
  runtime: EngineRuntime;
  clientRequestId: string | null;
  startedAt: string;
  endedAt: string | null;
  completion: 'completed' | 'ended-early' | null;
  overallScore: number | null;
  dimensionScores: Partial<Record<DimensionId, number>> | null;
  updatedAt: string;
}

export interface TurnRow {
  idx: number;
  role: 'customer' | 'trainee';
  text: string;
  source: 'opening' | 'live' | 'demo' | 'trainee';
  /** How the turn arrived. Only a trainee turn can be `voice`. */
  inputMode: InputMode;
  clientMessageId: string | null;
  classification: TurnClassification | null;
  createdAt: string;
}

type Row = Record<string, unknown>;
const json = (v: unknown) => JSON.stringify(v);
const parse = <T>(v: unknown): T => JSON.parse(String(v)) as T;
const parseOrNull = <T>(v: unknown): T | null =>
  v === null || v === undefined ? null : parse<T>(v);

function sessionFromRow(r: Row): SessionRow {
  return {
    id: String(r.id),
    profileId: String(r.profile_id),
    scenarioId: String(r.scenario_id),
    scenarioTitle: String(r.scenario_title),
    scenarioVersion: Number(r.scenario_version),
    scenario: normaliseStoredScenario(parse<EffectiveScenario>(r.scenario_snapshot)),
    mode: r.mode as PracticeMode,
    providerKind: r.provider_kind as ProviderKind,
    providerLabel: String(r.provider_label),
    promptVersions: parse<PromptVersions>(r.prompt_versions),
    isSample: Number(r.is_sample) === 1,
    status: r.status as SessionStatus,
    evaluationPhase: (r.evaluation_phase as EvaluationPhase | null) ?? null,
    evaluationError: parseOrNull(r.evaluation_error),
    runtime: normaliseRuntime(parse<EngineRuntime>(r.runtime)),
    clientRequestId: (r.client_request_id as string | null) ?? null,
    startedAt: String(r.started_at),
    endedAt: (r.ended_at as string | null) ?? null,
    completion: (r.completion as 'completed' | 'ended-early' | null) ?? null,
    overallScore:
      r.overall_score === null || r.overall_score === undefined ? null : Number(r.overall_score),
    dimensionScores: parseOrNull(r.dimension_scores),
    updatedAt: String(r.updated_at),
  };
}

function turnFromRow(r: Row): TurnRow {
  return {
    idx: Number(r.idx),
    role: r.role as 'customer' | 'trainee',
    text: String(r.text),
    source: r.source as TurnRow['source'],
    inputMode: r.input_mode === 'voice' ? 'voice' : 'text',
    clientMessageId: (r.client_message_id as string | null) ?? null,
    classification: parseOrNull<TurnClassification>(r.classification),
    createdAt: String(r.created_at),
  };
}

export function createRepository(db: DatabaseSync) {
  const now = () => new Date().toISOString();

  return {
    // ---- sessions -------------------------------------------------------------------------
    insertSession(s: SessionRow): void {
      db.prepare(
        `INSERT INTO sessions (id, profile_id, scenario_id, scenario_title, scenario_version, scenario_snapshot,
          mode, provider_kind, provider_label, prompt_versions, is_sample, status, evaluation_phase,
          evaluation_error, runtime, client_request_id, started_at, ended_at, completion, overall_score,
          dimension_scores, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        s.id,
        s.profileId,
        s.scenarioId,
        s.scenarioTitle,
        s.scenarioVersion,
        json(s.scenario),
        s.mode,
        s.providerKind,
        s.providerLabel,
        json(s.promptVersions),
        s.isSample ? 1 : 0,
        s.status,
        s.evaluationPhase,
        s.evaluationError ? json(s.evaluationError) : null,
        json(s.runtime),
        s.clientRequestId,
        s.startedAt,
        s.endedAt,
        s.completion,
        s.overallScore,
        s.dimensionScores ? json(s.dimensionScores) : null,
        s.updatedAt,
      );
    },

    getSession(id: string, profileId: string): SessionRow | null {
      const row = db
        .prepare('SELECT * FROM sessions WHERE id = ? AND profile_id = ?')
        .get(id, profileId) as Row | undefined;
      return row ? sessionFromRow(row) : null;
    },

    /** Used by background jobs that already hold a validated session id. */
    getSessionById(id: string): SessionRow | null {
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Row | undefined;
      return row ? sessionFromRow(row) : null;
    },

    findSessionByRequest(profileId: string, clientRequestId: string): SessionRow | null {
      const row = db
        .prepare('SELECT * FROM sessions WHERE profile_id = ? AND client_request_id = ?')
        .get(profileId, clientRequestId) as Row | undefined;
      return row ? sessionFromRow(row) : null;
    },

    updateRuntime(id: string, runtime: EngineRuntime): void {
      db.prepare('UPDATE sessions SET runtime = ?, updated_at = ? WHERE id = ?').run(
        json(runtime),
        now(),
        id,
      );
    },

    updateStatus(
      id: string,
      fields: {
        status: SessionStatus;
        evaluationPhase?: EvaluationPhase | null;
        evaluationError?: { message: string; retryable: boolean } | null;
        endedAt?: string | null;
      },
    ): void {
      const current = db.prepare('SELECT ended_at FROM sessions WHERE id = ?').get(id) as
        { ended_at: string | null } | undefined;
      db.prepare(
        `UPDATE sessions SET status = ?, evaluation_phase = ?, evaluation_error = ?, ended_at = ?, updated_at = ? WHERE id = ?`,
      ).run(
        fields.status,
        fields.evaluationPhase ?? null,
        fields.evaluationError ? json(fields.evaluationError) : null,
        fields.endedAt === undefined ? (current?.ended_at ?? null) : fields.endedAt,
        now(),
        id,
      );
    },

    completeSession(
      id: string,
      fields: {
        completion: 'completed' | 'ended-early';
        overallScore: number | null;
        dimensionScores: Partial<Record<DimensionId, number>>;
      },
    ): void {
      db.prepare(
        `UPDATE sessions SET status = 'completed', evaluation_phase = 'saved', evaluation_error = NULL,
           completion = ?, overall_score = ?, dimension_scores = ?, updated_at = ? WHERE id = ?`,
      ).run(fields.completion, fields.overallScore, json(fields.dimensionScores), now(), id);
    },

    deleteSession(id: string, profileId: string): boolean {
      const result = db
        .prepare('DELETE FROM sessions WHERE id = ? AND profile_id = ?')
        .run(id, profileId);
      return Number(result.changes) > 0;
    },

    stuckSessionIds(): string[] {
      return (
        db.prepare("SELECT id FROM sessions WHERE status = 'completing'").all() as { id: string }[]
      ).map((r) => r.id);
    },

    // ---- turns ----------------------------------------------------------------------------
    insertTurn(sessionId: string, t: Omit<TurnRow, 'createdAt'> & { createdAt?: string }): void {
      db.prepare(
        `INSERT INTO turns (session_id, idx, role, text, source, input_mode, client_message_id, classification, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        sessionId,
        t.idx,
        t.role,
        t.text,
        t.source,
        t.inputMode,
        t.clientMessageId,
        t.classification ? json(t.classification) : null,
        t.createdAt ?? now(),
      );
    },

    getTurns(sessionId: string): TurnRow[] {
      return (
        db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY idx').all(sessionId) as Row[]
      ).map(turnFromRow);
    },

    findTurnByClientId(sessionId: string, clientMessageId: string): TurnRow | null {
      const row = db
        .prepare('SELECT * FROM turns WHERE session_id = ? AND client_message_id = ?')
        .get(sessionId, clientMessageId) as Row | undefined;
      return row ? turnFromRow(row) : null;
    },

    // ---- events ---------------------------------------------------------------------------
    insertStateEvents(sessionId: string, events: StateEvent[]): void {
      const stmt = db.prepare(
        `INSERT INTO state_events (session_id, turn_index, key, previous, next, delta, category, reason, evidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const at = now();
      for (const e of events) {
        stmt.run(
          sessionId,
          e.turnIndex,
          e.key,
          e.previous,
          e.next,
          e.delta,
          e.category,
          e.reason,
          e.evidenceQuote ?? null,
          at,
        );
      }
    },

    getStateEvents(sessionId: string): StateEvent[] {
      return (
        db
          .prepare('SELECT * FROM state_events WHERE session_id = ? ORDER BY id')
          .all(sessionId) as Row[]
      ).map((r) => ({
        turnIndex: Number(r.turn_index),
        key: r.key as StateEvent['key'],
        previous: Number(r.previous),
        next: Number(r.next),
        delta: Number(r.delta),
        category: r.category as StateEvent['category'],
        reason: String(r.reason),
        ...(r.evidence ? { evidenceQuote: String(r.evidence) } : {}),
      }));
    },

    upsertDiscovery(sessionId: string, records: DiscoveryRecord[]): void {
      const at = now();
      for (const r of records) {
        if (r.status === 'discovered') {
          // A full discovery supersedes an earlier partial one.
          db.prepare(
            "DELETE FROM discovery_events WHERE session_id = ? AND fact_id = ? AND status = 'partial'",
          ).run(sessionId, r.factId);
        }
        db.prepare(
          `INSERT OR IGNORE INTO discovery_events (session_id, fact_id, status, turn_index, question, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(sessionId, r.factId, r.status, r.turnIndex, r.question, at);
      }
    },

    // ---- evaluations ----------------------------------------------------------------------
    /** Saves the report once per session. Returns false if one already exists (idempotent). */
    saveEvaluation(
      sessionId: string,
      report: CoachingReport,
      meta: {
        evaluatorKind: string;
        evaluatorName: string;
        evaluatorVersion: string;
        rubricVersion: string;
      },
    ): boolean {
      const result = db
        .prepare(
          `INSERT OR IGNORE INTO evaluations (session_id, evaluator_kind, evaluator_name, evaluator_version, rubric_version, report, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          sessionId,
          meta.evaluatorKind,
          meta.evaluatorName,
          meta.evaluatorVersion,
          meta.rubricVersion,
          json(report),
          now(),
        );
      return Number(result.changes) > 0;
    },

    getEvaluation(
      sessionId: string,
    ): { report: unknown; evaluatorVersion: string; rubricVersion: string } | null {
      const row = db.prepare('SELECT * FROM evaluations WHERE session_id = ?').get(sessionId) as
        Row | undefined;
      return row
        ? {
            report: parse<unknown>(row.report),
            evaluatorVersion: String(row.evaluator_version),
            rubricVersion: String(row.rubric_version),
          }
        : null;
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
