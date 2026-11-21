// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ScenarioOverridesSchema } from '#shared/domain/scenario.ts';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import {
  CONFIG_KEYS,
  briefPath,
  changedFromDefault,
  complicationsChip,
  defaultConfig,
  editPath,
  fitCurveballs,
  hintsOn,
  inspectConfig,
  parseConfig,
  parseConfigQuery,
  serializeConfig,
  summarise,
  toOverrides,
  toSearch,
  withDifficulty,
  type CallConfig,
} from './config-params.ts';
import { SAMPLE, publicScenarios, scenarioById } from './testing/fixtures.ts';

const starter = scenarioById(SAMPLE.starter);
const standard = scenarioById(SAMPLE.standard);
const challenge = scenarioById(SAMPLE.challenge);

const query = (config: CallConfig, scenario = standard) =>
  toSearch(serializeConfig(config, scenario));

describe('the query contract with the report page', () => {
  it('reads exactly these eight keys', () => {
    expect([...CONFIG_KEYS]).toEqual([
      'difficulty',
      'impact',
      'temperature',
      'proficiency',
      'style',
      'stage',
      'curveballs',
      'hints',
    ]);
    const config = parseConfig(
      'difficulty=challenge&impact=low&temperature=anxious&proficiency=expert&style=vague&stage=closure&curveballs=deadline&hints=on',
      standard,
    );
    expect(config).toEqual({
      difficulty: 'challenge',
      impact: 'low',
      temperature: 'anxious',
      proficiency: 'expert',
      style: 'vague',
      stage: 'closure',
      curveballs: { mode: 'choose', types: ['deadline'] },
      hints: true,
    });
  });

  it('accepts a leading question mark and a URLSearchParams', () => {
    expect(parseConfig('?difficulty=starter', standard).difficulty).toBe('starter');
    expect(parseConfig(new URLSearchParams({ difficulty: 'starter' }), standard).difficulty).toBe(
      'starter',
    );
  });

  it('writes the same keys back, and only for what differs from the scenario', () => {
    const config: CallConfig = {
      ...defaultConfig(standard),
      difficulty: 'challenge',
      temperature: 'angry',
      stage: 'escalated',
      curveballs: { mode: 'none' },
      hints: true,
    };
    const params = serializeConfig(config, standard);
    expect([...params.keys()]).toEqual([
      'difficulty',
      'temperature',
      'stage',
      'curveballs',
      'hints',
    ]);
    expect(params.get('curveballs')).toBe('none');
    expect(params.get('hints')).toBe('on');
  });
});

describe('invalid input is ignored, never thrown', () => {
  it('falls back to the scenario for anything that is not valid', () => {
    const search =
      'difficulty=nightmare&impact=&temperature=boiling&proficiency=%00&style=rude&stage=later&curveballs=nonsense&hints=maybe';
    expect(() => parseConfig(search, standard)).not.toThrow();
    expect(parseConfig(search, standard)).toEqual(defaultConfig(standard));
  });

  it('keeps the valid keys and reports the ignored ones', () => {
    const { config, ignored } = inspectConfig(
      'difficulty=starter&impact=huge&hints=maybe&stage=',
      standard,
    );
    expect(config.difficulty).toBe('starter');
    expect(config.impact).toBe(standard.impact);
    expect(ignored).toEqual(['impact', 'hints']);
  });

  it('survives hostile and oversized values', () => {
    const search = `difficulty=${'x'.repeat(5000)}&curveballs=${','.repeat(5000)}&style[]=terse&__proto__=1`;
    expect(parseConfig(search, challenge)).toEqual(defaultConfig(challenge));
  });

  it('matches values exactly: the case counts, spaces around a value do not', () => {
    const { config, ignored } = inspectConfig(
      'difficulty=Starter&hints=ON&stage=First-Contact&impact=%20high%20',
      standard,
    );
    expect(config.difficulty).toBe(standard.difficulty);
    expect(config.hints).toBeNull();
    expect(config.stage).toBe(standard.callStage);
    expect(config.impact).toBe('high');
    expect(ignored).toEqual(['difficulty', 'stage', 'hints']);
  });

  it('takes the first of a key given twice', () => {
    expect(parseConfig('difficulty=starter&difficulty=challenge', standard).difficulty).toBe(
      'starter',
    );
  });

  it('drops each invalid key to undefined on its own, and keeps the valid ones', () => {
    expect(
      parseConfigQuery({
        difficulty: 'nightmare',
        impact: 'high',
        temperature: 'boiling',
        proficiency: undefined,
        style: 'rude',
        stage: 'closure',
        curveballs: 'anything, read later',
        hints: 'maybe',
      }),
    ).toEqual({
      difficulty: undefined,
      impact: 'high',
      temperature: undefined,
      proficiency: undefined,
      style: undefined,
      stage: 'closure',
      curveballs: 'anything, read later',
      hints: undefined,
    });
  });
});

