import { DIFFICULTY_RANK, type Difficulty } from '#shared/domain/vocab.ts';
import { difficultyLabel } from './labels.ts';
import './level.css';

/** The difficulty: three bars filled to the level, and always its name, so it is never colour alone. */
export function Level({ difficulty, id }: { difficulty: Difficulty; id?: string }) {
  return (
    <span className="scn-level" id={id}>
      <span
        className="scn-level__bars"
        data-steps={DIFFICULTY_RANK[difficulty] + 1}
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
      </span>
      {difficultyLabel(difficulty)}
    </span>
  );
}
