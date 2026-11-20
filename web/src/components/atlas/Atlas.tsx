import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { Link, useViewTransitionState } from 'react-router';
import { useEffectBudget } from '../../lib/PerfTierProvider.tsx';
import { useFinePointer, onPointerFrame } from '../../lib/motion/pointer.ts';
import { useReducedMotion } from '../../lib/theme.tsx';
import { nextInDirection, readingOrder, type Direction } from '../../lib/spatial/traversal.ts';
import { setupPath } from '../scenario/paths.ts';
import { SignalGlyph } from '../signal/index.ts';
import { buildChart, plateHeightFor } from './atlas-chart.ts';
import { labelsUnder, placeDetail, type PlacedLabel } from './atlas-labels.ts';
import type { AtlasMission, AtlasModel } from './atlas-model.ts';
import { FALLBACK_PLATE, nearestMission, type PlotNode, type PlateSize } from './atlas-plate.ts';
import { MissionDetail, HistoryKnown, descriptionWithoutTitle } from './MissionDetail.tsx';
import { useBoxWidth, useViewportHeight } from './useBoxSize.ts';
import '../../styles/atlas.css';

/** The detail card's width, and the height it is placed for (it is as tall as its words need). */
const CARD_WIDTH = 300;
const CARD_HEIGHT = 252;
/** How near the pointer must come to a mission's edge for its detail to open, and how far it may drift. */
const ACQUIRE = 64;
const RELEASE = 92;

export interface AtlasProps {
  model: AtlasModel;
  /** The missions the lens lights, or null when nothing narrows them. */
  lit: ReadonlySet<string> | null;
  /** True when the intro sits beside the plate. */
  beside: boolean;
  /** Why the suggested mission is suggested. */
  reason?: string | undefined;
  /** Where "Back to the missions" should lead from a calibration page (this address, as it is). */
  backTo: string;
}

type Intent = { id: string; source: 'pointer' | 'focus' } | null;

// ------------------------------------------------------------------------------------------
// One mission

interface StarProps {
  mission: AtlasMission;
  node: PlotNode;
  label: PlacedLabel | undefined;
  glyph: number;
  lit: boolean;
  active: boolean;
  tabbable: boolean;
  hushed: boolean;
  index: number;
  backTo: string;
  morph: boolean;
  onLink(id: string, element: HTMLAnchorElement | null): void;
  onFocusStar(id: string): void;
  onEnter(id: string, event: PointerEvent<HTMLElement>): void;
  onLeave(): void;
  onPreview(id: string, event: MouseEvent<HTMLAnchorElement>): void;
}

const Star = memo(function Star({
  mission,
  node,
  label,
  glyph,
  lit,
  active,
  tabbable,
  hushed,
  index,
  backTo,
  morph,
  onLink,
  onFocusStar,
  onEnter,
  onLeave,
  onPreview,
}: StarProps) {
  const to = setupPath(mission.id);
  // While the page changes between this mission's plate position and its calibration page (in
  // either direction) its instrument carries the shared name, so the browser flies it across.
  const moving = useViewTransitionState(to);
  const known = useContext(HistoryKnown);
  const descriptionId = `plate-${mission.id}-about`;
  const style = {
    '--x': `${node.x}px`,
    '--y': `${node.y}px`,
    '--g': `${glyph}px`,
    '--i': index,
  } as CSSProperties;
  // The label is drawn inside the link, whose box is centred on the mission, so its offset is
  // measured from the link's own corner.
  const half = Math.max(glyph, 44) / 2;
  const labelStyle = label
    ? ({
        '--lx': `${Math.round((label.rect.x - node.x + half) * 10) / 10}px`,
        '--ly': `${Math.round((label.rect.y - node.y + half) * 10) / 10}px`,
        '--lw': `${label.rect.w}px`,
      } as CSSProperties)
    : undefined;
  return (
    <li
      className="atlas__item"
      style={style}
      data-lit={lit ? 'true' : 'false'}
      data-active={active ? 'true' : undefined}
      data-hushed={hushed ? 'true' : undefined}
      data-recommended={mission.recommended ? 'true' : undefined}
      data-status={mission.status}
      data-moving={moving ? 'true' : undefined}
      inert={!lit}
    >
      <Link
        ref={(element) => onLink(mission.id, element)}
        className="atlas__star"
        to={to}
        state={{ from: backTo, status: mission.status }}
        viewTransition={morph}
        tabIndex={tabbable ? 0 : -1}
        aria-describedby={descriptionId}
        onFocus={() => onFocusStar(mission.id)}
        onPointerEnter={(event) => onEnter(mission.id, event)}
        onPointerLeave={() => onLeave()}
        onClick={(event) => onPreview(mission.id, event)}
      >
        <span className="sr-only">{mission.title}</span>
        <span
          className="atlas__glyph"
          style={moving ? ({ viewTransitionName: 'signal-mission' } as CSSProperties) : undefined}
        >
          <SignalGlyph
            traits={{
              difficulty: mission.difficulty,
              impact: mission.impact,
              start: mission.start,
              stage: mission.stage,
              status: mission.status,
              minutes: mission.minutes,
              recommended: mission.recommended,
            }}
            size={glyph}
          />
        </span>
        {label ? (
          <span
            className="atlas__label"
            aria-hidden="true"
            data-align={label.align}
            data-side={label.side}
            style={labelStyle}
          >
            {label.kicker ? <span className="atlas__kicker">{label.kicker}</span> : null}
            {label.lines.map((line, at) => (
              <span key={at} className="atlas__line">
                {line}
              </span>
            ))}
          </span>
        ) : null}
      </Link>
      <span id={descriptionId} className="sr-only">
        {descriptionWithoutTitle(mission, known)}
      </span>
    </li>
  );
});

