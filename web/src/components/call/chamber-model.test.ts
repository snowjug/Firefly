import { describe, expect, it } from 'vitest';
import { seeded, type Random } from '../../test-rng.ts';
import {
  buildPath,
  describeNode,
  isNearBottom,
  LABEL_TEXT_LIMIT,
  scrollIntent,
  type PathNode,
  type PathOptions,
} from './chamber-model.ts';
import type { ChatShift, ChatTurn } from './useCall.ts';

const stamp = (n: number) => `2025-01-01T10:00:${String(n % 60).padStart(2, '0')}.000Z`;

const customer = (n: number, over: Partial<ChatTurn> = {}): ChatTurn => ({
  key: `t${n}`,
  index: n,
  role: 'customer',
  text: `Customer says ${n}`,
  createdAt: stamp(n),
  status: 'sent',
  ...over,
});

const trainee = (n: number, over: Partial<ChatTurn> = {}): ChatTurn => ({
  ...customer(n),
  role: 'trainee',
  text: `Trainee says ${n}`,
  ...over,
});

/** The customer opens, then each side takes a turn: customer 1, trainee 2, customer 3, ... */
const conversation = (count: number): ChatTurn[] =>
  Array.from({ length: count }, (_, i) => (i % 2 === 0 ? customer(i + 1) : trainee(i + 1)));

const options = (over: Partial<PathOptions> = {}): PathOptions => ({
  signalKeys: [],
  shifts: [],
  cue: 'full',
  pending: false,
  ...over,
});

const emphases = (path: PathNode[]) => path.map((node) => node.emphasis);

