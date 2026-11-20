import { useId, useMemo, useState, type RefObject } from 'react';
import { plural } from '../../lib/format.ts';
import { changeSummary, wordDiff, type DiffSegment } from './wording-diff.ts';

/** A word and the spaces after it: the unit that comes in or goes out without leaving a gap. */
const tokensOf = (text: string): string[] =>
  text.match(/\s*\S+\s*/g) ?? (text === '' ? [] : [text]);

/**
 * A stronger wording counts as an edit of what was said when they share enough: at least three
 * words, and at least two in five of the shorter one's. Anything less in common than that is a
 * different sentence, and marking every word of it as out and in would only be noise.
 */
const MIN_SHARED_WORDS = 3;
const MIN_SHARED_SHARE = 0.4;

export function isEditOf(counts: { kept: number; removed: number; added: number }): boolean {
  const shorter = Math.min(counts.kept + counts.removed, counts.kept + counts.added);
  return (
    counts.kept >= MIN_SHARED_WORDS &&
    shorter > 0 &&
    counts.kept / shorter >= MIN_SHARED_SHARE &&
    (counts.removed > 0 || counts.added > 0)
  );
}

function Line({ segments }: { segments: readonly DiffSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === 'keep' ? (
          <span key={index} className="wd__keep">
            {segment.text}
          </span>
        ) : (
          tokensOf(segment.text).map((token, at) => (
            <span key={`${index}-${at}`} className="wd__word" data-kind={segment.kind}>
              {token}
            </span>
          ))
        ),
      )}
    </>
  );
}

/**
 * A stronger wording, and what it keeps of what was said. When the two share words the stronger
 * wording can be shown as the change it is: words that go out are struck through, words that come
 * in are underlined, and the rest stay put. Selecting the view moves the words (they grow in and
 * shrink out where the browser can animate it, and simply change where it cannot, or when motion is
 * reduced). The plain wording is always in the page for screen readers and for copying, and the
 * marks are words as well as shapes: the counts and a legend say what the strokes mean. When the
 * two have little in common, or there was nothing said, it is just the wording.
 */
export function WordingDiff({
  before,
  after,
  textRef,
}: {
  /** What was said, or null when the gap was something that never happened. */
  before: string | null;
  after: string;
  /** The plain text, so a failed copy can select it. */
  textRef?: RefObject<HTMLParagraphElement | null>;
}) {
  const uid = useId();
  const [changes, setChanges] = useState(false);
  const diff = useMemo(() => (before ? wordDiff(before, after) : []), [before, after]);
  const counts = useMemo(() => changeSummary(diff), [diff]);
  const isEdit = isEditOf(counts);

  if (!isEdit) {
    return (
      <p ref={textRef} className="wd__plain">
        {after}
      </p>
    );
  }

  return (
    <div className="wd" data-view={changes ? 'changes' : 'after'}>
      {/* The words as they will be said: what a screen reader reads, and what is copied. */}
      <p ref={textRef} className="sr-only">
        {after}
      </p>
      <p className="wd__line" aria-hidden="true" id={`${uid}-line`}>
        <Line segments={diff} />
      </p>
      <div className="wd__foot">
        <button
          type="button"
          className="rp-link wd__toggle"
          aria-pressed={changes}
          aria-describedby={`${uid}-counts`}
          onClick={() => setChanges((on) => !on)}
        >
          <span className="wd__mark" aria-hidden="true" />
          Show what changed
        </button>
        <p id={`${uid}-counts`} className="wd__counts">
          {`${plural(counts.kept, 'word')} kept, ${counts.removed} taken out, ${counts.added} put in.`}
          {changes ? ' Struck-through words come out; underlined words go in.' : ''}
        </p>
      </div>
    </div>
  );
}
