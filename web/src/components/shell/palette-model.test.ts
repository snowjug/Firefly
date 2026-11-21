import { describe, expect, it } from 'vitest';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import {
  arrange,
  buildEntries,
  flatten,
  scoreEntry,
  searchEntry,
  type PaletteContext,
  type PaletteEntry,
} from './palette-model.ts';

const base: PaletteContext = {
  theme: 'dark',
  ambientPaused: false,
  ambientForced: false,
  scenarios: [
    makeScenario({ id: 'locked-out', title: 'Locked out after a password reset' }),
    makeScenario({
      id: 'team-workspace',
      title: 'Team cannot open the shared workspace',
      issueType: 'sign-in-access',
    }),
    makeScenario({ id: 'fraser', title: 'Fräser cannot log in', tags: ['login'] }),
  ],
};

const entries = (overrides: Partial<PaletteContext> = {}) =>
  buildEntries({ ...base, ...overrides });
const labels = (list: readonly PaletteEntry[]) => list.map((entry) => entry.label);

describe('what the palette offers', () => {
  it('lists every page the way the dock numbers them, with help and calibration besides', () => {
    const go = entries().filter((entry) => entry.group === 'Go to');
    expect(go.map((entry) => [entry.label, entry.hint])).toEqual([
      ['Home', '01'],
      ['Missions', '02'],
      ['History', '03'],
      ['Progress', '04'],
      ['Studio', '05'],
      ['Settings', '06'],
      ['Calibration', ''],
      ['Help and Responsible AI', ''],
    ]);
    expect(go.map((entry) => entry.action)).toContainEqual({ kind: 'navigate', to: '/help' });
  });

  it('starts practice and offers the other theme and the other state of ambient motion', () => {
    const dark = entries();
    expect(dark.find((entry) => entry.id === 'practice')?.action).toEqual({
      kind: 'navigate',
      to: '/practice',
    });
    expect(labels(dark)).toContain('Switch to light theme');
    expect(labels(dark)).toContain('Pause ambient motion');
    const light = entries({ theme: 'light', ambientPaused: true });
    expect(labels(light)).toContain('Switch to dark theme');
    expect(labels(light)).toContain('Resume ambient motion');
  });

  it('does not offer to resume ambient motion that reduced motion keeps off', () => {
    const forced = labels(entries({ ambientPaused: true, ambientForced: true }));
    expect(forced.some((label) => /ambient motion/.test(label))).toBe(false);
  });

  it('opens a mission on its calibration page, with the subject beside it', () => {
    const missions = entries().filter((entry) => entry.group === 'Missions');
    expect(missions.map((entry) => entry.label)).toEqual([
      'Locked out after a password reset',
      'Team cannot open the shared workspace',
      'Fräser cannot log in',
    ]);
    expect(missions[0]?.action).toEqual({ kind: 'navigate', to: '/scenarios/locked-out/setup' });
    expect(missions[0]?.hint).not.toBe('');
  });

  it('offers no missions until the list has arrived', () => {
    expect(entries({ scenarios: [] }).some((entry) => entry.group === 'Missions')).toBe(false);
  });
});

describe('finding things', () => {
  const find = (query: string) => labels(flatten(arrange(entries(), query)));

  it('shows everything in the fixed order when nothing is typed, and no search row', () => {
    const sections = arrange(entries(), '');
    expect(sections.map((section) => section.group)).toEqual([
      'Go to',
      'Practice',
      'Display',
      'Missions',
    ]);
    expect(flatten(sections)).toHaveLength(entries().length);
    expect(arrange(entries(), '   ').some((section) => section.group === 'Search')).toBe(false);
  });

  it('ignores case and accents', () => {
    expect(find('MISSIONS')[0]).toBe('Missions');
    expect(find('fraser')).toContain('Fräser cannot log in');
    expect(find('FRÄSER')).toContain('Fräser cannot log in');
  });

  it('puts the best match first, whichever group it is in', () => {
    // "locked" is a mission; nothing in the pages is named that.
    expect(find('locked')[0]).toBe('Locked out after a password reset');
    // A prefix of a page beats a word inside a mission title.
    expect(find('set')[0]).toBe('Settings');
  });

  it('needs every word that was typed', () => {
    expect(find('team workspace')).toContain('Team cannot open the shared workspace');
    expect(find('team banana')).toEqual(['Search missions for \u201cteam banana\u201d']);
  });

  it('finds a label with letters left out, but only for words of three letters or more', () => {
    expect(find('setng')[0]).toBe('Settings');
    expect(find('stngs')[0]).toBe('Settings');
    // Two letters in order are not a match; they have to be there as written.
    expect(find('sg').some((label) => label === 'Settings')).toBe(false);
  });

  it('finds a page by a word that describes it', () => {
    expect(find('badges')).toContain('Progress');
    expect(find('transcripts')).toContain('History');
    expect(find('progress')[0]).toBe('Progress');
  });

  it('does not take a scatter of letters inside a keyword for a match', () => {
    // "mis" is not inside any keyword of the help page, though m, i and s are all in them.
    expect(find('mis')).not.toContain('Help and Responsible AI');
  });

  it('orders the sections by their best match and always ends with the library search', () => {
    const sections = arrange(entries(), 'theme');
    expect(sections.at(-1)).toEqual({ group: 'Search', entries: [searchEntry('theme')] });
    expect(sections[0]?.group).toBe('Display');
  });

  it('ends with the library search, for the words as they were typed, trimmed', () => {
    const last = flatten(arrange(entries(), '  sign in ')).at(-1);
    expect(last?.label).toBe('Search missions for \u201csign in\u201d');
    expect(last?.action).toEqual({ kind: 'navigate', to: '/scenarios?q=sign%20in' });
  });

  it('leaves only the library search when nothing matches', () => {
    const sections = arrange(entries(), 'zzqx');
    expect(sections).toHaveLength(1);
    expect(flatten(sections).map((entry) => entry.id)).toEqual(['search']);
  });

  it('writes the words into the address safely', () => {
    const entry = searchEntry('a&b=c #d?');
    expect(entry.action).toEqual({ kind: 'navigate', to: '/scenarios?q=a%26b%3Dc%20%23d%3F' });
  });
});

describe('scoring', () => {
  const entry = (label: string, keywords = ''): PaletteEntry => ({
    id: label,
    group: 'Go to',
    label,
    hint: '',
    keywords,
    action: { kind: 'navigate', to: '/' },
  });

  it('prefers a prefix to a word to the middle of a word to a scatter', () => {
    const score = (label: string) => scoreEntry('set', entry(label)) ?? -1;
    expect(score('Settings')).toBeGreaterThan(score('The set of rules'));
    expect(score('The set of rules')).toBeGreaterThan(score('Reset password'));
    expect(score('Reset password')).toBeGreaterThan(score('S e t'));
  });

  it('counts a keyword for less than a label', () => {
    const inLabel = scoreEntry('badge', entry('Badge shelf')) ?? -1;
    const inKeywords = scoreEntry('badge', entry('Progress', 'skills badges')) ?? -1;
    expect(inLabel).toBeGreaterThan(inKeywords);
    expect(inKeywords).toBeGreaterThan(0);
  });

  it('says nothing for a word that is not there', () => {
    expect(scoreEntry('zebra', entry('Settings', 'profile'))).toBeNull();
  });
});
