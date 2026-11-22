import { useId, useMemo, useState, type ReactNode } from 'react';
import type { CareBehaviourResult, CareLevel } from '#shared/domain/report.ts';
import { Badge, Icon, cx, type BadgeTone, type IconName } from '../../design/index.ts';
import {
  BEHAVIOUR_STATUS_WORDS,
  CARE_LEVEL_WORDS,
  INSUFFICIENT_EVIDENCE,
  SUFFICIENCY_WORDS,
  clampWords,
  type Sufficiency,
} from './copy.ts';
import { TurnLink, useEvidence } from './evidence.tsx';
import type { EvidenceTurn } from './evidence-model.ts';
import { usePrinting } from './print.tsx';
import { locateQuote, segmentText } from './transcript-model.ts';
import './report.css';

/**
 * A titled part of the report. Its heading can take focus (when a link jumps here) and its
 * `data-rp-origin` is what "Back to ..." calls it after an evidence link was followed from inside.
 */
export function Section({
  id,
  title,
  lead,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  /** One short line under the heading that says what the part is for. */
  lead?: ReactNode;
  /** A control for the whole part, at the end of its heading row ("Expand all"). */
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cx('rp-section', className)}
      data-rp-origin={title}
    >
      <header className="rp-section__head">
        <h2 id={`${id}-title`} className="rp-section__title" tabIndex={-1} data-rp-heading>
          {title}
        </h2>
        {aside ? <div className="rp-section__aside no-print">{aside}</div> : null}
      </header>
      {lead ? <p className="rp-section__lead">{lead}</p> : null}
      {children}
    </section>
  );
}

/** A small label and the text it names, one under the other. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('rp-field', className)}>
      <p className="rp-field__label">{label}</p>
      <div className="rp-field__text">{children}</div>
    </div>
  );
}

/**
 * What stands where a quote would be when the transcript does not back one. It says so plainly and
 * never offers words in their place.
 */
export function InsufficientEvidence({ note, className }: { note?: string; className?: string }) {
  return (
    <p className={cx('rp-noevidence', className)}>
      <Icon name="info" size={16} />
      <span>
        <span className="rp-noevidence__title">{INSUFFICIENT_EVIDENCE}</span>
        {note ? <> {note}</> : null}
      </span>
    </p>
  );
}

/**
 * Words the trainee said, set apart as evidence: the exact text, and a link to the turn it came
 * from in the transcript. A quote is only shown when the turn it names says it; otherwise the page
 * says "Insufficient evidence" and shows no words at all.
 */
export function Quote({
  quote,
  turnIndex,
  className,
}: {
  quote: string;
  turnIndex: number | null;
  className?: string;
}) {
  const { verify } = useEvidence();
  if (!verify(turnIndex, quote)) {
    return <InsufficientEvidence className={className} />;
  }
  return (
    <figure className={cx('rp-quote', className)}>
      <blockquote className="rp-quote__text">
        <p className="t-quote">{`\u201c${quote}\u201d`}</p>
      </blockquote>
      {turnIndex !== null ? (
        <figcaption className="rp-quote__foot">
          <span className="rp-quote__who">You</span>{' '}
          <TurnLink turnIndex={turnIndex} quote={quote} />
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * A turn's words with the quoted ones marked. The text is the turn's, whole and unchanged: the mark
 * is drawn over it. With no quote, or one the turn does not say, nothing is marked.
 */
export function QuotedText({ text, quote }: { text: string; quote: string | null }) {
  const parts = useMemo(() => {
    const located = quote ? locateQuote(text, quote) : null;
    return located ? segmentText(text, [{ ...located, kind: 'quote' as const }]) : null;
  }, [text, quote]);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) =>
        part.quote ? (
          <mark key={index} className="rp-mark rp-mark--quote">
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

/** The skill an item is about, as a small label above its title. */
export const SkillTag = ({ children }: { children: ReactNode }) => (
  <p className="rp-skilltag">{children}</p>
);

/**
 * A turn of the call quoted whole, with who said it and a link to it. It is the transcript's own
 * text (the customer's reply, for example), so there is nothing to check it against.
 */
export function TurnQuote({ turn, className }: { turn: EvidenceTurn; className?: string }) {
  return (
    <figure className={cx('rp-quote', className)}>
      <blockquote className="rp-quote__text">
        <p className="t-quote" dir="auto">{`\u201c${turn.text}\u201d`}</p>
      </blockquote>
      <figcaption className="rp-quote__foot">
        <span className="rp-quote__who">{turn.speaker}</span> <TurnLink turnIndex={turn.index} />
      </figcaption>
    </figure>
  );
}

const SUFFICIENCY_ICON: Record<Sufficiency, { icon: IconName; tone: BadgeTone }> = {
  sufficient: { icon: 'check-circle', tone: 'success' },
  limited: { icon: 'warning', tone: 'warning' },
  insufficient: { icon: 'info', tone: 'neutral' },
};

/** How firm a score is: an icon and words, never a colour alone. */
export function EvidenceTag({
  value,
  size = 'small',
}: {
  value: Sufficiency;
  size?: 'small' | 'medium';
}) {
  const { icon, tone } = SUFFICIENCY_ICON[value];
  return (
    <Badge tone={tone} icon={icon} size={size}>
      {SUFFICIENCY_WORDS[value]}
    </Badge>
  );
}

const LEVEL_LOOK: Record<CareLevel, { tone: BadgeTone; icon: IconName }> = {
  strong: { tone: 'success', icon: 'check-circle' },
  developing: { tone: 'info', icon: 'trend-up' },
  'not-yet': { tone: 'warning', icon: 'flag' },
  'limited-evidence': { tone: 'neutral', icon: 'info' },
};

export function LevelBadge({ level }: { level: CareLevel }) {
  const { tone, icon } = LEVEL_LOOK[level];
  return (
    <Badge tone={tone} icon={icon}>
      {CARE_LEVEL_WORDS[level]}
    </Badge>
  );
}

const BEHAVIOUR_LOOK: Record<CareBehaviourResult['status'], { tone: BadgeTone; icon: IconName }> = {
  shown: { tone: 'success', icon: 'check-circle' },
  partly: { tone: 'info', icon: 'minus' },
  'not-shown': { tone: 'neutral', icon: 'x' },
};

export function BehaviourBadge({ status }: { status: CareBehaviourResult['status'] }) {
  const { tone, icon } = BEHAVIOUR_LOOK[status];
  return (
    <Badge tone={tone} icon={icon} size="small">
      {BEHAVIOUR_STATUS_WORDS[status]}
    </Badge>
  );
}

/**
 * Text kept to a word budget at first, with the rest behind "Show more". Nothing is removed: a
 * longer text from the evaluator is complete once opened (and always complete on paper).
 */
export function ClampedText({
  text,
  budget,
  budgetKey,
  className,
}: {
  text: string;
  budget: number;
  /** Names the budget this text is held to, so it can be measured in a test or a probe. */
  budgetKey?: string;
  className?: string;
}) {
  const { shown, full, clamped } = useMemo(() => clampWords(text, budget), [text, budget]);
  const [open, setOpen] = useState(false);
  const printing = usePrinting();
  const id = useId();
  const expanded = open || printing;
  return (
    <>
      <p id={id} className={className} data-budget={budgetKey}>
        {expanded ? full : shown}
      </p>
      {clamped ? (
        <button
          type="button"
          className="rp-more no-print"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </>
  );
}
