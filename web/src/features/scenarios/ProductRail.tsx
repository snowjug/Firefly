import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { ProductId } from '#shared/domain/vocab.ts';
import { useDragScroll } from '../../design/interaction/use-drag-scroll.ts';
import { ProductIcon } from '../../design/primitives/ProductIcon.tsx';
import { VisuallyHidden } from '../../design/primitives/VisuallyHidden.tsx';
import { PRODUCT_SHORT } from './labels.ts';
import './product-rail.css';

export interface RailProduct {
  id: ProductId;
  /** How many scenarios this product would show with the other filters as they are. */
  count: number;
}

export interface ProductRailProps {
  /** The products that have scenarios, in the order to show them. */
  products: readonly RailProduct[];
  /** How many scenarios "All" shows. */
  total: number;
  value: ProductId | null;
  onChange(value: ProductId | null): void;
}

/** How wide the soft fade at a scrolling edge is, in px: a chip is kept clear of it. */
const FADE_PX = 32;
const EDGE_PX = 2;

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// The imperative work below is on elements, not on React. The track is the row of chips and the
// strip is the element that scrolls it.

/** Marks each edge of the strip that has more beyond it, for the stylesheet's soft fade. */
function markEdges(strip: HTMLElement): void {
  const reach = strip.scrollWidth - strip.clientWidth;
  const more = [
    strip.scrollLeft > EDGE_PX ? 'start' : '',
    strip.scrollLeft < reach - EDGE_PX ? 'end' : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (more) strip.dataset.more = more;
  else delete strip.dataset.more;
}

/** Puts the indicator under the chosen chip, and brings that chip into view if it is not. */
function placeIndicator(strip: HTMLElement, row: HTMLElement, smooth: boolean): void {
  const chip = row.querySelector<HTMLElement>('.scn-chip[data-selected]');
  if (!chip) {
    row.style.setProperty('--scn-ind-o', '0');
    return;
  }
  row.style.setProperty('--scn-ind-x', `${chip.offsetLeft}px`);
  row.style.setProperty('--scn-ind-w', String(chip.offsetWidth));
  row.style.setProperty('--scn-ind-o', '1');
  const left = chip.offsetLeft;
  const right = left + chip.offsetWidth;
  const hidden =
    left - FADE_PX < strip.scrollLeft || right + FADE_PX > strip.scrollLeft + strip.clientWidth;
  if (!hidden || strip.clientWidth === 0) return;
  const centred = left - (strip.clientWidth - chip.offsetWidth) / 2;
  const target = Math.min(Math.max(centred, 0), strip.scrollWidth - strip.clientWidth);
  strip.scrollTo?.({ left: target, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
}

/** From now on the indicator may animate (its first placement must not slide in from the edge). */
function markPlaced(row: HTMLElement): void {
  row.dataset.placed = 'true';
}

/**
 * Keeps the one shared indicator under the chosen chip, and the chosen chip in view. The indicator is
 * moved with a transform only (its width is a scale), and its first placement is not animated: it
 * would otherwise slide in from the left edge.
 */
function useRailIndicator(
  track: { current: HTMLDivElement | null },
  value: ProductId | null,
  signature: string,
) {
  const placed = useRef(false);
  useLayoutEffect(() => {
    const row = track.current;
    const strip = row?.parentElement;
    if (!row || !strip) return;
    placeIndicator(strip, row, placed.current);
    markEdges(strip);
    const frame = requestAnimationFrame(() => {
      placed.current = true;
      markPlaced(row);
    });
    let pending = 0;
    const onScroll = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        markEdges(strip);
      });
    };
    strip.addEventListener('scroll', onScroll, { passive: true });
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            placeIndicator(strip, row, false);
            markEdges(strip);
          });
    observer?.observe(row);
    observer?.observe(strip);
    return () => {
      cancelAnimationFrame(frame);
      if (pending) cancelAnimationFrame(pending);
      strip.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [track, value, signature]);
}

interface ChipProps {
  name: string;
  label: string;
  count: number;
  value: string;
  checked: boolean;
  disabled?: boolean;
  product?: ProductId;
  onChoose(): void;
}

function Chip({ name, label, count, value, checked, disabled, product, onChoose }: ChipProps) {
  return (
    <label className="scn-chip" data-selected={checked ? 'true' : undefined}>
      <input
        className="scn-chip__input"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChoose}
      />
      <span className="scn-chip__face">
        {product ? <ProductIcon product={product} size={18} /> : null}
        <span className="scn-chip__label">{label}</span>
        <span className="scn-chip__count" aria-hidden="true">
          {count}
        </span>
        <VisuallyHidden>
          , {count} {count === 1 ? 'scenario' : 'scenarios'}
        </VisuallyHidden>
      </span>
    </label>
  );
}

/**
 * The product filter: "All" and one chip for each product that has scenarios, each with its icon, a
 * short name and how many scenarios it would show. It is one radio group, so the arrow keys move
 * (and choose), Home and End go to the first and last, and a screen reader says "3 of 14". One
 * indicator slides to the chosen chip. It is a single row that scrolls sideways (by touch, by the
 * trackpad, by dragging with a mouse, or with the keyboard), and never wraps.
 */
export function ProductRail({ products, total, value, onChange }: ProductRailProps) {
  const name = useId();
  const track = useRef<HTMLDivElement>(null);
  const strip = useDragScroll<HTMLDivElement>();
  useRailIndicator(track, value, products.map((product) => product.id).join('|'));

  // Home and End: radio groups have no key for them, so they are added next to the arrow keys. The
  // listener sits on the scrolling row, not on a control: the radios keep their own behaviour.
  useEffect(() => {
    const scroller = track.current?.parentElement;
    if (!scroller) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Home' && event.key !== 'End') return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.shiftKey) return;
      const radios = [
        ...scroller.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)'),
      ];
      const target = event.key === 'Home' ? radios[0] : radios[radios.length - 1];
      if (!target) return;
      event.preventDefault();
      target.focus();
      if (!target.checked) target.click();
    };
    scroller.addEventListener('keydown', onKeyDown);
    return () => scroller.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <fieldset className="scn-rail">
      <legend className="visually-hidden">Product</legend>
      <div className="scn-rail__scroller" ref={strip}>
        <div className="scn-rail__track" ref={track}>
          <span className="scn-rail__ind" aria-hidden="true" />
          <Chip
            name={name}
            label="All"
            value=""
            count={total}
            checked={value === null}
            onChoose={() => onChange(null)}
          />
          {products.map((product) => (
            <Chip
              key={product.id}
              name={name}
              label={PRODUCT_SHORT[product.id]}
              value={product.id}
              count={product.count}
              checked={value === product.id}
              disabled={product.count === 0 && value !== product.id}
              product={product.id}
              onChoose={() => onChange(product.id)}
            />
          ))}
        </div>
      </div>
    </fieldset>
  );
}
