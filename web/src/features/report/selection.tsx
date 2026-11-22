import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { nearestEvent, type CallEvent } from './events-model.ts';

// The timeline and the transcript are two views of one call, and they agree about where the reader
// is. Choosing a moment on the timeline marks its turn in the transcript; choosing a turn in the
// transcript (or a point of the customer's journey) selects the moment nearest to it on the
// timeline. This is the shared state, and nothing else: what each view draws is its own business.

export interface TimelineSync {
  events: readonly CallEvent[];
  /** The moment the reader chose, or null until they have chosen one. */
  selectedId: string | null;
  /** The turn marked in the transcript because the reader chose something, or null. */
  markedTurn: number | null;
  /** The moments seen at a turn, for labelling it in the transcript. */
  eventsAt(turnIndex: number): readonly CallEvent[];
  /** Chooses a moment on the timeline and marks its turn. */
  chooseEvent(id: string): void;
  /** Chooses a turn (in the transcript, or from the customer's journey): the nearest moment is selected. */
  pickTurn(turnIndex: number): CallEvent | null;
  /** Takes the mark off. The selected moment stays selected. */
  clearMark(): void;
}

const TimelineSyncContext = createContext<TimelineSync | null>(null);

export function TimelineSyncProvider({
  events,
  children,
}: {
  events: readonly CallEvent[];
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markedTurn, setMarkedTurn] = useState<number | null>(null);

  const byTurn = useMemo(() => {
    const map = new Map<number, CallEvent[]>();
    for (const event of events) {
      if (event.state !== 'seen' || event.turnIndex === null) continue;
      map.set(event.turnIndex, [...(map.get(event.turnIndex) ?? []), event]);
    }
    return map;
  }, [events]);

  const eventsAt = useCallback(
    (turnIndex: number): readonly CallEvent[] => byTurn.get(turnIndex) ?? [],
    [byTurn],
  );

  const chooseEvent = useCallback(
    (id: string) => {
      const event = events.find((candidate) => candidate.id === id);
      if (!event) return;
      setSelectedId(id);
      setMarkedTurn(event.state === 'seen' ? event.turnIndex : null);
    },
    [events],
  );

  const pickTurn = useCallback(
    (turnIndex: number): CallEvent | null => {
      const near = nearestEvent(events, turnIndex);
      setMarkedTurn(turnIndex);
      if (near) setSelectedId(near.id);
      return near;
    },
    [events],
  );

  const clearMark = useCallback(() => setMarkedTurn(null), []);

  const value = useMemo(
    () => ({ events, selectedId, markedTurn, eventsAt, chooseEvent, pickTurn, clearMark }),
    [events, selectedId, markedTurn, eventsAt, chooseEvent, pickTurn, clearMark],
  );
  return <TimelineSyncContext.Provider value={value}>{children}</TimelineSyncContext.Provider>;
}

/** The shared state of the timeline and the transcript, or null where there is no timeline (the transcript on its own). */
export function useTimelineSync(): TimelineSync | null {
  return useContext(TimelineSyncContext);
}
