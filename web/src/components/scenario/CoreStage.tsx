import { useMemo, useRef, type CSSProperties } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { coreParams } from '../atlas/core-params.ts';
import { useBoxWidth, useViewportHeight } from '../atlas/useBoxSize.ts';
import { Disclosure } from '../frame/index.ts';
import { CoreLegend, SignalCore } from '../signal/index.ts';
import type { GlyphStatus } from '../signal/types.ts';
import type { SetupChoices } from './setup-model.ts';

/** Room kept for what sits under the core (the legend, the caption) and the frame around it. */
const CHROME = 400;
const MIN_CORE = 260;
const MAX_CORE = 520;
/** Where the page is one column, the core stays small enough that the title and the settings are close. */
const MAX_STACKED_CORE = 336;

/**
 * The scenario core and its legend: the engraved instrument that turns as the settings change, with
 * each of its lettered parts named and its value said in words. The core is drawn from the same
 * numbers (`coreParams`) the legend and the field behind the page are, so they always agree. Beside
 * the settings the legend is always open; above them (one column) it is one tap away.
 */
export function CoreStage({
  scenario,
  choices,
  status,
  quiet,
  transitionName,
}: {
  scenario: PublicScenarioDTO;
  choices: SetupChoices;
  /** Where the trainee stands with this mission; the heart's fill. */
  status: GlyphStatus;
  /** The call is opening: the fine engraving dims and the rings are left. */
  quiet: boolean;
  /** Set while the page changes to or from the plate, so the browser flies the core. */
  transitionName?: string | undefined;
}) {
  const stage = useRef<HTMLElement>(null);
  const width = useBoxWidth(stage);
  const viewport = useViewportHeight();
  const beside = useMediaQuery('(min-width: 64rem)');
  const params = useMemo(() => coreParams(choices), [choices]);
  const traits = useMemo(
    () => ({
      difficulty: choices.difficulty,
      impact: choices.impact,
      start: choices.startingTemperature,
      stage: choices.callStage,
      status,
      minutes: scenario.estimatedMinutes,
    }),
    [choices, status, scenario.estimatedMinutes],
  );
  const room = width > 0 ? width : MAX_CORE;
  const size = beside
    ? Math.round(Math.max(MIN_CORE, Math.min(MAX_CORE, room, viewport - CHROME)))
    : Math.round(Math.min(MAX_STACKED_CORE, room));
  const legend = <CoreLegend traits={traits} params={params} className="cal-legend" />;

  return (
    <section ref={stage} className="cal-stage" aria-label="The scenario core">
      <div
        className="cal-core"
        style={
          transitionName ? ({ viewTransitionName: transitionName } as CSSProperties) : undefined
        }
      >
        <SignalCore traits={traits} params={params} size={size} quiet={quiet} />
      </div>
      {beside ? legend : <Disclosure summary="Read the instrument">{legend}</Disclosure>}
      <p className="cal-fig">
        <span className="type-label">Fig. 1</span> Every mark is live: change a setting and the
        instrument turns with it. What the customer is hiding stays hidden.
      </p>
    </section>
  );
}
