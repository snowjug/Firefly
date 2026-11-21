import { useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { slidePip } from './motion.ts';
import '../../styles/frame.css';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

/** The id of a tab, for the panel's `aria-labelledby`. */
export const tabDomId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
/** The id the panel for a tab should carry. */
export const tabPanelDomId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/**
 * Tabs as words on a hairline, the active one with an amber point under it that slides from the
 * old tab to the new one (WAI-ARIA tabs: one tab stop, arrow keys, Home and End move and select).
 * Panels are the caller's: give each `role="tabpanel"`, `id={tabPanelDomId(panelId, tab.id)}` and
 * `aria-labelledby={tabDomId(panelId, tab.id)}`; the tabs then name them in `aria-controls`.
 * On narrow screens the row scrolls sideways.
 */
export function TabRow({
  label,
  tabs,
  active,
  onChange,
  panelId,
}: {
  /** Names the tab list for screen readers. */
  label: string;
  tabs: readonly TabItem[];
  active: string;
  onChange(id: string): void;
  /** A prefix for the ids that tie tabs to panels (see `tabDomId` and `tabPanelDomId`). */
  panelId?: string;
}) {
  const fallbackId = useId();
  const prefix = panelId ?? fallbackId;
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const previous = useRef<HTMLElement | null>(null);
  const tabbable = tabs.some((tab) => tab.id === active) ? active : tabs[0]?.id;

  useLayoutEffect(() => {
    const tab = refs.current.get(active);
    if (!tab) return;
    slidePip(previous.current, tab);
    previous.current = tab;
  }, [active]);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let target = -1;
    if (event.key === forward || event.key === 'ArrowDown') target = index === last ? 0 : index + 1;
    else if (event.key === backward || event.key === 'ArrowUp')
      target = index === 0 ? last : index - 1;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = last;
    const next = tabs[target];
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div className="ff-tabs">
      <div className="ff-tabs__list" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) refs.current.set(tab.id, node);
                else refs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              className="ff-tabs__tab"
              id={tabDomId(prefix, tab.id)}
              aria-selected={selected}
              aria-controls={panelId ? tabPanelDomId(panelId, tab.id) : undefined}
              tabIndex={tab.id === tabbable ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => move(event, index)}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <>
                  {' '}
                  <span className="ff-tabs__count">{tab.count}</span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
