import { Link } from 'react-router';

export type QuoteTone = 'neutral' | 'positive' | 'accent' | 'caution';

/**
 * A quote from the call with a "Turn N" pill that links to the exact turn in the transcript.
 * Either part can be missing: a turn without a quote, or a quote without a link.
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
    </figure>
  );
}
