import { memo, useEffect, useId, useRef, useState } from 'react';
import { useSlidingIndicator } from '../../app/shell/use-sliding-indicator.ts';
import { cx } from '../../design/cx.ts';
import { useOnScreen } from '../../design/interaction/use-in-view.ts';
import { useLoopClock } from '../../design/interaction/use-loop-clock.ts';
import { usePageVisible } from '../../design/interaction/use-page-visible.ts';
import { useTilt } from '../../design/interaction/use-tilt.ts';
import { Button } from '../../design/primitives/Button.tsx';
import { useAnnouncer } from '../../design/primitives/LiveRegion.tsx';
import { ProductIcon } from '../../design/primitives/ProductIcon.tsx';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '../../design/primitives/Tabs.tsx';
import { accentClass } from '../../design/product-accent.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { PreviewPanel } from './PreviewPanel.tsx';
import {
  LOOP_MS,
  MAX_LOOPS,
  PREVIEW_EXAMPLES,
  finalFrame,
  frameAt,
  type PreviewExample,
} from './preview-script.ts';
import './call-preview.css';

export const PREVIEW_CAPTION = 'Example call. The customer is synthetic.';

const FIRST = PREVIEW_EXAMPLES[0] as PreviewExample;

/** An example that is not the one playing: its last frame, whole, so the card is as tall as the tallest. */
const Still = memo(function Still({ example }: { example: PreviewExample }) {
  return <PreviewPanel example={example} frame={finalFrame(example)} t={LOOP_MS} />;
});

interface PlayerProps {
  example: PreviewExample;
  /** It may run: on screen, in a tab that can be seen. */
  active: boolean;
  /** Motion is reduced: the final frame, and no control, because nothing moves. */
  reduced: boolean;
  /** This run was started by "Play" at the end, so focus goes back to the control that was pressed. */
  restoreFocus: boolean;
  onReplay(): void;
}

/**
 * The example that is playing. Its clock is its own, so choosing another example (or playing again)
 * mounts a new player and starts from the top. It runs three loops, then rests on the report, and
 * its one control pauses and plays: the visitor can always stop what moves (WCAG 2.2.2).
 */
function Player({ example, active, reduced, restoreFocus, onReplay }: PlayerProps) {
  const announce = useAnnouncer();
  const [paused, setPaused] = useState(false);
  const clock = useLoopClock({
    durationMs: LOOP_MS,
    maxLoops: MAX_LOOPS,
    paused: !active || paused,
    reduced,
  });
  const resting = !reduced && !clock.playing && clock.loop >= MAX_LOOPS;
  const showPlay = paused || resting;

  const button = useRef<HTMLButtonElement>(null);
  const [focusOnMount] = useState(restoreFocus);
  useEffect(() => {
    if (focusOnMount) button.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  const press = () => {
    if (resting) {
      announce('Preview playing again.');
      onReplay();
      return;
    }
    setPaused(!paused);
    announce(paused ? 'Preview playing.' : 'Preview paused.');
  };

  return (
    <PreviewPanel
      example={example}
      frame={frameAt(example, clock.t)}
      t={clock.t}
      action={
        reduced ? null : (
          <Button
            ref={button}
            appearance="subtle"
            size="small"
            icon={showPlay ? 'play' : 'pause'}
            aria-label={showPlay ? 'Play preview' : 'Pause preview'}
            onClick={press}
          >
            {showPlay ? 'Play' : 'Pause'}
          </Button>
        )
      }
    />
  );
}

/**
 * The hero's picture of a call: a short, scripted call that plays by itself and ends in a small
 * report. The three product tabs are three examples of the same call; the line under the chosen
 * one slides. It never plays sound, pauses while it is off screen or the tab is hidden, rests on the
 * report after three loops, and under reduced motion shows only that last frame. The window turns a
 * degree or two toward a mouse, and not at all for touch or reduced motion.
 */
export function CallPreview() {
  const captionId = useId();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [figure, onScreen] = useOnScreen<HTMLElement>();
  const visible = usePageVisible();
  const frame = useTilt<HTMLDivElement>({ maxDeg: 1.5 });
  const bar = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState(FIRST.id);
  const [run, setRun] = useState({ count: 0, restoreFocus: false });
  const example = PREVIEW_EXAMPLES.find(({ id }) => id === selected) ?? FIRST;
  useSlidingIndicator(bar, '[role="tab"][aria-selected="true"]', selected);

  const choose = (id: string) => {
    if (id === selected) return;
    setSelected(id);
    setRun(({ count }) => ({ count: count + 1, restoreFocus: false }));
  };
  const replay = () => setRun(({ count }) => ({ count: count + 1, restoreFocus: true }));

  return (
    <figure ref={figure} className="lp-preview" aria-labelledby={captionId}>
      <Tabs value={selected} onValueChange={choose}>
        <div ref={bar} className="lp-preview__bar">
          <TabList label="Example calls by product" className="lp-preview__tabs">
            {PREVIEW_EXAMPLES.map((item) => (
              <Tab key={item.id} value={item.id} className="lp-preview__tab">
                <span className={cx('lp-preview__name', accentClass(item.product))}>
                  <ProductIcon product={item.product} size={18} className="lp-preview__icon" />
                  {item.tab}
                </span>
              </Tab>
            ))}
          </TabList>
          <span
            className={cx('lp-preview__line', accentClass(example.product))}
            aria-hidden="true"
          />
        </div>
        <div ref={frame} className="lp-preview__window">
          <TabPanels>
            {PREVIEW_EXAMPLES.map((item) => (
              <TabPanel key={item.id} value={item.id} stacked className="lp-preview__panel">
                {item.id === selected ? (
                  <Player
                    key={`${item.id}:${run.count}`}
                    example={item}
                    active={onScreen && visible}
                    reduced={reduced}
                    restoreFocus={run.restoreFocus}
                    onReplay={replay}
                  />
                ) : (
                  <Still example={item} />
                )}
              </TabPanel>
            ))}
          </TabPanels>
        </div>
      </Tabs>
      <figcaption id={captionId} className="lp-preview__caption">
        {PREVIEW_CAPTION}
      </figcaption>
    </figure>
  );
}
