import { memo, useEffect, useId, useState } from 'react';
import { Badge, cx, Icon } from '../../design/index.ts';
import type { CustomerStateView } from './call-model.ts';
import './customer-state.css';

/** How long the outline that marks a change of state stays. It is an outline, not a flash. */
const HIGHLIGHT_MS = 2400;

export interface CustomerStateProps {
  view: CustomerStateView | null;
  /** Guided practice shows a count of what has been found; standard calls show nothing of the kind. */
  guided: boolean;
  contextFound: number;
}

/**
 * How the customer is feeling, always shown: a badge with the state's own icon shape and word, which
 * way it is moving, and one plain line. It never shows a number and never says why the state changed.
 * When the state changes the card gets a brief outline (instant under reduced motion).
 */
export const CustomerState = memo(function CustomerState({
  view,
  guided,
  contextFound,
}: CustomerStateProps) {
  const labelId = useId();
  const tone = view?.tone ?? null;
  const [seen, setSeen] = useState(tone);
  const [changed, setChanged] = useState(false);
  if (tone !== seen) {
    setSeen(tone);
    // The first state to arrive is not a change.
    if (seen !== null && tone !== null) setChanged(true);
  }
  useEffect(() => {
    if (!changed) return;
    const timer = window.setTimeout(() => setChanged(false), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [changed, tone]);

  return (
    <div
      className={cx('cw-state', view && `cw-state--${view.tone}`, changed && 'cw-state--changed')}
      role="group"
      aria-labelledby={labelId}
      data-changed={changed || undefined}
    >
      <p className="cw-state__label" id={labelId}>
        Customer state
      </p>
      {view ? (
        <>
          <div className="cw-state__row">
            <Badge tone={view.tone} className="cw-state__badge">
              {view.label}
            </Badge>
            <span className="cw-state__trend">
              <Icon name={view.trendIcon} size={18} />
              <span>
                <span className="visually-hidden">Trend: </span>
                {view.trendWord}
              </span>
            </span>
          </div>
          <p className="cw-state__text">{view.description}</p>
        </>
      ) : (
        <p className="cw-state__text">Shown once the customer has spoken.</p>
      )}
      {guided ? (
        <p className="cw-state__found">
          <Icon name="lightbulb" size={16} />
          <span>Context found: {contextFound}</span>
        </p>
      ) : null}
    </div>
  );
});
