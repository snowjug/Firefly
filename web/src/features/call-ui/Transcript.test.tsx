import { createElement, type ComponentProps } from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallSnapshot, CallTurn } from '../call/contract.ts';
import { FIXTURES } from './call-fixtures.ts';
import { clearViewport, renderCall, WIDTH } from './test-utils.tsx';

// A long call must stay cheap to keep on screen. The screen draws again whenever the snapshot changes
// (the clock ticks every second and the microphone level up to fifteen times a second), and each of
// those used to draw every turn of the transcript again. Each customer row draws exactly one avatar,
// so counting avatars counts the rows that were drawn.
const drawn = vi.hoisted(() => ({ rows: 0 }));

vi.mock('../../design/index.ts', async (importOriginal) => {
  const design = await importOriginal<typeof import('../../design/index.ts')>();
  return {
    ...design,
    Avatar: (props: ComponentProps<typeof design.Avatar>) => {
      if (props.className === 'cw-turn__avatar') drawn.rows += 1;
      return createElement(design.Avatar, props);
    },
  };
});

const base: CallSnapshot = FIXTURES['long-transcript'].snapshot;

beforeEach(() => {
  drawn.rows = 0;
});
afterEach(() => {
  cleanup();
  clearViewport();
});

function customerTurn(index: number): CallTurn {
  return {
    key: `t${index}`,
    index,
    role: 'customer',
    text: 'Thanks, that helps.',
    inputMode: 'text',
    createdAt: '2026-11-21T09:30:00.000Z',
    status: 'sent',
    clientMessageId: null,
    interrupted: false,
  };
}

describe('the transcript of a long call', () => {
  it('draws every turn once to begin with', () => {
    renderCall(base, { width: WIDTH.wide });
    const customerTurns = base.turns.filter((turn) => turn.role === 'customer').length;
    expect(customerTurns).toBeGreaterThan(20);
    expect(drawn.rows).toBe(customerTurns);
  });

  it('does not draw a turn again when only the clock or the microphone level changes', () => {
    const view = renderCall(base, { width: WIDTH.wide });
    const once = drawn.rows;
    for (let tick = 1; tick <= 5; tick += 1) {
      view.update({ ...base, elapsedSeconds: base.elapsedSeconds + tick });
      view.update({ ...base, micLevel: tick / 10, customerLevel: tick / 20 });
    }
    expect(drawn.rows).toBe(once);
  });

  it('draws only what is new when a turn arrives, not the whole call again', () => {
    const view = renderCall(base, { width: WIDTH.wide });
    const once = drawn.rows;
    view.update({ ...base, turns: [...base.turns, customerTurn(base.turns.length + 1)] });
    // The new turn, and the one that has just stopped being among the newest and so became "old".
    expect(drawn.rows - once).toBeLessThanOrEqual(2);
    expect(drawn.rows - once).toBeGreaterThanOrEqual(1);
  });
});
