import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { TurnClassification } from '#shared/domain/classification.ts';
import type {
  CreateSessionRequest,
  EndSessionRequest,
  PublicScenarioDTO,
  SendMessageRequest,
  SendMessageResponse,
  SessionDTO,
  SessionListDTO,
} from '#shared/domain/api.ts';
import { applyConfig } from '#shared/domain/config.ts';
import {
  CoachingReportSchema,
  type CoachingReport,
  type EvaluationDraft,
} from '#shared/domain/report.ts';
import { ScenarioOverridesSchema, type ScenarioDefinition } from '#shared/domain/scenario.ts';
import { startingState } from '#shared/domain/state.ts';
import { MAX_MESSAGE_CHARS, redactSensitive } from '#shared/domain/text.ts';
import {
  DIMENSION_IDS,
  PRACTICE_MODES,
  type DimensionId,
  type EvaluationPhase,
  type SessionStatus,
} from '#shared/domain/vocab.ts';
import { classifyTurnRules } from '../engine/classifier.ts';
import { processTraineeTurn } from '../engine/pipeline.ts';
import { createInitialRuntime, openingMessage, publicState } from '../engine/session.ts';
import type { EvaluationInput, TranscriptTurn } from '../engine/types.ts';
import { RUBRIC_VERSION } from '../engine/types.ts';
import { AppError, conflict, isAbortError, notFound } from '../errors.ts';
import type { FailureHooks } from '../hooks.ts';
import { shortId, type Logger } from '../log.ts';
import { ProviderError, type ModelProvider } from '../providers/types.ts';
import type { Repository, SessionRow, TurnRow } from '../db/repository.ts';
import { transaction } from '../db/database.ts';
import type { DatabaseSync } from 'node:sqlite';
import { toPublicScenario, toSessionDTO, toSummary } from './dto.ts';

export const LIMITS = { maxMessageChars: MAX_MESSAGE_CHARS, maxTraineeTurns: 60 };

export interface EvaluatorFns {
  rules: { name: string; version: string; evaluate(input: EvaluationInput): CoachingReport };
  mergeModelDraft(
    draft: EvaluationDraft,
    input: EvaluationInput,
    meta: { name: string; version: string; providerLabel: string },
  ): { report: CoachingReport; warnings: string[] };
}

export interface SessionServiceDeps {
  db: DatabaseSync;
  repo: Repository;
  provider: ModelProvider;
  library: ScenarioDefinition[];
  evaluators: EvaluatorFns;
  log: Logger;
  hooks: FailureHooks;
}

const idPattern = /^[A-Za-z0-9_-]{8,64}$/;

export const CreateSessionSchema = z.object({
  scenarioId: z.string().min(1).max(64),
  overrides: ScenarioOverridesSchema.optional(),
  mode: z.enum(PRACTICE_MODES).optional(),
  clientRequestId: z.string().regex(idPattern).optional(),
});

export const SendMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Type a message before sending.')
    .max(LIMITS.maxMessageChars, `Messages can be up to ${LIMITS.maxMessageChars} characters.`),
  clientMessageId: z.string().regex(idPattern),
});

export const EndSessionSchema = z.object({
  reason: z.enum(['finished', 'ended-early']).optional(),
});

export const MentorScoreSchema = z.object({
  reviewer: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[\p{L}\p{N} .,'@_-]+$/u, 'Use letters, numbers and simple punctuation only.'),
  scores: z.object(
    Object.fromEntries(DIMENSION_IDS.map((d) => [d, z.number().int().min(1).max(5)])) as Record<
      DimensionId,
      z.ZodNumber
    >,
  ),
  notes: z.string().trim().max(500).optional(),
});

const PROVIDER_STATUS: Record<string, number> = {
  provider_unavailable: 502,
  provider_timeout: 504,
  provider_rate_limited: 503,
  provider_bad_output: 502,
  provider_not_configured: 503,
  provider_content_filtered: 422,
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ProviderError) {
    return new AppError(PROVIDER_STATUS[error.code] ?? 502, error.code, error.message, {
      retryable: error.retryable,
    });
  }
  return new AppError(500, 'internal', 'Something went wrong on our side. Please try again.', {
    retryable: true,
  });
}

export class SessionService {
  private readonly deps: SessionServiceDeps;
  private readonly busy = new Set<string>();
  private readonly evalJobs = new Map<string, Promise<void>>();

