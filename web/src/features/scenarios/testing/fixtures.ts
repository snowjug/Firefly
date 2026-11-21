import type { AppConfigDTO, PublicScenarioDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import type { SpeechCapabilitiesDTO } from '#shared/domain/speech.ts';
import { getScenarioLibrary } from '#server/scenarios/index.ts';
import { toPublicScenario } from '#server/services/dto.ts';

// Test data for this feature. Scenarios are the real library, mapped by the server's own function,
// so a test can never drift from what the API sends.

export function publicScenarios(): PublicScenarioDTO[] {
  return getScenarioLibrary().map(toPublicScenario);
}

export function scenarioById(id: string): PublicScenarioDTO {
  const found = publicScenarios().find((scenario) => scenario.id === id);
  if (!found) throw new Error(`No scenario "${id}" in the library`);
  return found;
}

/** One scenario at each difficulty, each with a different starting mood and style. */
export const SAMPLE = {
  starter: 'locked-out-after-password-reset',
  standard: 'team-cannot-open-shared-workspace',
  challenge: 'checkout-outage-before-investor-event',
  followUp: 'follow-up-no-recent-update',
} as const;

export const NO_SPEECH: SpeechCapabilitiesDTO = {
  provider: 'none',
  label: 'Not configured',
  demo: false,
  transcribe: false,
  synthesize: false,
  expressiveStyles: false,
  notice: null,
  limits: { maxAudioBytes: 2_000_000, maxAudioSeconds: 30, sampleRate: 16000 },
};

export const AZURE_SPEECH: SpeechCapabilitiesDTO = {
  ...NO_SPEECH,
  provider: 'azure-speech',
  label: 'Azure AI Speech',
  transcribe: true,
  synthesize: true,
  expressiveStyles: true,
};

export const DEMO_SPEECH: SpeechCapabilitiesDTO = {
  ...NO_SPEECH,
  provider: 'mock',
  label: 'Demo speech (scripted)',
  demo: true,
  transcribe: true,
  synthesize: true,
};

export function appConfig(overrides: Partial<AppConfigDTO> = {}): AppConfigDTO {
  return {
    app: { name: 'Firefly', version: '0.1.0' },
    provider: { kind: 'mock', label: 'Demo mode', demo: true, notice: null },
    speech: NO_SPEECH,
    limits: { maxMessageChars: 1000, maxTraineeTurns: 60 },
    features: { devDiagnostics: false, testHooks: false },
    ...overrides,
  };
}

export function sessionSummary(overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO {
  return {
    id: 'session-0001',
    scenarioId: SAMPLE.starter,
    scenarioTitle: 'Locked out after a password reset',
    issueType: 'sign-in-access',
    difficulty: 'starter',
    startingTemperature: 'calm',
    impact: 'low',
    style: 'talkative',
    mode: 'guided',
    providerKind: 'mock',
    providerLabel: 'Demo mode',
    status: 'completed',
    startedAt: '2026-11-20T10:00:00.000Z',
    endedAt: '2026-11-20T10:09:00.000Z',
    durationSeconds: 540,
    traineeTurns: 9,
    completion: 'completed',
    overallScore: 3.4,
    dimensionScores: null,
    ...overrides,
  };
}
