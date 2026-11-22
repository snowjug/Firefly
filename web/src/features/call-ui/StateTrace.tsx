import { memo } from 'react';
import type { CustomerState } from '../../design/index.ts';
import type { CallStatePoint } from '../call/contract.ts';
import { describeTrace, traceShape } from './call-model.ts';

const BOX = { width: 120, height: 24, pad: 3 } as const;

export interface StateTraceProps {
  history: readonly CallStatePoint[];
  /** The customer's state now: the line takes its colour. */
  tone: CustomerState | null;
}

/**
 * How the customer has felt over the call, as one thin line: the hotter they were, the higher it
 * runs, the latest point at the right with a dot. It carries no numbers, no axis and no score; a
 * screen reader gets the same thing as words ("Customer state so far: calm, then concerned"). The
 * box keeps its size from the start, so the line arriving moves nothing.
 */
export const StateTrace = memo(function StateTrace({ history, tone }: StateTraceProps) {
  const points = traceShape(history, BOX);
  const words = describeTrace(history);
  const last = points.at(-1);
  return (
    <span
      className="cw-trace"
      data-tone={tone ?? undefined}
      role={words ? 'img' : undefined}
      aria-label={words || undefined}
      aria-hidden={words ? undefined : true}
    >
      <svg viewBox={`0 0 ${BOX.width} ${BOX.height}`} aria-hidden="true" focusable="false">
        {points.length > 1 ? (
          <polyline
            className="cw-trace__line"
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ) : null}
        {last ? <circle className="cw-trace__now" cx={last.x} cy={last.y} r={2.5} /> : null}
      </svg>
    </span>
  );
});