describe('buildPath', () => {
  it('makes a node of every turn, in order, with its place on the path and its side', () => {
    const path = buildPath(conversation(3), options());
    expect(path.map((node) => node.key)).toEqual(['t1', 't2', 't3']);
    expect(path.map((node) => node.position)).toEqual([0, 1, 2]);
    expect(path.map((node) => node.side)).toEqual(['start', 'end', 'start']);
    expect(path[1]).toMatchObject({
      index: 2,
      role: 'trainee',
      text: 'Trainee says 2',
      createdAt: stamp(2),
      status: 'sent',
    });
  });

  it('is an empty path for an empty conversation', () => {
    expect(buildPath([], options())).toEqual([]);
    expect(buildPath([], options({ pending: true }))).toEqual([]);
  });

  it('carries the error and saved flag of a message that did not get through, and only then', () => {
    const failed = trainee(4, {
      key: 'k4',
      index: null,
      status: 'failed',
      saved: true,
      error: 'Not delivered.',
    });
    const [node] = buildPath([failed], options());
    expect(node).toMatchObject({
      key: 'k4',
      index: null,
      status: 'failed',
      saved: true,
      error: 'Not delivered.',
    });
    // A retry clears the error by setting it to undefined: that must not leave a key behind.
    const [retrying] = buildPath([{ ...failed, status: 'sending', error: undefined }], options());
    expect('error' in (retrying as PathNode)).toBe(false);
    const [plain] = buildPath([customer(1)], options());
    expect('error' in (plain as PathNode)).toBe(false);
    expect('saved' in (plain as PathNode)).toBe(false);
  });

  describe('emphasis', () => {
    it('is on the customer’s latest turn, with the two before it recent and the rest settled', () => {
      expect(emphases(buildPath(conversation(7), options()))).toEqual([
        'settled',
        'settled',
        'settled',
        'settled',
        'recent',
        'recent',
        'active',
      ]);
      expect(emphases(buildPath(conversation(1), options()))).toEqual(['active']);
      expect(emphases(buildPath(conversation(2), options()))).toEqual(['active', 'recent']);
    });

    it('is on the trainee’s own message while it is being sent', () => {
      const turns = [...conversation(3), trainee(4, { key: 'k4', index: null, status: 'sending' })];
      expect(emphases(buildPath(turns, options({ pending: true })))).toEqual([
        'settled',
        'recent',
        'recent',
        'active',
      ]);
      // A message still marked as sending is enough, even before the screen says it is pending.
      expect(emphases(buildPath(turns, options()))).toEqual([
        'settled',
        'recent',
        'recent',
        'active',
      ]);
    });

    it('treats a pending call as waiting on the trainee’s last message', () => {
      expect(emphases(buildPath(conversation(4), options({ pending: true })))).toEqual([
        'settled',
        'recent',
        'recent',
        'active',
      ]);
    });

    it('stays with the customer when the reply is pending but the last turn is theirs', () => {
      expect(emphases(buildPath(conversation(3), options({ pending: true })))).toEqual([
        'recent',
        'recent',
        'active',
      ]);
    });

    it('stays with the customer’s turn when a message did not get through, and that message is recent', () => {
      const turns = [...conversation(3), trainee(4, { key: 'k4', index: null, status: 'failed' })];
      expect(emphases(buildPath(turns, options()))).toEqual([
        'recent',
        'recent',
        'active',
        'recent',
      ]);
    });

    it('goes to the newest turn when no customer has spoken', () => {
      const failed = (key: string): ChatTurn =>
        trainee(1, { key, index: null, status: 'failed', saved: false });
      expect(emphases(buildPath([failed('a')], options()))).toEqual(['active']);
      expect(emphases(buildPath([failed('a'), failed('b'), failed('c')], options()))).toEqual([
        'recent',
        'recent',
        'active',
      ]);
    });

    it('does not depend on cues: even immersive practice attends to the latest turn', () => {
      expect(emphases(buildPath(conversation(7), options({ cue: 'none' })))).toEqual(
        emphases(buildPath(conversation(7), options())),
      );
    });
  });

  describe('marks', () => {
    const shifts: ChatShift[] = [
      {
        afterKey: 't3',
        kind: 'band',
        from: { id: 'calm', label: 'Calm' },
        to: { id: 'angry', label: 'Angry' },
        direction: 'tenser',
      },
      { afterKey: 't3', kind: 'silent' },
      { afterKey: 't3', kind: 'curveball' },
      { afterKey: 't5', kind: 'curveball' },
      { afterKey: 'gone', kind: 'curveball' },
    ];

    it('puts a signal first, then the shifts, in the order they happened, on the right turn', () => {
      const path = buildPath(
        conversation(5),
        options({ signalKeys: ['t3', 't5', 'unknown'], shifts }),
      );
      expect(path.map((node) => node.marks.length)).toEqual([0, 0, 4, 0, 2]);
      expect(path[2]?.marks).toEqual([
        { kind: 'signal' },
        { kind: 'shift', shift: shifts[0] },
        { kind: 'shift', shift: shifts[1] },
        { kind: 'shift', shift: shifts[2] },
      ]);
      expect(path[4]?.marks).toEqual([{ kind: 'signal' }, { kind: 'shift', shift: shifts[3] }]);
    });

    it('marks a turn once however often it is listed, and ignores shifts after unknown turns', () => {
      const path = buildPath(
        conversation(3),
        options({ signalKeys: ['t3', 't3', 't3'], shifts: [{ afterKey: 'gone', kind: 'silent' }] }),
      );
      expect(path.map((node) => node.marks)).toEqual([[], [], [{ kind: 'signal' }]]);
    });

    it('leaves the path as plain text when cues are off, whatever it is given', () => {
      const path = buildPath(
        conversation(5),
        options({ cue: 'none', signalKeys: ['t3', 't5'], shifts }),
      );
      expect(path).toHaveLength(5);
      for (const node of path) expect(node.marks).toEqual([]);
    });

    it('gives every node a marks list of its own', () => {
      const path = buildPath(conversation(3), options());
      path[0]?.marks.push({ kind: 'signal' });
      expect(path.map((node) => node.marks.length)).toEqual([1, 0, 0]);
    });
  });

  it('leaves its inputs alone', () => {
    const turns = Object.freeze(conversation(4).map((turn) => Object.freeze(turn)));
    const frozen = Object.freeze({
      signalKeys: Object.freeze(['t3']),
      shifts: Object.freeze([Object.freeze<ChatShift>({ afterKey: 't3', kind: 'curveball' })]),
      cue: 'full' as const,
      pending: false,
    });
    const path = buildPath(turns, frozen);
    expect(path).toHaveLength(4);
    expect(buildPath(turns, frozen)).toEqual(path);
  });
});

