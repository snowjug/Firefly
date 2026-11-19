import { readStorage, writeStorage } from './storage.ts';

// Which calls used voice. It is kept on this device only, so the report can add one honest caution:
// speech recognition can mishear words, so check the quotes against the transcript.

const KEY = 'firefly.voiceSessions';
const MAX_IDS = 100;

function read(): string[] {
  const stored = readStorage<unknown>(KEY, []);
  return Array.isArray(stored)
    ? stored.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
}

/** Records that voice was used in this call (the newest 100 calls are kept). */
export function markVoiceSession(id: string): void {
  if (!id) return;
  const ids = read().filter((existing) => existing !== id);
  ids.push(id);
  writeStorage(KEY, ids.slice(-MAX_IDS));
}

export function usedVoice(id: string): boolean {
  return read().includes(id);
}

/** For when a call is deleted. */
export function forgetVoiceSession(id: string): void {
  writeStorage(
    KEY,
    read().filter((existing) => existing !== id),
  );
}
