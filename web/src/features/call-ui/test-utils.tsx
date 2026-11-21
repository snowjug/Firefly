import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router';
import { vi, type Mock } from 'vitest';
import { AnnouncerProvider } from '../../design/index.ts';
import { installDialogShim } from '../../design/dialog-shim.ts';
import type { CallActions, CallSnapshot } from '../call/contract.ts';
import { CallWorkspace, type CallWorkspaceProps } from './CallWorkspace.tsx';
import { FIXTURES, type CallFixture, type FixtureName } from './call-fixtures.ts';

// Helpers shared by the call screen's tests: a fake set of actions, a stand-in for the browser's
// media queries (the screen picks its layout from them), a render that wraps what the screen needs
// around it (a router, the polite announcer and the `main` landmark the call layout provides), and
// an axe run for component tests.

export type FakeActions = { [Name in keyof CallActions]: Mock<CallActions[Name]> };

export function fakeActions(overrides: Partial<CallActions> = {}): FakeActions {
  return {
    begin: vi.fn<CallActions['begin']>(async () => undefined),
    talk: vi.fn<CallActions['talk']>(),
    stopTalking: vi.fn<CallActions['stopTalking']>(),
    toggleMute: vi.fn<CallActions['toggleMute']>(),
    togglePause: vi.fn<CallActions['togglePause']>(),
    setHandsFree: vi.fn<CallActions['setHandsFree']>(),
    setLanguage: vi.fn<CallActions['setLanguage']>(),
    useText: vi.fn<CallActions['useText']>(),
    setAudio: vi.fn<CallActions['setAudio']>(),
    interrupt: vi.fn<CallActions['interrupt']>(),
    replay: vi.fn<CallActions['replay']>(),
    sendText: vi.fn<CallActions['sendText']>(async () => true),
    retry: vi.fn<CallActions['retry']>(),
    dismissProblem: vi.fn<CallActions['dismissProblem']>(),
    endCall: vi.fn<CallActions['endCall']>(async () => ({ sessionId: 'ses_fixture_priya' })),
    ...overrides,
  } as FakeActions;
}

/** The widths the layouts start at, in CSS pixels: 64em and 80em. */
export const WIDTH = { narrow: 375, tablet: 768, medium: 1024, wide: 1440 } as const;

/**
 * Makes `matchMedia` answer for a window of this width (in CSS pixels). Without it the test DOM has no
 * media queries and the screen shows its narrow layout. Reduced motion is on unless asked otherwise,
 * so the waveform stays still and tests do not update state behind their own back.
 */
export function mockViewport(width: number, options: { reducedMotion?: boolean } = {}): void {
  const em = width / 16;
  const reducedMotion = options.reducedMotion ?? true;
  window.matchMedia = ((query: string): MediaQueryList => {
    const min = /\(min-width:\s*([\d.]+)em\)/.exec(query);
    const max = /\(max-width:\s*([\d.]+)em\)/.exec(query);
    let matches = false;
    if (min) matches = em >= Number(min[1]);
    else if (max) matches = em <= Number(max[1]);
    else if (/prefers-reduced-motion:\s*reduce/.test(query)) matches = reducedMotion;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  }) as typeof window.matchMedia;
}

export function clearViewport(): void {
  delete (window as { matchMedia?: unknown }).matchMedia;
}

export const DEMO = { demo: true, label: 'Demo mode (built-in rules engine)' };

export interface RenderedCall extends RenderResult {
  actions: FakeActions;
  /** Renders the same screen again with another snapshot, as the engine would publish one. */
  update(snapshot: CallSnapshot): void;
}

type Source = FixtureName | CallSnapshot;

export function snapshotOf(source: Source): CallSnapshot {
  return typeof source === 'string' ? FIXTURES[source].snapshot : source;
}

/** Renders the call screen for a fixture (or any snapshot) at a given window width. */
export function renderCall(
  source: Source,
  props: Partial<CallWorkspaceProps> & { width?: number; reducedMotion?: boolean } = {},
): RenderedCall {
  const { width = WIDTH.wide, reducedMotion, ...rest } = props;
  // jsdom has no modal dialogs: the design system's test shim gives it enough of them.
  installDialogShim();
  mockViewport(width, { reducedMotion });
  const actions = (rest.actions as FakeActions | undefined) ?? fakeActions();
  const view: CallFixture['view'] = typeof source === 'string' ? FIXTURES[source].view : undefined;
  const screen = (snapshot: CallSnapshot) => (
    <AnnouncerProvider>
      <MemoryRouter>
        <main id="main">
          <CallWorkspace
            snapshot={snapshot}
            actions={actions}
            provider={view?.provider ?? DEMO}
            online={view?.online}
            preferText={view?.preferText}
            initialUi={view?.initialUi}
            showInputMode={view?.showInputMode}
            {...rest}
          />
        </main>
      </MemoryRouter>
    </AnnouncerProvider>
  );
  const result = render(screen(snapshotOf(source)));
  return {
    ...result,
    actions,
    update: (snapshot) => result.rerender(screen(snapshot)),
  };
}

/** The visually hidden region that the page's announcer reads from. */
export function announced(): string {
  return document.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? '';
}

/**
 * Runs axe on what is rendered and returns one readable line per violation of a WCAG A or AA rule or
 * a best practice. The test DOM has no layout or colour engine, so contrast (and the rules that need
 * a scroll height) is left to the browser run; everything structural is checked here.
 */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  const results = await axe.run(root, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    },
    rules: {
      'color-contrast': { enabled: false },
      'scrollable-region-focusable': { enabled: false },
      region: { enabled: false },
    },
  });
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} :: ${violation.nodes
        .slice(0, 3)
        .map((node) => `${node.target.join(' ')} ${node.html.slice(0, 100)}`)
        .join(' | ')}`,
  );
}