describe('buildPath on random conversations', () => {
  function randomTurns(rand: Random): ChatTurn[] {
    return Array.from({ length: rand.int(0, 14) }, (_, i) => {
      const status = rand.pick(['sent', 'sent', 'sent', 'sending', 'failed'] as const);
      return {
        key: `k${i}`,
        index: status === 'sent' ? i + 1 : rand.chance(0.5) ? null : i + 1,
        role: rand.chance(0.5) ? 'customer' : 'trainee',
        text: `turn ${i}`,
        createdAt: stamp(i),
        status,
        ...(status === 'failed' ? { error: 'Not delivered.', saved: rand.chance(0.5) } : {}),
      };
    });
  }

  function randomShifts(rand: Random, turns: readonly ChatTurn[]): ChatShift[] {
    return Array.from({ length: rand.int(0, 6) }, () => ({
      afterKey: rand.chance(0.9) && turns.length > 0 ? rand.pick(turns).key : 'gone',
      kind: rand.pick(['band', 'silent', 'curveball'] as const),
    }));
  }

  function eachTrial(
    seed: number,
    run: (trial: {
      label: string;
      turns: ChatTurn[];
      shifts: ChatShift[];
      signalKeys: string[];
      pending: boolean;
    }) => void,
  ) {
    const rand = seeded(seed);
    for (let n = 0; n < 500; n++) {
      const turns = randomTurns(rand);
      run({
        label: `seed ${seed}, trial ${n}`,
        turns,
        shifts: randomShifts(rand, turns),
        signalKeys: turns.filter(() => rand.chance(0.3)).map((turn) => turn.key),
        pending: rand.chance(0.4),
      });
    }
  }

  it('keeps every turn in order, in its place, on its side', () => {
    eachTrial(401, ({ label, turns, shifts, signalKeys, pending }) => {
      const path = buildPath(turns, { signalKeys, shifts, cue: 'full', pending });
      expect(
        path.map((node) => node.key),
        label,
      ).toEqual(turns.map((turn) => turn.key));
      expect(
        path.map((node) => node.position),
        label,
      ).toEqual(turns.map((_, i) => i));
      path.forEach((node, i) => {
        const turn = turns[i] as ChatTurn;
        expect(node.side, label).toBe(turn.role === 'customer' ? 'start' : 'end');
        expect(node.status, label).toBe(turn.status);
        expect(node.index, label).toBe(turn.index);
        expect(node.text, label).toBe(turn.text);
      });
    });
  });

  it('attends to exactly one turn, and settles only what is older than the two before it', () => {
    eachTrial(402, ({ label, turns, shifts, signalKeys, pending }) => {
      const path = buildPath(turns, { signalKeys, shifts, cue: 'full', pending });
      if (turns.length === 0) return;
      const last = turns[turns.length - 1] as ChatTurn;
      const lastCustomer = turns.map((turn) => turn.role).lastIndexOf('customer');
      const waiting = last.role === 'trainee' && (last.status === 'sending' || pending);
      const active = waiting || lastCustomer < 0 ? turns.length - 1 : lastCustomer;
      expect(
        path.filter((node) => node.emphasis === 'active'),
        label,
      ).toHaveLength(1);
      path.forEach((node, i) => {
        const expected = i === active ? 'active' : i >= active - 2 ? 'recent' : 'settled';
        expect(node.emphasis, `${label}, turn ${i}`).toBe(expected);
      });
    });
  });

  it('marks exactly the signals and shifts that belong to a turn, and only with full cues', () => {
    eachTrial(403, ({ label, turns, shifts, signalKeys, pending }) => {
      const full = buildPath(turns, { signalKeys, shifts, cue: 'full', pending });
      for (const node of full) {
        const signals = signalKeys.includes(node.key) ? 1 : 0;
        const changes = shifts.filter((shift) => shift.afterKey === node.key).length;
        expect(node.marks, label).toHaveLength(signals + changes);
        expect(
          node.marks.filter((mark) => mark.kind === 'signal'),
          label,
        ).toHaveLength(signals);
      }
      const none = buildPath(turns, { signalKeys, shifts, cue: 'none', pending });
      expect(none, label).toEqual(full.map((node) => ({ ...node, marks: [] })));
    });
  });
});

