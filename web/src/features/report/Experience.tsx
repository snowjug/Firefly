import { lazy, Suspense, useMemo, useState } from 'react';
import type { CoachingReport, JourneyPoint } from '#shared/domain/report.ts';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import {
  Badge,
  Disclosure,
  Skeleton,
  StateBadge,
  VisuallyHidden,
  useAnnouncer,
} from '../../design/index.ts';
import { CURVEBALL_STATUS_WORDS, bandIdFor, plainUnexpectedTurn } from './copy.ts';
import { EvidencePanel, type Moment } from './EvidencePanel.tsx';
import { TurnLink, useEvidence } from './evidence.tsx';
import { isVerifiedQuote } from './evidence-model.ts';
import {
  journeySentence,
  journeyTableRows,
  keyMoments,
  pointSummary,
  type ChartPoint,
  type KeyMoment,
} from './journey-model.ts';
import { Field, Section, TurnQuote } from './parts.tsx';
import { MarkerGlyph } from './marker-shape.tsx';
import { usePrinting } from './print.tsx';
import { useTimelineSync } from './selection.tsx';
import './journey.css';

// The chart is drawn by its own chunk, loaded when this section renders. Everything it shows is
// also here as rows and a table, which load with the page.
const JourneyChart = lazy(() => import('./JourneyChart.tsx'));

type Journey = CoachingReport['journey'];

function ChartPlaceholder({ journey }: { journey: Journey }) {
  return (
    <div className="rp-chart-placeholder" role="status">
      <p className="rp-chart__readout">{journeySentence(journey)}</p>
      <Skeleton variant="rect" height={240} />
      <VisuallyHidden>Loading the customer temperature chart</VisuallyHidden>
    </div>
  );
}

/** The turn a point shows. The start of the call is before any turn, so it shows the customer's opening. */
const turnOf = (point: JourneyPoint): number => (point.turnIndex === 0 ? 1 : point.turnIndex);

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
 * An important point as a row: the chart's marker for it, the customer's state, whose turn it was
 * and what moved, the reason, and what the customer said next, from the transcript. "Show the exact
 * turn" opens the same panel as the timeline, inline.
 */
function MomentRow({
  moment,
  open,
  panel,
  onToggle,
}: {
  moment: KeyMoment;
  open: boolean;
  panel: Moment;
  onToggle: () => void;
}) {
  const { point, reaction } = moment;
  const band = bandIdFor(point.band) ?? 'calm';
  return (
    <li className="rp-moment">
      <div className="rp-moment__head">
        <MarkerGlyph kind={point.kind} />
        <StateBadge state={band} />
        <p className="rp-moment__title">{moment.title}</p>
      </div>
      {moment.reason ? (
        <Field label="Reason">
          <p className="t-reading">{moment.reason}</p>
        </Field>
      ) : null}
      {reaction ? (
        <Field
          label={
            point.kind === 'start' ? 'Customer opened with' : `Their reply, turn ${reaction.index}`
          }
        >
          <TurnQuote turn={reaction} />
        </Field>
      ) : null}
      <Disclosure
        appearance="inline"
        className="rp-moment__toggle"
        open={open}
        onOpenChange={onToggle}
        summary={
          <>
            {open ? 'Hide the exact turn' : 'Show the exact turn'}{' '}
            <VisuallyHidden>for {moment.heading}</VisuallyHidden>
          </>
        }
      >
        {open ? <EvidencePanel moment={panel} /> : null}
      </Disclosure>
    </li>
  );
}

/**
 * How the customer felt through the call: the temperature as a line over the turns (a chart whose
 * points can be used with the keyboard), then each important point as a row with its state, turn,
 * reason and the customer's reply. Choosing a point on the chart, or a row's button, shows the exact
 * turn in the same panel the timeline uses, and marks the turn in the transcript. The table is the
 * chart's text alternative, with every point and its change.
 */
