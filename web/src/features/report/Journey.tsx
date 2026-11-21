import { lazy, Suspense, useMemo, useState } from 'react';
import type { CoachingReport, Milestone } from '#shared/domain/report.ts';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import { Badge, Icon, Skeleton, VisuallyHidden } from '../../design/index.ts';
import { CURVEBALL_STATUS_WORDS, MILESTONE_STATUS_WORDS, plainUnexpectedTurn } from './copy.ts';
import { TurnLink } from './evidence.tsx';
import {
  journeyListItems,
  journeySentence,
  journeyTableRows,
  type PointKind,
} from './journey-model.ts';
import { MarkerGlyph } from './marker-shape.tsx';
import { Quote, Section } from './parts.tsx';
import { usePrinting } from './print.tsx';
import './journey.css';

// The chart is drawn by its own chunk, loaded when this section renders. Everything it shows is
// also here as a list and a table, which load with the page.
const JourneyChart = lazy(() => import('./JourneyChart.tsx'));

function ChartPlaceholder({ journey }: { journey: CoachingReport['journey'] }) {
  return (
    <div className="rp-chart-placeholder" role="status">
      <p className="rp-chart__readout">{journeySentence(journey)}</p>
      <Skeleton variant="rect" height={240} />
      <VisuallyHidden>Loading the customer temperature chart</VisuallyHidden>
    </div>
  );
}

function MilestoneMark({ status }: { status: Milestone['status'] }) {
  return (
    <span className="rp-milestone__mark" aria-hidden="true">
      {status === 'reached' ? <Icon name="check" size={14} /> : null}
      {status === 'not-applicable' ? <Icon name="minus" size={14} /> : null}
    </span>
  );
}

/**
 * The six things a support call moves through, in call order. Each is reached (with the words and the
 * turn that show it), not reached, or, for the escalation, not applicable when nothing unexpected
 * happened. The status is written as well as drawn.
 */
function Milestones({ milestones }: { milestones: readonly Milestone[] }) {
  return (
    <div className="rp-timeline-box">
      <h3 className="rp-subtitle">Call milestones</h3>
      <ol className="rp-timeline" role="list">
        {milestones.map((milestone) => (
          <li className="rp-milestone" data-status={milestone.status} key={milestone.id}>
            <MilestoneMark status={milestone.status} />
            <div className="rp-milestone__body">
              <p className="rp-milestone__head">
                <span className="rp-milestone__label">{plainUnexpectedTurn(milestone.label)}</span>
                <span className="rp-milestone__status">
                  <VisuallyHidden>: </VisuallyHidden>
                  {MILESTONE_STATUS_WORDS[milestone.status]}
                </span>
              </p>
              {milestone.status === 'reached' && milestone.turnIndex !== null ? (
                milestone.quote ? (
                  <Quote
                    className="rp-milestone__quote"
                    quote={milestone.quote}
                    turnIndex={milestone.turnIndex}
                  />
                ) : (
                  <p className="rp-milestone__link">
                    <TurnLink turnIndex={milestone.turnIndex} />
                  </p>
                )
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const STATUS_TONE = { resolved: 'success', unresolved: 'warning', active: 'neutral' } as const;

function UnexpectedTurn({ curveball }: { curveball: NonNullable<CoachingReport['curveball']> }) {
  const label = CURVEBALL_LABELS[curveball.type]?.label ?? 'An unexpected moment';
  return (
    <div className="rp-unexpected">
      <h3 className="rp-subtitle">Unexpected turn</h3>
      <p className="rp-unexpected__line">
        <span className="rp-unexpected__what">{label}</span>
        <span>After turn {curveball.firedAtTurn}</span>
        <Badge tone={STATUS_TONE[curveball.status]} size="small">
          {CURVEBALL_STATUS_WORDS[curveball.status]}
        </Badge>
        <TurnLink turnIndex={curveball.firedAtTurn} />
      </p>
      <p className="t-reading">{plainUnexpectedTurn(curveball.assessment)}</p>
    </div>
  );
}

/**
 * How the call went for the customer: the six milestones in order (when the report has them), the
 * temperature through the call as a chart whose points can be used with the keyboard, the turns that
 * moved it in words and the same points as a table. Reports without milestones (saved before they
 * existed) show the temperature alone, and nothing is made up for the rest.
 */
export function JourneySection({ report }: { report: CoachingReport }) {
  const { journey, curveball } = report;
  const milestones = journey.milestones ?? null;
  const items = useMemo(() => journeyListItems(journey), [journey]);
  const rows = useMemo(() => journeyTableRows(journey), [journey]);
  const [open, setOpen] = useState(false);
  const printing = usePrinting();
  return (
    <Section id="journey" title="Customer journey">
      <div className="rp-journey">
        <div className="rp-journey__chart">
          <Suspense fallback={<ChartPlaceholder journey={journey} />}>
            <JourneyChart journey={journey} />
          </Suspense>
        </div>
        {milestones ? <Milestones milestones={milestones} /> : null}
      </div>

      <h3 className="rp-subtitle">What moved the customer</h3>
      <ol className="rp-moves" role="list">
        {items.map((item) => (
          <li className="rp-move" key={`${item.point.turnIndex}-${item.point.kind}`}>
            <p className="rp-move__kind">
              <MarkerGlyph kind={item.point.kind as PointKind} />
              <span>{item.kindLabel}</span>
            </p>
            <p className="rp-move__heading">{item.heading}</p>
            {item.reason ? <p className="rp-move__reason">{item.reason}</p> : null}
            {item.quote ? (
              <Quote quote={item.quote} turnIndex={item.point.turnIndex} />
            ) : item.point.turnIndex > 0 ? (
              <p className="rp-move__link">
                <TurnLink turnIndex={item.point.turnIndex} />
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {curveball ? <UnexpectedTurn curveball={curveball} /> : null}

      <details
        className="rp-disclosure"
        open={open || printing}
        onToggle={(event) => {
          if (!printing) setOpen(event.currentTarget.open);
        }}
      >
        <summary className="rp-disclosure__summary">Show as a table</summary>
        <table className="rp-table">
          <caption className="rp-table__caption">
            Customer temperature at each point in the call
          </caption>
          <thead>
            <tr>
              <th scope="col">Turn</th>
              <th scope="col">Point</th>
              <th scope="col">Customer</th>
              <th scope="col">Change</th>
              <th scope="col">What happened</th>
              <th scope="col">
                <VisuallyHidden>Link to the turn</VisuallyHidden>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.turnIndex}-${row.kindLabel}`}>
                <th scope="row">{row.turnIndex}</th>
                <td>{row.kindLabel}</td>
                <td>{row.band}</td>
                <td>{row.change}</td>
                <td>{row.reason ?? ''}</td>
                <td>{row.turnIndex > 0 ? <TurnLink turnIndex={row.turnIndex} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Section>
  );
}
