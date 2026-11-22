import { memo, type ReactNode } from 'react';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { cx } from '../../design/cx.ts';
import { Icon } from '../../design/icons.tsx';
import { accentClass } from '../../design/product-accent.ts';
import { Avatar } from '../../design/primitives/Avatar.tsx';
import { StateBadge } from '../../design/primitives/Badge.tsx';
import { ProductIcon } from '../../design/primitives/ProductIcon.tsx';
import { ScoreBar } from '../../design/primitives/ScoreBar.tsx';
import { callStatus, type PreviewExample, type PreviewFrame } from './preview-script.ts';
import { Waveform } from './Waveform.tsx';
import './call-preview.css';

// What the call preview shows for one example at one moment. It is a picture of a frame and holds no
// state: the player decides which frame, this draws it. Everything moves by changing a class or an
// attribute, and every word is in the document at every moment, whether or not it can be seen yet.

const Transcript = memo(function Transcript({
  example,
  shown,
}: {
  example: PreviewExample;
  shown: number;
}) {
  return (
    <ol className="lp-call__lines" role="list">
      {example.lines.map((line, index) => (
        <li
          key={index}
          className="lp-line"
          data-speaker={line.speaker}
          data-shown={index < shown ? '' : undefined}
        >
          <span className="lp-line__who">
            {line.speaker === 'customer' ? example.customer.name : 'You'}
          </span>
          <span className="lp-line__text">{line.text}</span>
        </li>
      ))}
    </ol>
  );
});

/** The report the card turns into: the words each score rests on first, then the score. */
const MiniReport = memo(function MiniReport({
  example,
  quotes,
  scores,
}: {
  example: PreviewExample;
  quotes: number;
  scores: number;
}) {
  return (
    <div className="lp-face lp-face--report">
      <p className="lp-mini__label">After the call</p>
      <ul className="lp-mini__rows" role="list">
        {example.report.map((row, index) => (
          <li
            key={row.skill}
            className="lp-mini__row"
            data-quoted={index < quotes ? '' : undefined}
            data-scored={index < scores ? '' : undefined}
          >
            <p className="lp-mini__skill">{DIMENSIONS[row.skill].short}</p>
            <p className="lp-mini__quote">
              <span className="lp-mini__turn">Turn {row.turn}</span> <q>{row.quote}</q>
            </p>
            <span className="lp-mini__score">
              <ScoreBar score={row.score} size="small" animate={index < scores} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});

export interface PreviewPanelProps {
  example: PreviewExample;
  frame: PreviewFrame;
  /** Milliseconds into the loop, for the waveform. */
  t: number;
  /** The control that pauses and plays the preview: only the panel that is playing has one. */
  action?: ReactNode;
}

/**
 * One example as a call window: the product, the customer and how they feel, their voice, the words
 * so far and, when the call has ended, the report that follows it. Below the two faces, the microphone
 * indicators and the one control. The moving parts (the state, the waveform, the indicators) are
 * hidden from assistive technology; the product, the person, the transcript and the report are not.
 */
export function PreviewPanel({ example, frame, t, action }: PreviewPanelProps) {
  const status = callStatus(frame);
  return (
    <div
      className="lp-panel"
      data-phase={frame.report ? 'report' : 'call'}
      data-speaking={frame.speaking ?? 'nobody'}
    >
      <div className="lp-panel__stage">
        <div className="lp-face lp-face--call">
          <div className="lp-call__head">
            <p className="lp-call__product">
              <span className={cx('lp-call__tile', accentClass(example.product))}>
                <ProductIcon product={example.product} size={18} />
              </span>
              {example.productName}
            </p>
            <span className="lp-call__mood" aria-hidden="true">
              <span key={frame.state} className="lp-call__swap">
                <StateBadge state={frame.state} size="small" />
              </span>
            </span>
          </div>

          <div className="lp-call__person">
            <span className="lp-call__avatar">
              <Avatar name={example.customer.name} size="md" />
            </span>
            <div className="lp-call__who">
              <p className="lp-call__name">{example.customer.name}</p>
              <p className="lp-call__role">{example.customer.role}</p>
            </div>
          </div>

          <div className="lp-call__voice" aria-hidden="true">
            {/* A wave at rest is the same at every moment, so it is not told the time and does not redraw. */}
            <Waveform t={frame.level > 0 ? t : 0} level={frame.level} />
            <p className="lp-call__state" data-state={status}>
              <span className="lp-call__dot" />
              <span key={status} className="lp-call__swap">
                {status}
              </span>
            </p>
          </div>

          <Transcript example={example} shown={frame.shown} />
        </div>

        <MiniReport example={example} quotes={frame.quotes} scores={frame.scores} />
      </div>

      <div className="lp-panel__foot">
        <span className="lp-panel__indicators" aria-hidden="true">
          <span
            className="lp-ind lp-ind--mic"
            data-live={frame.speaking === 'trainee' ? '' : undefined}
          >
            <Icon name="microphone" size={16} />
          </span>
          <span className="lp-ind lp-ind--mute">
            <Icon name="microphone-off" size={16} />
          </span>
        </span>
        {action}
      </div>
    </div>
  );
}
