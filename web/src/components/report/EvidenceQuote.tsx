import { useContext, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../Icon.tsx';
import { ReportTurnsContext, segmentAround } from './turns-context.ts';

export type QuoteTone = 'neutral' | 'positive' | 'accent' | 'caution';

/** The conversation around a cited turn, shown in place. Built only when it is opened. */
function MomentInContext({ turn }: { turn: number }) {
  const turns = useContext(ReportTurnsContext);
  const [open, setOpen] = useState(false);
  if (!turns) return null;
  const segment = segmentAround(turns, turn);
  if (segment.length < 2) return null;
  return (
    <details className="rp-ctx" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="rp-ctx-summary">
        <Icon name="play" size={13} />
        See it in the conversation
      </summary>
      {open ? (
        <ol role="list" className="rp-ctx-list" aria-label={`The conversation around turn ${turn}`}>
          {segment.map((item) => (
            <li
              key={item.index}
              className="rp-ctx-turn"
              data-role={item.role}
              data-cited={item.index === turn ? 'true' : undefined}
              aria-current={item.index === turn ? 'true' : undefined}
            >
              <span className="rp-ctx-who">
                {item.role === 'trainee' ? 'You' : 'Customer'}
                <span className="rp-ctx-n"> · turn {item.index}</span>
              </span>
              <span className="rp-ctx-text">{item.text}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </details>
  );
}

/**
 * A quote from the call with a "Turn N" pill that links to the exact turn in the transcript.
 * Either part can be missing: a turn without a quote, or a quote without a link. Inside a report it
 * can also open the surrounding conversation in place.
 */
export function EvidenceQuote({
  quote,
  turn,
  href,
  label,
  tone = 'neutral',
}: {
  quote?: string | null;
  turn?: number | null;
  href?: string;
  /** Who said it, for example "You said". */
  label?: string;
  tone?: QuoteTone;
}) {
  const hasHead = turn != null || Boolean(label);
  return (
    <figure className={`rp-quote rp-quote-${tone}`}>
      {hasHead ? (
        <figcaption className="rp-quote-head">
          {turn != null ? (
            href ? (
              <Link
                to={href}
                className="rp-turn-pill"
                aria-label={`Turn ${turn}, view in transcript`}
                viewTransition
              >
                Turn {turn}
              </Link>
            ) : (
              <span className="rp-turn-pill">Turn {turn}</span>
            )
          ) : null}
          {label ? <span className="rp-quote-label">{label}</span> : null}
        </figcaption>
      ) : null}
      {quote ? <blockquote className="rp-quote-text">{`\u201c${quote}\u201d`}</blockquote> : null}
      {quote && turn != null ? <MomentInContext turn={turn} /> : null}
    </figure>
  );
}
