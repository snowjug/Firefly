import type { Difficulty } from '#shared/domain/vocab.ts';
import { Avatar, Badge, Button, IconButton, StateBadge } from '../../design/index.ts';
import { WordmarkMark } from '../../app/shell/Wordmark.tsx';
import {
  clock,
  DIFFICULTY_NAMES,
  type ConnectionStatus,
  type CustomerStateView,
} from './call-model.ts';
import './command-bar.css';

export interface CommandBarProps {
  /** Below 64em: the customer, their state, the time and End call, on two short rows. */
  compact: boolean;
  /** Below 80em the context is not a column, so the bar offers it as a sheet. */
  showDetails: boolean;
  scenarioTitle: string;
  customerName: string;
  customerRole: string;
  connection: ConnectionStatus;
  elapsedSeconds: number;
  difficulty: Difficulty;
  provider: { demo: boolean; label: string };
  state: CustomerStateView | null;
  onDetails(): void;
  onEnd(): void;
}

/**
 * The command bar: where the call is and how to end it. The scenario and the customer are written
 * out in full (they wrap, they are never cut short), the connection badge says whether the call is
 * live, muted, paused, typed, reconnecting or offline, and the timer counts up without ever being
 * announced. End call is always here, at every width, and last in the tab order.
 */
export function CommandBar({
  compact,
  showDetails,
  scenarioTitle,
  customerName,
  customerRole,
  connection,
  elapsedSeconds,
  difficulty,
  provider,
  state,
  onDetails,
  onEnd,
}: CommandBarProps) {
  const timer = (
    <span className="cw-bar__timer" role="timer" aria-live="off" aria-label="Call time">
      {clock(elapsedSeconds)}
    </span>
  );
  return (
    <header className="cw-bar">
      <div className="cw-bar__inner">
        <div className="cw-bar__id">
          {compact ? (
            <Avatar name={customerName} size="sm" />
          ) : (
            <WordmarkMark size={24} className="cw-bar__mark" />
          )}
          <div className="cw-bar__titles">
            <p className="cw-bar__title">{compact ? customerName : scenarioTitle}</p>
            <p className="cw-bar__sub">
              {compact ? customerRole : `${customerName}, ${customerRole}`}
            </p>
          </div>
        </div>
        <div className="cw-bar__status">
          {compact && state ? (
            <StateBadge state={state.tone} label={state.label} size="small" />
          ) : null}
          <Badge tone={connection.tone} icon={connection.icon} size={compact ? 'small' : 'medium'}>
            {connection.label}
          </Badge>
          {timer}
          {compact ? null : (
            <>
              <Badge tone="neutral" icon={null} appearance="outline">
                {DIFFICULTY_NAMES[difficulty]}
              </Badge>
              <Badge
                tone={provider.demo ? 'neutral' : 'ai'}
                icon={provider.demo ? 'info' : 'sparkle'}
                appearance="outline"
              >
                {provider.demo ? 'Demo mode' : 'Live model'}
              </Badge>
            </>
          )}
        </div>
        <div className="cw-bar__actions">
          {showDetails ? (
            compact ? (
              <IconButton
                icon="info"
                label="Details"
                appearance="secondary"
                aria-haspopup="dialog"
                onClick={onDetails}
              />
            ) : (
              <Button icon="list" aria-haspopup="dialog" onClick={onDetails}>
                Details
              </Button>
            )
          ) : null}
          <Button appearance="danger" icon="phone-end" className="cw-bar__end" onClick={onEnd}>
            End call
          </Button>
        </div>
      </div>
    </header>
  );
}
