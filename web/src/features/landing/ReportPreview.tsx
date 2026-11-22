import { useId, useState, type CSSProperties } from 'react';
import { DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { useInViewOnce } from '../../design/interaction/use-in-view.ts';
import { ScoreBar } from '../../design/primitives/ScoreBar.tsx';
import { useMediaQuery } from '../../lib/hooks.ts';
import { LandingSection } from './LandingSection.tsx';
import { REPORT_FIRST, REPORT_PREVIEW, REPORT_ROWS } from './landing-copy.ts';
import './report-preview.css';

// The scores follow once the card's top is a little way up the window, so the order is seen.
const IN_VIEW = '0px 0px -15% 0px';

/**
 * A small report that shows its evidence before its scores. On the left, one thing the trainee said,
 * with its turn and what the coaching made of it; on the right, the six skills as one choice. The
 * quote belongs to the skill that is chosen: pointing at a row (a mouse), or moving to it (a keyboard,
 * a tap), puts that row's words in the evidence. When the card first scrolls into view the evidence
 * lands, and the scores follow it, one after another. Under reduced motion everything is there at
 * once. Every word and score is in the document throughout. It is captioned as an example.
 */
export function ReportPreview() {
  const group = useId();
  const evidenceId = useId();
  const captionId = useId();
  const [card, seen] = useInViewOnce<HTMLDivElement>({ rootMargin: IN_VIEW });
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const revealed = seen || reduced;
  const [active, setActive] = useState<DimensionId>(REPORT_FIRST);

  return (
    <LandingSection id="evidence" title={REPORT_PREVIEW.title} lead={REPORT_PREVIEW.lead}>
      <figure className="lp-rp" aria-labelledby={captionId}>
        <div ref={card} className="lp-rp__card" data-revealed={revealed ? '' : undefined}>
          <div id={evidenceId} className="lp-rp__evidence">
            <p className="lp-rp__label">{REPORT_PREVIEW.evidence}</p>
            {/* The words of all six skills share one cell, so the card is as tall as the longest of
                them and nothing below it moves when the choice changes. Only the chosen words are
                seen, read out and reachable. */}
            <div className="lp-rp__stack">
              {REPORT_ROWS.map((row) => {
                const chosen = row.skill === active;
                return (
                  <div
                    key={row.skill}
                    className="lp-rp__linked"
                    data-active={chosen ? '' : undefined}
                    aria-hidden={chosen ? undefined : true}
                    inert={!chosen}
                  >
                    <p className="lp-rp__meta">
                      <span className="lp-rp__turn">Turn {row.turn}</span>
                      <span className="lp-rp__who">You</span>
                    </p>
                    <blockquote className="lp-rp__quote">
                      <p>{row.quote}</p>
                    </blockquote>
                    <div className="lp-rp__noted">
                      <p className="lp-rp__label">{REPORT_PREVIEW.coaching}</p>
                      <p className="lp-rp__note">{row.note}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <fieldset className="lp-rp__skills">
            <legend className="lp-rp__label">{REPORT_PREVIEW.skills}</legend>
            <ul className="lp-rp__rows" role="list">
              {REPORT_ROWS.map((row, index) => (
                <li key={row.skill} className="lp-rp__item">
                  <label
                    className="lp-rp__row"
                    data-active={active === row.skill ? '' : undefined}
                    style={{ '--i': index } as CSSProperties}
                    onPointerEnter={(event) => {
                      // A mouse points at a row to see its words; touch and pen choose by tapping.
                      if (event.pointerType === 'mouse') setActive(row.skill);
                    }}
                  >
                    <input
                      type="radio"
                      className="visually-hidden lp-rp__input"
                      name={group}
                      value={row.skill}
                      checked={active === row.skill}
                      aria-describedby={evidenceId}
                      onChange={() => setActive(row.skill)}
                    />
                    <span className="lp-rp__skill">{DIMENSIONS[row.skill].label}</span>
                    <span className="lp-rp__at">Turn {row.turn}</span>
                    <span className="lp-rp__score">
                      <ScoreBar score={row.score} size="small" />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>
        <figcaption id={captionId} className="lp-rp__caption">
          {REPORT_PREVIEW.caption}
        </figcaption>
      </figure>
    </LandingSection>
  );
}
