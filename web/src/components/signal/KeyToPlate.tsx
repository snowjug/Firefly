import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGES,
  DIFFICULTIES,
  IMPACTS,
  IMPACT_LABELS,
  START_TEMPERATURES,
  type BusinessImpact,
  type CallStage,
  type Difficulty,
  type StartTemperature,
} from '#shared/domain/vocab.ts';
import { STAGE_WORDS } from './describe.ts';
import { edgeShape, heartHalfPath, heartPath, tickPaths } from './geometry.ts';
import type { GlyphStatus } from './types.ts';
import '../../styles/signal.css';

// The legend of the grammar for the mission atlas: every channel of the glyph, one value at a
// time, each drawn as a tiny glyph and named in words. A description list, so it reads the same
// without the pictures, and nothing in it is colour alone.

const BOX = 24;
const HALF = BOX / 2;
const VIEW = `${-HALF} ${-HALF} ${BOX} ${BOX}`;

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const EDGE_NAMES: Record<StartTemperature, string> = {
  calm: 'Calm',
  anxious: 'Anxious',
  frustrated: 'Frustrated',
  angry: 'Angry',
};
const FILL_NAMES: Record<GlyphStatus, string> = {
  new: 'New',
  attempted: 'Attempted',
  completed: 'Completed',
};
const FILLS: readonly GlyphStatus[] = ['new', 'attempted', 'completed'];

const RING_RADII: Record<Difficulty, number[]> = {
  starter: [9],
  standard: [10, 6],
  challenge: [10.5, 7, 3.6],
};
const SIZE_HEARTS: Record<BusinessImpact, number> = { low: 2.8, medium: 4.6, high: 7 };

type Mini =
  | { channel: 'rings'; value: Difficulty }
  | { channel: 'size'; value: BusinessImpact }
  | { channel: 'edge'; value: StartTemperature }
  | { channel: 'form'; value: CallStage }
  | { channel: 'fill'; value: GlyphStatus }
  | { channel: 'ticks' }
  | { channel: 'glint' };

/** One channel of the glyph on its own, at 24 px: the same marks, one at a time. */
function MiniGlyph({ mini }: { mini: Mini }) {
  let marks;
  switch (mini.channel) {
    case 'rings':
      marks = RING_RADII[mini.value].map((r, i) => (
        <circle key={r} className={i === 0 ? 'sig-edge' : 'sig-ring'} r={r} strokeWidth={1.2} />
      ));
      break;
    case 'size':
      marks = (
        <>
          <circle className="sig-heart is-solid" r={SIZE_HEARTS[mini.value]} />
          <circle className="sig-ring" r={10.6} strokeWidth={1.2} />
        </>
      );
      break;
    case 'edge': {
      const edge = edgeShape(mini.value, 9.2, 1);
      marks = (
        <>
          {edge.kind === 'serrated' ? (
            <path className="sig-edge" d={edge.d} strokeWidth={1.2} strokeLinejoin="miter" />
          ) : (
            <circle
              className="sig-edge"
              r={edge.radius}
              strokeWidth={edge.kind === 'round-dashes' ? 1.7 : 1.2}
              strokeDasharray={edge.kind === 'smooth' ? undefined : edge.dasharray}
              strokeLinecap={edge.kind === 'round-dashes' ? 'round' : 'butt'}
            />
          )}
          <circle className="sig-heart is-solid" r={1.6} />
        </>
      );
      break;
    }
    case 'form':
      marks = <path className="sig-heart" d={heartPath(mini.value, 6.2)} strokeWidth={1.4} />;
      break;
    case 'fill':
      marks = (
        <>
          {mini.value === 'attempted' ? (
            <path className="sig-heart-half" d={heartHalfPath('first-contact', 6.4)} />
          ) : null}
          <circle
            className={mini.value === 'completed' ? 'sig-heart is-solid' : 'sig-heart'}
            r={6.4}
            strokeWidth={1.4}
          />
        </>
      );
      break;
    case 'ticks': {
      const { on, off } = tickPaths(10, 7, 2.8, 4.6);
      marks = (
        <>
          <path className="sig-tick sig-tick--ghost" d={off} strokeWidth={1.2} />
          <path className="sig-tick" d={on} strokeWidth={1.2} />
        </>
      );
      break;
    }
    case 'glint':
      marks = (
        <>
          <path className="sig-glint" d="M0 -4V-11M0 4V11M-4 0H-11M4 0H11" strokeWidth={1.3} />
          <path
            className="sig-glint sig-glint--diagonal"
            d="M3 -3L5.6 -5.6M-3 3L-5.6 5.6M3 3L5.6 5.6M-3 -3L-5.6 -5.6"
            strokeWidth={1.3}
          />
        </>
      );
      break;
  }
  return (
    <svg
      className="sig sig-mini"
      viewBox={VIEW}
      width={BOX}
      height={BOX}
      aria-hidden="true"
      focusable="false"
    >
      {marks}
    </svg>
  );
}

