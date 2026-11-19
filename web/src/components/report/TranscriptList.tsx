import { useEffect } from 'react';
import type { TurnDTO, TurnMarker } from '#shared/domain/api.ts';
import { formatTime } from '../../lib/format.ts';
import { Icon, type IconName } from '../Icon.tsx';
import '../../styles/transcript.css';

type MarkerTone = 'eased' | 'rose' | 'mood' | 'discovery' | 'curveball';

/** Text, an icon and a tone for a marker, so its meaning never depends on colour. */
export function describeMarker(marker: TurnMarker): {
  icon: IconName;
  text: string;
  tone: MarkerTone;
} {
  const label = marker.label.trim();
  if (marker.kind === 'discovery') {
    const match = /^(partly\s+)?uncovered:\s*(.*)$/i.exec(label);
    const text = match
      ? `${match[1] ? 'Partly discovered' : 'Discovered'}: ${match[2]}`
      : `Discovery: ${label}`;
    return { icon: 'search', text, tone: 'discovery' };
  }
  if (marker.kind === 'curveball') {
    return {
      icon: 'flag',
      text: /^curveball/i.test(label) ? label : `Curveball: ${label}`,
      tone: 'curveball',
    };
  }
  if (marker.delta !== undefined && marker.delta < 0) {
    return { icon: 'chevron-down', text: `Customer mood eased: ${label}`, tone: 'eased' };
  }
  if (marker.delta !== undefined && marker.delta > 0) {
    return { icon: 'chevron-up', text: `Customer mood rose: ${label}`, tone: 'rose' };
  }
  return { icon: 'info', text: `Customer mood: ${label}`, tone: 'mood' };
}

function TurnItem({
  turn,
  customerName,
  cited,
  showMarkers,
  linked,
}: {
  turn: TurnDTO;
  customerName: string;
  cited: readonly string[] | undefined;
  showMarkers: boolean;
  linked: boolean;
}) {
  const isCustomer = turn.role === 'customer';
  const markers = showMarkers ? (turn.markers ?? []) : [];
  return (
    <li
      id={`turn-${turn.index}`}
      tabIndex={-1}
      className="tx-turn"
      data-role={turn.role}
      data-cited={cited ? 'true' : undefined}
      data-linked={linked ? 'true' : undefined}
      aria-current={linked ? 'location' : undefined}
    >
      <div className="tx-head">
        <span className="tx-speaker">{isCustomer ? `Customer \u2013 ${customerName}` : 'You'}</span>
        <span className="tx-where">
          Turn {turn.index}
          <span aria-hidden="true"> &middot; </span>
          <time dateTime={turn.createdAt}>{formatTime(turn.createdAt)}</time>
        </span>
        {cited ? (
          <span className="chip chip-accent tx-tag">
            <Icon name="flag" size={13} /> Cited in report
          </span>
        ) : linked ? (
          <span className="chip tx-tag">Linked turn</span>
        ) : null}
      </div>
      <p className="tx-text">{turn.text}</p>
      {cited ? (
        <ul role="list" className="tx-cites" aria-label="Where the report uses this turn">
          {cited.map((label) => (
            <li key={label} className="tx-cite">
              {label}
            </li>
          ))}
        </ul>
      ) : null}
      {markers.length > 0 ? (
        <ul role="list" className="tx-markers" aria-label="Analysis markers">
          {markers.map((marker, index) => {
            const view = describeMarker(marker);
            return (
              <li key={`${marker.kind}-${index}`} className="tx-marker" data-tone={view.tone}>
                <Icon name={view.icon} size={14} />
                <span>{view.text}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * The conversation as a semantic ordered list. Each turn has an id (`turn-N`) that links from the
 * report land on; the linked turn is scrolled into view, focused and highlighted.
 */
export function TranscriptList({
  turns,
  customerName,
  cited,
  showMarkers,
  linked,
}: {
  turns: readonly TurnDTO[];
  customerName: string;
  cited: ReadonlyMap<number, string[]>;
  showMarkers: boolean;
  linked: number | null;
}) {
  useEffect(() => {
    if (linked === null) return;
    const element = document.getElementById(`turn-${linked}`);
    if (!element) return;
    element.scrollIntoView?.({ block: 'center' });
    element.focus({ preventScroll: true });
  }, [linked]);

  return (
    <ol role="list" className="tx-list" aria-label="Conversation">
      {turns.map((turn) => (
        <TurnItem
          key={turn.index}
          turn={turn}
          customerName={customerName}
          cited={cited.get(turn.index)}
          showMarkers={showMarkers}
          linked={linked === turn.index}
        />
      ))}
    </ol>
  );
}
