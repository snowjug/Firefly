import { lazy, Suspense, useMemo, useState } from 'react';
import type { CoachingReport } from '#shared/domain/report.ts';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import { Badge, Skeleton, VisuallyHidden } from '../../design/index.ts';
import { CURVEBALL_STATUS_WORDS, plainUnexpectedTurn, seeTurnText } from './copy.ts';
import { TurnLink } from './evidence.tsx';
import {
  journeyListItems,
  journeySentence,
  journeyTableRows,
  type PointKind,
} from './journey-model.ts';
import { MarkerGlyph } from './marker-shape.tsx';
import { Section } from './parts.tsx';
import { usePrinting } from './print.tsx';
import './journey.css';

// The chart is drawn by its own chunk, loaded when this section renders. Everything it shows is
// also here as an ordered list and a table, which load with the page.
const JourneyChart = lazy(() => import('./JourneyChart.tsx'));

function ChartPlaceholder() {
  return (
    <div className="rp-chart-placeholder" role="status">
      <Skeleton variant="rect" height={240} />
      <VisuallyHidden>Loading the customer temperature chart</VisuallyHidden>
    </div>
  );
}

const STATUS_TONE = { resolved: 'success', unresolved: 'warning', active: 'neutral' } as const;

function UnexpectedTurn({ curveball }: { curveball: NonNullable<CoachingReport['curveball']> }) {
  const label = CURVEBALL_LABELS[curveball.type]?.label ?? 'An unexpected moment';
  return (
    <div className="rp-unexpected">
      <h3 className="rp-subtitle">Unexpected turn</h3>
      <dl className="rp-facts">
        <div className="rp-facts__item">
          <dt>What happened</dt>
          <dd>{label}</dd>
        </div>
        <div className="rp-facts__item">
          <dt>When</dt>
          <dd>
            After turn {curveball.firedAtTurn}.{' '}
            <TurnLink turnIndex={curveball.firedAtTurn}>
              {seeTurnText(curveball.firedAtTurn)}
            </TurnLink>
          </dd>
        </div>
        <div className="rp-facts__item">
          <dt>Outcome</dt>
          <dd>
            <Badge tone={STATUS_TONE[curveball.status]} size="small">
              {CURVEBALL_STATUS_WORDS[curveball.status]}
            </Badge>
          </dd>
        </div>
      </dl>
      <p className="t-reading">{plainUnexpectedTurn(curveball.assessment)}</p>
    </div>
  );
}

/** The customer's temperature: a chart, the turns that moved it in words, and the same data as a table. */
export function JourneySection({ report }: { report: CoachingReport }) {
  const { journey, curveball } = report;
  const items = useMemo(() => journeyListItems(journey), [journey]);
  const rows = useMemo(() => journeyTableRows(journey), [journey]);
  const [open, setOpen] = useState(false);
  const printing = usePrinting();
  return (
    <Section
      id="journey"
      title="Customer temperature"
      lead="How the customer's mood moved through the call, and what moved it. Each point on the chart is one of your turns."
    >
      <p className="rp-journey__summary t-reading">{journeySentence(journey)}</p>
      <Suspense fallback={<ChartPlaceholder />}>
        <JourneyChart journey={journey} />
      </Suspense>

      <h3 className="rp-subtitle">What moved the customer</h3>
      <ol className="rp-moves" role="list">
        {items.map((item) => (
          <li className="rp-move" key={`${item.point.turnIndex}-${item.point.kind}`}>
            <p className="rp-move__kind">
              <MarkerGlyph kind={item.point.kind as PointKind} />
              <span>{item.kindLabel}</span>
            </p>
            <p className="rp-move__heading">{item.heading}</p>
            {item.reason ? <p className="t-reading">{item.reason}</p> : null}
            {item.quote ? (
              <p className="rp-move__quote t-reading">
                You said: <span className="t-quote">{`\u201c${item.quote}\u201d`}</span>
              </p>
            ) : null}
            <p className="rp-move__link">
              <TurnLink turnIndex={item.point.turnIndex} quote={item.quote} />
            </p>
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
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Section>
  );
}