  constructor(deps: SessionServiceDeps) {
    this.deps = deps;
    this.recoverInterruptedEvaluations();
  }

  // ---- scenarios --------------------------------------------------------------------------

  listScenarios(): PublicScenarioDTO[] {
    return this.deps.library.filter((s) => s.enabled).map(toPublicScenario);
  }

  getScenario(id: string): PublicScenarioDTO {
    const found = this.deps.library.find((s) => s.id === id && s.enabled);
    if (!found) throw notFound('That scenario');
    return toPublicScenario(found);
  }

  // ---- sessions ---------------------------------------------------------------------------

  createSession(
    profileId: string,
    request: CreateSessionRequest,
    options: { isSample?: boolean; startedAt?: string } = {},
  ): SessionDTO {
    const { repo, provider, log } = this.deps;
    const base = this.deps.library.find((s) => s.id === request.scenarioId && s.enabled);
    if (!base) throw notFound('That scenario');

    if (request.clientRequestId) {
      const existing = repo.findSessionByRequest(profileId, request.clientRequestId);
      if (existing) return this.loadDTO(existing);
    }

    const seed = randomInt(1, 2 ** 31 - 1);
    const scenario = applyConfig(base, request.overrides ?? {}, { mode: request.mode, seed });
    const runtime = createInitialRuntime(scenario);
    const startedAt = options.startedAt ?? new Date().toISOString();
    const id = randomUUID();
    const row: SessionRow = {
      id,
      profileId,
      scenarioId: base.id,
      scenarioTitle: base.title,
      scenarioVersion: base.version,
      scenario,
      mode: scenario.config.mode,
      providerKind: provider.kind,
      providerLabel: provider.label,
      promptVersions: provider.prompts,
      isSample: options.isSample ?? false,
      status: 'active',
      evaluationPhase: null,
      evaluationError: null,
      runtime,
      clientRequestId: request.clientRequestId ?? null,
      startedAt,
      endedAt: null,
      completion: null,
      overallScore: null,
      dimensionScores: null,
      updatedAt: startedAt,
    };
    transaction(this.deps.db, () => {
      repo.insertSession(row);
      repo.insertTurn(id, {
        idx: 1,
        role: 'customer',
        text: openingMessage(scenario),
        source: 'opening',
        clientMessageId: null,
        classification: null,
        createdAt: startedAt,
      });
    });
    log.info('session.created', {
      sessionId: shortId(id),
      scenarioId: base.id,
      difficulty: scenario.config.difficulty,
      provider: provider.kind,
    });
    return this.loadDTO(row);
  }

  getSession(profileId: string, id: string): SessionDTO {
    const row = this.deps.repo.getSession(id, profileId);
    if (!row) throw notFound('That session');
    return this.loadDTO(row);
  }

  listSessions(
    profileId: string,
    filters: {
      status?: SessionStatus;
      difficulty?: string;
      scenarioId?: string;
      includeSamples?: boolean;
      limit?: number;
      offset?: number;
    },
  ): SessionListDTO {
    const { repo } = this.deps;
    const { rows, total } = repo.listSessions(profileId, filters);
    const counts = repo.traineeTurnCounts(rows.map((r) => r.id));
    const reviewed = repo.sessionIdsWithMentorReview(profileId);
    return {
      sessions: rows.map((r) => toSummary(r, counts.get(r.id) ?? 0, reviewed.has(r.id))),
      total,
    };
  }

  deleteSession(profileId: string, id: string): void {
    if (this.evalJobs.has(id) || this.busy.has(id))
      throw conflict('That session is busy. Try again in a moment.', true);
    if (!this.deps.repo.deleteSession(id, profileId)) throw notFound('That session');
  }

  // ---- the conversation -------------------------------------------------------------------

