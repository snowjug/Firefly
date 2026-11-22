import type { ReactNode } from 'react';
import { Button } from '../../design/index.ts';
import { useEvidence } from './evidence.tsx';
import { turnContext, type EvidenceTurn } from './evidence-model.ts';
import type { EventState } from './events-model.ts';
import { InsufficientEvidence, QuotedText } from './parts.tsx';
import './timeline.css';

/** A moment to look at: what it is, and the turn (and the words in it) that show it. */
export interface Moment {
  /** "Greeting", "Turn 4". */
  title: string;
  /** Under the title: the fact found, or how the customer's mood moved. */
  detail?: ReactNode;
  state: EventState;
  turnIndex: number | null;
  /** The trainee's words to mark in the turn. Only ever a quote the transcript backs. */
  quote: string | null;
}

function Neighbour({ turn, label }: { turn: EvidenceTurn; label: string }) {
  return (
    <div className="rp-ev__turn rp-ev__turn--near">
      <p className="rp-ev__who">
        <span className="rp-ev__side">{label}</span>
        <span>
          Turn {turn.index}, {turn.speaker}
        </span>
      </p>
      <p className="rp-ev__text rp-ev__text--near" dir="auto">
        {turn.text}
      </p>
    </div>
  );
}

/**
 * The exact turn that shows a moment: who said it, when, and the words, with the quoted ones marked,
 * and the turn before and the turn after for the sense of it. The words are the transcript's own and
 * are never edited. A moment that was not seen says so; one the transcript does not confirm says
 * "Insufficient evidence" and shows nothing as evidence. "Open in transcript" goes to the turn in the
 * full transcript.
 */
export function EvidencePanel({ moment }: { moment: Moment }) {
  const { turns, goToTurn } = useEvidence();
  const { title, detail, state, turnIndex, quote } = moment;
  const context = state === 'seen' && turnIndex !== null ? turnContext(turns, turnIndex) : null;

  return (
    <div className="rp-ev" data-state={state}>
      <p className="rp-ev__title">{title}</p>
      {detail ? <p className="rp-ev__detail">{detail}</p> : null}
      {context ? (
        <>
          <div className="rp-ev__turns">
            {context.previous ? <Neighbour turn={context.previous} label="Before" /> : null}
            <div className="rp-ev__turn rp-ev__turn--current" key={context.turn.index}>
              <p className="rp-ev__who">
                <span>{context.turn.speaker}</span>
                <span>Turn {context.turn.index}</span>
                <span className="rp-ev__clock">
                  <span className="visually-hidden">at </span>
                  {context.turn.clock}
                </span>
              </p>
              <p className="rp-ev__text t-reading" dir="auto">
                <QuotedText text={context.turn.text} quote={quote} />
              </p>
            </div>
            {context.next ? <Neighbour turn={context.next} label="After" /> : null}
          </div>
          <div className="rp-ev__actions no-print">
            <Button
              size="small"
              icon="arrow-down"
              onClick={(event) => goToTurn(context.turn.index, quote, event.currentTarget)}
            >
              Open in transcript
            </Button>
          </div>
        </>
      ) : state === 'unverified' ? (
        <InsufficientEvidence note="The transcript does not confirm what the report says about this moment." />
      ) : (
        <p className="rp-ev__none">Not reached in this call.</p>
      )}
    </div>
  );
}
