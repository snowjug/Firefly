import type { DimensionTrendDTO, ProgressDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { noise, signedNoise } from '../../lib/seeded-noise.ts';

// The mastery constellation: the six coaching skills as clusters of stars around a core. A star
// lights for each piece of evidence, so a cluster fills in as someone practises. A skill with no
// practice is still drawn, as faint points, so it reads as "not started" and never as "bad". Where
// everything sits depends only on the seed, never on the evidence, so lighting a star moves
// nothing. Coordinates are normalised (0..1).

export type SkillLevel = 0 | 1 | 2 | 3 | 4;

export interface SkillInput {
  id: DimensionId;
  label: string;
  level: SkillLevel;
  /** How many calls the skill has been scored on. */
  evidence: number;
  /** Kept for the caller's own words and icons: the layout never draws a direction. */
  trend: DimensionTrendDTO['change'];
  focus?: boolean;
}

export interface ConstellationCluster {
  id: DimensionId;
  x: number;
  y: number;
  /** Encloses every star of the cluster, for halos and hit areas. */
  radius: number;
  level: SkillLevel;
  focus: boolean;
}

export interface ConstellationNode {
  /** `${cluster}:${index}`: the same star always has the same id. */
  id: string;
  cluster: DimensionId;
  x: number;
  y: number;
  lit: boolean;
}

export interface ConstellationLink {
  from: string;
  /** Another node, or `CORE_ID` for the link that joins a cluster to the core. */
  to: string;
  /** 0..1. Zero until both ends are lit, then it grows with the skill's level. */
  strength: number;
}

export interface Constellation {
  clusters: ConstellationCluster[];
  nodes: ConstellationNode[];
  links: ConstellationLink[];
  core: { x: number; y: number };
}

/** Every cluster draws this many stars; the ones beyond the evidence stay dormant. */
export const CLUSTER_NODE_CAP = 14;
export const CORE_ID = 'core';
export const CONSTELLATION_BOUNDS = { min: 0.05, max: 0.95 } as const;

const DEFAULT_SEED = 1;
const CORE = { x: 0.5, y: 0.5 } as const;
/** How far the clusters sit from the core, at most. */
const RING_RADIUS = 0.3;
/** Each cluster's distance from the core varies by up to this share... */
const RING_LOOSENESS = 0.1;
/** ...and its angle by up to this many radians: irregular, but the clusters never meet. */
const ANGLE_LOOSENESS = 0.12;
/** Six flat-topped slots, the first at the upper left, so the ring suits a wide screen. */
const FIRST_ANGLE = -Math.PI / 2 - Math.PI / 6;
const STAR_SPACING = 0.0225;
const STAR_JITTER = 0.004;
const RADIUS_PAD = 0.012;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const round = (value: number) => Math.round(value * 10_000) / 10_000;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const inBounds = (value: number) =>
  round(clamp(value, CONSTELLATION_BOUNDS.min, CONSTELLATION_BOUNDS.max));

/** Whole pieces of evidence. Anything that is not a usable number counts as none. */
function evidenceOf(value: number): number {
  return Number.isNaN(value) ? 0 : Math.max(0, Math.floor(value));
}

function levelOf(value: number): SkillLevel {
  return clamp(Number.isNaN(value) ? 0 : Math.round(value), 0, 4) as SkillLevel;
}

/** Brighter, firmer lines for a higher level; even the first level is visible once it is lit. */
const strengthOf = (level: SkillLevel) => round(0.2 + level * 0.2);

// ------------------------------------------------------------------------------------------
// Levels

/**
 * What it takes to reach each level above the first. A level says a skill has been shown steadily,
 * so the higher ones need more calls behind them: one excellent call is a good start, not mastery.
 * Anything with at least one scored call is level 1 whatever the average, so a low average reads as
 * "started" and never as "nothing". The averages are on the 1 to 5 coaching scale.
 */
const LEVEL_RULES = [
  { level: 4, average: 4.2, evidence: 5 },
  { level: 3, average: 3.5, evidence: 3 },
  { level: 2, average: 2.5, evidence: 2 },
] as const;

/** 0 with nothing yet, then 1 to 4: each needs a higher average and more calls behind it. */
export function levelFor(average: number | null, evidence: number): SkillLevel {
  const calls = evidenceOf(evidence);
  if (average === null || Number.isNaN(average) || calls < 1) return 0;
  for (const rule of LEVEL_RULES) {
    if (average >= rule.average && calls >= rule.evidence) return rule.level;
  }
  return 1;
}

/** The skills as stored: every one of the six, with nothing lit for a skill that has no calls. */
export function skillsFromProgress(
  progress: Pick<ProgressDTO, 'dimensionTrends' | 'focus'> | null,
): SkillInput[] {
  return DIMENSION_IDS.map((id) => {
    const trend = progress?.dimensionTrends.find((t) => t.dimension === id);
    const evidence = trend?.points.length ?? 0;
    return {
      id,
      label: DIMENSIONS[id].label,
      level: levelFor(trend?.average ?? null, evidence),
      evidence,
      trend: trend?.change ?? 'not-enough-data',
      focus: progress?.focus === id,
    };
  });
}

/** One of each known skill, in the order of the vocabulary, whatever order they were given in. */
function inOrder(skills: readonly SkillInput[]): SkillInput[] {
  const seen = new Set<DimensionId>();
  const kept: SkillInput[] = [];
  for (const skill of skills) {
    if (!DIMENSION_IDS.includes(skill.id) || seen.has(skill.id)) continue;
    seen.add(skill.id);
    kept.push(skill);
  }
  return kept.sort((a, b) => DIMENSION_IDS.indexOf(a.id) - DIMENSION_IDS.indexOf(b.id));
}

/**
 * The skill to suggest next: the one flagged as the focus, otherwise the one with the lowest level
 * among those that have evidence (the one with more evidence first, as the surer reading), and
 * nothing at all when there is no evidence yet, rather than a guess.
 */
export function nextSkillToFocus(skills: readonly SkillInput[]): DimensionId | null {
  const ordered = inOrder(skills);
  const flagged = ordered.find((skill) => skill.focus);
  if (flagged) return flagged.id;
  const practised = ordered
    .filter((skill) => evidenceOf(skill.evidence) > 0)
    .sort(
      (a, b) =>
        levelOf(a.level) - levelOf(b.level) || evidenceOf(b.evidence) - evidenceOf(a.evidence),
    );
  return practised[0]?.id ?? null;
}

// ------------------------------------------------------------------------------------------
// Layout

/**
 * Lays the constellation out. Each skill keeps its own slot on the ring (by its place in the
 * vocabulary), so one that is missing leaves a gap and the others do not move. The ring is a
 * little irregular, and each cluster is a golden-angle spiral of stars with a small seeded jitter.
 * The first stars to light are the ones nearest the middle of a cluster, so a cluster grows
 * outwards as evidence builds. Every star links to the next in its cluster, and each cluster's
 * first star links to the core; a link is drawn (strength above zero) only once both ends are lit.
 */
export function constellationLayout(
  skills: readonly SkillInput[],
  options: { seed?: number } = {},
): Constellation {
  const seed =
    options.seed !== undefined && Number.isFinite(options.seed) ? options.seed : DEFAULT_SEED;
  const clusters: ConstellationCluster[] = [];
  const nodes: ConstellationNode[] = [];
  const links: ConstellationLink[] = [];

  for (const skill of inOrder(skills)) {
    const slot = DIMENSION_IDS.indexOf(skill.id);
    const angle =
      FIRST_ANGLE +
      (slot * Math.PI * 2) / DIMENSION_IDS.length +
      signedNoise(seed, `angle:${skill.id}`) * ANGLE_LOOSENESS;
    const reach = RING_RADIUS * (1 + signedNoise(seed, `reach:${skill.id}`) * RING_LOOSENESS);
    const centre = { x: CORE.x + Math.cos(angle) * reach, y: CORE.y + Math.sin(angle) * reach };
    const turn = noise(seed, `turn:${skill.id}`) * Math.PI * 2;
    const level = levelOf(skill.level);
    const lit = Math.min(evidenceOf(skill.evidence), CLUSTER_NODE_CAP);

    let extent = 0;
    const ids: string[] = [];
    for (let index = 0; index < CLUSTER_NODE_CAP; index += 1) {
      const distance = STAR_SPACING * Math.sqrt(index + 0.5);
      const around = turn + index * GOLDEN_ANGLE;
      const x =
        centre.x +
        Math.cos(around) * distance +
        signedNoise(seed, `${skill.id}:${index}:x`) * STAR_JITTER;
      const y =
        centre.y +
        Math.sin(around) * distance +
        signedNoise(seed, `${skill.id}:${index}:y`) * STAR_JITTER;
      const id = `${skill.id}:${index}`;
      ids.push(id);
      extent = Math.max(extent, Math.hypot(x - centre.x, y - centre.y));
      nodes.push({ id, cluster: skill.id, x: inBounds(x), y: inBounds(y), lit: index < lit });
    }

    clusters.push({
      id: skill.id,
      x: inBounds(centre.x),
      y: inBounds(centre.y),
      radius: round(extent + RADIUS_PAD),
      level,
      focus: skill.focus === true,
    });
    for (let index = 0; index + 1 < ids.length; index += 1) {
      links.push({
        from: ids[index] as string,
        to: ids[index + 1] as string,
        strength: index + 1 < lit ? strengthOf(level) : 0,
      });
    }
    links.push({ from: ids[0] as string, to: CORE_ID, strength: lit >= 1 ? strengthOf(level) : 0 });
  }

  return { clusters, nodes, links, core: { ...CORE } };
}