  async sendMessage(
    profileId: string,
    sessionId: string,
    request: SendMessageRequest,
    signal?: AbortSignal,
  ): Promise<SendMessageResponse> {
    const { repo, log, hooks } = this.deps;
    if (this.busy.has(sessionId)) {
      throw conflict('Another message in this call is still being processed.', true);
    }
    this.busy.add(sessionId);
    const started = Date.now();
    try {
      const session = repo.getSession(sessionId, profileId);
      if (!session) throw notFound('That session');
      if (session.status !== 'active') {
        throw new AppError(
          409,
          'session_not_active',
          'This call has ended, so no more messages can be sent.',
        );
      }
      if (session.providerKind !== this.deps.provider.kind) {
        throw conflict(
          'This call was started with a different AI setting than the server is using now. Start a new call.',
        );
      }

      const turns = repo.getTurns(sessionId);
      const existing = turns.find((t) => t.clientMessageId === request.clientMessageId);

      // A resend of an already-answered message returns the stored answer without reprocessing.
      if (existing) {
        const reply = turns.find((t) => t.idx === existing.idx + 1 && t.role === 'customer');
        if (reply) return this.responseFor(session, existing, reply, []);
      } else {
        const last = turns[turns.length - 1];
        if (last && last.role === 'trainee') {
          throw conflict('Your previous message is still waiting for a reply. Retry it first.');
        }
        if (session.runtime.traineeTurns >= LIMITS.maxTraineeTurns) {
          throw new AppError(
            409,
            'turn_limit_reached',
            `This call has reached its ${LIMITS.maxTraineeTurns}-message limit. End the call to see your coaching.`,
          );
        }
      }

      let trainee: TurnRow;
      let redactions: string[] = [];
      if (existing) {
        trainee = existing;
      } else {
        const cleaned = redactSensitive(request.text.trim());
        redactions = cleaned.redactions;
        const lastCustomer = [...turns].reverse().find((t) => t.role === 'customer')?.text ?? null;
        const classification = await this.classify(
          session,
          cleaned.text,
          session.runtime.traineeTurns + 1,
          lastCustomer,
          signal,
        );
        trainee = {
          idx: turns.length + 1,
          role: 'trainee',
          text: cleaned.text,
          source: 'trainee',
          clientMessageId: request.clientMessageId,
          classification,
          createdAt: new Date().toISOString(),
        };
        // The trainee's words are saved before the customer replies, so a failed reply loses nothing.
        repo.insertTurn(sessionId, trainee);
      }

      const history: TranscriptTurn[] = turns
        .filter((t) => t.idx < trainee.idx)
        .map((t) => ({ index: t.idx, role: t.role, text: t.text }));
      const stored = trainee.classification as TurnClassification;

      let result;
      try {
        result = await processTraineeTurn({
          scenario: session.scenario,
          runtime: session.runtime,
          traineeText: trainee.text,
          turnIndex: trainee.idx,
          history,
          classify: () => Promise.resolve(stored),
          generate: (ctx) => {
            hooks.maybeFail('customer');
            return this.deps.provider.generateCustomer(ctx, signal);
          },
        });
      } catch (error) {
        if (isAbortError(error)) throw error;
        const app = toAppError(error);
        log.warn('message.failed', {
          sessionId: shortId(sessionId),
          code: app.code,
          ms: Date.now() - started,
        });
        throw new AppError(app.status, app.code, app.message, {
          retryable: app.retryable,
          details: { traineeTurn: this.turnDTO(trainee) },
        });
      }

      const reply: TurnRow = {
        idx: trainee.idx + 1,
        role: 'customer',
        text: result.customerText,
        source: result.customerSource,
        clientMessageId: null,
        classification: null,
        createdAt: new Date().toISOString(),
      };
      transaction(this.deps.db, () => {
        repo.insertTurn(sessionId, reply);
        repo.insertStateEvents(sessionId, result.stateEvents);
        repo.upsertDiscovery(sessionId, result.discoveryRecords);
        repo.updateRuntime(sessionId, result.runtime);
      });
      log.info('message.ok', {
        sessionId: shortId(sessionId),
        turn: trainee.idx,
        ms: Date.now() - started,
        provider: this.deps.provider.kind,
        curveball: Boolean(result.curveballFired),
      });
      const updated = { ...session, runtime: result.runtime };
      return this.responseFor(updated, trainee, reply, redactions);
    } finally {
      this.busy.delete(sessionId);
    }
  }

  private async classify(
    session: SessionRow,
    text: string,
    traineeTurnNumber: number,
    lastCustomerText: string | null,
    signal?: AbortSignal,
  ): Promise<TurnClassification> {
    try {
      this.deps.hooks.maybeFail('classifier');
      return await this.deps.provider.classifyTurn(
        { scenario: session.scenario, traineeText: text, traineeTurnNumber, lastCustomerText },
        signal,
      );
    } catch (error) {
      if (isAbortError(error)) throw error;
      this.deps.log.warn('classifier.fallback', {
        sessionId: shortId(session.id),
        code: error instanceof ProviderError ? error.code : 'error',
      });
      return classifyTurnRules(text, { scenario: session.scenario, traineeTurnNumber });
    }
  }

