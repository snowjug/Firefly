import { describe, expect, it } from 'vitest';
import { makeScenario } from './scenario-fixtures.ts';
import {
  STEP_COUNT,
  choicesFromOverrides,
  defaultChoices,
  describeCall,
  fitCurveballs,
  overridesFromChoices,
  parseStep,
  settingRows,
} from './setup-model.ts';

const scenario = makeScenario();

describe('overrides', () => {
  it('hold only what differs from the scenario', () => {
    expect(overridesFromChoices(scenario, defaultChoices(scenario))).toEqual({});
    const changed = {
      ...defaultChoices(scenario),
      impact: 'high',
      difficulty: 'challenge',
    } as const;
    expect(overridesFromChoices(scenario, changed)).toEqual({
      impact: 'high',
      difficulty: 'challenge',
    });
  });

  it('leave curveballs out for the recommendation, empty for none, and list a chosen few', () => {
    const base = defaultChoices(scenario);
    expect(overridesFromChoices(scenario, base)).not.toHaveProperty('curveballs');
    expect(overridesFromChoices(scenario, { ...base, curveballMode: 'none' }).curveballs).toEqual(
      [],
    );
    expect(
      overridesFromChoices(scenario, {
        ...base,
        curveballMode: 'choose',
        curveballs: ['ask-manager'],
      }).curveballs,
    ).toEqual(['ask-manager']);
    // Choosing "Choose" without picking anything is the same as none.
    expect(overridesFromChoices(scenario, { ...base, curveballMode: 'choose' }).curveballs).toEqual(
      [],
    );
  });

  it('are read back as valid choices, ignoring anything stale or edited by hand', () => {
    const choices = choicesFromOverrides(scenario, {
      impact: 'high',
      style: 'shouty',
      difficulty: 'starter',
      curveballs: ['ask-manager', 'deadline', 'not-a-curveball'],
    });
    expect(choices).toMatchObject({
      impact: 'high',
      style: scenario.style,
      difficulty: 'starter',
      curveballMode: 'choose',
      curveballs: ['ask-manager'], // Starter allows one
    });
    expect(choicesFromOverrides(scenario, 'nonsense')).toEqual(defaultChoices(scenario));
  });
});

describe('curveball limits', () => {
  it('keep the earliest picks and drop what the scenario does not offer', () => {
    expect(
      fitCurveballs(['deadline', 'ask-manager', 'deadline', 'change-issue'], 'challenge', [
        'ask-manager',
        'deadline',
      ]),
    ).toEqual({ picks: ['deadline', 'ask-manager'], removed: [] });
    expect(
      fitCurveballs(['deadline', 'ask-manager'], 'starter', ['ask-manager', 'deadline']),
    ).toEqual({
      picks: ['deadline'],
      removed: ['ask-manager'],
    });
  });
});

describe('the call so far', () => {
  it('is one plain sentence built from the public scenario and the current choices', () => {
    expect(describeCall(scenario, { ...defaultChoices(scenario), impact: 'high' })).toBe(
      "Maya Okafor, an IT administrator at Northwind Foods, is frustrated and terse, with intermediate technical knowledge. It's a first contact. Business impact is high.",
    );
  });

  it('words roles, articles, stage and communication style naturally', () => {
    const other = makeScenario({
      persona: {
        name: 'Seun Adeyemi',
        role: 'Senior Platform Engineer',
        organisation: 'Lucerne Tickets',
      },
      startingTemperature: 'angry',
      style: 'non-native',
      proficiency: 'expert',
      callStage: 'escalated',
      impact: 'low',
    });
    expect(describeCall(other, defaultChoices(other))).toBe(
      "Seun Adeyemi, a senior platform engineer at Lucerne Tickets, is angry and a non-native English speaker, with expert technical knowledge. It's an escalated case. Business impact is low.",
    );
  });

  it('marks a row as changed only when it differs, and says nothing about when a curveball happens', () => {
    const rows = settingRows(scenario, {
      ...defaultChoices(scenario),
      startingTemperature: 'angry',
    });
    expect(rows.filter((row) => row.changed).map((row) => row.key)).toEqual([
      'startingTemperature',
    ]);
    const curveballs = rows.find((row) => row.key === 'curveballs');
    expect(curveballs?.value).toBe('Recommended for Standard');
    expect(curveballs?.description).toContain('You will not be told when');
  });
});

describe('steps', () => {
  it('stay within the flow whatever the address says', () => {
    expect([null, 'abc', '0', '3', '99'].map(parseStep)).toEqual([1, 1, 1, 3, STEP_COUNT]);
  });
});