describe('serialising keeps URLs short', () => {
  it('writes nothing for the scenario as written, and reads nothing back', () => {
    for (const scenario of publicScenarios()) {
      expect(query(defaultConfig(scenario), scenario)).toBe('');
    }
  });

  it('round-trips every scenario with a mix of changes', () => {
    for (const scenario of publicScenarios()) {
      const config: CallConfig = {
        difficulty: scenario.difficulty === 'challenge' ? 'starter' : 'challenge',
        impact: scenario.impact === 'low' ? 'high' : 'low',
        temperature: scenario.startingTemperature === 'angry' ? 'calm' : 'angry',
        proficiency: scenario.proficiency === 'expert' ? 'novice' : 'expert',
        style: scenario.style === 'terse' ? 'talkative' : 'terse',
        stage: scenario.callStage === 'closure' ? 'first-contact' : 'closure',
        curveballs: { mode: 'choose', types: ['deadline'] },
        hints: true,
      };
      const normalised = parseConfig(serializeConfig(config, scenario), scenario);
      // Hints that say what the difficulty says anyway are the same as no value.
      expect(normalised).toEqual({
        ...config,
        hints: config.difficulty === 'starter' ? null : true,
      });
      expect(toSearch(serializeConfig(normalised, scenario))).toBe(query(config, scenario));
    }
  });

  it('writes commas as commas', () => {
    const config: CallConfig = {
      ...defaultConfig(challenge),
      curveballs: { mode: 'choose', types: ['ask-manager', 'deadline'] },
    };
    expect(query(config, challenge)).toBe('?curveballs=ask-manager,deadline');
  });
});