  private turnDTO(t: TurnRow) {
    return { index: t.idx, role: t.role, text: t.text, createdAt: t.createdAt, source: t.source };
  }

  private responseFor(
    session: SessionRow,
    trainee: TurnRow,
    reply: TurnRow,
    redactions: string[],
  ): SendMessageResponse {
    return {
      traineeTurn: this.turnDTO(trainee),
      customerTurn: this.turnDTO(reply),
      state: publicState(session.runtime),
      redactions: redactions as SendMessageResponse['redactions'],
      turnsRemaining: Math.max(0, LIMITS.maxTraineeTurns - session.runtime.traineeTurns),
    };
  }

  // ---- ending a call ----------------------------------------------------------------------

  /**
   * Ends the call. This is a real state transition: the transcript is locked, the session moves to
   * `completing`, evaluation runs, and the report is saved exactly once. Calling it again while
   * evaluation is running, or after it has finished, never creates a second report.
   */
  async endSession(
    profileId: string,
    id: string,
    _request: EndSessionRequest = {},
  ): Promise<SessionDTO> {
    const { repo, log } = this.deps;
    const session = repo.getSession(id, profileId);
    if (!session) throw notFound('That session');

    if (session.status === 'active') {
      if (this.busy.has(id))
        throw conflict('A message is still being processed. Try again in a moment.', true);
      const turns = repo.getTurns(id);
      if (!turns.some((t) => t.role === 'trainee')) {
        throw new AppError(
          422,
          'no_conversation',
          'There is nothing to evaluate yet: no messages were sent. Discard this call instead.',
        );
      }
      repo.updateStatus(id, {
        status: 'completing',
        evaluationPhase: 'transcript_locked',
        endedAt: new Date().toISOString(),
      });
      log.info('session.ending', { sessionId: shortId(id) });
      this.startEvaluation(id);
    } else if (session.status === 'evaluation_failed') {
      this.startEvaluation(id);
    } else if (session.status === 'completing' && !this.evalJobs.has(id)) {
      this.startEvaluation(id);
    }

    const job = this.evalJobs.get(id);
    if (job) await Promise.race([job, new Promise<void>((resolve) => setTimeout(resolve, 400))]);
    return this.getSession(profileId, id);
  }

  async retryEvaluation(profileId: string, id: string): Promise<SessionDTO> {
    const session = this.deps.repo.getSession(id, profileId);
    if (!session) throw notFound('That session');
    if (session.status === 'active') throw conflict('End the call before requesting a report.');
    return this.endSession(profileId, id);
  }

  getReport(profileId: string, id: string): CoachingReport {
    const dto = this.getSession(profileId, id);
    if (!dto.report) throw notFound('A report for that session');
    return dto.report;
  }

  private startEvaluation(id: string): void {
    if (this.evalJobs.has(id)) return;
    const job = this.runEvaluation(id).finally(() => this.evalJobs.delete(id));
    this.evalJobs.set(id, job);
  }

  private setPhase(id: string, phase: EvaluationPhase): void {
    this.deps.repo.updateStatus(id, { status: 'completing', evaluationPhase: phase });
  }