// ------------------------------------------------------------------------------------------
// The plate

/** The graticule behind the missions: arcs and rays from a point below the plate, faint and still. */
function Graticule({ size }: { size: PlateSize }) {
  const cx = size.width * 0.16;
  const cy = size.height * 1.22;
  const step = Math.min(size.width, 1500) * 0.24;
  const reach = Math.hypot(size.width, size.height) * 1.4;
  return (
    <g className="atlas__graticule">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <circle key={i} cx={cx} cy={cy} r={Math.round(step * i)} />
      ))}
      {Array.from({ length: 30 }, (_, i) => {
        const angle = ((i * 12 - 180) * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={Math.round(cx + Math.cos(angle) * 90)}
            y1={Math.round(cy + Math.sin(angle) * 90)}
            x2={Math.round(cx + Math.cos(angle) * reach)}
            y2={Math.round(cy + Math.sin(angle) * reach)}
          />
        );
      })}
    </g>
  );
}

export function Atlas({ model, lit, beside, reason, backTo }: AtlasProps) {
  const box = useRef<HTMLDivElement>(null);
  const light = useRef<HTMLDivElement>(null);
  const rulerX = useRef<HTMLElement>(null);
  const rulerY = useRef<HTMLElement>(null);
  const links = useRef(new Map<string, HTMLAnchorElement>());

  const measured = useBoxWidth(box);
  const viewport = useViewportHeight();
  const reduced = useReducedMotion();
  const fine = useFinePointer();
  const budget = useEffectBudget();

  const width = measured > 0 ? measured : FALLBACK_PLATE.width;
  const height = plateHeightFor({ width, viewport, beside });
  const size = useMemo<PlateSize>(() => ({ width, height }), [width, height]);
  const chart = useMemo(() => buildChart(model, size), [model, size]);
  const { plate, placement } = chart;

  const missionById = useMemo(
    () => new Map(model.missions.map((mission) => [mission.id, mission])),
    [model],
  );
  const labelById = useMemo(
    () => new Map(placement.labels.map((label) => [label.id, label])),
    [placement],
  );
  const litIds = useMemo(
    () => model.missions.filter((m) => !lit || lit.has(m.id)).map((m) => m.id),
    [model, lit],
  );

  // ---- Which mission is being read: the one under the pointer's approach, or the one in focus.
  const [intent, setIntent] = useState<Intent>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const cardHover = useRef(false);
  const clearTimer = useRef(0);
  const touched = useRef(false);

  const choose = useCallback((next: Intent) => {
    window.clearTimeout(clearTimer.current);
    setIntent((current) =>
      current?.id === next?.id && current?.source === next?.source ? current : next,
    );
  }, []);
  const clearSoon = useCallback(() => {
    window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => {
      if (!cardHover.current)
        setIntent((current) => (current?.source === 'pointer' ? null : current));
    }, 160);
  }, []);
  useEffect(() => () => window.clearTimeout(clearTimer.current), []);

  const lens = fine && budget.pointerEffects && !reduced;
  const intentRef = useRef<Intent>(null);
  useEffect(() => {
    intentRef.current = intent;
  }, [intent]);
  const litNodes = useMemo(
    () => plate.nodes.filter((node) => !lit || lit.has(node.id)),
    [plate, lit],
  );

  // The pointer's approach: one coalesced handler, no layout reads while it runs. The plate's
  // rectangle is read once when the pointer arrives, and again only after a scroll or a resize.
  // Without a fine pointer, or with effects held back, a mission opens only under the pointer.
  useEffect(() => {
    const element = box.current;
    if (!lens || !element) return;
    let rect = element.getBoundingClientRect();
    let stale = false;
    const markStale = () => {
      stale = true;
    };
    window.addEventListener('scroll', markStale, { passive: true });
    window.addEventListener('resize', markStale);
    let near: string | null = null;
    const stop = onPointerFrame(element, (clientX, clientY) => {
      if (stale) {
        rect = element.getBoundingClientRect();
        stale = false;
      }
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (light.current) light.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (rulerX.current) rulerX.current.style.transform = `translateX(${x}px)`;
      if (rulerY.current) rulerY.current.style.transform = `translateY(${y}px)`;
      const next = nearestMission(
        litNodes,
        { x, y },
        { acquire: ACQUIRE, release: RELEASE, current: near },
      );
      if (next !== near) {
        near = next;
        if (next) choose({ id: next, source: 'pointer' });
        else if (intentRef.current?.source === 'pointer' && !cardHover.current) clearSoon();
      }
    });
    const enter = () => {
      stale = true;
      element.setAttribute('data-lens', 'on');
    };
    const leave = () => {
      element.removeAttribute('data-lens');
      near = null;
      clearSoon();
    };
    element.addEventListener('pointerenter', enter);
    element.addEventListener('pointerleave', leave);
    return () => {
      stop();
      window.removeEventListener('scroll', markStale);
      window.removeEventListener('resize', markStale);
      element.removeEventListener('pointerenter', enter);
      element.removeEventListener('pointerleave', leave);
      element.removeAttribute('data-lens');
    };
  }, [lens, litNodes, choose, clearSoon]);

  // ---- Roving focus: one tab stop on the plate; the arrows move across it.
  const [current, setCurrent] = useState<string | null>(null);
  const tabbableId =
    current && litIds.includes(current)
      ? current
      : (litIds.find((id) => missionById.get(id)?.recommended) ?? litIds[0] ?? null);

  const onLink = useCallback((id: string, element: HTMLAnchorElement | null) => {
    if (element) links.current.set(id, element);
    else links.current.delete(id);
  }, []);
  const onFocusStar = useCallback(
    (id: string) => {
      setCurrent(id);
      choose({ id, source: 'focus' });
    },
    [choose],
  );
  const onEnter = useCallback(
    (id: string, event: PointerEvent<HTMLElement>) => {
      if (lens || event.pointerType === 'touch') return;
      choose({ id, source: 'pointer' });
    },
    [lens, choose],
  );
  const onLeave = useCallback(() => {
    if (!lens) clearSoon();
  }, [lens, clearSoon]);

  // On a touch screen a mission that has no name on the plate says who it is on the first tap and
  // opens on the second: otherwise there would be nothing to read before it opens.
  const onPreview = useCallback(
    (id: string, event: MouseEvent<HTMLAnchorElement>) => {
      const unlabelled = !labelById.has(id);
      if (touched.current && unlabelled && intentRef.current?.id !== id) {
        event.preventDefault();
        choose({ id, source: 'focus' });
      }
    },
    [labelById, choose],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Escape') {
      if (intent) {
        event.preventDefault();
        setDismissed(intent.id);
      }
      return;
    }
    const direction: Direction | null =
      event.key === 'ArrowRight'
        ? 'right'
        : event.key === 'ArrowLeft'
          ? 'left'
          : event.key === 'ArrowDown'
            ? 'down'
            : event.key === 'ArrowUp'
              ? 'up'
              : null;
    const points = litIds.flatMap((id) => {
      const node = plate.byId.get(id);
      return node ? [{ id, x: node.x, y: node.y }] : [];
    });
    let target: string | null = null;
    if (direction) target = nextInDirection(points, tabbableId, direction);
    else if (event.key === 'Home') target = readingOrder(points)[0]?.id ?? null;
    else if (event.key === 'End') target = readingOrder(points).at(-1)?.id ?? null;
    else return;
    event.preventDefault();
    if (target) links.current.get(target)?.focus();
  };

  const onBlur = (event: FocusEvent<HTMLUListElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIntent((value) => (value?.source === 'focus' ? null : value));
    }
  };

  // ---- The detail beside the mission being read.
  const shown = intent && dismissed !== intent.id ? intent.id : null;
  const shownMission = shown ? missionById.get(shown) : undefined;
  const shownNode = shown ? plate.byId.get(shown) : undefined;
  const cardWidth = Math.min(CARD_WIDTH, size.width - 16);
  const detail = useMemo(
    () =>
      shownNode
        ? placeDetail(shownNode, { w: cardWidth, h: CARD_HEIGHT }, size, plate.nodes)
        : null,
    [shownNode, cardWidth, size, plate.nodes],
  );
  const hushed = useMemo(
    () => new Set(detail ? labelsUnder(detail.rect, placement.labels) : []),
    [detail, placement.labels],
  );
  const to = shownMission ? setupPath(shownMission.id) : '';

  return (
    <div
      ref={box}
      className="atlas"
      style={{ height }}
      onPointerDown={(event) => {
        touched.current = event.pointerType === 'touch';
      }}
      data-lens-ready={lens ? 'true' : undefined}
    >
      <svg
        className="atlas__sky"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        focusable="false"
      >
        <Graticule size={size} />
        {chart.links.map((link) => (
          <line
            key={`${link.from}-${link.to}`}
            className="atlas__link"
            data-dim={lit && (!lit.has(link.from) || !lit.has(link.to)) ? 'true' : undefined}
            x1={link.segment.x1}
            y1={link.segment.y1}
            x2={link.segment.x2}
            y2={link.segment.y2}
          />
        ))}
        {placement.labels.flatMap((label) =>
          label.leader
            ? [
                <line
                  key={`leader-${label.id}`}
                  className="atlas__leader"
                  x1={label.leader.x1}
                  y1={label.leader.y1}
                  x2={label.leader.x2}
                  y2={label.leader.y2}
                />,
              ]
            : [],
        )}
        {placement.families.flatMap((family) =>
          family.leader
            ? [
                <line
                  key={`family-${family.id}`}
                  className="atlas__leader atlas__leader--family"
                  x1={family.leader.x1}
                  y1={family.leader.y1}
                  x2={family.leader.x2}
                  y2={family.leader.y2}
                />,
              ]
            : [],
        )}
      </svg>
      <div className="atlas__ruler atlas__ruler--x" aria-hidden="true">
        <i ref={rulerX} />
      </div>
      <div className="atlas__ruler atlas__ruler--y" aria-hidden="true">
        <i ref={rulerY} />
      </div>
      <div ref={light} className="atlas__light" aria-hidden="true" />

      {placement.families.map((family) => (
        <p
          key={family.id}
          className="atlas__family"
          aria-hidden="true"
          data-align={family.align}
          data-dim={
            lit &&
            !model.families
              .find((one) => one.id === family.id)
              ?.missionIds.some((id) => lit.has(id))
              ? 'true'
              : undefined
          }
          style={
            {
              '--fx': `${family.rect.x}px`,
              '--fy': `${family.rect.y}px`,
              '--fw': `${family.rect.w}px`,
            } as CSSProperties
          }
        >
          {family.text}
        </p>
      ))}

      <p id="plate-hint" className="sr-only">
        Use the arrow keys to move to the nearest mission in a direction, and Enter to open its
        calibration.
      </p>
      {/* The arrow keys are handled for the focusable stars inside (roving focus); the list itself takes none. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <ul
        className="atlas__items"
        role="list"
        aria-label="Missions"
        aria-describedby="plate-hint"
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      >
        {model.missions.map((mission, index) => {
          const node = plate.byId.get(mission.id);
          if (!node) return null;
          return (
            <Star
              key={mission.id}
              mission={mission}
              node={node}
              label={labelById.get(mission.id)}
              glyph={plate.glyph}
              lit={!lit || lit.has(mission.id)}
              active={shown === mission.id}
              tabbable={tabbableId === mission.id}
              hushed={hushed.has(mission.id)}
              index={index}
              backTo={backTo}
              morph={!reduced}
              onLink={onLink}
              onFocusStar={onFocusStar}
              onEnter={onEnter}
              onLeave={onLeave}
              onPreview={onPreview}
            />
          );
        })}
      </ul>

      {shownMission && detail ? (
        <aside
          className="plate-detail glass glass--inspector"
          aria-hidden="true"
          data-side={detail.side}
          style={
            {
              width: cardWidth,
              transform: `translate3d(${Math.round(detail.rect.x)}px, ${Math.round(detail.rect.y)}px, 0)`,
            } as CSSProperties
          }
          onPointerEnter={() => {
            cardHover.current = true;
            window.clearTimeout(clearTimer.current);
          }}
          onPointerLeave={() => {
            cardHover.current = false;
            clearSoon();
          }}
        >
          <MissionDetail
            mission={shownMission}
            to={to}
            state={{ from: backTo, status: shownMission.status }}
            reason={shownMission.recommended ? reason : undefined}
            viewTransition={!reduced}
          />
        </aside>
      ) : null}
    </div>
  );
}
