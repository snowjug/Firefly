import { cx } from '../cx.ts';
import './divider.css';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** Text centred on a horizontal rule, such as "or". */
  label?: string;
  className?: string;
}

/** A hairline that separates content. A plain horizontal one is a real `<hr>`. */
export function Divider({ orientation = 'horizontal', label, className }: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cx('ff-divider', 'ff-divider--vertical', className)}
      />
    );
  }
  if (label) {
    return (
      <div role="separator" className={cx('ff-divider', 'ff-divider--labelled', className)}>
        <span className="ff-divider__label">{label}</span>
      </div>
    );
  }
  return <hr className={cx('ff-divider', className)} />;
}
