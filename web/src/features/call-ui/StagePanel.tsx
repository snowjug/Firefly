import type { ReactNode } from 'react';
import { CustomerPanel, type CustomerPanelProps } from './CustomerPanel.tsx';
import './stage.css';

export interface StagePanelProps {
  titleId: string;
  customer: CustomerPanelProps;
  /** The voice zone, pinned under the customer. */
  children: ReactNode;
}

/**
 * The stage panel on wide screens: the customer and how they feel at the top, and the part of the
 * call that talks and listens pinned at the bottom, so Talk never scrolls out of reach.
 */
export function StagePanel({ titleId, customer, children }: StagePanelProps) {
  return (
    <section className="cw-stage" aria-labelledby={titleId}>
      <h2 className="visually-hidden" id={titleId}>
        Customer and voice
      </h2>
      <div className="cw-stage__scroll">
        <CustomerPanel {...customer} />
      </div>
      <div className="cw-stage__voice">{children}</div>
    </section>
  );
}
