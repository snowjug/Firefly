import {
  createContext,
  useContext,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '../cx.ts';
import { Icon, type IconName } from '../icons.tsx';
import './tabs.css';

type Orientation = 'horizontal' | 'vertical';

interface TabsContextValue {
  value: string;
  select(value: string): void;
  base: string;
  orientation: Orientation;
  activation: 'automatic' | 'manual';
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab, TabList and TabPanel must be used inside Tabs.');
  return context;
}

const safe = (value: string) => value.replace(/[^\w-]/g, '_');

export interface TabsProps<V extends string = string> {
  /** The selected tab (controlled). */
  value?: V;
  /** The tab selected first when uncontrolled. */
  defaultValue?: V;
  onValueChange?(value: NoInfer<V>): void;
  orientation?: Orientation;
  /** `automatic` selects a tab as arrow keys reach it; `manual` waits for Enter or Space. */
  activation?: 'automatic' | 'manual';
  children: ReactNode;
  className?: string;
}

/**
 * Tabs with the keyboard behaviour people expect: one tab stop in the list, arrow keys move between
 * tabs, Home and End jump to the ends, and the panel is the next tab stop. Compose with TabList,
 * Tab and TabPanel.
 */
export function Tabs<V extends string = string>({
  value,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  activation = 'automatic',
  children,
  className,
}: TabsProps<V>) {
  const base = useId();
  const [own, setOwn] = useState<string>(defaultValue ?? '');
  const current = value ?? own;
  const select = (next: string) => {
    if (value === undefined) setOwn(next);
    onValueChange?.(next as V);
  };
  return (
    <TabsContext.Provider value={{ value: current, select, base, orientation, activation }}>
      <div className={cx('ff-tabs', `ff-tabs--${orientation}`, className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  /** Names the set of tabs, for example "Report sections". */
  label: string;
  children: ReactNode;
  className?: string;
}

export function TabList({ label, children, className }: TabListProps) {
  const { orientation, activation, select } = useTabs();
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys =
      orientation === 'horizontal'
        ? { previous: 'ArrowLeft', next: 'ArrowRight' }
        : { previous: 'ArrowUp', next: 'ArrowDown' };
    if (![keys.previous, keys.next, 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    );
    const from = tabs.findIndex((tab) => tab === document.activeElement);
    if (tabs.length === 0 || from < 0) return;
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (from + (event.key === keys.next ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    const tab = tabs[target] as HTMLButtonElement;
    tab.focus();
    if (activation === 'automatic' && tab.dataset.value !== undefined) select(tab.dataset.value);
  };
  return (
    // The keyboard handler serves the tabs inside; the list itself is not a control.
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      className={cx('ff-tablist', className)}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  children: ReactNode;
  icon?: IconName;
  disabled?: boolean;
  className?: string;
}

export function Tab({ value, children, icon, disabled, className }: TabProps) {
  const { value: selected, select, base } = useTabs();
  const isSelected = selected === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${base}-tab-${safe(value)}`}
      aria-selected={isSelected}
      aria-controls={`${base}-panel-${safe(value)}`}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      data-value={value}
      className={cx('ff-tab', isSelected && 'ff-tab--selected', className)}
      onClick={() => select(value)}
    >
      {icon ? <Icon name={icon} size={18} /> : null}
      {typeof children === 'string' ? (
        // The heavier weight of the selected tab is reserved in every tab, so none of them shifts.
        <span className="ff-tab__label" data-text={children}>
          {children}
        </span>
      ) : (
        <span className="ff-tab__label">{children}</span>
      )}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
  /**
   * Keep every panel in the layout, one on top of the other, and crossfade between them: the group
   * is as tall as its tallest panel, so choosing a tab never moves what is below it. Wrap the
   * panels in `TabPanels`. A panel that is not showing is inert and hidden from assistive
   * technology, so only the selected one is read or reached.
   */
  stacked?: boolean;
}

/** The content of one tab. Only the selected panel is shown. */
export function TabPanel({ value, children, className, stacked = false }: TabPanelProps) {
  const { value: selected, base } = useTabs();
  const isSelected = selected === value;
  const id = `${base}-panel-${safe(value)}`;
  const labelledBy = `${base}-tab-${safe(value)}`;
  if (stacked) {
    return (
      <div
        role="tabpanel"
        id={id}
        aria-labelledby={labelledBy}
        aria-hidden={isSelected ? undefined : true}
        inert={!isSelected}
        tabIndex={isSelected ? 0 : -1}
        data-selected={isSelected ? '' : undefined}
        className={cx('ff-tabpanel', 'ff-tabpanel--stacked', className)}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={labelledBy}
      hidden={!isSelected}
      tabIndex={0}
      className={cx('ff-tabpanel', className)}
    >
      {isSelected ? children : null}
    </div>
  );
}

/** Holds `stacked` panels in one cell, so they crossfade in place. */
export function TabPanels({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('ff-tabpanels', className)}>{children}</div>;
}
