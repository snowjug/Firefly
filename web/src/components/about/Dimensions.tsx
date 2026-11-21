import {
  CARE_LABELS,
  DIMENSION_IDS,
  DIMENSIONS,
  SCORE_DESCRIPTIONS,
  SCORE_LABELS,
} from '#shared/domain/vocab.ts';
import { Ledger } from '../frame/Ledger.tsx';

const SCORES = [1, 2, 3, 4, 5] as const;

/** The six coaching dimensions, straight from the shared vocabulary the evaluator also uses. */
export function Dimensions() {
  return (
    <ol role="list" className="ab-dimensions">
      {DIMENSION_IDS.map((id, index) => {
        const dimension = DIMENSIONS[id];
        return (
          <li key={id} className="ab-dimension">
            <span className="ab-dimension__no type-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="ab-dimension__body">
              <h3 className="ab-dimension__title">{dimension.label}</h3>
              <p className="ab-dimension__text">{dimension.description}</p>
              <ul role="list" className="ab-care" aria-label="CARE behaviours">
                {dimension.care.map((behaviour) => (
                  <li key={behaviour}>{CARE_LABELS[behaviour]}</li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The 1 to 5 scale with the descriptors scorers and the evaluator both use. */
export function ScaleList() {
  return (
    <Ledger
      rows={SCORES.map((score) => ({
        label: `${score} \u2013 ${SCORE_LABELS[score - 1]}`,
        value: SCORE_DESCRIPTIONS[score],
      }))}
    />
  );
}
