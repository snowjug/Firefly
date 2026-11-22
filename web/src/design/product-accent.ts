import type { ProductId } from '#shared/domain/vocab.ts';
import './accent.css';

// Each Microsoft product is given one of seven accent hues, so a scenario is recognised at a glance
// in a carousel, a list and a report. The hue is a small mark (an icon tile, a thin edge, a tag),
// never a large fill, and never the only way a product is named: its name is always written. The
// hues are neutral picks from the palette; they are not product logos and make no brand claim.

export const ACCENTS = ['blue', 'indigo', 'purple', 'teal', 'green', 'orange', 'magenta'] as const;
export type AccentId = (typeof ACCENTS)[number];

export const PRODUCT_ACCENT: Record<ProductId, AccentId> = {
  teams: 'purple',
  outlook: 'blue',
  'exchange-online': 'indigo',
  'sharepoint-online': 'teal',
  'onedrive-business': 'blue',
  'm365-apps': 'orange',
  'entra-id': 'indigo',
  intune: 'green',
  'defender-office-365': 'teal',
  'power-platform': 'magenta',
  'windows-11': 'blue',
  azure: 'blue',
  'dynamics-365': 'purple',
};

/**
 * The class that gives an element its product's accent as three local custom properties:
 * `--accent-fg`, `--accent-bg` and `--accent-border`. They follow the active theme. A component
 * reads those and never a hue by name, so a product can change its hue in one place.
 */
export function accentClass(product: ProductId | null | undefined): string {
  return `ff-accent ff-accent--${product ? PRODUCT_ACCENT[product] : 'blue'}`;
}
