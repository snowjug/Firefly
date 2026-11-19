import type { RewardLevelDTO, RewardRuleDTO } from '#shared/domain/api.ts';
import { Icon } from '../Icon.tsx';

/**
 * The trust-building part: every way to earn points, what it pays, and the safeguard that stops
 * it being gamed. The text comes from the server, which is also where the rules are applied.
 */
export function RulesList({ rules }: { rules: readonly RewardRuleDTO[] }) {
  return (
    <ul role="list" className="glass rw-rules">
      {rules.map((rule) => (
        <li key={rule.id} className="rw-rule">
          <p className="rw-rule-points tabular">
            <span aria-hidden="true">+{rule.points}</span>
            <span className="sr-only">{rule.points} points</span>
          </p>
          <div className="rw-rule-body">
            <h3 className="rw-rule-title">{rule.title}</h3>
            <p className="rw-rule-detail">{rule.detail}</p>
            <p className="rw-rule-safeguard">
              <Icon name="shield-check" size={16} />
              <span>
                <strong>Safeguard:</strong> {rule.safeguard}
              </span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The four levels. A level needs both points and different kinds of call, so a pile of points from one kind is not enough. */
export function LevelsList({
  levels,
  currentId,
}: {
  levels: readonly RewardLevelDTO[];
  currentId: string;
}) {
  return (
    <ol role="list" className="rw-levels" aria-label="Levels">
      {levels.map((level) => (
        <li
          key={level.id}
          className="rw-levels-item"
          aria-current={level.id === currentId ? 'step' : undefined}
        >
          <p className="rw-levels-name">
            {level.name}
            {level.id === currentId ? <span className="chip chip-accent">You are here</span> : null}
          </p>
          <p className="rw-meta">
            {level.minPoints === 0 && level.minFamilies === 0
              ? 'Where everyone starts'
              : `${level.minPoints} points and ${level.minFamilies} kinds of call`}
          </p>
        </li>
      ))}
    </ol>
  );
}
