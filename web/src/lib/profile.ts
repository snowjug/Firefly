import { useSyncExternalStore } from 'react';
import { DIFFICULTIES, type Difficulty } from '#shared/domain/vocab.ts';
import { readStorage, removeStorage, writeStorage } from './storage.ts';

// A profile lives on this device only (localStorage). There is no account, no password and no
// server-side identity: it exists so the app can greet someone by name and remember preferences.

export type HintsPreference = 'auto' | 'on' | 'off';

export interface ProfilePreferences {
  /** The difficulty the practice page starts on. */
  defaultDifficulty: Difficulty;
  /** `auto` follows the difficulty; `on` always starts guided; `off` always starts immersive. */
  hints: HintsPreference;
  /** Voice (Beta): the call offers a microphone and spoken customer replies. Off by default. */
  voice: boolean;
  /** In-app notices only. Nothing is ever sent outside this browser. */
  notifyReports: boolean;
  notifyBadges: boolean;
}

export interface Profile {
  name: string;
  role: string;
  location: string;
  createdAt: string;
  preferences: ProfilePreferences;
}

export const DEFAULT_PREFERENCES: ProfilePreferences = {
  defaultDifficulty: 'starter',
  hints: 'auto',
  voice: false,
  notifyReports: true,
  notifyBadges: true,
};

const KEY = 'firefly.profile';
const NAME_MAX = 60;
const FIELD_MAX = 80;
const listeners = new Set<() => void>();

let cached: Profile | null | undefined;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function sanitisePreferences(raw: unknown): ProfilePreferences {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    defaultDifficulty: DIFFICULTIES.includes(p.defaultDifficulty as Difficulty)
      ? (p.defaultDifficulty as Difficulty)
      : DEFAULT_PREFERENCES.defaultDifficulty,
    hints: p.hints === 'on' || p.hints === 'off' || p.hints === 'auto' ? p.hints : 'auto',
    voice: p.voice === true,
    notifyReports: p.notifyReports !== false,
    notifyBadges: p.notifyBadges !== false,
  };
}

/** Whatever is in storage is treated as untrusted: anything unexpected falls back to a default. */
function sanitise(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const name = text(p.name, NAME_MAX);
  if (!name) return null;
  return {
    name,
    role: text(p.role, FIELD_MAX),
    location: text(p.location, FIELD_MAX),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date(0).toISOString(),
    preferences: sanitisePreferences(p.preferences),
  };
}

function read(): Profile | null {
  if (cached === undefined) cached = sanitise(readStorage<unknown>(KEY, null));
  return cached;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      cached = undefined;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function getProfile(): Profile | null {
  return read();
}

export function useProfile(): Profile | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** The preferences to use right now: the saved ones, or the defaults when there is no profile. */
export function usePreferences(): ProfilePreferences {
  return useProfile()?.preferences ?? DEFAULT_PREFERENCES;
}

export interface ProfileDetails {
  name: string;
  role?: string;
  location?: string;
}

/** Creates the profile, or updates its details and keeps the saved preferences. */
export function saveProfile(details: ProfileDetails): Profile | null {
  const name = text(details.name, NAME_MAX);
  if (!name) return null;
  const previous = read();
  const next: Profile = {
    name,
    role: text(details.role, FIELD_MAX),
    location: text(details.location, FIELD_MAX),
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    preferences: previous?.preferences ?? DEFAULT_PREFERENCES,
  };
  cached = next;
  writeStorage(KEY, next);
  emit();
  return next;
}

export function updatePreferences(patch: Partial<ProfilePreferences>): void {
  const previous = read();
  if (!previous) return;
  const next: Profile = {
    ...previous,
    preferences: sanitisePreferences({ ...previous.preferences, ...patch }),
  };
  cached = next;
  writeStorage(KEY, next);
  emit();
}

/** "Sign out" on this device: forgets the profile. Saved practice calls are not touched. */
export function clearProfile(): void {
  cached = null;
  removeStorage(KEY);
  emit();
}

export function resetProfileForTests(): void {
  cached = undefined;
}

/** The first whole character of a word (an emoji or an accented letter is one character, not half of one). */
const firstCharacter = (word: string | undefined): string => (word ? ([...word][0] ?? '') : '');

/** One capital letter: "ß" upper-cases to "SS", which is two, so only the first of them is kept. */
const capital = (character: string): string => [...character.toLocaleUpperCase()][0] ?? '';

/** "Vidhi Kamat" becomes "VK"; a single name gives one letter. */
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = capital(firstCharacter(parts[0]));
  const last = parts.length > 1 ? capital(firstCharacter(parts[parts.length - 1])) : '';
  return first + last;
}

/** Titles that come before a name and are not the name. */
const TITLES = new Set(['mr', 'mrs', 'ms', 'mx', 'miss', 'dr', 'prof', 'sir', 'madam']);

/**
 * What to call someone in a greeting: "Priya Raman" is "Priya", "Dr. Jane Doe" is "Jane" and "Smith,
 * John" is "John", with no stray full stop or comma left on the end.
 */
export function firstName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return name;
  // "Smith, John": the surname comes first, so the given name is the word after it.
  if (words.length > 1 && words[0]?.endsWith(',')) words.shift();
  while (words.length > 1 && TITLES.has((words[0] ?? '').replace(/[.,]+$/, '').toLowerCase())) {
    words.shift();
  }
  return (words[0] ?? name).replace(/[.,;:]+$/, '');
}

export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Hello';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
