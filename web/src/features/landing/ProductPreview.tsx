import { useId } from 'react';
import { DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { Avatar, Badge, Icon, ScoreBar, StateBadge } from '../../design/index.ts';
import './product-preview.css';

// An illustration of one moment in a fictional call: the customer, the live status, a piece of the
// transcript and the start of the coaching. It is built from real text and a little inline SVG, so
// everything can be selected, translated and read at any zoom. Assistive technology meets it as one
// image with a description (the words are all in the page for everyone else), and the caption says
// plainly that it is an example.

const WAVE_HEIGHTS = [
  14, 24, 38, 30, 52, 66, 44, 28, 40, 72, 88, 60, 36, 24, 46, 78, 92, 70, 48, 32, 22, 38, 58, 42,
  26, 16, 22, 12, 18, 10, 14, 8,
];
const BAR = 4;
const STEP = 8;
const WAVE_WIDTH = WAVE_HEIGHTS.length * STEP - (STEP - BAR);
const WAVE_HEIGHT = 40;

/** The skills shown in the coaching strip, with their scores in this fictional call. */
const PREVIEW_SCORES: readonly { id: DimensionId; score: number }[] = [
  { id: 'opening-rapport', score: 4 },
  { id: 'scoping-discovery', score: 5 },
  { id: 'empathy-deescalation', score: 3 },
];

const DESCRIPTION =
  'A call workspace from a fictional call. The customer, Maya Okafor, a front-desk coordinator, is ' +
  'frustrated and getting more so. The customer is speaking. In the transcript Maya says she cannot ' +
  'sign in after changing her password. The engineer asks, "When did it start, and has anything ' +
  'changed on your side recently?" and the call marks that context was found. Maya answers that it ' +
  'began right after the change. Below the call, a coaching preview shows three of six skills: ' +
  'Opening and Rapport 4 of 5, Scoping and Discovery 5 of 5, and Empathy and De-escalation 3 of 5.';

function Waveform() {
  return (
    <svg
      className="pv__wave"
      viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`}
      aria-hidden="true"
      focusable="false"
    >
      {WAVE_HEIGHTS.map((value, index) => {
        const height = 4 + (value / 100) * (WAVE_HEIGHT - 8);
        return (
          <rect
            key={index}
            className="pv__bar"
            x={index * STEP}
            y={(WAVE_HEIGHT - height) / 2}
            width={BAR}
            height={height}
            rx={BAR / 2}
          />
        );
      })}
    </svg>
  );
}

export function ProductPreview() {
  const captionId = useId();
  const descriptionId = useId();
  return (
    <figure className="pv" aria-labelledby={captionId}>
      <div
        className="pv__window"
        role="img"
        aria-label="Preview of a call workspace"
        aria-describedby={descriptionId}
      >
        <div className="pv__person">
          <span className="pv__avatar">
            <Avatar name="Maya Okafor" size="lg" />
          </span>
          <div className="pv__who">
            <p className="pv__name">Maya Okafor</p>
            <p className="pv__role">Front-desk coordinator</p>
          </div>
          <StateBadge state="frustrated" label="Frustrated, rising" />
        </div>

        <div className="pv__voice">
          <Waveform />
          <p className="pv__status">
            <Icon name="speaker" size={18} />
            <span>The customer is speaking</span>
          </p>
        </div>

        <div className="pv__transcript">
          <p className="t-label">Transcript</p>
          <ul role="list" className="pv__turns">
            <li className="pv__turn">
              <p className="pv__meta">
                <span className="pv__speaker">Maya Okafor</span> <span>0:08</span>
              </p>
              <p className="pv__text">
                I can’t sign in to the staff portal. It stopped letting me in after I changed my
                password this morning.
              </p>
            </li>
            <li className="pv__turn pv__turn--you">
              <p className="pv__meta">
                <span className="pv__speaker">You</span> <span>0:21</span>
              </p>
              <p className="pv__text">
                When did it start, and has anything changed on your side recently?
              </p>
              <p className="pv__marker">
                <Badge tone="success" size="small">
                  Context found
                </Badge>
              </p>
            </li>
            <li className="pv__turn">
              <p className="pv__meta">
                <span className="pv__speaker">Maya Okafor</span> <span>0:34</span>
              </p>
              <p className="pv__text">
                Right after I changed my password, about ten past eight. I need to be in before the
                nine o’clock appointments.
              </p>
            </li>
          </ul>
        </div>

        <div className="pv__coaching">
          <p className="t-label pv__coaching-label">
            <span>Coaching after the call</span>
            <span className="pv__note">Three of six skills shown</span>
          </p>
          <ul role="list" className="pv__scores">
            {PREVIEW_SCORES.map(({ id, score }) => (
              <li key={id} className="pv__score">
                <span className="pv__skill">{DIMENSIONS[id].label}</span>
                <ScoreBar score={score} size="small" />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p id={descriptionId} hidden>
        {DESCRIPTION}
      </p>
      <figcaption id={captionId} className="pv__caption t-meta">
        Example from a fictional call
      </figcaption>
    </figure>
  );
}
