import { useContext, useId, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../Icon.tsx';
import { transcriptHref } from './labels.ts';
import { ReportTurnsContext, segmentAround } from './turns-context.ts';

export type QuoteTone = 'neutral' | 'positive' | 'accent' | 'caution';

/**
 * A quote from the call, set as a pull quote on a hairline, with a "Turn N" mark that links to the
 * exact turn in the transcript. Either part can be missing: a turn without a quote, or a quote
 * without a link. Inside a report it can also open the conversation around the quote in place, set
 * the way the transcript sets it (who and which turn in a mono margin, the words beside); that is
 * only built when it is opened, so a report with many quotes costs nothing until someone asks.
 */
export function EvidenceQuote({
  quote,
  turn,
  href,
  label,
  tone = 'neutral',
  sessionId,
}: {
  quote?: string | null;
  turn?: number | null;
  href?: string;
  /** Who said it, for example "You said". */
  label?: string;
  tone?: QuoteTone;
  /** When given, the opened conversation offers a way on into the whole transcript. */
  sessionId?: string;
}) {
  const turns = useContext(ReportTurnsContext);
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const segment = turns && quote && turn != null ? segmentAround(turns, turn) : [];
  const canOpen = segment.length >= 2;
  const hasHead = turn != null || Boolean(label) || canOpen;
  return (
    <figure className="rp-quote" data-tone={tone}>
      {hasHead ? (
        <figcaption className="rp-quote__head">
          <span className="rp-quote__ids">
            {turn != null ? (
              href ? (
                <Link
                  to={href}
                  className="rp-turn"
                  aria-label={`Turn ${turn}, view in transcript`}
                  viewTransition
                >
                  Turn {turn}
                </Link>
              ) : (
                <span className="rp-turn">Turn {turn}</span>
              )
            ) : null}
            {label ? <span className="rp-quote__label">{label}</span> : null}
          </span>
          {canOpen ? (
            <button
              type="button"
              className="rp-ctx__toggle"
              aria-expanded={open}
              aria-controls={regionId}
              onClick={() => setOpen((on) => !on)}
            >
              <span className="rp-ctx__mark" aria-hidden="true" />
              See it in the conversation
            </button>
          ) : null}
        </figcaption>
      ) : null}
      {quote ? <blockquote className="rp-quote__text">{`\u201c${quote}\u201d`}</blockquote> : null}
      <div id={regionId} className="rp-ctx" hidden={!open}>
        {open && turn != null ? (
          <>
            <ol
              role="list"
              className="rp-ctx__list"
              aria-label={`The conversation around turn ${turn}`}
            >
              {segment.map((item) => (
                <li
                  key={item.index}
                  className="rp-ctx__turn"
                  data-role={item.role}
                  data-cited={item.index === turn ? 'true' : undefined}
                  aria-current={item.index === turn ? 'true' : undefined}
                >
                  <span className="rp-ctx__who">
                    {item.role === 'trainee' ? 'You' : 'Customer'}
                    <span className="rp-ctx__n"> · turn {item.index}</span>
                  </span>
                  <span className="rp-ctx__text">{item.text}</span>
                </li>
              ))}
            </ol>
            {sessionId ? (
              <p className="rp-ctx__more">
                <Link to={transcriptHref(sessionId, turn)} className="text-link" viewTransition>
                  Open the whole transcript at turn {turn}
                  <Icon name="arrow-right" size={14} />
                </Link>
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </figure>
  );
}
