import {
  CARE_LABELS,
  DIMENSION_IDS,
  DIMENSIONS,
  SCORE_DESCRIPTIONS,
  SCORE_LABELS,
} from '#shared/domain/vocab.ts';

const SCORES = [1, 2, 3, 4, 5] as const;

/** The six coaching dimensions, straight from the shared vocabulary the evaluator also uses. */
export function DimensionCards() {
  return (
    <ol role="list" className="ab-dimensions">
      {DIMENSION_IDS.map((id, index) => {
        const dimension = DIMENSIONS[id];
        return (
          <li key={id} className="ab-dimension">
            <div className="ab-dimension-head">
              <span className="ab-dimension-number" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="ab-dimension-title">{dimension.label}</h3>
            </div>
            <p className="t-small t-muted">{dimension.description}</p>
            <ul role="list" className="cluster ab-care" aria-label="CARE behaviours">
              {dimension.care.map((behaviour) => (
                <li key={behaviour} className="chip">
                  {CARE_LABELS[behaviour]}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** The 1 to 5 scale with the descriptors scorers and the evaluator both use. */
export function ScaleList() {
  return (
    <dl className="ab-scale">
      {SCORES.map((score) => (
        <div key={score}>
          <dt>
            {score} &ndash; {SCORE_LABELS[score - 1]}
          </dt>
          <dd>{SCORE_DESCRIPTIONS[score]}</dd>
        </div>
      ))}
    </dl>
  );
}
