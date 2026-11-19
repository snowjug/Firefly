import { describe, expect, it } from 'vitest';
import type { MissionRecommendation } from '#shared/domain/recommend.ts';
import { makeScenario } from './scenario-fixtures.ts';
import {
  carryChoices,
  changedSettings,
  chooseStartScenario,
  choicesFromOverrides,
  curveballSummary,
  curveballsOn,
  defaultChoices,
  defaultMode,
  draftFor,
  fitCurveballs,
  issueTypesOf,
  modeFromDraft,
  overridesFromChoices,
  scenarioForIssue,
  switchIssue,
  withCurveballPick,
  withCurveballsOn,
  type SetupChoices,
} from './setup-model.ts';

const scenario = makeScenario();
const starterScenario = makeScenario({ id: 'starter-one', difficulty: 'starter' });

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

  it('do not spell out "no curveballs" where the difficulty already means none', () => {
    const none = { ...defaultChoices(starterScenario), curveballMode: 'none' } as const;
    expect(overridesFromChoices(starterScenario, none)).toEqual({});
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
    expect(choicesFromOverrides(scenario, { curveballs: [] }).curveballMode).toBe('none');
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

describe('the curveball switch', () => {
  it('reads on when the difficulty recommends a curveball and off when it recommends none', () => {
    expect(curveballsOn(defaultChoices(scenario))).toBe(true);
    expect(curveballsOn(defaultChoices(starterScenario))).toBe(false);
    expect(curveballsOn({ ...defaultChoices(scenario), curveballMode: 'none' })).toBe(false);
  });

  it('turns off to none and on to what the difficulty recommends', () => {
    const off = withCurveballsOn(scenario, defaultChoices(scenario), false);
    expect(off).toMatchObject({ curveballMode: 'none', curveballs: [] });
    expect(overridesFromChoices(scenario, off).curveballs).toEqual([]);

    const on = withCurveballsOn(scenario, off, true);
    expect(on.curveballMode).toBe('recommended');
    expect(overridesFromChoices(scenario, on)).not.toHaveProperty('curveballs');
  });

  it('never means "none" when switched on: Starter ticks the first curveball on offer', () => {
    const on = withCurveballsOn(starterScenario, defaultChoices(starterScenario), true);
    expect(on).toMatchObject({ curveballMode: 'choose', curveballs: ['ask-manager'] });
    expect(curveballsOn(on)).toBe(true);
  });

  it('lets one be picked, never goes past what the difficulty allows, and goes back to the recommendation when none is left', () => {
    const base = defaultChoices(scenario);
    const one = withCurveballPick(scenario, base, 'deadline', true);
    expect(one).toMatchObject({ curveballMode: 'choose', curveballs: ['deadline'] });

    // Standard allows one: a second tick is not kept.
    expect(withCurveballPick(scenario, one, 'go-silent', true).curveballs).toEqual(['deadline']);
    const challenge = { ...base, difficulty: 'challenge' } as const;
    const two = withCurveballPick(
      scenario,
      withCurveballPick(scenario, challenge, 'deadline', true),
      'go-silent',
      true,
    );
    expect(two.curveballs).toEqual(['deadline', 'go-silent']);

    expect(withCurveballPick(scenario, one, 'deadline', false)).toMatchObject({
      curveballMode: 'recommended',
      curveballs: [],
    });
  });

  it('describes the state without ever saying when a curveball happens', () => {
    const base = defaultChoices(scenario);
    expect(curveballSummary(base)).toBe('One curveball may come up. You will not be told when.');
    expect(curveballSummary({ ...base, curveballMode: 'none' })).toBe(
      'No curveballs on this call.',
    );
    expect(curveballSummary({ ...base, curveballMode: 'choose', curveballs: ['deadline'] })).toBe(
      'One curveball chosen. You will not be told when it may come up.',
    );
    expect(curveballSummary({ ...base, difficulty: 'challenge' })).toBe(
      'Up to two curveballs may come up. You will not be told when.',
    );
  });
});

describe('what changed', () => {
  it('lists, in the order the page shows them, only the settings that differ from the scenario', () => {
    expect(changedSettings(scenario, defaultChoices(scenario))).toEqual([]);
    expect(
      changedSettings(scenario, {
        ...defaultChoices(scenario),
        callStage: 'escalated',
        impact: 'high',
        difficulty: 'challenge',
        curveballMode: 'choose',
        curveballs: ['deadline'],
      }),
    ).toEqual(['difficulty', 'impact', 'callStage', 'curveballs']);
  });

  it('counts switching curveballs off as a change only where the difficulty recommends one', () => {
    expect(
      changedSettings(scenario, { ...defaultChoices(scenario), curveballMode: 'none' }),
    ).toEqual(['curveballs']);
    expect(
      changedSettings(starterScenario, {
        ...defaultChoices(starterScenario),
        curveballMode: 'none',
      }),
    ).toEqual([]);
  });
});

describe('which scenario', () => {
  const signStarter = makeScenario({
    id: 'locked-out',
    title: 'Locked out',
    difficulty: 'starter',
    impact: 'low',
  });
  const signStandard = makeScenario({ id: 'team-workspace', title: 'Team workspace' });
  const outage = makeScenario({
    id: 'checkout-down',
    issueType: 'service-outage',
    difficulty: 'challenge',
    impact: 'high',
  });
  const library = [outage, signStandard, signStarter];

  it('offers only the issue types that have a scenario, in the vocabulary order', () => {
    expect(issueTypesOf(library)).toEqual(['sign-in-access', 'service-outage']);
  });

  it('picks the scenario of an issue type that matches the difficulty, else the gentlest', () => {
    expect(scenarioForIssue(library, 'sign-in-access', 'standard')?.id).toBe('team-workspace');
    expect(scenarioForIssue(library, 'sign-in-access', 'starter')?.id).toBe('locked-out');
    expect(scenarioForIssue(library, 'sign-in-access', 'challenge')?.id).toBe('locked-out');
    expect(scenarioForIssue(library, 'service-outage', 'starter')?.id).toBe('checkout-down');
    expect(scenarioForIssue(library, 'how-to', 'starter')).toBeNull();
  });

  it('starts a switched issue from its own settings but keeps what was changed', () => {
    const changed = {
      ...defaultChoices(signStandard),
      impact: 'low',
      difficulty: 'starter',
    } as const;
    const next = switchIssue(library, 'service-outage', signStandard, changed);
    expect(next?.scenario.id).toBe('checkout-down');
    // The outage is written for high impact and Challenge; the trainee's Low and Starter stay.
    expect(next?.choices).toEqual({
      ...defaultChoices(outage),
      impact: 'low',
      difficulty: 'starter',
    });

    // Settings the trainee did not touch follow the new scenario, but the difficulty chosen stays.
    const plain = switchIssue(
      library,
      'service-outage',
      signStandard,
      defaultChoices(signStandard),
    );
    expect(plain?.choices).toEqual({ ...defaultChoices(outage), difficulty: 'standard' });
    expect(switchIssue(library, 'how-to', signStandard, changed)).toBeNull();
  });

  it('carries curveball choices across, keeping only what the new scenario offers', () => {
    const picked: SetupChoices = {
      ...defaultChoices(signStandard),
      curveballMode: 'choose',
      curveballs: ['deadline'],
    };
    const bare = makeScenario({ id: 'bare', issueType: 'how-to', curveballOptions: ['go-silent'] });
    expect(carryChoices(signStandard, outage, picked).curveballs).toEqual(['deadline']);
    expect(carryChoices(signStandard, bare, picked).curveballMode).toBe('recommended');
    const none = { ...defaultChoices(signStandard), curveballMode: 'none' } as const;
    expect(carryChoices(signStandard, outage, none).curveballMode).toBe('none');
  });

  const recommendation = (pick: typeof outage): MissionRecommendation => ({
    scenario: pick,
    kind: 'new-ground',
    dimension: null,
    difficulty: pick.difficulty,
    reason: 'You have not tried this scenario yet.',
  });

  it('opens on the recommended scenario among those written for the difficulty', () => {
    const seen: string[][] = [];
    const pick = chooseStartScenario(library, 'standard', (pool) => {
      seen.push(pool.map((s) => s.id));
      return recommendation(pool[0] ?? outage);
    });
    expect(seen).toEqual([['team-workspace']]);
    expect(pick).toEqual({
      scenario: signStandard,
      reason: 'You have not tried this scenario yet.',
    });
  });

  it('falls back to the first of them, and to the whole library when none is written for it', () => {
    expect(chooseStartScenario(library, 'starter', () => null)).toEqual({
      scenario: signStarter,
      reason: null,
    });
    const seen: string[][] = [];
    chooseStartScenario([signStandard], 'challenge', (pool) => {
      seen.push(pool.map((s) => s.id));
      return null;
    });
    expect(seen).toEqual([['team-workspace']]);
    expect(chooseStartScenario([], 'starter', () => null)).toBeNull();
  });
});

describe('practice mode and the draft', () => {
  it('follows the difficulty unless the hints setting says otherwise', () => {
    expect(defaultMode('starter', 'auto')).toBe('guided');
    expect(defaultMode('standard', 'auto')).toBe('immersive');
    expect(defaultMode('challenge', 'on')).toBe('guided');
    expect(defaultMode('starter', 'off')).toBe('immersive');
  });

  it('counts a draft only for its own scenario and reads only a valid mode', () => {
    const draft = { scenarioId: 'a', overrides: {}, mode: 'guided' } as const;
    expect(draftFor(draft, 'a')).toBe(draft);
    expect(draftFor(draft, 'b')).toBeNull();
    expect(draftFor(null, 'a')).toBeNull();
    expect(modeFromDraft(draft)).toBe('guided');
    expect(modeFromDraft({ mode: 'frantic' })).toBeNull();
    expect(modeFromDraft(null)).toBeNull();
  });
});
