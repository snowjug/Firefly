import { describe, expect, it } from 'vitest';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGES,
  DIFFICULTIES,
  DIFFICULTY_RANK,
  IMPACTS,
  PROFICIENCIES,
  START_TEMPERATURES,
  STYLES,
} from '#shared/domain/vocab.ts';
import { seeded } from '../../test-rng.ts';
import { SETTING_NAMES, defaultChoices, type SetupChoices } from '../scenario/setup-model.ts';
import { CATALOGUE } from './atlas.fixtures.ts';
import {
  CORE_KEYS,
  CORE_SETTINGS,
  OPTION_EXPLANATIONS,
  PRESETS,
  coreParams,
  explainChange,
  explanationFor,
  interpolate,
  presetParams,
  type CoreParams,
} from './core-params.ts';

const BASE: SetupChoices = {
  impact: 'medium',
  startingTemperature: 'anxious',
  style: 'talkative',
  proficiency: 'intermediate',
  callStage: 'follow-up',
  difficulty: 'standard',
  curveballMode: 'recommended',
  curveballs: [],
};
const withChoices = (patch: Partial<SetupChoices>): SetupChoices => ({ ...BASE, ...patch });

describe('coreParams', () => {
  it.each([
    ['pressure', 'impact', { low: 0.2, medium: 0.55, high: 0.9 }],
    [
      'stability',
      'startingTemperature',
      { calm: 0.9, anxious: 0.65, frustrated: 0.4, angry: 0.18 },
    ],
    ['density', 'proficiency', { novice: 0.3, intermediate: 0.6, expert: 0.9 }],
    [
      'rhythm',
      'style',
      { talkative: 0.8, terse: 0.25, demanding: 0.65, vague: 0.45, 'non-native': 0.5 },
    ],
    [
      'horizon',
      'callStage',
      { 'first-contact': 0.2, 'follow-up': 0.5, escalated: 0.8, closure: 0.95 },
    ],
    ['complexity', 'difficulty', { starter: 0.25, standard: 0.55, challenge: 0.9 }],
  ] as const)('reads %s from the %s setting alone', (key, setting, expected) => {
    for (const [option, value] of Object.entries(expected)) {
      expect(coreParams(withChoices({ [setting]: option }))[key]).toBe(value);
    }
  });

  it('is 0 for disturbance when curveballs are off, and rises with difficulty when they are on', () => {
    const on = (difficulty: SetupChoices['difficulty']) =>
      coreParams(withChoices({ difficulty, curveballMode: 'choose', curveballs: ['deadline'] }));
    expect(on('starter').disturbance).toBe(0.25);
    expect(on('standard').disturbance).toBe(0.45);
    expect(on('challenge').disturbance).toBe(0.7);
    for (const difficulty of DIFFICULTIES) {
      expect(coreParams(withChoices({ difficulty, curveballMode: 'none' })).disturbance).toBe(0);
    }
  });

  it('follows the curveball switch the practice page shows, so Starter reads as off until one is chosen', () => {
    expect(coreParams(withChoices({ difficulty: 'starter' })).disturbance).toBe(0);
    expect(coreParams(withChoices({ difficulty: 'standard' })).disturbance).toBe(0.45);
    // "Choose" with nothing ticked means none.
    expect(coreParams(withChoices({ curveballMode: 'choose', curveballs: [] })).disturbance).toBe(
      0,
    );
  });

  it('stays between 0 and 1 for every combination of settings', () => {
    let checked = 0;
    for (const impact of IMPACTS)
      for (const startingTemperature of START_TEMPERATURES)
        for (const proficiency of PROFICIENCIES)
          for (const style of STYLES)
            for (const callStage of CALL_STAGES)
              for (const difficulty of DIFFICULTIES)
                for (const [curveballMode, curveballs] of [
                  ['recommended', []],
                  ['none', []],
                  ['choose', ['deadline']],
                ] as const) {
                  const core = coreParams({
                    impact,
                    startingTemperature,
                    proficiency,
                    style,
                    callStage,
                    difficulty,
                    curveballMode,
                    curveballs: [...curveballs],
                  });
                  for (const key of CORE_KEYS) {
                    expect(core[key]).toBeGreaterThanOrEqual(0);
                    expect(core[key]).toBeLessThanOrEqual(1);
                  }
                  checked += 1;
                }
    expect(checked).toBe(3 * 4 * 3 * 5 * 4 * 3 * 3);
  });

  it('never lowers a parameter when its setting goes up the scale', () => {
    const rises = (
      key: keyof CoreParams,
      setting: keyof SetupChoices,
      order: readonly string[],
      direction: 1 | -1,
    ) => {
      const values = order.map((option) => coreParams(withChoices({ [setting]: option }))[key]);
      for (let i = 1; i < values.length; i += 1) {
        expect(((values[i] as number) - (values[i - 1] as number)) * direction).toBeGreaterThan(0);
      }
    };
    rises('pressure', 'impact', IMPACTS, 1);
    rises('stability', 'startingTemperature', START_TEMPERATURES, -1);
    rises('density', 'proficiency', PROFICIENCIES, 1);
    rises('horizon', 'callStage', CALL_STAGES, 1);
    rises('complexity', 'difficulty', DIFFICULTIES, 1);
    rises('disturbance', 'difficulty', DIFFICULTIES.slice(1), 1);
  });

  it('keeps complexity and disturbance in step with how strict each difficulty is', () => {
    const profiles = [...DIFFICULTIES]
      .sort((a, b) => DIFFICULTY_RANK[a] - DIFFICULTY_RANK[b])
      .map((id) => DIFFICULTY_PROFILES[id]);
    for (let i = 1; i < profiles.length; i += 1) {
      const [easier, harder] = [profiles[i - 1], profiles[i]] as [
        (typeof profiles)[number],
        (typeof profiles)[number],
      ];
      expect(harder.patienceDecay).toBeGreaterThan(easier.patienceDecay);
      expect(harder.cooperation).toBeLessThan(easier.cooperation);
      expect(harder.startingTrust).toBeLessThan(easier.startingTrust);
      expect(harder.startingPatience).toBeLessThan(easier.startingPatience);
      expect(harder.maxCurveballs).toBeGreaterThanOrEqual(easier.maxCurveballs);
      const on = (difficulty: SetupChoices['difficulty']) =>
        coreParams(withChoices({ difficulty, curveballMode: 'choose', curveballs: ['deadline'] }));
      expect(on(harder.id).complexity).toBeGreaterThan(on(easier.id).complexity);
      expect(on(harder.id).disturbance).toBeGreaterThan(on(easier.id).disturbance);
    }
  });

  it('is moved by a setting only where that setting is the cause', () => {
    const random = seeded(31);
    const pick = random.pick;
    const owner: Record<string, readonly (keyof CoreParams)[]> = {
      impact: ['pressure'],
      startingTemperature: ['stability'],
      proficiency: ['density'],
      style: ['rhythm'],
      callStage: ['horizon'],
      difficulty: ['complexity', 'disturbance'],
    };
    const options: Record<string, readonly string[]> = {
      impact: IMPACTS,
      startingTemperature: START_TEMPERATURES,
      proficiency: PROFICIENCIES,
      style: STYLES,
      callStage: CALL_STAGES,
      difficulty: DIFFICULTIES,
    };
    for (let trial = 0; trial < 200; trial += 1) {
      const base = withChoices({
        impact: pick(IMPACTS),
        startingTemperature: pick(START_TEMPERATURES),
        proficiency: pick(PROFICIENCIES),
        style: pick(STYLES),
        callStage: pick(CALL_STAGES),
        difficulty: pick(DIFFICULTIES),
        curveballMode: pick(['recommended', 'none'] as const),
      });
      const setting = pick(Object.keys(owner));
      const changed = { ...base, [setting]: pick(options[setting] as readonly string[]) };
      const before = coreParams(base);
      const after = coreParams(changed);
      for (const key of CORE_KEYS) {
        if (!owner[setting]?.includes(key)) expect(after[key]).toBe(before[key]);
      }
    }
  });

  it('reads an option it does not know as the middle instead of breaking', () => {
    const odd = coreParams({
      ...BASE,
      impact: 'extreme',
      style: 'poetic',
    } as unknown as SetupChoices);
    expect(odd.pressure).toBe(0.5);
    expect(odd.rhythm).toBe(0.5);
    expect(odd.density).toBe(coreParams(BASE).density);
  });

  it('gives every real scenario a core, with the outage under more pressure than the first call', () => {
    const cores = new Map(CATALOGUE.map((s) => [s.id, coreParams(defaultChoices(s))]));
    for (const core of cores.values()) {
      for (const key of CORE_KEYS) expect(core[key]).toBeGreaterThanOrEqual(0);
    }
    const gentle = cores.get('locked-out-after-password-reset') as CoreParams;
    const intense = cores.get('checkout-outage-before-investor-event') as CoreParams;
    expect(intense.pressure).toBeGreaterThan(gentle.pressure);
    expect(intense.stability).toBeLessThan(gentle.stability);
    expect(intense.complexity).toBeGreaterThan(gentle.complexity);
    expect(intense.disturbance).toBeGreaterThan(gentle.disturbance);
  });
});

