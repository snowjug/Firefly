import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { ISSUE_TYPE_LABELS } from '#shared/domain/vocab.ts';
import { fold } from '../scenario/library-filters.ts';
import { libraryPath, setupPath } from '../scenario/paths.ts';
import { DOCK_ITEMS, HELP_ITEM } from './nav.ts';

// The palette's content and how a query finds it. Pure: the component only draws what this returns
// and runs the action of the entry that was chosen.

export type PaletteGroup = 'Go to' | 'Practice' | 'Display' | 'Missions' | 'Search';

export const GROUP_ORDER: readonly PaletteGroup[] = [
  'Go to',
  'Practice',
  'Display',
  'Missions',
  'Search',
];

export type PaletteAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'theme'; next: 'light' | 'dark' }
  | { kind: 'ambient' };

export interface PaletteEntry {
  id: string;
  group: PaletteGroup;
  label: string;
  /** A short mono note at the end of the row: the dock number, or what the mission is about. */
  hint: string;
  /** Words that find the entry besides its label. They count for less than the label. */
  keywords: string;
  action: PaletteAction;
}

export interface PaletteContext {
  theme: 'light' | 'dark';
  ambientPaused: boolean;
  /** Reduced motion keeps ambient motion off, so there is nothing to offer. */
  ambientForced: boolean;
  scenarios: readonly PublicScenarioDTO[];
}

export interface PaletteSection {
  group: PaletteGroup;
  entries: PaletteEntry[];
}

const navigateTo = (to: string): PaletteAction => ({ kind: 'navigate', to });

/** Everything that can be chosen without typing: pages, practice, display and the missions. */
export function buildEntries(context: PaletteContext): PaletteEntry[] {
  const entries: PaletteEntry[] = DOCK_ITEMS.map((item, index) => ({
    id: `go:${item.to}`,
    group: 'Go to',
    label: item.label,
    hint: String(index + 1).padStart(2, '0'),
    keywords: item.keywords,
    action: navigateTo(item.to),
  }));
  entries.push(
    {
      id: 'go:/calibration',
      group: 'Go to',
      label: 'Calibration',
      hint: '',
      keywords: 'mentor review blind scores studio',
      action: navigateTo('/calibration'),
    },
    {
      id: `go:${HELP_ITEM.to}`,
      group: 'Go to',
      label: 'Help and Responsible AI',
      hint: '',
      keywords: HELP_ITEM.keywords,
      action: navigateTo(HELP_ITEM.to),
    },
    {
      id: 'practice',
      group: 'Practice',
      label: 'Start practice',
      hint: 'Recommended',
      keywords: 'call begin recommended next mission',
      action: navigateTo('/practice'),
    },
  );

  const next = context.theme === 'dark' ? 'light' : 'dark';
  entries.push({
    id: 'theme',
    group: 'Display',
    label: `Switch to ${next} theme`,
    hint: '',
    keywords: 'appearance colour dark light night day parchment',
    action: { kind: 'theme', next },
  });
  if (!context.ambientForced) {
    entries.push({
      id: 'ambient',
      group: 'Display',
      label: context.ambientPaused ? 'Resume ambient motion' : 'Pause ambient motion',
      hint: '',
      keywords: 'animation movement background field',
      action: { kind: 'ambient' },
    });
  }

  for (const scenario of context.scenarios) {
    entries.push({
      id: `mission:${scenario.id}`,
      group: 'Missions',
      label: scenario.title,
      hint: ISSUE_TYPE_LABELS[scenario.issueType],
      keywords: [
        scenario.persona.name,
        scenario.persona.role,
        scenario.persona.organisation,
        ...scenario.tags,
      ].join(' '),
      action: navigateTo(setupPath(scenario.id)),
    });
  }
  return entries;
}

/** The search row of the palette: what was typed opens the missions with those words in their search. */
export function searchEntry(text: string): PaletteEntry {
  return {
    id: 'search',
    group: 'Search',
    label: `Search missions for \u201c${text}\u201d`,
    hint: 'Missions',
    keywords: '',
    action: navigateTo(`${libraryPath}?q=${encodeURIComponent(text)}`),
  };
}

// ------------------------------------------------------------------------------------------
// Matching

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** How well one folded word finds a folded text: a prefix is best, a scattered match is worst. */
function wordScore(word: string, text: string, scattered: boolean): number | null {
  if (text.startsWith(word)) return 100;
  let weakest: number | null = null;
  for (let at = text.indexOf(word); at >= 0; at = text.indexOf(word, at + 1)) {
    if (!isWordChar(text[at - 1])) return 80;
    weakest = 55;
  }
  if (weakest !== null) return weakest;

  // Letters in order, with gaps: "setng" finds "settings". Short words must match for real, and
  // only a label can be found this way: a stray run of letters in a keyword is not a match.
  if (!scattered || word.length < 3) return null;
  let last = -1;
  let gaps = 0;
  for (const char of word) {
    const found = text.indexOf(char, last + 1);
    if (found < 0) return null;
    if (last >= 0) gaps += found - last - 1;
    last = found;
  }
  return gaps > word.length ? null : Math.max(5, 30 - gaps);
}

/**
 * How well a query finds an entry, or null when it does not. Every word typed has to be found, in
 * the label or (worth half) in its keywords. Case and accents do not matter.
 */
export function scoreEntry(query: string, entry: PaletteEntry): number | null {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const label = fold(entry.label);
  const keywords = fold(entry.keywords);
  let total = 0;
  for (const word of words) {
    const inLabel = wordScore(word, label, true);
    const inKeywords = wordScore(word, keywords, false);
    const best = Math.max(inLabel ?? -1, inKeywords === null ? -1 : inKeywords / 2);
    if (best < 0) return null;
    total += best;
  }
  return total;
}

/**
 * The entries a query finds, in the sections they are drawn in. With no query that is everything in
 * the fixed order. With a query the best match leads: sections are ordered by their best entry, and
 * the search-the-library row always closes the list.
 */
export function arrange(entries: readonly PaletteEntry[], query: string): PaletteSection[] {
  const text = query.trim();
  if (!text) {
    return GROUP_ORDER.map((group) => ({
      group,
      entries: entries.filter((entry) => entry.group === group),
    })).filter((section) => section.entries.length > 0);
  }

  const found = entries
    .map((entry, order) => ({ entry, order, score: scoreEntry(text, entry) }))
    .filter((item): item is { entry: PaletteEntry; order: number; score: number } => {
      return item.score !== null;
    })
    .sort((a, b) => b.score - a.score || a.order - b.order);

  const sections: (PaletteSection & { best: number })[] = [];
  for (const { entry, score } of found) {
    const section = sections.find((candidate) => candidate.group === entry.group);
    if (section) section.entries.push(entry);
    else sections.push({ group: entry.group, entries: [entry], best: score });
  }
  sections.sort(
    (a, b) => b.best - a.best || GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
  );
  return [
    ...sections.map(({ group, entries: inGroup }) => ({ group, entries: inGroup })),
    { group: 'Search', entries: [searchEntry(text)] },
  ];
}

/** The entries in the order they are drawn, which is the order the arrow keys walk. */
export function flatten(sections: readonly PaletteSection[]): PaletteEntry[] {
  return sections.flatMap((section) => section.entries);
}
