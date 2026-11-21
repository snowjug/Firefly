/**
 * A polite announcer's queue, kept free of React so it is easy to test.
 *
 * What it promises to assistive technology:
 * - Every announcement is a whole sentence, spoken one at a time, never character by character.
 * - The same sentence is not repeated while it is waiting or for a few seconds after it was spoken.
 * - Each sentence is given time to be read before the next replaces it, and the region is emptied
 *   between sentences so that a genuine repeat later is still a change that gets read.
 */

const HOLD_BASE_MS = 700;
const HOLD_PER_CHARACTER_MS = 25;
const HOLD_MAX_MS = 5000;
const GAP_MS = 120;
const REPEAT_WINDOW_MS = 4000;
const MAX_WAITING = 6;

export interface AnnouncerQueue {
  announce(message: string): void;
  /** Stops speaking and forgets what was waiting. The queue can be used again afterwards. */
  dispose(): void;
}

export function createAnnouncerQueue(
  speak: (text: string) => void,
  now: () => number = Date.now,
): AnnouncerQueue {
  const waiting: string[] = [];
  const spoken = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function next() {
    timer = null;
    const message = waiting.shift();
    if (message === undefined) return;
    const at = now();
    spoken.set(message, at);
    for (const [text, when] of spoken) if (at - when > REPEAT_WINDOW_MS) spoken.delete(text);
    speak(message);
    const hold = Math.min(HOLD_MAX_MS, HOLD_BASE_MS + message.length * HOLD_PER_CHARACTER_MS);
    timer = setTimeout(() => {
      speak('');
      timer = setTimeout(next, GAP_MS);
    }, hold);
  }

  return {
    announce(raw) {
      const message = raw.replace(/\s+/g, ' ').trim();
      if (!message || waiting.includes(message)) return;
      const last = spoken.get(message);
      if (last !== undefined && now() - last <= REPEAT_WINDOW_MS) return;
      waiting.push(message);
      if (waiting.length > MAX_WAITING) waiting.shift();
      if (timer === null) next();
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      waiting.length = 0;
      spoken.clear();
    },
  };
}