interface Item {
  key: string;
  word: string;
  mini: Mini;
}
interface Row {
  label: string;
  /** What the channel stands for, as the grammar has it. */
  means: string;
  items: readonly Item[];
}

const ROWS: readonly Row[] = [
  {
    label: 'Rings',
    means: 'difficulty',
    items: DIFFICULTIES.map((value) => ({
      key: value,
      word: DIFFICULTY_PROFILES[value].label,
      mini: { channel: 'rings', value },
    })),
  },
  {
    label: 'Size',
    means: 'impact',
    items: IMPACTS.map((value) => ({
      key: value,
      word: IMPACT_LABELS[value].label,
      mini: { channel: 'size', value },
    })),
  },
  {
    label: 'Edge',
    means: 'start',
    items: START_TEMPERATURES.map((value) => ({
      key: value,
      word: EDGE_NAMES[value],
      mini: { channel: 'edge', value },
    })),
  },
  {
    label: 'Form',
    means: 'stage',
    items: CALL_STAGES.map((value) => ({
      key: value,
      word: capital(STAGE_WORDS[value]),
      mini: { channel: 'form', value },
    })),
  },
  {
    label: 'Fill',
    means: 'status',
    items: FILLS.map((value) => ({
      key: value,
      word: FILL_NAMES[value],
      mini: { channel: 'fill', value },
    })),
  },
];

const NOTES: readonly { label: string; means: string; mini: Mini; text: string }[] = [
  {
    label: 'Ticks',
    means: 'minutes',
    mini: { channel: 'ticks' },
    text: 'One tick is one minute. A full circle is fifteen.',
  },
  {
    label: 'Glint',
    means: 'suggested',
    mini: { channel: 'glint' },
    text: 'An amber cross marks the recommended mission.',
  },
];

export interface KeyToPlateProps {
  /** The smaller form, for the side panel of the atlas. */
  compact?: boolean;
  className?: string;
}

/** The key to the plate: what rings, size, edge, form, fill, ticks and the glint stand for. */
export function KeyToPlate({ compact = false, className }: KeyToPlateProps) {
  return (
    <dl
      className={className ? `sig-key ${className}` : 'sig-key'}
      data-sig="key"
      data-compact={compact ? '' : undefined}
    >
      {ROWS.map((row) => (
        <div key={row.label} className="sig-key__row">
          <dt>
            {row.label}
            <span className="sr-only">, </span>
            <span className="sig-key__means">{row.means}</span>
          </dt>
          <dd>
            <ul className="sig-key__list">
              {row.items.map((item) => (
                <li key={item.key} className="sig-key__item">
                  <MiniGlyph mini={item.mini} />
                  <span>{item.word}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
      {NOTES.map((note) => (
        <div key={note.label} className="sig-key__row">
          <dt>
            {note.label}
            <span className="sr-only">, </span>
            <span className="sig-key__means">{note.means}</span>
          </dt>
          <dd className="sig-key__note">
            <span className="sig-key__item">
              <MiniGlyph mini={note.mini} />
              <span>{note.text}</span>
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
