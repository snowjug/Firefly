import type { ProductId } from '#shared/domain/vocab.ts';
import { Badge, Button, ProductIcon, StatusBadge } from '../../design/index.ts';
import { Wordmark } from '../../app/shell/Wordmark.tsx';
import { clock, type ConnectionStatus } from './call-model.ts';
import './workspace.css';

export interface CallBarProps {
  /** Below 80em the case is not a column, so the bar offers it as a sheet. */
  showCase: boolean;
  scenarioTitle: string;
  /** The Microsoft product, or null for a call saved before scenarios named one (nothing is guessed). */
  product: { id: ProductId; name: string } | null;
  connection: ConnectionStatus;
  elapsedSeconds: number;
  provider: { demo: boolean; label: string };
  onCase(): void;
  onEnd(): void;
}

/**
 * The top bar: Firefly, the Microsoft product, the scenario, how long the call has run, whether it
 * is connected, and End call. The scenario is written out in full from a tablet up (it wraps), the
 * timer counts up without ever being announced, and End call is always here, at every width, and
 * last in the tab order. The demo label ("Demo mode", or "Live model") shows wherever the customer
 * is the built-in rules, on the bar from 360 px wide up. On a tablet the bar is two rows; a phone has
 * two as well, the buttons first and then the case with the time, the connection and that label
 * beside it, or as a line under it where they do not fit (the CSS decides). There the product is its
 * icon (its name is kept for a screen reader), the scenario takes two lines, and the case button
 * shows only its icon below 360 px. Below 360 px the bar has no room for the label, and it is in
 * Voice settings and the pre-flight, which have the room to say it in words.
 */
export function CallBar({
  showCase,
  scenarioTitle,
  product,
  connection,
  elapsedSeconds,
  provider,
  onCase,
  onEnd,
}: CallBarProps) {
  return (
    <header className="cw-bar">
      <div className="cw-bar__inner">
        <Wordmark size="sm" className="cw-bar__brand" />
        <div className="cw-bar__line">
          <div className="cw-bar__case">
            {product ? (
              <span className="cw-bar__product">
                <ProductIcon product={product.id} size={18} />
                <span className="cw-bar__product-name">{product.name}</span>
              </span>
            ) : null}
            <p className="cw-bar__scenario">{scenarioTitle}</p>
          </div>
          <div className="cw-bar__status">
            <span className="cw-bar__timer" role="timer" aria-live="off" aria-label="Call time">
              {clock(elapsedSeconds)}
            </span>
            <StatusBadge label={connection.label} tone={connection.tone} size="medium" />
            <Badge
              tone="neutral"
              appearance="outline"
              icon={provider.demo ? 'info' : null}
              className="cw-bar__provider"
            >
              {provider.demo ? 'Demo mode' : 'Live model'}
            </Badge>
          </div>
        </div>
        <div className="cw-bar__actions">
          {showCase ? (
            <Button icon="document" aria-haspopup="dialog" onClick={onCase}>
              <span className="cw-bar__case-label">Case</span>
            </Button>
          ) : null}
          <Button appearance="danger" icon="phone-end" className="cw-bar__end" onClick={onEnd}>
            End call
          </Button>
        </div>
      </div>
    </header>
  );
}
