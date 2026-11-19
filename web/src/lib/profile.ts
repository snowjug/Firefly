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

/** "Vidhi Kamat" becomes "VK"; a single name gives one letter. */
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Hello';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
