import {
  DIMENSIONS,
  SCORE_DESCRIPTIONS,
  SCORE_LABELS,
  type DimensionId,
} from '#shared/domain/vocab.ts';

export const SCORES = [1, 2, 3, 4, 5] as const;

export const scoreFieldId = (base: string, dimension: DimensionId) => `${base}-${dimension}`;
export const firstScoreInputId = (base: string, dimension: DimensionId) =>
  `${scoreFieldId(base, dimension)}-1`;

/** One skill: its description and a keyboard-operable 1 to 5 radio group with visible labels. */
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
  const describedBy = [`${id}-about`, `${id}-selected`, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <fieldset
      role="radiogroup"
      className="cal-field"
      aria-labelledby={`${id}-legend`}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      aria-required="true"
    >
      <legend id={`${id}-legend`} className="cal-field-title">
        {meta.label}
      </legend>
      <p id={`${id}-about`} className="t-small t-muted">
        {meta.description}
      </p>
      <div className="cal-scale">
        {SCORES.map((score) => (
          <label key={score} className="option cal-choice">
            <input
              type="radio"
              id={`${id}-${score}`}
              name={id}
              value={score}
              checked={value === score}
              onChange={() => onChange(score)}
            />
            <span className="option-check" aria-hidden="true" />
            <span className="cal-choice-num" aria-hidden="true">
              {score}
            </span>
            <span className="cal-choice-name" aria-hidden="true">
              {SCORE_LABELS[score - 1]}
            </span>
            {/* One text node, so the name reads "3 - Developing" however the boxes are laid out. */}
            <span className="sr-only">{`${score} \u2013 ${SCORE_LABELS[score - 1]}`}</span>
          </label>
        ))}
      </div>
      <p id={`${id}-selected`} className="t-small cal-selected">
        {value
          ? `${SCORE_LABELS[value - 1]}: ${SCORE_DESCRIPTIONS[value]}`
          : 'Choose a score from 1 to 5.'}
      </p>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
