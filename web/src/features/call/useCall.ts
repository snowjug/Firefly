import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { CallActions, CallSnapshot, UseCallOptions } from './contract.ts';
import { createCallController } from './controller.ts';

/**
 * Runs one call. The screen reads `snapshot` and calls `actions`; it never touches the microphone,
 * audio elements or the speech APIs itself. `actions` never changes identity, and `snapshot` is a
 * new object whenever anything in it changed.
 *
 * Nothing is loaded or opened until the component has mounted, no microphone is asked for until
 * `actions.begin({ voice: true })` is called from a click, and everything the call opened
 * (microphone tracks, audio contexts, blob URLs, speech, requests, timers) is released when the
 * component unmounts, when the call ends, and when `sessionId` changes.
 */
export function useCall(
  sessionId: string,
  options: UseCallOptions,
): { snapshot: CallSnapshot; actions: CallActions } {
  const [current, setCurrent] = useState(() => ({
    sessionId,
    controller: createCallController(sessionId, options),
  }));
  let active = current;
  if (current.sessionId !== sessionId) {
    // A different call: start a new engine. The old one is released by its effect's cleanup.
    active = { sessionId, controller: createCallController(sessionId, options) };
    setCurrent(active);
  }
  const { controller } = active;

  useEffect(() => {
    controller.attach();
    return () => controller.detach();
  }, [controller]);

  useEffect(() => {
    controller.setOptions(options);
  });

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return useMemo(() => ({ snapshot, actions: controller.actions }), [snapshot, controller]);
}