export function ExperienceSection({ report }: { report: CoachingReport }) {
  const { journey, curveball } = report;
  const { turns } = useEvidence();
  const sync = useTimelineSync();
  const announce = useAnnouncer();
  const printing = usePrinting();
  const moments = useMemo(() => keyMoments(journey, turns), [journey, turns]);
  const rows = useMemo(() => journeyTableRows(journey), [journey]);
  const [chosen, setChosen] = useState<{ turn: number; host: 'chart' | 'row' } | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  const panelFor = (point: JourneyPoint, heading?: string): Moment => {
    const index = journey.points.indexOf(point);
    const previous = index > 0 ? (journey.points[index - 1] ?? null) : null;
    return {
      title: heading ?? pointSummary(previous, point),
      detail: point.reason ? plainUnexpectedTurn(point.reason) : null,
      state: 'seen',
      turnIndex: turnOf(point),
      quote: isVerifiedQuote(turns, point.turnIndex, point.quote) ? point.quote : null,
    };
  };

  const fromChart = (chart: ChartPoint) => {
    const point = journey.points[chart.index];
    if (!point) return;
    const same = chosen?.host === 'chart' && chosen.turn === turnOf(point);
    setChosen(same ? null : { turn: turnOf(point), host: 'chart' });
    if (same) return;
    sync?.pickTurn(turnOf(point));
    announce(`Showing turn ${turnOf(point)}, under the chart.`);
  };

  const fromRow = (moment: KeyMoment) => {
    const turn = turnOf(moment.point);
    const same = chosen?.host === 'row' && chosen.turn === turn;
    setChosen(same ? null : { turn, host: 'row' });
    if (!same) sync?.pickTurn(turn);
  };

  const underChart =
    chosen?.host === 'chart'
      ? journey.points.find((point) => turnOf(point) === chosen.turn)
      : undefined;

  const tableDetails =
    rows.length > 0 ? (
      <details
        className="rp-disclosure"
        open={tableOpen || printing}
        onToggle={(event) => {
          if (!printing) setTableOpen(event.currentTarget.open);
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
                <td>
                  <span className="rp-table__point">
                    <MarkerGlyph kind={row.kind} />
                    {row.kindLabel}
                  </span>
                </td>
                <td>{row.band}</td>
                <td>{row.change}</td>
                <td>{row.reason ?? ''}</td>
                <td>{row.turnIndex > 0 ? <TurnLink turnIndex={row.turnIndex} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    ) : null;

  return (
    <Section
      id="experience"
      title="Customer experience"
      lead="How the customer's mood moved through the call."
    >
      {journey.points.length > 0 ? (
        <div className="rp-journey">
          <div className="rp-journey__chart">
            <Suspense fallback={<ChartPlaceholder journey={journey} />}>
              <JourneyChart
                journey={journey}
                chosenTurn={chosen?.host === 'chart' ? chosen.turn : null}
                onChoose={fromChart}
              />
            </Suspense>
          </div>
          {underChart ? (
            <div className="rp-journey__panel">
              <EvidencePanel moment={panelFor(underChart)} />
            </div>
          ) : null}
          {tableDetails}
        </div>
      ) : (
        <p className="rp-empty">{journeySentence(journey)}</p>
      )}

      {moments.length > 0 ? (
        <>
          <h3 className="rp-subtitle">Important points</h3>
          <ol className="rp-moments" role="list">
            {moments.map((moment) => (
              <MomentRow
                key={`${moment.point.turnIndex}-${moment.point.kind}`}
                moment={moment}
                open={chosen?.host === 'row' && chosen.turn === turnOf(moment.point)}
                panel={panelFor(moment.point, moment.heading)}
                onToggle={() => fromRow(moment)}
              />
            ))}
          </ol>
        </>
      ) : null}

      {curveball ? <UnexpectedTurn curveball={curveball} /> : null}
    </Section>
  );
}
