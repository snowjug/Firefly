import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '../cx.ts';
import { Icon } from '../icons.tsx';
import './split-view.css';

export interface SplitViewProps {
  /** The list or navigation: on the left from 64em wide. */
  list: ReactNode;
  /** What the selected item shows: on the right from 64em wide. */
  detail: ReactNode;
  /** The accessible names of the two regions, for example "Scenarios" and "Scenario details". */
  listLabel: string;
  detailLabel: string;
  /**
   * On narrow screens only one pane shows: the list, or (when this is true) the detail with a Back
   * button above it. Wide screens always show both.
   */
  detailOpen?: boolean;
  /** Called by the Back button on narrow screens. Without it there is no Back button. */
  onBack?(): void;
  backLabel?: string;
  /** Changing this fades the detail in again: pass the id of the selected item. */
  detailKey?: string;
  /** The width of the list on wide screens: 22, 26 (default) or 32 rem. */
  listSize?: 'sm' | 'md' | 'lg';
  className?: string;
}

const NARROW = '(max-width: 63.99em)';

function isNarrow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;
}

/**
 * A list beside a detail pane. From 64em both show; below that the list comes first and choosing
 * an item replaces it with the detail and a clear way back. Focus follows the change on narrow
 * screens (to the detail when it opens, to the list when it closes) and never moves on first
 * render. Both panes are named regions.
 */
export function SplitView({
  list,
  detail,
  listLabel,
  detailLabel,
  detailOpen = false,
  onBack,
  backLabel = 'Back to list',
  detailKey,
  listSize = 'md',
  className,
}: SplitViewProps) {
  const listPane = useRef<HTMLElement>(null);
  const detailPane = useRef<HTMLElement>(null);
  const before = useRef(detailOpen);

  useEffect(() => {
    const was = before.current;
    before.current = detailOpen;
    if (was === detailOpen || !isNarrow()) return;
    const pane = detailOpen ? detailPane.current : listPane.current;
    pane?.focus();
    pane?.scrollIntoView?.({ block: 'start' });
  }, [detailOpen]);

  return (
    <div
      className={cx('ff-split', `ff-split--${listSize}`, className)}
      data-detail-open={detailOpen ? '' : undefined}
    >
      <section ref={listPane} tabIndex={-1} aria-label={listLabel} className="ff-split__list">
        {list}
      </section>
      <section ref={detailPane} tabIndex={-1} aria-label={detailLabel} className="ff-split__detail">
        {onBack ? (
          <button type="button" className="ff-split__back" onClick={onBack}>
            <Icon name="chevron-left" size={18} />
            <span>{backLabel}</span>
          </button>
        ) : null}
        <div key={detailKey} className={cx('ff-split__content', detailKey && 'u-fade')}>
          {detail}
        </div>
      </section>
    </div>
  );
}
