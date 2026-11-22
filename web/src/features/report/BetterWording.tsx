import { Fragment, useMemo } from 'react';
import { VisuallyHidden, useInViewOnce } from '../../design/index.ts';
import { WORDING_ABOUT } from './copy.ts';
import { diffWords, type DiffRun } from './diff-model.ts';
import { prefersReducedMotion } from './dom.ts';
import { ClampedText, InsufficientEvidence } from './parts.tsx';
import type { Wording } from './report-model.ts';
import './wording.css';

/** The most words the reason a wording is stronger shows before "Show more". */
export const WORDING_WORDS = 30;

const HIDDEN_LABEL = { removed: 'Removed: ', added: 'Added: ' } as const;

/**
 * One side of the comparison, word by word. A removed or added run is a real `<del>` or `<ins>`
 * (struck through or underlined, and tinted), with its own words "Removed:" or "Added:" for a
 * screen reader. The transcript is not touched: this is a picture of the difference.
 */
function Runs({ runs }: { runs: readonly DiffRun[] }) {
  return (
    <>
      {runs.map((run, index) => {
        if (run.kind === 'same') {
          return (
            <Fragment key={index}>
              {run.text}
              {run.gap}
            </Fragment>
          );
        }
        const Mark = run.kind === 'removed' ? 'del' : 'ins';
        return (
          <Fragment key={index}>
            <Mark className="rp-bw__mark">
              <VisuallyHidden>{HIDDEN_LABEL[run.kind]}</VisuallyHidden>
              {run.text}
            </Mark>
            {run.gap}
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * What was said and what could be said instead, as a stacked pair: "You said" with the words that
 * went marked as removed, "Try" with the words that came marked as added, a key for the marks that
 * are there and one line on why the new wording is stronger. A line at the top says what the block
 * is. When nothing was said (a gap) the whole new sentence is added. The two lines come in with a
 * short spring the first time they scroll into view; with reduced motion they are simply there.
 */
export function BetterWording({ wording, why }: { wording: Wording; why: string }) {
  const { original, improved, state } = wording;
  const diff = useMemo(
    () => (state === 'unverified' ? null : diffWords(original ?? '', improved)),
    [original, improved, state],
  );
  const hasRemoved = diff?.before.some((run) => run.kind === 'removed') ?? false;
  const hasAdded = diff?.after.some((run) => run.kind === 'added') ?? false;
  const [ref, seen] = useInViewOnce<HTMLDivElement>();
  const revealed = seen || prefersReducedMotion();
  return (
    <div
      className="rp-bw"
      role="group"
      aria-label="Better wording"
      ref={ref}
      data-revealed={revealed ? '' : undefined}
    >
      <p className="rp-bw__about">{WORDING_ABOUT}</p>
      <div className="rp-bw__line rp-bw__line--before">
        <p className="rp-bw__label">You said</p>
        {state === 'said' && diff ? (
          <p className="rp-bw__text" dir="auto">
            {'\u201c'}
            <Runs runs={diff.before} />
            {'\u201d'}
          </p>
        ) : state === 'omitted' ? (
          <p className="rp-bw__none">Not said in this call</p>
        ) : (
          <InsufficientEvidence />
        )}
      </div>
      <div className="rp-bw__line rp-bw__line--after">
        <p className="rp-bw__label">Try</p>
        <p className="rp-bw__text" dir="auto">
          {'\u201c'}
          {diff ? <Runs runs={diff.after} /> : improved}
          {'\u201d'}
        </p>
      </div>
      {hasRemoved || hasAdded ? (
        <p className="rp-bw__legend" aria-hidden="true">
          {hasRemoved ? <span className="rp-bw__key">Struck through: removed</span> : null}
          {hasAdded ? <span className="rp-bw__key">Underlined: added</span> : null}
        </p>
      ) : null}
      <ClampedText className="rp-bw__why" text={why} budget={WORDING_WORDS} whole />
    </div>
  );
}
