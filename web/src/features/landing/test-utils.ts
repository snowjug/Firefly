import { act } from '@testing-library/react';
import { vi } from 'vitest';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import {
  CALL_STAGES,
  PRODUCT_FAMILY_LABELS,
  PRODUCT_INFO,
  type Difficulty,
  type ProductId,
} from '#shared/domain/vocab.ts';
import type { FakeRaf } from '../../design/interaction/test-utils.ts';

// Helpers for the landing page's tests. jsdom has no layout, no IntersectionObserver and no
// animation frames a test can step, so each is stood in for here.

/** An IntersectionObserver the test controls: `report` says whether the observed element is in view. */
export class FakeObserver {
  static all: FakeObserver[] = [];
  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit | undefined;
  private target: Element | null = null;
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeObserver.all.push(this);
  }
  observe(element: Element) {
    this.target = element;
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  report(isIntersecting: boolean) {
    const target = this.target;
    if (!target) throw new Error('Nothing was observed');
    act(() => {
      this.callback([{ isIntersecting, target } as IntersectionObserverEntry], this as never);
    });
  }
}

/** Replaces IntersectionObserver with `FakeObserver` and forgets earlier observers. */
export function stubIntersection(): typeof FakeObserver {
  FakeObserver.all = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  return FakeObserver;
}

/** The observers that are still watching something, oldest first. */
export const live = () => FakeObserver.all.filter((observer) => !observer.disconnected);

/**
 * Steps the fake animation frames 100 ms apart, as a browser would, so the loop clock advances by
 * `ms`. The first frame after a start or a resume is only a starting point, so one frame with no
 * time in it goes first.
 */
export function stepper(raf: FakeRaf) {
  let now = 1000;
  return {
    advance(ms: number) {
      raf.frame(now);
      for (let spent = 0; spent < ms; spent += 100) {
        now += Math.min(100, ms - spent);
        raf.frame(now);
      }
    },
  };
}

/** A made-up scenario of the public shape: just enough for a card, with everything else neutral. */
export function makeScenario(
  id: string,
  product: ProductId,
  difficulty: Difficulty = 'standard',
): PublicScenarioDTO {
  const info = PRODUCT_INFO[product];
  return {
    id,
    version: 1,
    title: `The full title of ${id}`,
    shortTitle: `Short ${id}`,
    listSummary: 'A made-up scenario for a test.',
    summary: 'A made-up scenario for a test.',
    tags: [],
    estimatedMinutes: 10,
    product: {
      id: product,
      name: info.name,
      family: info.family,
      familyLabel: PRODUCT_FAMILY_LABELS[info.family],
      area: 'Area',
    },
    caseReference: null,
    issueType: 'sign-in-access',
    impact: 'medium',
    startingTemperature: 'anxious',
    proficiency: 'intermediate',
    style: 'talkative',
    callStage: 'first-contact',
    difficulty,
    persona: { name: 'Test Person', role: 'Tester', organisation: 'Test Organisation' },
    publicBrief: {
      issue: 'Something is wrong.',
      impact: { low: 'A little.', medium: 'Some.', high: 'A lot.' },
      objective: 'Find out what happened.',
    },
    brief: { situation: 'A situation.', goal: 'A goal.', groundRules: [] },
    stageBriefs: Object.fromEntries(CALL_STAGES.map((stage) => [stage, ''])) as Record<
      (typeof CALL_STAGES)[number],
      string
    >,
    expectedDiscoveryAreas: [],
    coachingFocus: ['clarity'],
    curveballOptions: [],
    synthetic: true,
  };
}
