import type { RewardLevelDTO, RewardRuleDTO } from '#shared/domain/api.ts';
import { Tag } from '../frame/index.ts';
import '../../styles/rewards.css';

/**
 * The trust-building part: every way to earn points, what it pays, and the safeguard that stops
 * it being gamed. The text comes from the server, which is also where the rules are applied.
 */
export function RulesBlock({
  rules,
  levels,
  currentId,
}: {
  rules: readonly RewardRuleDTO[];
  levels: readonly RewardLevelDTO[];
  currentId: string;
}) {
  return (
    <section className="rw-block" aria-labelledby="rw-rules-title">
      <div className="rw-block__aside">
        <h3 id="rw-rules-title" className="rw-block__title">
          How points work
        </h3>
        <p className="rw-block__lead">
          Points come from specific things you do on a call. Each rule says what it pays and the
          safeguard that keeps it fair. Speed and call length earn nothing, and a low score or a
          missed day never takes points away. Nothing here is ranked or compared with anyone.
        </p>
      </div>
      <div className="rw-block__main">
        <ul className="rw-rules">
          {rules.map((rule) => (
            <li key={rule.id} className="rw-rule">
              <p className="rw-rule__points">
                <span aria-hidden="true">+{rule.points}</span>
                <span className="sr-only">{rule.points} points</span>
              </p>
              <div className="rw-rule__body">
                <h4 className="rw-rule__title">{rule.title}</h4>
                <p className="rw-rule__detail">{rule.detail}</p>
                <p className="rw-rule__safeguard">
                  <strong>Safeguard:</strong> {rule.safeguard}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <h4 className="rw-sub">Levels</h4>
        <p className="rw-sub__lead">
          A level needs both points and different kinds of call, so a pile of points from one kind
          of call is not enough.
        </p>
        <ol className="rw-levels" aria-label="Levels">
          {levels.map((level) => (
            <li
              key={level.id}
              className="rw-levels__item"
              aria-current={level.id === currentId ? 'step' : undefined}
            >
              <p className="rw-levels__name">
                {level.name}
                {level.id === currentId ? <Tag tone="amber">You are here</Tag> : null}
              </p>
              <p className="rw-levels__need">
                {level.minPoints === 0 && level.minFamilies === 0
                  ? 'Where everyone starts'
                  : `${level.minPoints} points and ${level.minFamilies} kinds of call`}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
