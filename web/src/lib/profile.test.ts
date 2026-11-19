import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearProfile,
  DEFAULT_PREFERENCES,
  firstName,
  getProfile,
  greetingFor,
  initials,
  resetProfileForTests,
  saveProfile,
  updatePreferences,
} from './profile.ts';

beforeEach(() => {
  localStorage.clear();
  resetProfileForTests();
});

describe('profile', () => {
  it('has no profile until one is saved, and needs a name', () => {
    expect(getProfile()).toBeNull();
    expect(saveProfile({ name: '   ' })).toBeNull();
    expect(getProfile()).toBeNull();
  });

  it('saves details, trims them and keeps them across a reload', () => {
    saveProfile({ name: '  Priya Raman ', role: ' Apprentice ', location: 'Pune' });
    resetProfileForTests();
    expect(getProfile()).toMatchObject({
      name: 'Priya Raman',
      role: 'Apprentice',
      location: 'Pune',
      preferences: DEFAULT_PREFERENCES,
    });
  });

  it('keeps the saved preferences and creation time when the details are edited', () => {
    const first = saveProfile({ name: 'Priya' });
    updatePreferences({ voice: true, defaultDifficulty: 'challenge' });
    const edited = saveProfile({ name: 'Priya R', role: 'Engineer' });
    expect(edited?.createdAt).toBe(first?.createdAt);
    expect(edited?.preferences).toMatchObject({ voice: true, defaultDifficulty: 'challenge' });
  });

  it('ignores preference changes when there is no profile', () => {
    updatePreferences({ voice: true });
    expect(getProfile()).toBeNull();
  });

  it('treats stored data as untrusted and falls back to safe defaults', () => {
    localStorage.setItem(
      'firefly.profile',
      JSON.stringify({
        name: 'Sam',
        role: 42,
        preferences: { defaultDifficulty: 'impossible', hints: 'sometimes', voice: 'yes' },
      }),
    );
    expect(getProfile()).toMatchObject({
      name: 'Sam',
      role: '',
      preferences: { defaultDifficulty: 'starter', hints: 'auto', voice: false },
    });
    localStorage.setItem('firefly.profile', '{not json');
    resetProfileForTests();
    expect(getProfile()).toBeNull();
  });

  it('signs out by forgetting the profile', () => {
    saveProfile({ name: 'Priya' });
    clearProfile();
    expect(getProfile()).toBeNull();
    expect(localStorage.getItem('firefly.profile')).toBeNull();
  });
});

describe('profile helpers', () => {
  it('makes initials from the first and last name', () => {
    expect(initials('Priya Raman')).toBe('PR');
    expect(initials('Priya')).toBe('P');
    expect(initials('  anna  maria  de souza ')).toBe('AS');
    expect(initials('   ')).toBe('?');
  });

  it('uses the first name for greetings', () => {
    expect(firstName('Priya Raman')).toBe('Priya');
  });

  it('greets by time of day', () => {
    const at = (hour: number) => new Date(2026, 0, 5, hour, 0, 0);
    expect(greetingFor(at(3))).toBe('Hello');
    expect(greetingFor(at(9))).toBe('Good morning');
    expect(greetingFor(at(14))).toBe('Good afternoon');
    expect(greetingFor(at(20))).toBe('Good evening');
  });
});
