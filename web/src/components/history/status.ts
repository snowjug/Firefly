import type { SessionStatus } from '#shared/domain/vocab.ts';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';

export type StatusTone = 'positive' | 'caution' | 'info';

/** The status of a session in plain words. Shown as text, never as colour alone. */
export function statusOf(session: Pick<SessionSummaryDTO, 'status' | 'completion'>): {
  label: string;
  tone: StatusTone;
} {
  switch (session.status) {
    case 'active':
      return { label: 'In progress', tone: 'info' };
    case 'completing':
      return { label: 'Evaluating', tone: 'info' };
    case 'evaluation_failed':
      return { label: 'Needs attention', tone: 'caution' };
    case 'completed':
      return session.completion === 'ended-early'
        ? { label: 'Ended early', tone: 'caution' }
        : { label: 'Completed', tone: 'positive' };
  }
}

export type StatusFilter = 'all' | 'completed' | 'active' | 'attention';

export const STATUS_FILTERS: {
  value: StatusFilter;
  label: string;
  api: SessionStatus | undefined;
}[] = [
  { value: 'all', label: 'All statuses', api: undefined },
  { value: 'completed', label: 'Completed', api: 'completed' },
  { value: 'active', label: 'In progress', api: 'active' },
  { value: 'attention', label: 'Needs attention', api: 'evaluation_failed' },
];

export interface HistoryFilters {
  difficulty: string;
  scenarioId: string;
  status: StatusFilter;
  includeSamples: boolean;
}

export const DEFAULT_FILTERS: HistoryFilters = {
  difficulty: '',
  scenarioId: '',
  status: 'all',
  includeSamples: true,
};

/** True when something other than the sample toggle narrows the list. */
export const narrowed = (filters: HistoryFilters): boolean =>
  filters.difficulty !== '' || filters.scenarioId !== '' || filters.status !== 'all';

export const isDefault = (filters: HistoryFilters): boolean =>
  !narrowed(filters) && filters.includeSamples === DEFAULT_FILTERS.includeSamples;
