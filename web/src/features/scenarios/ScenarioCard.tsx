import { useId } from 'react';
import { Link, type To } from 'react-router';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { formatEstimate } from '#shared/domain/duration.ts';
import { cx } from '../../design/cx.ts';
import { Icon } from '../../design/icons.tsx';
import { useTilt } from '../../design/interaction/use-tilt.ts';
import { accentClass } from '../../design/product-accent.ts';
import { ProductIcon } from '../../design/primitives/ProductIcon.tsx';
import { Skeleton } from '../../design/primitives/Skeleton.tsx';
import { PRODUCT_SHORT, cardTitle, metaLine } from './labels.ts';
import { Level } from './Level.tsx';
import './scenario-card.css';

/** Where "Use scenario" goes: the workspace with this scenario chosen. */
export function scenarioHref(id: string): string {
  return `/scenarios?scenario=${encodeURIComponent(id)}`;
}

interface CardBase {
  scenario: PublicScenarioDTO;
  className?: string;
}

/**
 * `link`: the whole card is a link to the workspace (or to `to`), for a gallery that leads somewhere
 * else, such as the landing page. `select`: the card is one choice in a single-choice gallery: a
 * visually hidden radio covers it, so the whole card is the target and the arrow keys move between
 * cards as in any radio group. All the cards of one gallery share a `name`.
 */
export type ScenarioCardProps = CardBase &
  (
    | { mode: 'link'; to?: To }
    | { mode: 'select'; selected?: boolean; name: string; onSelect(id: string): void }
  );

/** A very small waveform: decorative, and it moves only while the card is pointed at or focused. */
function Wave() {
  return (
    <span className="scn-card__wave" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

/**
 * A scenario as one quick look: the product, the issue in a few words, how it starts (impact,
 * customer state, call stage), how long it takes, how hard it is, and the way on. Nothing else: no
 * summary, so a row of cards can be scanned. It carries its product's accent as a small mark and
 * works in both themes with tokens only. Pointed at with a mouse it rises, tilts a degree or so and
 * its edge catches a soft light; keyboard focus gives the same prominence without the tilt.
 */
export function ScenarioCard(props: ScenarioCardProps) {
  const { scenario, className } = props;
  const base = useId();
  const tilt = useTilt<HTMLDivElement>();
  const ids = {
    input: `${base}-input`,
    product: `${base}-product`,
    title: `${base}-title`,
    meta: `${base}-meta`,
    time: `${base}-time`,
    level: `${base}-level`,
    action: `${base}-action`,
  };
  const described = `${ids.product} ${ids.meta} ${ids.time} ${ids.level}`;
  const selected = props.mode === 'select' && props.selected === true;

  return (
    <div
      ref={tilt}
      className={cx('scn-card', accentClass(scenario.product.id), className)}
      data-scenario={scenario.id}
      data-mode={props.mode}
      data-selected={selected ? 'true' : undefined}
    >
      <span className="scn-card__edge" aria-hidden="true" />
      <span className="scn-card__accent" aria-hidden="true" />
      {props.mode === 'select' ? (
        <input
          id={ids.input}
          className="scn-card__input"
          type="radio"
          name={props.name}
          value={scenario.id}
          checked={selected}
          aria-labelledby={ids.title}
          aria-describedby={described}
          onChange={() => props.onSelect(scenario.id)}
        />
      ) : null}
      <div className="scn-card__face">
        <div className="scn-card__top">
          <span className="scn-card__tile">
            <ProductIcon product={scenario.product.id} size={18} />
          </span>
          <span className="scn-card__product" id={ids.product}>
            {PRODUCT_SHORT[scenario.product.id]}
          </span>
          <Wave />
        </div>
        <p className="scn-card__title" id={ids.title}>
          {cardTitle(scenario)}
        </p>
        <p className="scn-card__meta" id={ids.meta}>
          {metaLine(scenario)}
        </p>
        <div className="scn-card__facts">
          <span className="scn-card__time" id={ids.time}>
            <Icon name="clock" size={14} />
            {formatEstimate(scenario.estimatedMinutes)}
          </span>
          <Level difficulty={scenario.difficulty} id={ids.level} />
        </div>
        {props.mode === 'link' ? (
          <Link
            className="scn-card__go scn-card__link"
            to={props.to ?? scenarioHref(scenario.id)}
            aria-labelledby={`${ids.action} ${ids.title}`}
            aria-describedby={described}
          >
            <span id={ids.action}>Use scenario</span>
            <Icon name="arrow-right" size={16} />
          </Link>
        ) : (
          // The radio is the control; this is what choosing it looks like, so it is not read twice.
          <span className="scn-card__go" aria-hidden="true">
            {selected ? (
              <>
                <Icon name="check" size={16} />
                Selected
              </>
            ) : (
              <>
                Use scenario
                <Icon name="arrow-right" size={16} />
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/** The shape of a card while the scenarios load. */
export function ScenarioCardSkeleton() {
  return (
    <div className="scn-card scn-card--skeleton" aria-hidden="true">
      <div className="scn-card__face">
        <Skeleton width="40%" />
        <Skeleton width="85%" height="1.25rem" />
        <Skeleton width="70%" />
        <Skeleton width="55%" />
      </div>
    </div>
  );
}
