import { useLayoutEffect, useRef } from 'react';
import {
  DIMENSION_IDS,
  DIMENSIONS,
  SCORE_DESCRIPTIONS,
  SCORE_LABELS,
  type DimensionId,
} from '#shared/domain/vocab.ts';
import { Icon, slidePip } from '../trainer/bridge.tsx';

export const SCORES = [1, 2, 3, 4, 5] as const;

export const scoreFieldId = (base: string, dimension: DimensionId) => `${base}-${dimension}`;
export const firstScoreInputId = (base: string, dimension: DimensionId) =>
  `${scoreFieldId(base, dimension)}-1`;

/**
 * One skill: its name and what it covers, then a row of numerals 1 to 5 on a hairline. The chosen
 * numeral is full ink with an amber point under it (the point slides from the old choice to the new
 * one), and below the row it is put into words: the label and what it means. It is a radio group
 * of real radio inputs, so arrow keys, Space and screen readers work as they do anywhere; each
 * radio is named "3 - Developing", number and word together.
 */
export function ScoreField({
  idBase,
  dimension,
  value,
  error,
  onChange,
}: {
  idBase: string;
  dimension: DimensionId;
  value: number | undefined;
  error: string | undefined;
  onChange(score: number): void;
}) {
  const meta = DIMENSIONS[dimension];
  const id = scoreFieldId(idBase, dimension);
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const position = DIMENSION_IDS.indexOf(dimension) + 1;
  const describedBy = [`${id}-about`, `${id}-selected`, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  useLayoutEffect(() => {
    const mark = fieldset.current?.querySelector<HTMLElement>('input:checked ~ .cal-score__mark');
    if (!mark) return;
    slidePip(previous.current, mark);
    previous.current = mark;
  }, [value]);

  return (
    <fieldset
      ref={fieldset}
      role="radiogroup"
      className="cal-score"
      aria-labelledby={`${id}-legend`}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      aria-required="true"
      data-invalid={error ? '' : undefined}
    >
      <legend id={`${id}-legend`} className="cal-score__title">
        <span className="cal-score__index type-label" aria-hidden="true">
          {String(position).padStart(2, '0')}
        </span>
        {meta.label}
      </legend>
      <p id={`${id}-about`} className="cal-score__about">
        {meta.description}
      </p>
      <div className="cal-score__opts">
        {SCORES.map((score) => (
          <label key={score} className="cal-score__opt">
            <input
              type="radio"
              id={`${id}-${score}`}
              name={id}
              value={score}
              checked={value === score}
              onChange={() => onChange(score)}
            />
            <span className="cal-score__num" aria-hidden="true">
              {score}
            </span>
            <span className="cal-score__mark" aria-hidden="true" />
            {/* One text node, so the name reads "3 - Developing" however the row is laid out. */}
            <span className="sr-only">{`${score} \u2013 ${SCORE_LABELS[score - 1]}`}</span>
          </label>
        ))}
      </div>
      <p id={`${id}-selected`} className="cal-score__selected">
        {value
          ? `${SCORE_LABELS[value - 1]}: ${SCORE_DESCRIPTIONS[value]}`
          : 'Choose a score from 1 to 5.'}
      </p>
      {error ? (
        <p id={`${id}-error`} className="cal-score__error">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}
