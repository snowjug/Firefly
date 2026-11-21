import type { ReactNode } from 'react';
import '../../styles/frame.css';

/**
 * One figure in display serif with its mono label under it (the label comes first for screen
 * readers). Put Stats side by side in a `StatRow`, which separates them with hairlines; they are
 * ledger entries, not tiles.
 */
export function Stat({
  label,
  value,
  note,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <dl className="ff-stat">
      <dt className="ff-stat__label type-label">{label}</dt>
      <dd className="ff-stat__value">{value}</dd>
      {note ? <dd className="ff-stat__note">{note}</dd> : null}
    </dl>
  );
}

/** Stats in a row, separated by hairlines, wrapping on narrow screens. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="ff-stats">{children}</div>;
}

/**
 * Facts as rows on hairlines: a label, a value in tabular figures and an optional note. It is a
 * definition list, so each label is tied to its value for screen readers; on narrow containers the
 * label sits above the value.
 */
export function Ledger({
  rows,
}: {
  rows: readonly { label: ReactNode; value: ReactNode; note?: ReactNode }[];
}) {
  return (
    <dl className="ff-ledger">
      {rows.map((row, index) => (
        <div key={index} className="ff-ledger__row">
          <dt className="ff-ledger__label">{row.label}</dt>
          <dd className="ff-ledger__value">{row.value}</dd>
          {row.note ? <dd className="ff-ledger__note">{row.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
