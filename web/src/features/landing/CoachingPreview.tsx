import { useId } from 'react';
import {
  DIMENSION_IDS,
  DIMENSIONS,
  temperatureBand,
  type DimensionId,
} from '#shared/domain/vocab.ts';
import { Badge, ScoreBar, StateBadge, Tag } from '../../design/index.ts';
import './coaching-preview.css';

// A miniature of the coaching report, built from the real report's ingredients and the real names of
// the six skills and the score words, using a fictional call. It is real text, so it can be read at any
// zoom; the mood trace is drawn, with the same facts in a table for assistive technology.

const SCORES: Record<DimensionId, number> = {
  'opening-rapport': 4,
  'scoping-discovery': 5,
  'empathy-deescalation': 3,
  clarity: 4,
  'ownership-next-steps': 3,
  closing: 4,
};

/** The customer's temperature (0 to 100) at moments of the fictional call. */
const TRACE = [
  { turn: 0, moment: 'Start', temperature: 52 },
  { turn: 4, moment: 'Turn 4', temperature: 47 },
  { turn: 6, moment: 'Turn 6', temperature: 64 },
  { turn: 8, moment: 'Turn 8', temperature: 46 },
  { turn: 12, moment: 'End', temperature: 31 },
] as const;
const LAST_TURN = 12;
const FIELD_HEIGHT = 120;

/** The five states, hottest at the top, as the trace labels them. */
const AXIS = ['Escalating', 'Angry', 'Frustrated', 'Concerned', 'Calm'] as const;

const placed = TRACE.map((item) => ({
  ...item,
  x: (item.turn / LAST_TURN) * 100,
  y: ((100 - item.temperature) / 100) * FIELD_HEIGHT,
  state: temperatureBand(item.temperature),
}));
const first = placed[0];
const last = placed[placed.length - 1];
const peak = placed.reduce((hottest, item) =>
  item.temperature > hottest.temperature ? item : hottest,
);

const at = (x: number, y: number) => ({
  insetInlineStart: `${x}%`,
  insetBlockStart: `${(y / FIELD_HEIGHT) * 100}%`,
});

function TemperatureTrace() {
  return (
    <div className="cr__block">
      <p className="t-label">How the customer’s mood moved</p>
      <div className="cr__plot" aria-hidden="true">
        <ul role="list" className="cr__axis">
          {AXIS.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <div className="cr__field">
          <svg viewBox={`0 0 100 ${FIELD_HEIGHT}`} preserveAspectRatio="none" focusable="false">
            {[1, 2, 3, 4].map((row) => (
              <line
                key={row}
                className="cr__rule"
                x1="0"
                x2="100"
                y1={(row * FIELD_HEIGHT) / 5}
                y2={(row * FIELD_HEIGHT) / 5}
              />
            ))}
            <polyline
              className="cr__line"
              points={placed.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
            />
          </svg>
          {placed.map((item) => (
            <span
              key={item.moment}
              className={
                item === first || item === last
                  ? `cr__dot cr__dot--end cr__dot--${item.state.id}`
                  : 'cr__dot'
              }
              style={at(item.x, item.y)}
            />
          ))}
          <span className="cr__peak" style={at(peak.x, peak.y)}>
            {peak.moment}
          </span>
        </div>
      </div>
      {first && last ? (
        <p className="cr__ends">
          <span className="cr__end">
            Start
            <StateBadge state={first.state.id} size="small" />
          </span>
          <span className="cr__end">
            End
            <StateBadge state={last.state.id} size="small" />
          </span>
        </p>
      ) : null}
      <table className="visually-hidden">
        <caption>Customer mood through the fictional call</caption>
        <thead>
          <tr>
            <th scope="col">Moment</th>
            <th scope="col">Customer state</th>
          </tr>
        </thead>
        <tbody>
          {placed.map((item) => (
            <tr key={item.moment}>
              <th scope="row">{item.moment}</th>
              <td>{item.state.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CoachingPreview() {
  const captionId = useId();
  const factsId = useId();
  return (
    <figure className="cr" aria-labelledby={captionId}>
      <div className="cr__sheet">
        <div className="cr__head">
          <p className="cr__title">Coaching report</p>
          <Badge tone="ai">Written by the coaching evaluator</Badge>
        </div>

        <div className="cr__grid">
          <div className="cr__col">
            <table className="cr__scores">
              <caption className="t-label">Six coaching skills, each scored from 1 to 5</caption>
              <tbody>
                {DIMENSION_IDS.map((id) => (
                  <tr key={id}>
                    <th scope="row">{DIMENSIONS[id].label}</th>
                    <td>
                      <ScoreBar score={SCORES[id]} size="small" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TemperatureTrace />
          </div>

          <div className="cr__col">
            <div className="cr__block">
              <p className="t-label">What went well</p>
              <p>
                <Tag size="small">{DIMENSIONS['scoping-discovery'].label}</Tag>
              </p>
              <blockquote className="cr__quote">
                <p className="t-quote">
                  <q>When did it start, and has anything changed on your side recently?</q>
                </p>
                <p className="t-meta">Turn 4</p>
              </blockquote>
              <p className="cr__body">
                <strong>Why it worked.</strong> An open question about timing and recent changes
                gave the customer room to explain what happened first.
              </p>
            </div>

            <div className="cr__block">
              <p className="t-label">What to improve</p>
              <p>
                <Tag size="small">{DIMENSIONS['empathy-deescalation'].label}</Tag>
              </p>
              <blockquote className="cr__quote cr__quote--plain">
                <p className="cr__body">
                  <span className="t-meta">You said at turn 6</span>
                  <br />
                  <q>Let’s try resetting it again.</q>
                </p>
              </blockquote>
              <div className="cr__suggest">
                <p className="cr__suggest-label">Try saying</p>
                <p className="cr__body">
                  <q>
                    I can hear this is holding up your morning. Let me find out what is happening
                    before we reset anything.
                  </q>
                </p>
              </div>
            </div>

            <div className="cr__block">
              <p className="t-label" id={factsId}>
                Facts you found and missed
              </p>
              <ul role="list" className="cr__facts" aria-labelledby={factsId}>
                <li className="cr__fact">
                  <Badge tone="success" size="small">
                    Found
                  </Badge>
                  <div>
                    <p className="cr__fact-title">Started right after the password change</p>
                    <p className="cr__fact-note">Revealed at turn 4 by your question.</p>
                  </div>
                </li>
                <li className="cr__fact">
                  <Badge tone="warning" size="small">
                    Missed
                  </Badge>
                  <div>
                    <p className="cr__fact-title">
                      Already tried several times, including a colleague
                    </p>
                    <p className="cr__fact-note">
                      A question worth asking:{' '}
                      <q>What have you already tried, and what happened each time?</q>
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <figcaption id={captionId} className="cr__caption t-meta">
        Illustration using a fictional call. A real report is built from your own transcript.
      </figcaption>
    </figure>
  );
}