describe('isNearBottom', () => {
  // A 1000 px tall conversation in a 100 px window: the bottom is at scrollTop 900.
  const at = (scrollTop: number) => ({ scrollTop, clientHeight: 100, scrollHeight: 1000 });

  it('is true at the bottom and within the slack of it, false beyond', () => {
    expect(isNearBottom(at(900))).toBe(true);
    expect(isNearBottom(at(804))).toBe(true);
    expect(isNearBottom(at(803))).toBe(false);
    expect(isNearBottom(at(0))).toBe(false);
  });

  it('uses the slack it is given, and none at all for zero or less', () => {
    expect(isNearBottom(at(700), 200)).toBe(true);
    expect(isNearBottom(at(699), 200)).toBe(false);
    expect(isNearBottom(at(900), 0)).toBe(true);
    expect(isNearBottom(at(899), 0)).toBe(false);
    expect(isNearBottom(at(899), -50)).toBe(false);
    expect(isNearBottom(at(900), -50)).toBe(true);
  });

  it('copes with fractional positions, overscroll and content shorter than the window', () => {
    expect(isNearBottom(at(803.5))).toBe(false);
    expect(isNearBottom(at(804.5))).toBe(true);
    expect(isNearBottom(at(930))).toBe(true);
    expect(isNearBottom({ scrollTop: 0, clientHeight: 500, scrollHeight: 300 })).toBe(true);
  });

  it('counts a missing measurement as near, so the view keeps following', () => {
    expect(isNearBottom({ scrollTop: Number.NaN, clientHeight: 100, scrollHeight: 1000 })).toBe(
      true,
    );
  });
});

describe('scrollIntent', () => {
  it('sticks for the trainee’s own message, wherever the reader was', () => {
    expect(scrollIntent(true, 'trainee')).toBe('stick');
    expect(scrollIntent(false, 'trainee')).toBe('stick');
  });

  it('sticks for the customer’s reply only if the reader was at the end', () => {
    expect(scrollIntent(true, 'customer')).toBe('stick');
    expect(scrollIntent(false, 'customer')).toBe('hold');
  });

  it('lets a reader look back without being pulled away, and brings them back when they reply', () => {
    // At the end; scrolls up to re-read; the customer answers (hold); they reply (stick); the
    // view is at the end again, so the next answer follows.
    let near = isNearBottom({ scrollTop: 900, clientHeight: 100, scrollHeight: 1000 });
    expect(scrollIntent(near, 'customer')).toBe('stick');
    near = isNearBottom({ scrollTop: 200, clientHeight: 100, scrollHeight: 1200 });
    expect(scrollIntent(near, 'customer')).toBe('hold');
    expect(scrollIntent(near, 'trainee')).toBe('stick');
    near = isNearBottom({ scrollTop: 1300, clientHeight: 100, scrollHeight: 1400 });
    expect(scrollIntent(near, 'customer')).toBe('stick');
  });
});