describe('curveballs', () => {
  it('means the difficulty default when absent, none when "none"', () => {
    expect(parseConfig('', standard).curveballs).toEqual({ mode: 'default' });
    expect(parseConfig('curveballs=none', standard).curveballs).toEqual({ mode: 'none' });
    expect(parseConfig('curveballs=NONE', standard).curveballs).toEqual({ mode: 'none' });
  });

  it('keeps only types the scenario offers, once each', () => {
    const config = parseConfig('curveballs=deadline,deadline,not-a-type', challenge);
    expect(config.curveballs).toEqual({ mode: 'choose', types: ['deadline'] });
    expect(inspectConfig('curveballs=deadline,not-a-type', challenge).ignored).toEqual([
      'curveballs',
    ]);
    expect(inspectConfig('curveballs=deadline,deadline', challenge).ignored).toEqual([]);
  });

  it('allows no more than the difficulty does, keeping the earliest', () => {
    expect(parseConfig('curveballs=ask-manager,deadline', standard).curveballs).toEqual({
      mode: 'choose',
      types: ['ask-manager'],
    });
    expect(parseConfig('curveballs=ask-manager,deadline,go-silent', challenge).curveballs).toEqual({
      mode: 'choose',
      types: ['ask-manager', 'deadline'],
    });
    expect(inspectConfig('curveballs=ask-manager,deadline', standard).ignored).toEqual([
      'curveballs',
    ]);
  });

  it('trims the choice when the difficulty is lowered, and says what was dropped', () => {
    const chosen: CallConfig = {
      ...defaultConfig(challenge),
      curveballs: { mode: 'choose', types: ['ask-manager', 'deadline'] },
    };
    const lowered = withDifficulty(chosen, 'standard', challenge);
    expect(lowered.config.curveballs).toEqual({ mode: 'choose', types: ['ask-manager'] });
    expect(lowered.dropped).toEqual(['deadline']);
    expect(withDifficulty(chosen, 'challenge', challenge).dropped).toEqual([]);
  });

  it('fits a list to what is offered', () => {
    expect(fitCurveballs(['deadline', 'ask-manager'], 'standard', standard)).toEqual({
      kept: ['deadline'],
      dropped: ['ask-manager'],
    });
  });

  it('says how many complications to expect, never which', () => {
    expect(complicationsChip(defaultConfig(starter))).toBe('No complications');
    expect(complicationsChip(defaultConfig(standard))).toBe('Up to one complication');
    expect(complicationsChip(defaultConfig(challenge))).toBe('Up to two complications');
    expect(complicationsChip({ ...defaultConfig(challenge), curveballs: { mode: 'none' } })).toBe(
      'No complications',
    );
    expect(
      complicationsChip({
        ...defaultConfig(challenge),
        curveballs: { mode: 'choose', types: ['deadline', 'go-silent'] },
      }),
    ).toBe('Two complications');
  });
});

describe('live hints', () => {
  it('follow the difficulty when not set', () => {
    expect(hintsOn(parseConfig('', starter))).toBe(true);
    expect(hintsOn(parseConfig('', standard))).toBe(false);
    expect(hintsOn(parseConfig('', challenge))).toBe(false);
    expect(hintsOn(parseConfig('difficulty=starter', challenge))).toBe(true);
    expect(hintsOn(parseConfig('difficulty=challenge', starter))).toBe(false);
  });

  it('can be set either way', () => {
    expect(hintsOn(parseConfig('hints=on', standard))).toBe(true);
    expect(hintsOn(parseConfig('hints=off', starter))).toBe(false);
  });

  it('treat a value the difficulty would give anyway as no value', () => {
    expect(parseConfig('hints=off', standard).hints).toBeNull();
    expect(parseConfig('hints=on', starter).hints).toBeNull();
    expect(parseConfig('hints=on', standard).hints).toBe(true);
  });
});

describe('toOverrides', () => {
  it('is empty and follows the difficulty for the scenario as written', () => {
    expect(toOverrides(defaultConfig(starter), starter)).toEqual({ overrides: {}, mode: 'guided' });
    expect(toOverrides(defaultConfig(standard), standard)).toEqual({
      overrides: {},
      mode: 'immersive',
    });
  });

  it('holds only what was changed, under the names the API uses', () => {
    const config: CallConfig = {
      difficulty: 'challenge',
      impact: 'low',
      temperature: 'calm',
      proficiency: 'novice',
      style: 'vague',
      stage: 'closure',
      curveballs: { mode: 'choose', types: ['go-silent'] },
      hints: true,
    };
    expect(toOverrides(config, standard)).toEqual({
      overrides: {
        difficulty: 'challenge',
        impact: 'low',
        startingTemperature: 'calm',
        proficiency: 'novice',
        style: 'vague',
        callStage: 'closure',
        curveballs: ['go-silent'],
      },
      mode: 'guided',
    });
  });

  it('sends an empty list for "off" and nothing for the default', () => {
    expect(
      toOverrides({ ...defaultConfig(standard), curveballs: { mode: 'none' } }, standard).overrides,
    ).toEqual({ curveballs: [] });
    expect(toOverrides(defaultConfig(standard), standard).overrides).not.toHaveProperty(
      'curveballs',
    );
  });

  it('never sends more curveballs than the difficulty allows', () => {
    const config: CallConfig = {
      ...defaultConfig(standard),
      curveballs: { mode: 'choose', types: ['ask-manager', 'deadline', 'go-silent'] },
    };
    expect(toOverrides(config, standard).overrides.curveballs).toEqual(['ask-manager']);
  });

  it('is always accepted by the overrides schema', () => {
    for (const scenario of publicScenarios()) {
      const config = parseConfig(
        'difficulty=challenge&impact=high&temperature=angry&curveballs=ask-manager,deadline&hints=off',
        scenario,
      );
      expect(
        ScenarioOverridesSchema.safeParse(toOverrides(config, scenario).overrides).success,
      ).toBe(true);
    }
  });
});