  private async runEvaluation(id: string): Promise<void> {
    const { repo, log, hooks, provider, evaluators } = this.deps;
    const started = Date.now();
    try {
      this.setPhase(id, 'discovery_review');
      const session = repo.getSessionById(id);
      if (!session) return;
      const input = this.buildEvaluationInput(session);

      this.setPhase(id, 'scoring');
      hooks.maybeFail('evaluator');
      let report: CoachingReport;
      let meta: { kind: string; name: string; version: string };
      if (provider.evaluateDraft) {
        const draft = await provider.evaluateDraft(input);
        const merged = evaluators.mergeModelDraft(draft, input, {
          name: 'Firefly model evaluator',
          version: provider.prompts.evaluator,
          providerLabel: provider.label,
        });
        if (merged.warnings.length > 0)
          log.warn('evaluation.warnings', {
            sessionId: shortId(id),
            count: merged.warnings.length,
          });
        report = merged.report;
        meta = {
          kind: 'model',
          name: 'Firefly model evaluator',
          version: provider.prompts.evaluator,
        };
      } else {
        report = evaluators.rules.evaluate(input);
        meta = { kind: 'rules', name: evaluators.rules.name, version: evaluators.rules.version };
      }

      this.setPhase(id, 'building_report');
      const validated = CoachingReportSchema.parse(report);
      const scores = Object.fromEntries(validated.dimensions.map((d) => [d.id, d.score])) as Record<
        DimensionId,
        number
      >;
      transaction(this.deps.db, () => {
        repo.saveEvaluation(id, validated, {
          evaluatorKind: meta.kind,
          evaluatorName: meta.name,
          evaluatorVersion: meta.version,
          rubricVersion: RUBRIC_VERSION,
        });
        repo.completeSession(id, {
          completion: validated.completion.status,
          overallScore: validated.summary.overallScore,
          dimensionScores: scores,
        });
      });
      log.info('evaluation.ok', {
        sessionId: shortId(id),
        ms: Date.now() - started,
        evaluator: meta.kind,
      });
    } catch (error) {
      const app = toAppError(error);
      const retryable = app.code === 'internal' ? true : app.retryable;
      log.error('evaluation.failed', {
        sessionId: shortId(id),
        code: app.code,
        ms: Date.now() - started,
      });
      repo.updateStatus(id, {
        status: 'evaluation_failed',
        evaluationPhase: null,
        evaluationError: {
          message:
            app.code === 'internal'
              ? 'The coaching report could not be generated. Your transcript is safe; try again.'
              : app.message,
          retryable,
        },
      });
    }
  }

  buildEvaluationInput(session: SessionRow): EvaluationInput {
    const { repo, library } = this.deps;
    const turns = repo.getTurns(session.id);
    const transcript: TranscriptTurn[] = turns.map((t) => ({
      index: t.idx,
      role: t.role,
      text: t.text,
    }));
    const classifications: Record<number, TurnClassification> = {};
    for (const t of turns)
      if (t.role === 'trainee' && t.classification) classifications[t.idx] = t.classification;

    const traineeTurns = turns.filter((t) => t.role === 'trainee');
    const lastTwo = traineeTurns.slice(-2).map((t) => t.classification);
    const closed = lastTwo.some(
      (c) => c && (c.wrapsUp || c.confirmsNextContact || c.asksAnythingElse),
    );
    const cfg = session.scenario.config;
    const endedAt = session.endedAt ?? new Date().toISOString();
    return {
      scenario: session.scenario,
      turns: transcript,
      classifications,
      stateEvents: repo.getStateEvents(session.id),
      discovery: session.runtime.discovery,
      startState: startingState({
        startingTemperature: cfg.startingTemperature,
        difficulty: cfg.difficulty,
        callStage: cfg.callStage,
        impact: cfg.impact,
      }),
      finalState: session.runtime.customer,
      endedEarly: !closed,
      durationSeconds: Math.max(
        0,
        Math.round((Date.parse(endedAt) - Date.parse(session.startedAt)) / 1000),
      ),
      provider: { kind: session.providerKind, label: session.providerLabel },
      library: library
        .filter((s) => s.enabled)
        .map((s) => ({
          id: s.id,
          title: s.title,
          difficulty: s.difficulty,
          coachingFocus: s.coachingFocus,
        })),
    };
  }

  /** After a restart, any call that was mid-evaluation is marked retryable instead of staying stuck. */
  private recoverInterruptedEvaluations(): void {
    const { repo, log } = this.deps;
    for (const id of repo.stuckSessionIds()) {
      repo.updateStatus(id, {
        status: 'evaluation_failed',
        evaluationPhase: null,
        evaluationError: {
          message: 'Report generation was interrupted. Your transcript is safe; try again.',
          retryable: true,
        },
      });
      log.warn('evaluation.recovered', { sessionId: shortId(id) });
    }
  }

  private loadDTO(row: SessionRow): SessionDTO {
    const { repo } = this.deps;
    const turns = repo.getTurns(row.id);
    const events = row.status === 'completed' ? repo.getStateEvents(row.id) : [];
    const stored = row.status === 'completed' ? repo.getEvaluation(row.id)?.report : null;
    const reviewed = repo.sessionIdsWithMentorReview(row.profileId).has(row.id);
    return toSessionDTO(row, turns, events, stored, reviewed);
  }

  /** Wait for any running evaluation (used by tests and the sample loader). */
  async settle(id: string): Promise<void> {
    await this.evalJobs.get(id);
  }
}
