import type { PublicScenarioDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import type { SessionStatus } from '#shared/domain/vocab.ts';
import {
  Badge,
  Button,
  Dialog,
  LinkButton,
  MessageBar,
  Spinner,
  VisuallyHidden,
  type BadgeTone,
} from '../../design/index.ts';
import { api, errorMessage } from '../../lib/api.ts';
import { formatDateTime, formatDuration, formatScore } from '../../lib/format.ts';
import { useApi, useOnline } from '../../lib/hooks.ts';
import './recent-calls.css';

/** The call in progress, if there is one. Quiet when there is none, and when it cannot be found out. */
export function useActiveCall(): SessionSummaryDTO | null {
  const { data } = useApi((signal) => api.listSessions({ status: 'active', limit: 1 }, signal), []);
  return data?.sessions.find((call) => call.status === 'active') ?? null;
}

const callPath = (id: string) => `/calls/${encodeURIComponent(id)}`;
const reportPath = (id: string) => `/sessions/${encodeURIComponent(id)}/report`;

/** A reminder at the top of the workspace, with the way back into the call. */
export function InProgressBanner({ call }: { call: SessionSummaryDTO }) {
  return (
    <MessageBar
      intent="info"
      className="rc-banner"
      actions={
        <LinkButton to={callPath(call.id)} appearance="primary">
          Resume
        </LinkButton>
      }
    >
      You have a call in progress: {call.scenarioTitle}.
    </MessageBar>
  );
}

interface StatusView {
  label: string;
  tone: BadgeTone;
  action: string;
  to(id: string): string;
}

const STATUS: Record<SessionStatus, StatusView> = {
  active: { label: 'In progress', tone: 'info', action: 'Resume', to: callPath },
  completing: { label: 'Evaluating', tone: 'info', action: 'Open', to: reportPath },
  completed: { label: 'Completed', tone: 'success', action: 'View report', to: reportPath },
  evaluation_failed: { label: 'Report failed', tone: 'warning', action: 'Open', to: reportPath },
};

function RecentCall({ call, customer }: { call: SessionSummaryDTO; customer: string | null }) {
  const status = STATUS[call.status];
  const facts = [
    customer,
    formatDateTime(call.startedAt),
    call.durationSeconds === null ? null : formatDuration(call.durationSeconds),
    call.status === 'completed' && call.overallScore !== null
      ? `Overall ${formatScore(call.overallScore)} of 5`
      : null,
  ].filter((fact): fact is string => fact !== null);
  return (
    <li className="rc-row">
      <div className="rc-row__main">
        <p className="rc-row__title">{call.scenarioTitle}</p>
        <p className="rc-row__facts">{facts.join(' \u00b7 ')}</p>
      </div>
      <Badge tone={status.tone}>{status.label}</Badge>
      <LinkButton to={status.to(call.id)} size="small" className="rc-row__action">
        {status.action}
        <VisuallyHidden> call: {call.scenarioTitle}</VisuallyHidden>
      </LinkButton>
    </li>
  );
}

function RecentCallsBody({ scenarios }: { scenarios: readonly PublicScenarioDTO[] | null }) {
  const online = useOnline();
  const { data, error, loading, reload } = useApi(
    (signal) => api.listSessions({ limit: 10 }, signal),
    [],
  );
  if (loading) {
    return (
      <div className="rc-state">
        <Spinner label="Loading recent calls" showLabel labelPosition="after" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <MessageBar
        intent="error"
        title="Recent calls could not be loaded."
        actions={<Button onClick={reload}>Try again</Button>}
      >
        {online ? errorMessage(error) : 'You are offline. Reconnect, then try again.'} Nothing was
        changed.
      </MessageBar>
    );
  }
  if (data.sessions.length === 0) {
    return (
      <div className="rc-state">
        <p className="rc-state__title">No calls yet.</p>
        <p className="rc-state__text">Once you start a call it will be listed here.</p>
      </div>
    );
  }
  const customers = new Map(scenarios?.map((scenario) => [scenario.id, scenario.persona.name]));
  return (
    <ul className="rc-list" role="list">
      {data.sessions.slice(0, 10).map((call) => (
        <RecentCall key={call.id} call={call} customer={customers.get(call.scenarioId) ?? null} />
      ))}
    </ul>
  );
}

export interface RecentCallsDialogProps {
  open: boolean;
  onClose(): void;
  /** The scenarios, so each call can name its customer. */
  scenarios: readonly PublicScenarioDTO[] | null;
}

/** The latest calls, to carry on with or to read the report of. Not a dashboard: no totals, no trends. */
export function RecentCallsDialog({ open, onClose, scenarios }: RecentCallsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Recent calls"
      description="Your latest calls, newest first."
      size="lg"
      closeLabel="Close recent calls"
      actions={<Button onClick={onClose}>Close</Button>}
    >
      <RecentCallsBody scenarios={scenarios} />
    </Dialog>
  );
}
