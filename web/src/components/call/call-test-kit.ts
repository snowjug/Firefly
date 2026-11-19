import { useMemo, useSyncExternalStore } from 'react';
import { vi } from 'vitest';
import type { SendMessageResponse, SessionDTO } from '#shared/domain/api.ts';
import type { VoiceCall, VoiceCallOptions } from '../../lib/voice/index.ts';

// Shared pieces for the call screen's tests: a session to render, a customer reply, a fake voice
// engine (the real one needs a microphone) and a way to say what kind of screen this is.

export const persona = {
  name: 'Maya Okafor',
  role: 'Receptionist',
  organisation: 'Northwind Clinic',
};

export function makeSession(over: Partial<SessionDTO> = {}): SessionDTO {
  return {
    id: 'session-1',
    scenarioId: 'demo',
    scenarioTitle: 'Demo',
    issueType: 'sign-in-access',
    difficulty: 'starter',
    startingTemperature: 'calm',
    impact: 'high',
    style: 'talkative',
    mode: 'guided',
    providerKind: 'mock',
    providerLabel: 'Demo mode',
    isSample: false,
    status: 'active',
    startedAt: new Date(Date.now() - 65_000).toISOString(),
    endedAt: null,
    durationSeconds: null,
    traineeTurns: 1,
    completion: null,
    overallScore: null,
    dimensionScores: null,
    mentorReviewed: false,
    scenario: {
      scenarioId: 'demo',
      title: 'Locked out after a password reset',
      summary: 'Summary',
      issueType: 'sign-in-access',
      tags: [],
      estimatedMinutes: 10,
      persona,
      brief: {
        situation: 'A customer cannot sign in.',
        goal: 'Find out what is happening.',
        groundRules: ['Everything is fictional.'],
      },
      config: {
        impact: 'high',
        startingTemperature: 'calm',
        proficiency: 'novice',
        style: 'talkative',
        callStage: 'first-contact',
        difficulty: 'starter',
        mode: 'guided',
        curveballsEnabled: false,
      },
      expectedDiscoveryAreas: ['When it started', 'The exact message on screen'],
      coachingFocus: ['scoping-discovery'],
    },
    turns: [
      {
        index: 1,
        role: 'customer',
        text: 'Hi, I cannot sign in to the staff portal.',
        createdAt: '2025-01-01T10:00:00.000Z',
        source: 'opening',
      },
    ],
    state: {
      band: { id: 'frustrated', label: 'Frustrated' },
      trend: 'rising',
      discoveredCount: 2,
      silent: false,
    },
    awaitingReply: null,
    evaluationPhase: null,
    evaluationError: null,
    report: null,
    ...over,
  };
}

/** The same call in immersive practice. */
export function immersive(session: SessionDTO): SessionDTO {
  return {
    ...session,
    mode: 'immersive',
    scenario: { ...session.scenario, config: { ...session.scenario.config, mode: 'immersive' } },
  };
}

let turnCounter = 10;

/** What the server answers when a message is sent. */
export function makeReply(
  text: string,
  over: Partial<SendMessageResponse['state']> = {},
  traineeText = 'Thanks for waiting.',
): SendMessageResponse {
  const base = makeSession().state;
  turnCounter += 2;
  return {
    traineeTurn: {
      index: turnCounter - 1,
      role: 'trainee',
      text: traineeText,
      createdAt: '2025-01-01T10:00:10.000Z',
      source: 'trainee',
    },
    customerTurn: {
      index: turnCounter,
      role: 'customer',
      text,
      createdAt: '2025-01-01T10:00:12.000Z',
      source: 'live',
    },
    state: { ...base, ...over },
    redactions: [],
    turnsRemaining: 50,
  };
}

/** What a browser answers to a media query. Everything else is "no". */
export function stubScreen({
  wide = false,
  coarse = false,
}: { wide?: boolean; coarse?: boolean } = {}) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches:
          (wide && query.includes('min-width: 961px')) ||
          (coarse && query.includes('pointer: coarse')),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

// ---------------------------------------------------------------------------------------
// A voice engine that does nothing but report what it is told to.

type VoiceState = Omit<
  VoiceCall,
  'start' | 'stop' | 'toggleMute' | 'talk' | 'speakCustomerReply' | 'replay' | 'stopSpeaking'
>;

const SUPPORTED: VoiceState['support'] = {
  recognition: true,
  synthesis: true,
  secureContext: true,
  reason: null,
};

const QUIET: VoiceState = {
  support: SUPPORTED,
  recognitionMode: 'unknown',
  status: 'off',
  interim: '',
  error: null,
  hint: null,
  muted: false,
  customerSpeaking: false,
};

function createFakeVoice() {
  const listeners = new Set<() => void>();
  let state: VoiceState = QUIET;
  let latest: VoiceCallOptions | null = null;
  const actions = {
    start: vi.fn(async () => undefined),
    stop: vi.fn(),
    toggleMute: vi.fn(),
    talk: vi.fn(),
    speakCustomerReply: vi.fn(),
    replay: vi.fn(),
    stopSpeaking: vi.fn(),
  };
  return {
    actions,
    /** The options the screen gave the engine on its latest render. */
    get options(): VoiceCallOptions {
      if (!latest) throw new Error('The screen has not asked for a voice engine yet');
      return latest;
    },
    reset() {
      state = QUIET;
      latest = null;
      for (const action of Object.values(actions)) action.mockClear();
      actions.start.mockImplementation(async () => undefined);
    },
    /** Changes what the engine reports; the screen re-renders. */
    set(next: Partial<VoiceState>) {
      state = { ...state, ...next };
      for (const listener of [...listeners]) listener();
    },
    /** Stands in for `useVoiceCall`. */
    useFake(options: VoiceCallOptions): VoiceCall {
      latest = options;
      const snapshot = useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => state,
      );
      return useMemo(() => ({ ...snapshot, ...actions }), [snapshot]);
    },
  };
}

export const fakeVoice = createFakeVoice();
export const voiceSupport = SUPPORTED;
