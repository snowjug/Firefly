import type { ReactNode } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import {
  Badge,
  Button,
  Icon,
  LinkButton,
  MessageBar,
  ProductIcon,
  StateBadge,
  VisuallyHidden,
  accentClass,
  cx,
} from '../../design/index.ts';
import { formatDateTime, formatDuration } from '../../lib/format.ts';
import { SCENARIO_LIST } from './brief-href.ts';
import { STAGE_WORDS, bandOf, plainUnexpectedTurn, scoreText } from './copy.ts';
import { CountUp } from './count-up.tsx';
import { jumpToSection } from './dom.ts';
import { SectionLink } from './evidence.tsx';
import { ClampedText } from './parts.tsx';
import { restsOnLimitedEvidence, summarySays } from './report-model.ts';
import './summary.css';

/** The most words the summary shows before "Show more". */
export const SUMMARY_WORDS = 45;

/** Where the signal line stands in the block's arrival (`--rp-step` in summary.css): its number counts up as the line comes in. */
const SIGNAL_STEP = 4;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rp-exec__fact">
      <dt className="rp-exec__label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * The top of the report in one block: which call this was (the Microsoft product on its accent tile,
 * the scenario, the stage, how long it lasted, how the customer began and ended), the coaching
 * summary, one modest line for the practice signal and the first actions. A call saved before the
 * Microsoft scenarios has no product, and then none is shown: the page does not guess one. A short
 * or ended-early call says so here, once, before the scores that rest on it: in the summary's own
 * words when it has them, and otherwise in a note under it. The signal is the average of the six
 * skills and is never drawn large: it is coaching, not a verdict.
 */
export function ExecutiveSummary({
  session,
  report,
  onPrint,
}: {
  session: SessionDTO;
  report: CoachingReport;
  onPrint: () => void;
}) {
  const { scenario } = session;
  const { product } = scenario;
  const { overallScore, overall } = report.summary;
  const started = bandOf(report.journey.start);
  const ended = bandOf(report.journey.end);
  const summary = plainUnexpectedTurn(overall);
  const says = summarySays(summary);
  return (
    <header className={cx('rp-exec', accentClass(product?.id))}>
      <div className="rp-exec__top">
        {product ? (
          <p className="rp-exec__product">
            <span className="rp-exec__tile">
              <ProductIcon product={product.id} size={22} />
            </span>
            <span className="rp-exec__names">
              <span className="rp-exec__name">{product.name}</span>
              <span className="rp-exec__area">{product.area}</span>
            </span>
          </p>
        ) : null}
        <p className="rp-exec__flags">
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

      <div className="rp-exec__titles">
        <h1 id="report-title" className="rp-exec__title t-title2" tabIndex={-1}>
          Coaching report
        </h1>
        <p className="rp-exec__scenario">{scenario.title}</p>
      </div>

      <dl className="rp-exec__facts">
        <Fact label="Stage">{STAGE_WORDS[scenario.config.callStage]}</Fact>
        <Fact label="Date">{formatDateTime(session.startedAt)}</Fact>
        <Fact label="Duration">{formatDuration(session.durationSeconds)}</Fact>
        <Fact label="Customer">
          <span className="rp-exec__states">
            <StateBadge state={started.id} />
            <VisuallyHidden>to</VisuallyHidden>
            <Icon name="arrow-right" size={16} className="rp-exec__arrow" />
            <StateBadge state={ended.id} />
          </span>
        </Fact>
      </dl>

      <section
        id="summary"
        aria-labelledby="summary-title"
        className="rp-exec__summary"
        data-rp-origin="Summary"
      >
        <h2 id="summary-title" className="rp-exec__label" tabIndex={-1} data-rp-heading>
          Summary
        </h2>
        <ClampedText
          className="rp-exec__text t-reading"
          text={summary}
          budget={SUMMARY_WORDS}
          budgetKey="summary"
        />
        {overallScore !== null ? (
          <p className="rp-exec__signal">
            Practice signal{' '}
            <CountUp
              className="rp-exec__number"
              text={scoreText(overallScore)}
              step={SIGNAL_STEP}
            />{' '}
            of 5, the average of six skills.
          </p>
        ) : says.noScore ? null : (
          <p className="rp-exec__signal">No overall practice signal: not enough evidence.</p>
        )}
        {restsOnLimitedEvidence(report) && !says.short ? (
          <MessageBar intent="info" live={false}>
            {report.completion.note ??
              'This call was short, so the coaching rests on limited evidence.'}
          </MessageBar>
        ) : null}
        <p className="rp-exec__note">
          <Icon name="info" size={16} />
          <span>
            Automatic practice feedback, not a performance assessment.{' '}
            <SectionLink to="about">About this report</SectionLink>
          </span>
        </p>
      </section>

      <div className="rp-exec__actions no-print">
        <LinkButton to={SCENARIO_LIST} appearance="primary" icon="phone">
          Try another call
        </LinkButton>
        <Button icon="document" onClick={() => jumpToSection('transcript')}>
          Review full transcript
        </Button>
        <Button icon="print" onClick={onPrint}>
          Print report
        </Button>
      </div>
    </header>
  );
}
