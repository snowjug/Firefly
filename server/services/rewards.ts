import type { PublicScenarioDTO, RewardsDTO } from '#shared/domain/api.ts';
import { CoachingReportSchema } from '#shared/domain/report.ts';
import {
  computeRewards,
  type RewardCall,
  type RewardMentorReview,
} from '#shared/domain/rewards.ts';
import {
  DIFFICULTIES,
  ISSUE_TYPES,
  type Difficulty,
  type IssueType,
} from '#shared/domain/vocab.ts';
import type { Repository, SessionRow } from '../db/repository.ts';

// Rewards are not stored. Each request reads the profile's saved calls, their stored coaching
// reports and any human mentor reviews, and hands them to the pure rules in shared/domain/rewards.ts.
// A call whose report is missing or no longer valid is skipped rather than failing the request.

const PAGE_SIZE = 200;

const isIssueType = (value: unknown): value is IssueType =>
  (ISSUE_TYPES as readonly unknown[]).includes(value);
const isDifficulty = (value: unknown): value is Difficulty =>
  (DIFFICULTIES as readonly unknown[]).includes(value);

export class RewardsService {
  private readonly repo: Repository;
  private readonly listScenarios: () => PublicScenarioDTO[];

  constructor(repo: Repository, listScenarios: () => PublicScenarioDTO[]) {
    this.repo = repo;
    this.listScenarios = listScenarios;
  }

  rewards(profileId: string, options: { tzOffsetMinutes: number; now?: Date }): RewardsDTO {
    const reviews = this.humanReviews(profileId);
    const calls: RewardCall[] = [];
    for (const row of this.completedSessions(profileId)) {
      const call = this.toCall(row, reviews.get(row.id) ?? []);
      if (call) calls.push(call);
    }
    return computeRewards(
      { calls },
      {
        tzOffsetMinutes: options.tzOffsetMinutes,
        now: options.now ?? new Date(),
        scenarios: this.listScenarios(),
      },
    );
  }

  /** Every completed practice call, however many there are: a cap would change what is "first". */
  private completedSessions(profileId: string): SessionRow[] {
    const rows = new Map<string, SessionRow>();
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = this.repo.listSessions(profileId, {
        status: 'completed',
        includeSamples: false,
        limit: PAGE_SIZE,
        offset,
      });
      for (const row of page.rows) rows.set(row.id, row);
      if (page.rows.length < PAGE_SIZE || offset + PAGE_SIZE >= page.total) break;
    }
    return [...rows.values()];
  }

  private humanReviews(profileId: string): Map<string, RewardMentorReview[]> {
    const bySession = new Map<string, RewardMentorReview[]>();
    for (const review of this.repo.listMentorEvaluations(profileId, false)) {
      if (review.source !== 'mentor') continue;
      const list = bySession.get(review.sessionId) ?? [];
      list.push({ source: 'mentor', at: review.createdAt, scores: review.scores });
      bySession.set(review.sessionId, list);
    }
    return bySession;
  }

  private toCall(row: SessionRow, mentorReviews: RewardMentorReview[]): RewardCall | null {
    if (row.isSample || row.status !== 'completed') return null;
    const issueType = row.scenario.issueType;
    const difficulty = row.scenario.config.difficulty;
    if (!isIssueType(issueType) || !isDifficulty(difficulty)) return null;
    const stored = this.repo.getEvaluation(row.id);
    const report = stored ? CoachingReportSchema.safeParse(stored.report) : null;
    if (!report?.success) return null;
    return {
      sessionId: row.id,
      scenarioId: row.scenarioId,
      scenarioTitle: row.scenarioTitle,
      issueType,
      difficulty,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      isSample: row.isSample,
      report: report.data,
      mentorReviews,
    };
  }
}
