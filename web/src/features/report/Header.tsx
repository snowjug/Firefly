import type { ReactNode } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { Badge, Button, StateBadge } from '../../design/index.ts';
import { formatDateTime, formatDuration } from '../../lib/format.ts';
import { bandOf } from './copy.ts';
import { jumpToSection } from './dom.ts';
import './report.css';

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rp-meta__item">
      <dt className="rp-meta__label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Which call this is, at a glance: the scenario, its Microsoft product, when and how long, and how
 * the customer began and ended. A call saved before the Microsoft scenarios has no product, and then
 * none is shown: the page does not guess one.
 */
export function ReportHeader({
  session,
  report,
  onPrint,
}: {
  session: SessionDTO;
  report: CoachingReport;
  onPrint: () => void;
}) {
  const { scenario } = session;
  const started = bandOf(report.journey.start);
  const ended = bandOf(report.journey.end);
  return (
    <header className="rp-header">
      <div className="rp-header__top">
        <div className="rp-header__titles">
          <h1 id="report-title" className="t-title2" tabIndex={-1}>
            Coaching report
          </h1>
          <p className="rp-header__scenario">{scenario.title}</p>
          <p className="rp-header__flags">
            <Badge tone="info" appearance="outline">
              Training only
            </Badge>
            {session.providerKind === 'mock' ? (
              <Badge tone="neutral" appearance="outline">
                Demo mode
              </Badge>
            ) : null}
            {report.completion.status === 'ended-early' ? (
              <Badge tone="warning">Ended early</Badge>
            ) : null}
          </p>
        </div>
        <div className="rp-header__actions no-print">
          <Button size="small" icon="print" onClick={onPrint}>
            Print report
          </Button>
          <Button size="small" icon="document" onClick={() => jumpToSection('transcript')}>
            Review transcript
          </Button>
        </div>
      </div>
      <dl className="rp-meta">
        {scenario.product ? (
          <Meta label="Product">
            <span className="rp-meta__strong">{scenario.product.name}</span>
            <span className="rp-meta__line">{scenario.product.area}</span>
          </Meta>
        ) : null}
        <Meta label="Date">{formatDateTime(session.startedAt)}</Meta>
        <Meta label="Duration">{formatDuration(session.durationSeconds)}</Meta>
        <Meta label="Start state">
          <StateBadge state={started.id} />
        </Meta>
        <Meta label="End state">
          <StateBadge state={ended.id} />
        </Meta>
      </dl>
    </header>
  );
}
