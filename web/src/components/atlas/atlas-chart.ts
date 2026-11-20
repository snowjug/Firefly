import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  labelMetricsFor,
  placeLabels,
  type LabelMetrics,
  type LabelNode,
  type Placement,
} from './atlas-labels.ts';
import { layoutAtlas, type AtlasModel } from './atlas-model.ts';
import {
  constellationLinks,
  layoutAspect,
  linkSegment,
  projectAtlas,
  type Plate,
  type PlateSize,
  type Point,
  type Segment,
} from './atlas-plate.ts';

// The whole plate as numbers: the missions where they sit at this size, their hairlines, and where
// every label goes. The page draws this and decides nothing of its own, so what the tests check is
// what the trainee sees.

export interface Chart {
  plate: Plate;
  links: { family: string; from: string; to: string; segment: Segment }[];
  placement: Placement;
  metrics: LabelMetrics;
  /** Each family's anchor in plate pixels. */
  anchors: Map<string, Point>;
}

/**
 * What a mission's small line says: how hard and how long, and "Suggested" for the one to try
 * next. On a narrow plate the suggested one gives up its difficulty to keep the line short.
 */
export function kickerFor(
  mission: {
    difficulty: keyof typeof DIFFICULTY_PROFILES;
    minutes: number;
    recommended: boolean;
  },
  compact = false,
): string {
  const minutes = Math.max(1, Math.round(mission.minutes));
  const label = DIFFICULTY_PROFILES[mission.difficulty].label;
  if (!mission.recommended) return `${label} \u00b7 ${minutes} min`;
  return compact
    ? `Suggested \u00b7 ${minutes} min`
    : `Suggested \u00b7 ${label} \u00b7 ${minutes} min`;
}

/** The plate for a model at a size. The same model and size always give the same chart. */
export function buildChart(model: AtlasModel, size: PlateSize): Chart {
  const layout = layoutAtlas(model, { aspect: layoutAspect(size) });
  const plate = projectAtlas(model, layout, size);
  const metrics = labelMetricsFor(size.width);

  const links = constellationLinks(model.missions).flatMap((link) => {
    const from = plate.byId.get(link.from);
    const to = plate.byId.get(link.to);
    const segment = from && to ? linkSegment(from, to) : null;
    return segment ? [{ ...link, segment }] : [];
  });

  const anchors = new Map(
    layout.anchors.map((anchor) => [
      anchor.family,
      { x: anchor.x * size.width, y: anchor.y * size.height },
    ]),
  );
  const nodes: LabelNode[] = model.missions.map((mission) => {
    const at = plate.byId.get(mission.id);
    const anchor = anchors.get(mission.family);
    return {
      id: mission.id,
      x: at?.x ?? 0,
      y: at?.y ?? 0,
      reach: at?.reach ?? 0,
      kicker: kickerFor(mission, size.width < 600),
      title: mission.title,
      anchor: anchor ?? { x: size.width / 2, y: size.height / 2 },
      recommended: mission.recommended,
    };
  });
  const placement = placeLabels({
    size,
    nodes,
    families: model.families.map((family) => ({
      id: family.id,
      text: family.label,
      members: family.missionIds,
    })),
    links: links.map((link) => link.segment),
    metrics,
  });
  return { plate, links, placement, metrics, anchors };
}

// ------------------------------------------------------------------------------------------
// How tall the plate is

export interface PlateSpace {
  /** The width the plate has. */
  width: number;
  /** The height of the window. */
  viewport: number;
  /** True when the intro sits beside the plate (a wide window); false when it sits above it. */
  beside: boolean;
}

const REM = 16;
/** Above and below the plate: the wordmark, the tools over the plate and the dock. */
const FRAME = 72 + 92 + 108;

/**
 * How tall to draw the plate. Beside the intro it fills the window, within limits; stacked under
 * it, it is as tall as it is wide so the missions are never crowded; on a narrow plate it is
 * tall (2.5 times as tall as wide), because the layout needs height there and the page scrolls.
 */
export function plateHeightFor({ width, viewport, beside }: PlateSpace): number {
  if (width < 600) return Math.round(Math.max(520, Math.min(width * 2.5, 52 * REM)));
  if (beside) {
    return Math.round(Math.min(52 * REM, Math.max(36 * REM, viewport - FRAME)));
  }
  return Math.round(Math.min(52 * REM, Math.max(36 * REM, width)));
}