describe('interpolate', () => {
  const a = coreParams(
    withChoices({ impact: 'low', startingTemperature: 'calm', difficulty: 'starter' }),
  );
  const b = coreParams(
    withChoices({ impact: 'high', startingTemperature: 'angry', difficulty: 'challenge' }),
  );

  it('is exactly the first core at 0 and exactly the second at 1', () => {
    expect(interpolate(a, b, 0)).toEqual(a);
    expect(interpolate(a, b, 1)).toEqual(b);
  });

  it('is halfway at one half, and does not mind which way round', () => {
    const half = interpolate(a, b, 0.5);
    for (const key of CORE_KEYS) expect(half[key]).toBeCloseTo((a[key] + b[key]) / 2, 12);
    const back = interpolate(b, a, 0.3);
    const forth = interpolate(a, b, 0.7);
    for (const key of CORE_KEYS) expect(back[key]).toBeCloseTo(forth[key], 12);
  });

  it('holds at the ends for a time that is outside 0..1 or not a number', () => {
    expect(interpolate(a, b, -3)).toEqual(a);
    expect(interpolate(a, b, 7)).toEqual(b);
    expect(interpolate(a, b, Number.NaN)).toEqual(a);
    expect(interpolate(a, b, Number.POSITIVE_INFINITY)).toEqual(a);
  });

  it('stays bounded and between the two ends for any time', () => {
    const random = seeded(5);
    for (let i = 0; i < 300; i += 1) {
      const from = coreParams(
        withChoices({ impact: random.pick(IMPACTS), difficulty: random.pick(DIFFICULTIES) }),
      );
      const to = coreParams(
        withChoices({ style: random.pick(STYLES), callStage: random.pick(CALL_STAGES) }),
      );
      const point = interpolate(from, to, random.next());
      for (const key of CORE_KEYS) {
        expect(point[key]).toBeGreaterThanOrEqual(Math.min(from[key], to[key]));
        expect(point[key]).toBeLessThanOrEqual(Math.max(from[key], to[key]));
        expect(point[key]).toBeGreaterThanOrEqual(0);
        expect(point[key]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('moves every parameter steadily, so a glide never overshoots or doubles back', () => {
    const steps = Array.from({ length: 11 }, (_, i) => interpolate(a, b, i / 10));
    for (const key of CORE_KEYS) {
      const direction = Math.sign(b[key] - a[key]);
      for (let i = 1; i < steps.length; i += 1) {
        const move =
          ((steps[i] as CoreParams)[key] - (steps[i - 1] as CoreParams)[key]) * direction;
        expect(move).toBeGreaterThanOrEqual(-1e-12);
      }
    }
  });

  it('does not change what it is given', () => {
    const before = JSON.stringify([a, b]);
    interpolate(a, b, 0.4);
    expect(JSON.stringify([a, b])).toBe(before);
  });
});

describe('OPTION_EXPLANATIONS', () => {
  const FORBIDDEN =
    /score|grade|mark|rubric|criteri|hidden|evaluat|fail|weak|poor|bad|easy|hard|wrong|penal|shame/i;
  const everyOption = {
    impact: IMPACTS,
    startingTemperature: START_TEMPERATURES,
    proficiency: PROFICIENCIES,
    style: STYLES,
    callStage: CALL_STAGES,
    difficulty: DIFFICULTIES,
    curveballs: ['on', 'off'],
  } as const;

  it('has a sentence for every option of every setting, and no others', () => {
    expect(Object.keys(OPTION_EXPLANATIONS).sort()).toEqual(Object.keys(everyOption).sort());
    for (const [setting, options] of Object.entries(everyOption)) {
      const table = OPTION_EXPLANATIONS[setting as keyof typeof OPTION_EXPLANATIONS] as Record<
        string,
        string
      >;
      expect(Object.keys(table).sort()).toEqual([...options].sort());
      for (const option of options) expect(table[option]).toBeTruthy();
    }
  });

  it('are short, distinct, plain sentences that never judge, score or give anything away', () => {
    const seen = new Set<string>();
    for (const table of Object.values(OPTION_EXPLANATIONS)) {
      const sentences = Object.values(table) as string[];
      expect(new Set(sentences).size).toBe(sentences.length);
      for (const text of sentences) {
        expect(text).toMatch(/^[A-Z]/);
        expect(text).toMatch(/[.]$/);
        expect(text.length).toBeLessThanOrEqual(125);
        expect(text).not.toMatch(FORBIDDEN);
        seen.add(text);
      }
    }
    expect(seen.size).toBe(3 + 4 + 3 + 5 + 4 + 3 + 2);
  });

  it('says what high impact does in the words the screen is written to', () => {
    expect(OPTION_EXPLANATIONS.impact.high).toBe(
      'Higher pressure: the customer expects quick progress and will notice delays.',
    );
  });

  it('explains the option a set of choices holds, including the curveball switch', () => {
    expect(explanationFor(BASE, 'impact')).toBe(OPTION_EXPLANATIONS.impact.medium);
    expect(explanationFor(BASE, 'curveballs')).toBe(OPTION_EXPLANATIONS.curveballs.on);
    expect(explanationFor(withChoices({ curveballMode: 'none' }), 'curveballs')).toBe(
      OPTION_EXPLANATIONS.curveballs.off,
    );
    expect(explanationFor(withChoices({ difficulty: 'starter' }), 'curveballs')).toBe(
      OPTION_EXPLANATIONS.curveballs.off,
    );
  });

  it('lists the settings in the order the practice page does', () => {
    expect([...CORE_SETTINGS]).toEqual(Object.keys(SETTING_NAMES));
  });
});

describe('explainChange', () => {
  it('says nothing changed when nothing did, including a curveball choice that reads the same', () => {
    expect(explainChange(BASE, BASE)).toBe('Nothing has changed.');
    expect(
      explainChange(BASE, withChoices({ curveballMode: 'choose', curveballs: ['deadline'] })),
    ).toBe('Nothing has changed.');
  });

  it('explains a single change with the sentence for what it changed to', () => {
    expect(explainChange(BASE, withChoices({ impact: 'high' }))).toBe(
      OPTION_EXPLANATIONS.impact.high,
    );
    expect(explainChange(BASE, withChoices({ impact: 'low' }))).toBe(
      OPTION_EXPLANATIONS.impact.low,
    );
    expect(explainChange(BASE, withChoices({ style: 'vague' }))).toBe(
      OPTION_EXPLANATIONS.style.vague,
    );
    expect(explainChange(BASE, withChoices({ curveballMode: 'none' }))).toBe(
      OPTION_EXPLANATIONS.curveballs.off,
    );
  });

  it('describes several changes at once by how the call itself moved, in a fixed order', () => {
    expect(
      explainChange(
        withChoices({ impact: 'low', startingTemperature: 'calm' }),
        withChoices({ impact: 'high', startingTemperature: 'angry' }),
      ),
    ).toBe('The call now has more pressure and a less settled customer.');
    expect(
      explainChange(
        withChoices({ impact: 'high', startingTemperature: 'angry' }),
        withChoices({ impact: 'low', startingTemperature: 'calm' }),
      ),
    ).toBe('The call now has less pressure and a steadier customer.');
  });

  it('notices the curveballs a difficulty brings with it', () => {
    expect(explainChange(BASE, withChoices({ difficulty: 'starter' }))).toBe(
      'The call now has less to untangle and fewer surprises.',
    );
    expect(
      explainChange(
        withChoices({ difficulty: 'starter' }),
        withChoices({ difficulty: 'challenge' }),
      ),
    ).toBe('The call now has more to untangle and more chance of surprises.');
  });

  it('joins three or more changes in plain words', () => {
    expect(
      explainChange(
        withChoices({ impact: 'low', proficiency: 'novice', callStage: 'first-contact' }),
        withChoices({ impact: 'high', proficiency: 'expert', callStage: 'closure' }),
      ),
    ).toBe('The call now has more pressure, more technical detail and more history behind it.');
  });

  it('never mentions scoring or anything hidden', () => {
    const { pick } = seeded(8);
    for (let i = 0; i < 200; i += 1) {
      const text = explainChange(
        withChoices({ impact: pick(IMPACTS), difficulty: pick(DIFFICULTIES), style: pick(STYLES) }),
        withChoices({
          impact: pick(IMPACTS),
          difficulty: pick(DIFFICULTIES),
          callStage: pick(CALL_STAGES),
        }),
      );
      expect(text).not.toMatch(/score|hidden|criteri|rubric|evaluat|fail/i);
      expect(text).toMatch(/\.$/);
    }
  });
});

describe('PRESETS', () => {
  it('are the practice page quick starts: one for each difficulty, easiest first', () => {
    expect(PRESETS.map((p) => p.id)).toEqual([...DIFFICULTIES]);
    expect(PRESETS.map((p) => p.label)).toEqual(['Starter', 'Standard', 'Challenge']);
    for (const preset of PRESETS) {
      expect(preset.tagline.length).toBeGreaterThan(10);
      expect(preset.patch).toEqual({ difficulty: preset.id });
    }
  });

  it('lead to a core that rises in complexity and leaves the other settings as they were', () => {
    const targets = PRESETS.map((preset) => presetParams(BASE, preset));
    expect(targets.map((core) => core.complexity)).toEqual([0.25, 0.55, 0.9]);
    const current = coreParams(BASE);
    for (const target of targets) {
      for (const key of ['pressure', 'stability', 'density', 'rhythm', 'horizon'] as const) {
        expect(target[key]).toBe(current[key]);
      }
    }
    expect(presetParams(BASE, PRESETS[1] as (typeof PRESETS)[number])).toEqual(current);
  });

  it('can be glided to from where the core is now', () => {
    const challenge = PRESETS[2] as (typeof PRESETS)[number];
    const from = coreParams(BASE);
    const to = presetParams(BASE, challenge);
    expect(interpolate(from, to, 1)).toEqual(to);
    expect(interpolate(from, to, 0.5).complexity).toBeGreaterThan(from.complexity);
    expect(interpolate(from, to, 0.5).complexity).toBeLessThan(to.complexity);
  });
});
