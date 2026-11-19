import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { LedgerEntryDTO } from '#shared/domain/api.ts';
import { formatDate } from '../../lib/format.ts';
import { reportHref, transcriptHref } from '../report/labels.ts';
import { LEDGER_PAGE } from './rewards-model.ts';

/** The server lists at most this many entries; the total points always count every one. */
const SERVER_LEDGER_LIMIT = 200;

function Entry({ entry }: { entry: LedgerEntryDTO }) {
  const quote = entry.evidence?.quote?.trim() ? entry.evidence.quote : null;
  const turn = entry.evidence?.turnIndex ?? null;
  return (
    <li className="rw-entry" tabIndex={-1}>
      <p className="rw-entry-points tabular">
        <span aria-hidden="true">+{entry.points}</span>
        <span className="sr-only">{entry.points} points</span>
      </p>
      <div className="rw-entry-body">
        <div className="rw-entry-head">
          <p className="rw-entry-title">{entry.title}</p>
          <time className="rw-meta" dateTime={entry.at}>
            {formatDate(entry.at)}
          </time>
        </div>
        <p className="rw-entry-reason">{entry.reason}</p>
        {entry.sessionId && entry.scenarioTitle ? (
          <p className="rw-meta">
            Call:{' '}
            <Link to={reportHref(entry.sessionId)} viewTransition>
              {entry.scenarioTitle}
            </Link>
          </p>
        ) : null}
        {quote ? (
          <blockquote className="rw-quote">
            <p>
              <span className="sr-only">Quote from the call: </span>
              &ldquo;{quote}&rdquo;
            </p>
            {entry.sessionId && turn ? (
              <p className="rw-meta">
                <Link to={transcriptHref(entry.sessionId, turn)} viewTransition>
                  Turn {turn} in the transcript
                </Link>
              </p>
            ) : null}
          </blockquote>
        ) : null}
      </div>
    </li>
  );
}

/** Every award, newest first, each with the reason and, where there is one, the moment it came from. */
export function PointsHistory({ ledger }: { ledger: readonly LedgerEntryDTO[] }) {
  const [visible, setVisible] = useState(LEDGER_PAGE);
  const list = useRef<HTMLOListElement>(null);
  const focusFrom = useRef<number | null>(null);

  // After "Show more", focus lands on the first new entry, so the control that was pressed can go
  // away without leaving keyboard focus behind.
  useEffect(() => {
    const index = focusFrom.current;
    if (index === null) return;
    focusFrom.current = null;
    (list.current?.children[index] as HTMLElement | undefined)?.focus();
  }, [visible]);

  if (ledger.length === 0) {
    return (
      <p className="glass rw-history-empty">
        Nothing here yet. Every point you earn is listed here with the reason it was awarded.
      </p>
    );
  }

  const shown = Math.min(visible, ledger.length);
  const showMore = () => {
    focusFrom.current = shown;
    setVisible(shown + LEDGER_PAGE);
  };
  return (
    <div className="glass rw-history">
      <ol role="list" className="rw-entries" ref={list}>
        {ledger.slice(0, shown).map((entry) => (
          <Entry key={entry.id} entry={entry} />
        ))}
      </ol>
      <div className="rw-history-foot">
        <p className="rw-meta" role="status">
          Showing {shown} of {ledger.length} {ledger.length === 1 ? 'entry' : 'entries'}
        </p>
        {shown < ledger.length ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={showMore}>
            Show more
          </button>
        ) : null}
      </div>
      {ledger.length >= SERVER_LEDGER_LIMIT ? (
        <p className="rw-meta">
          Your newest {SERVER_LEDGER_LIMIT} entries are listed. Your total counts every entry.
        </p>
      ) : null}
    </div>
  );
}