describe('changedFromDefault', () => {
  it('is empty for the scenario as written', () => {
    expect(changedFromDefault(defaultConfig(standard), standard)).toEqual([]);
    expect(changedFromDefault(parseConfig('difficulty=standard', standard), standard)).toEqual([]);
  });

  it('lists the controls that differ, in the order the page shows them', () => {
    const config = parseConfig(
      'hints=on&curveballs=none&stage=closure&style=vague&difficulty=challenge&impact=low',
      standard,
    );
    expect(changedFromDefault(config, standard)).toEqual([
      'difficulty',
      'impact',
      'style',
      'stage',
      'curveballs',
      'hints',
    ]);
  });

  it('does not count hints that only follow a changed difficulty', () => {
    const config = parseConfig('difficulty=starter', standard);
    expect(hintsOn(config)).toBe(true);
    expect(changedFromDefault(config, standard)).toEqual(['difficulty']);
  });
});

describe('summarise', () => {
  it('reads as plain sentences built from the shared descriptions', () => {
    const config = parseConfig('temperature=frustrated&stage=follow-up', challenge);
    expect(summarise(config, challenge)).toEqual([
      'A frustrated, demanding customer with intermediate technical proficiency is following up on an open case.',
      'The business impact is high: production outage or broad impact.',
      'Expect up to two complications.',
    ]);
  });

  it('changes with each choice', () => {
    const text = (search: string) => summarise(parseConfig(search, standard), standard).join(' ');
    expect(text('temperature=anxious')).toContain('An anxious');
    expect(text('proficiency=novice')).toContain('with novice technical proficiency');
    expect(text('impact=low')).toContain('The business impact is low: one user affected');
    expect(text('stage=closure')).toContain('is calling to close the case');
    expect(text('curveballs=none')).toContain('No complications are set.');
    expect(text('style=non-native')).toContain('who is a non-native English speaker');
  });

  it('never names a curveball or says when one happens', () => {
    for (const scenario of publicScenarios()) {
      const config = parseConfig('curveballs=ask-manager,deadline&difficulty=challenge', scenario);
      const text = summarise(config, scenario).join(' ').toLowerCase();
      for (const { label } of Object.values(CURVEBALL_LABELS)) {
        expect(text).not.toContain(label.toLowerCase());
      }
      expect(text).not.toMatch(
        /manager|cancel|deadline|goes quiet|guarantee|credibility|trigger|hidden/,
      );
    }
  });
});

describe('links between the screens', () => {
  it('builds the brief address with the configuration', () => {
    const config = parseConfig('difficulty=challenge&curveballs=none', standard);
    expect(briefPath(standard.id, config, standard)).toBe(
      `/scenarios/${standard.id}/brief?difficulty=challenge&curveballs=none`,
    );
    expect(briefPath(standard.id, defaultConfig(standard), standard)).toBe(
      `/scenarios/${standard.id}/brief`,
    );
  });

  it('builds the edit address with the scenario first', () => {
    const config = parseConfig('hints=on&stage=closure', standard);
    expect(editPath(standard.id, config, standard)).toBe(
      `/scenarios?scenario=${standard.id}&stage=closure&hints=on`,
    );
  });
});
