import type { CoreParams } from '../atlas/core-params.ts';
import { OPTION_EXPLANATIONS } from '../atlas/core-params.ts';
import { describeCoreParts } from './describe.ts';
import { difficultyOf, impactOf, startOf } from './poses.ts';
import type { CoreTraits } from './types.ts';
import '../../styles/signal.css';

export interface CoreLegendProps {
  traits: CoreTraits;
  params: CoreParams;
  /** Adds a line of what each part means under it, from the same words the settings use. */
  explain?: boolean;
  className?: string;
}

/** What each part means, in the words of the settings. Only the three that follow a setting. */
function meaning(letter: string, params: CoreParams): string {
  switch (letter) {
    case 'A':
      return 'One tick is one minute of the call, up to fifteen.';
    case 'B':
      return OPTION_EXPLANATIONS.impact[impactOf(params.pressure)];
    case 'C':
      return 'The shape is the call stage. The fill is where you stand with this mission.';
    case 'D':
      return OPTION_EXPLANATIONS.startingTemperature[startOf(params.stability)];
    case 'E':
      return OPTION_EXPLANATIONS.difficulty[difficultyOf(params.complexity)];
    default:
      return 'How much there is to look for. The signals themselves stay hidden.';
  }
}

/**
 * The key to the core: its six lettered parts, each with what it shows now. A real description
 * list, so a screen reader gets every part and its value and the letters only match the picture.
 * Signal density is a word ("Moderate"), never a count.
 */
export function CoreLegend({ traits, params, explain = false, className }: CoreLegendProps) {
  return (
    <dl className={className ? `sig-legend ${className}` : 'sig-legend'} data-sig="legend">
      {describeCoreParts(traits, params).map((part) => (
        <div key={part.letter} className="sig-legend__item">
          <span className="sig-legend__k" aria-hidden="true">
            {part.letter}
          </span>
          <dt>{part.name}</dt>
          <dd>{part.value}</dd>
          {explain ? <dd className="sig-legend__why">{meaning(part.letter, params)}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
