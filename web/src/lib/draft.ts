import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import type { PracticeMode } from '#shared/domain/vocab.ts';
import { readStorage, removeStorage, writeStorage } from './storage.ts';

// The call being set up. It lives in sessionStorage so a refresh keeps the choices, and it is
// discarded when the call starts.

export interface CallDraft {
  scenarioId: string;
  overrides: ScenarioOverrides;
  mode?: PracticeMode;
}

const KEY = 'firefly.draft';

export function loadDraft(): CallDraft | null {
  return readStorage<CallDraft | null>(KEY, null, 'session');
}
export function saveDraft(draft: CallDraft): void {
  writeStorage(KEY, draft, 'session');
}
export function clearDraft(): void {
  removeStorage(KEY, 'session');
}
