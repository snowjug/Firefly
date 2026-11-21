import type { ReactNode, SVGProps } from 'react';
import type { ProductId } from '#shared/domain/vocab.ts';
import '../icons.css';

// One neutral, original mark for each Microsoft product Firefly practises. They are drawn here, on
// the same 24 px grid and with the same 1.5 stroke as the other icons, and they are not logos: each
// one is a plain picture of what the product is for (a video call, an inbox, a cloud folder, an ID
// card, a managed device, a stack of layers). Kept apart from icons.tsx so that the app shell, which
// loads that file first, does not carry them; pages that show products import this one.

const Dot = ({ x, y, r = 1.4 }: { x: number; y: number; r?: number }) => (
  <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none" />
);

const SHAPES: Record<ProductId, ReactNode> = {
  // Meetings, chat and calls: a video call.
  teams: (
    <>
      <rect x="3" y="7" width="12.5" height="10" rx="2.5" />
      <path d="M15.5 10.8l5-2.8v8l-5-2.8" />
    </>
  ),
  // Mail and calendar: an envelope.
  outlook: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3.8 7.5l8.2 6 8.2-6" />
    </>
  ),
  // Mailboxes and mail flow: an inbox tray.
  'exchange-online': (
    <path d="M4 13.5l2-7h12l2 7v4.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18zM4 13.5h4.5l1 2h5l1-2H20" />
  ),
  // Sites and sharing: three connected nodes.
  'sharepoint-online': (
    <>
      <circle cx="12" cy="6.5" r="2.5" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
      <path d="M10.6 8.6L7.9 15.3M13.4 8.6l2.7 6.7M9 17.5h6" />
    </>
  ),
  // Files in the cloud: a cloud.
  'onedrive-business': (
    <path d="M7 18.5a4 4 0 0 1-.5-7.97 5.6 5.6 0 0 1 10.7 1.2 3.4 3.4 0 0 1-.7 6.77z" />
  ),
  // The Office apps: a launcher grid.
  'm365-apps': (
    <>
      <Dot x={6.5} y={6.5} />
      <Dot x={12} y={6.5} />
      <Dot x={17.5} y={6.5} />
      <Dot x={6.5} y={12} />
      <Dot x={12} y={12} />
      <Dot x={17.5} y={12} />
      <Dot x={6.5} y={17.5} />
      <Dot x={12} y={17.5} />
      <Dot x={17.5} y={17.5} />
    </>
  ),
  // Identity and sign-in: an ID card.
  'entra-id': (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="8.5" cy="11.2" r="2" />
      <path d="M5.3 16c.5-1.5 1.7-2.3 3.2-2.3s2.7.8 3.2 2.3M14 10.5h4M14 13.5h3" />
    </>
  ),
  // Device management: a device with a check.
  intune: (
    <>
      <rect x="3.5" y="5" width="17" height="11" rx="2" />
      <path d="M9 19.5h6M12 16v3.5M9.2 10.6l2.2 2.2 3.6-4.2" />
    </>
  ),
  // Mail protection: a shield around an envelope.
  'defender-office-365': (
    <>
      <path d="M12 3L4.5 5.9v5.6c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V5.9z" />
      <path d="M8.6 10.2h6.8v4.6H8.6zM8.6 10.7l3.4 2.4 3.4-2.4" />
    </>
  ),
  // Automation and apps: a bolt.
  'power-platform': <path d="M13.2 3L5.5 13.4h5.3L9.8 21l8.7-11.2h-5.6z" />,
  // The operating system: an application window.
  'windows-11': (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M3 9h18" />
      <Dot x={6} y={6.75} r={0.8} />
      <Dot x={8.6} y={6.75} r={0.8} />
      <Dot x={11.2} y={6.75} r={0.8} />
    </>
  ),
  // Cloud platform: a stack of layers.
  azure: <path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8zM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />,
  // Business applications: rising bars.
  'dynamics-365': <path d="M3.5 20h17M7 20v-6.5M12 20V7.5M17 20v-9" />,
};

export interface ProductIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'name' | 'children' | 'ref'
> {
  product: ProductId;
  /** Width and height in CSS pixels. */
  size?: number;
  /** An accessible name. Leave it out when the product's name is written beside the icon. */
  label?: string;
}

/** A product's neutral mark. Decorative (hidden from assistive technology) unless it has a `label`. */
export function ProductIcon({ product, size = 20, label, className, ...rest }: ProductIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={className ? `ff-icon ${className}` : 'ff-icon'}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      {...rest}
    >
      {SHAPES[product]}
    </svg>
  );
}
