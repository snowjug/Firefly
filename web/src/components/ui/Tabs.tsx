import { useRef, type KeyboardEvent } from 'react';

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/**
 * A tab list (WAI-ARIA tabs pattern): one tab stop, arrow keys / Home / End move between tabs.
 * The caller renders the panel: `role="tabpanel"`, `id={panelId(prefix, value)}`,
 * `aria-labelledby={tabId(prefix, value)}`.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  label,
  prefix,
}: {
  tabs: readonly TabDef[];
  value: string;
  onChange(id: string): void;
  label: string;
  prefix: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const target =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    if (target < 0) return;
    event.preventDefault();
    const next = tabs[target];
    if (!next) return;
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            type="button"
            role="tab"
            className="tab"
            id={tabId(prefix, tab.id)}
            aria-selected={selected}
            aria-controls={panelId(prefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => move(event, index)}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="tab-count">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
