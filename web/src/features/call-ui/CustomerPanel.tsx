import { memo } from 'react';
import { Avatar, Icon, Tag } from '../../design/index.ts';
import { CustomerState } from './CustomerState.tsx';
import { TemperatureTrace } from './TemperatureTrace.tsx';
import type { CustomerStateView, TracePoint } from './call-model.ts';
import './customer-panel.css';

export interface CustomerPanelProps {
  name: string;
  role: string;
  organisation: string;
  /** The customer's voice is playing: a still ring on the avatar and the word "Speaking". */
  speaking: boolean;
  view: CustomerStateView | null;
  points: readonly TracePoint[];
  guided: boolean;
  contextFound: number;
}

/**
 * Who is on the line and how they feel: the customer, their state and the temperature trace.
 * It lives in the stage panel on wide screens and in the details sheet on narrow ones.
 */
export const CustomerPanel = memo(function CustomerPanel({
  name,
  role,
  organisation,
  speaking,
  view,
  points,
  guided,
  contextFound,
}: CustomerPanelProps) {
  return (
    <div className="cw-person">
      <div className="cw-person__card">
        <Avatar name={name} size="xl" speaking={speaking} className="cw-person__avatar" />
        <div className="cw-person__text">
          <p className="cw-person__name">{name}</p>
          <p className="cw-person__role">{role}</p>
          <p className="cw-person__org">{organisation}</p>
          <div className="cw-person__tags">
            <Tag size="small">Fictional customer</Tag>
            {speaking ? (
              <span className="cw-person__speaking">
                <Icon name="speaker" size={16} />
                Speaking
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <CustomerState view={view} guided={guided} contextFound={contextFound} />
      <TemperatureTrace points={points} view={view} />
    </div>
  );
});