describe('describeNode', () => {
  const node = (over: Partial<PathNode> = {}): PathNode => ({
    key: 't7',
    index: 7,
    role: 'customer',
    text: 'Hello there',
    createdAt: stamp(7),
    status: 'sent',
    position: 6,
    side: 'start',
    emphasis: 'settled',
    marks: [],
    ...over,
  });

  it('names the turn, who spoke and what was said', () => {
    expect(describeNode(node(), 'Maya')).toBe('Turn 7, Maya: Hello there');
    expect(
      describeNode(node({ index: 8, role: 'trainee', position: 7, side: 'end' }), 'Maya'),
    ).toBe('Turn 8, you: Hello there');
  });

  it('numbers a message that is still being sent by its place on the path', () => {
    const sending = node({ index: null, role: 'trainee', status: 'sending', position: 9 });
    expect(describeNode(sending, 'Maya')).toBe('Turn 10, you: Hello there');
  });

  it('speaks of the customer when there is no name, and says nothing after an empty message', () => {
    expect(describeNode(node(), '  ')).toBe('Turn 7, the customer: Hello there');
    expect(describeNode(node({ text: ' \n ' }), 'Maya')).toBe('Turn 7, Maya');
  });

  it('puts a turn on one line', () => {
    expect(describeNode(node({ text: '  Hello\n\n  there\t friend ' }), 'Maya')).toBe(
      'Turn 7, Maya: Hello there friend',
    );
  });

  it('adds nothing about marks or delivery', () => {
    const marked = node({
      status: 'failed',
      error: 'Not delivered.',
      marks: [{ kind: 'signal' }, { kind: 'shift', shift: { afterKey: 't7', kind: 'curveball' } }],
    });
    expect(describeNode(marked, 'Maya')).toBe('Turn 7, Maya: Hello there');
  });

  describe('a long turn', () => {
    const body = (label: string) => label.slice('Turn 7, Maya: '.length);

    it('is left whole up to the limit and shortened with an ellipsis beyond it', () => {
      const atLimit = 'a'.repeat(LABEL_TEXT_LIMIT);
      expect(body(describeNode(node({ text: atLimit }), 'Maya'))).toBe(atLimit);
      const over = body(describeNode(node({ text: 'a'.repeat(LABEL_TEXT_LIMIT + 1) }), 'Maya'));
      expect(over).toBe(`${'a'.repeat(LABEL_TEXT_LIMIT - 1)}…`);
      expect(over).toHaveLength(LABEL_TEXT_LIMIT);
    });

    it('is cut between words, not through one', () => {
      const text = `${'word '.repeat(40)}end`;
      const shortened = body(describeNode(node({ text }), 'Maya'));
      expect(shortened.length).toBeLessThanOrEqual(LABEL_TEXT_LIMIT);
      expect(shortened.endsWith('word…')).toBe(true);
      expect(shortened).toMatch(/^(?:word )*word…$/);
    });

    it('drops a comma, full stop or dash left dangling before the ellipsis', () => {
      const stem = 'a'.repeat(130);
      for (const mark of [',', '.', ';', ' \u2014', ' -']) {
        const text = `${stem}${mark} ${'b'.repeat(40)}`;
        expect(body(describeNode(node({ text }), 'Maya')), JSON.stringify(mark)).toBe(`${stem}…`);
      }
      // A mark that carries meaning stays.
      const asked = `${stem}? ${'b'.repeat(40)}`;
      expect(body(describeNode(node({ text: asked }), 'Maya'))).toBe(`${stem}?…`);
    });

    it('only cuts through a word that is longer than the room, and never through an emoji', () => {
      const wellFormed = (text: string) => {
        try {
          encodeURIComponent(text);
          return true;
        } catch {
          return false;
        }
      };
      const emoji = '😀'.repeat(200);
      const shortened = body(describeNode(node({ text: emoji }), 'Maya'));
      expect(wellFormed(shortened)).toBe(true);
      expect(shortened.endsWith('…')).toBe(true);
      expect(shortened.length).toBeLessThanOrEqual(LABEL_TEXT_LIMIT);
    });

    it('holds for random texts: short enough, cut at a word, and the start of what was said', () => {
      const rand = seeded(501);
      const gaps = [' ', ' ', ' ', '  ', '\n', '\t', ' \n '];
      for (let n = 0; n < 500; n++) {
        const words = Array.from({ length: rand.int(0, 60) }, () =>
          'abcdefghij'.slice(0, rand.int(1, 10)).concat(rand.pick(['', '', '', ',', '.', '!'])),
        );
        const text = words.map((word) => word + rand.pick(gaps)).join('');
        const flat = text.replace(/\s+/g, ' ').trim();
        const label = describeNode(node({ text }), 'Maya');
        const said = flat === '' ? '' : body(label);
        expect(said.length, `trial ${n}`).toBeLessThanOrEqual(LABEL_TEXT_LIMIT);
        if (flat.length <= LABEL_TEXT_LIMIT) {
          expect(said, `trial ${n}`).toBe(flat);
          continue;
        }
        expect(said.endsWith('…'), `trial ${n}`).toBe(true);
        const kept = said.slice(0, -1);
        expect(flat.startsWith(kept), `trial ${n}`).toBe(true);
        expect(flat.slice(kept.length), `trial ${n}`).toMatch(/^[\s,;:.\u2013\u2014-]*\s/);
      }
    });
  });
});
