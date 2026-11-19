import type { DatabaseSync } from 'node:sqlite';
import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import type { StateEvent } from '#shared/domain/state.ts';
import type {
  DimensionId,
  EvaluationPhase,
  PracticeMode,
  SessionStatus,
} from '#shared/domain/vocab.ts';
import type { ProviderKind } from '#shared/domain/api.ts';
import type { DiscoveryRecord, EngineRuntime } from '../engine/types.ts';
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
  clientMessageId: string | null;
  classification: TurnClassification | null;
  createdAt: string;
}

export interface MentorRow {
  id: number;
  sessionId: string;
  reviewer: string;
  scores: Record<DimensionId, number>;
  notes: string | null;
  rubricVersion: string;
  source: 'mentor' | 'sample';
  createdAt: string;
}

export interface SessionFilters {
  status?: SessionStatus;
  difficulty?: string;
  scenarioId?: string;
  includeSamples?: boolean;
  onlySamples?: boolean;
  limit?: number;
  offset?: number;
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
    scenario: parse<EffectiveScenario>(r.scenario_snapshot),
    mode: r.mode as PracticeMode,
    providerKind: r.provider_kind as ProviderKind,
    providerLabel: String(r.provider_label),
    promptVersions: parse<PromptVersions>(r.prompt_versions),
    isSample: Number(r.is_sample) === 1,
    status: r.status as SessionStatus,
    evaluationPhase: (r.evaluation_phase as EvaluationPhase | null) ?? null,
    evaluationError: parseOrNull(r.evaluation_error),
    runtime: parse<EngineRuntime>(r.runtime),
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

    listSessions(profileId: string, f: SessionFilters = {}): { rows: SessionRow[]; total: number } {
      const where: string[] = ['profile_id = ?'];
      const params: (string | number)[] = [profileId];
      if (f.status) {
        where.push('status = ?');
        params.push(f.status);
      }
      if (f.scenarioId) {
        where.push('scenario_id = ?');
        params.push(f.scenarioId);
      }
      if (f.difficulty) {
        where.push("json_extract(scenario_snapshot, '$.config.difficulty') = ?");
        params.push(f.difficulty);
      }
      if (f.onlySamples) where.push('is_sample = 1');
      else if (!f.includeSamples) where.push('is_sample = 0');
      const clause = where.join(' AND ');
      const total = Number(
        (
          db.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE ${clause}`).get(...params) as {
            n: number;
          }
        ).n,
      );
      const rows = db
        .prepare(`SELECT * FROM sessions WHERE ${clause} ORDER BY started_at DESC LIMIT ? OFFSET ?`)
        .all(...params, Math.min(200, f.limit ?? 50), f.offset ?? 0) as Row[];
      return { rows: rows.map(sessionFromRow), total };
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

    /** Used for labelled sample sessions so their timestamps look like real practice over time. */
    setSessionTimes(id: string, startedAt: string, endedAt: string): void {
      db.prepare(
        'UPDATE sessions SET started_at = ?, ended_at = ?, updated_at = ? WHERE id = ?',
      ).run(startedAt, endedAt, now(), id);
    },

    deleteSessions(profileId: string, scope: 'practice' | 'samples' | 'all'): number {
      const clause =
        scope === 'all' ? '' : scope === 'samples' ? ' AND is_sample = 1' : ' AND is_sample = 0';
      const result = db
        .prepare(`DELETE FROM sessions WHERE profile_id = ?${clause}`)
        .run(profileId);
      return Number(result.changes);
    },

    countSessions(profileId: string): { practice: number; samples: number } {
      const rows = db
        .prepare(
          'SELECT is_sample, COUNT(*) AS n FROM sessions WHERE profile_id = ? GROUP BY is_sample',
        )
        .all(profileId) as { is_sample: number; n: number }[];
      return {
        practice: Number(rows.find((r) => r.is_sample === 0)?.n ?? 0),
        samples: Number(rows.find((r) => r.is_sample === 1)?.n ?? 0),
      };
    },

    stuckSessionIds(): string[] {
      return (
        db.prepare("SELECT id FROM sessions WHERE status = 'completing'").all() as { id: string }[]
      ).map((r) => r.id);
    },

    // ---- turns ----------------------------------------------------------------------------
    insertTurn(sessionId: string, t: Omit<TurnRow, 'createdAt'> & { createdAt?: string }): void {
      db.prepare(
        `INSERT INTO turns (session_id, idx, role, text, source, client_message_id, classification, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        sessionId,
        t.idx,
        t.role,
        t.text,
        t.source,
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

    // ---- mentor reviews -------------------------------------------------------------------
    saveMentorEvaluation(m: Omit<MentorRow, 'id' | 'createdAt'>): void {
      db.prepare(
        `INSERT INTO mentor_evaluations (session_id, reviewer, scores, notes, rubric_version, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (session_id, reviewer) DO UPDATE SET scores = excluded.scores, notes = excluded.notes,
           rubric_version = excluded.rubric_version, source = excluded.source, created_at = excluded.created_at`,
      ).run(m.sessionId, m.reviewer, json(m.scores), m.notes, m.rubricVersion, m.source, now());
    },

    listMentorEvaluations(
      profileId: string,
      includeSamples: boolean,
    ): (MentorRow & {
      scenarioTitle: string;
      aiScores: Partial<Record<DimensionId, number>> | null;
      evaluatorVersion: string | null;
    })[] {
      const rows = db
        .prepare(
          `SELECT m.*, s.scenario_title, s.dimension_scores, e.evaluator_version
           FROM mentor_evaluations m
           JOIN sessions s ON s.id = m.session_id
           LEFT JOIN evaluations e ON e.session_id = m.session_id
           WHERE s.profile_id = ? ${includeSamples ? '' : "AND m.source = 'mentor'"}
           ORDER BY m.created_at DESC`,
        )
        .all(profileId) as Row[];
      return rows.map((r) => ({
        id: Number(r.id),
        sessionId: String(r.session_id),
        reviewer: String(r.reviewer),
        scores: parse<Record<DimensionId, number>>(r.scores),
        notes: (r.notes as string | null) ?? null,
        rubricVersion: String(r.rubric_version),
        source: r.source as 'mentor' | 'sample',
        createdAt: String(r.created_at),
        scenarioTitle: String(r.scenario_title),
        aiScores: parseOrNull<Partial<Record<DimensionId, number>>>(r.dimension_scores),
        evaluatorVersion: (r.evaluator_version as string | null) ?? null,
      }));
    },

    sessionIdsWithMentorReview(profileId: string): Set<string> {
      const rows = db
        .prepare(
          `SELECT DISTINCT m.session_id FROM mentor_evaluations m JOIN sessions s ON s.id = m.session_id WHERE s.profile_id = ?`,
        )
        .all(profileId) as { session_id: string }[];
      return new Set(rows.map((r) => r.session_id));
    },

    traineeTurnCounts(sessionIds: string[]): Map<string, number> {
      const map = new Map<string, number>();
      if (sessionIds.length === 0) return map;
      const placeholders = sessionIds.map(() => '?').join(',');
      const rows = db
        .prepare(
          `SELECT session_id, COUNT(*) AS n FROM turns WHERE role = 'trainee' AND session_id IN (${placeholders}) GROUP BY session_id`,
        )
        .all(...sessionIds) as { session_id: string; n: number }[];
      for (const r of rows) map.set(r.session_id, Number(r.n));
      return map;
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
