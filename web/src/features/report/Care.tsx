import { useLayoutEffect, useRef, useState } from 'react';
import type { CarePrincipleResult, CoachingReport } from '#shared/domain/report.ts';
import { CARE_LABELS, type CareBehaviour } from '#shared/domain/vocab.ts';
import {
  Disclosure,
  Icon,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  VisuallyHidden,
} from '../../design/index.ts';
import { careNextAction, careQuote } from './care-model.ts';
import { BEHAVIOUR_STATUS_WORDS, dimensionLabel } from './copy.ts';
import { useEvidence } from './evidence.tsx';
import {
  BehaviourBadge,
  ClampedText,
  Field,
  InsufficientEvidence,
  LevelBadge,
  Quote,
  Section,
} from './parts.tsx';
import { usePrinting } from './print.tsx';
import { careCounts } from './report-model.ts';
import './scores.css';

/** The most words a CARE observation or its next action shows before "Show more". */
export const CARE_WORDS = 30;

function Counts({ principle }: { principle: CarePrincipleResult }) {
  const { shown, partly, notShown } = careCounts(principle);
  return (
    <p className="rp-care__counts">
      <span>
        {shown} {BEHAVIOUR_STATUS_WORDS.shown.toLowerCase()}
      </span>{' '}
      <span>
        {partly} {BEHAVIOUR_STATUS_WORDS.partly.toLowerCase()}
      </span>{' '}
      <span>
        {notShown} {BEHAVIOUR_STATUS_WORDS['not-shown'].toLowerCase()}
      </span>
    </p>
  );
}

/** How much of what a principle looks for the call showed: a segment for each behaviour, and the count in words. */
function Coverage({ principle }: { principle: CarePrincipleResult }) {
  const total = principle.behaviours.length;
  if (total === 0) return <span className="rp-care__coverage">No behaviours listed</span>;
  return (
    <span className="rp-care__coverage">
      <span className="rp-care__segments" aria-hidden="true">
        {principle.behaviours.map((behaviour) => (
          <span className={`rp-care__seg rp-care__seg--${behaviour.status}`} key={behaviour.id} />
        ))}
      </span>
      <span>
        {careCounts(principle).shown} of {total} shown
      </span>
    </span>
  );
}

function Panel({ report, principle }: { report: CoachingReport; principle: CarePrincipleResult }) {
  const { turns } = useEvidence();
  const printing = usePrinting();
  const [open, setOpen] = useState(false);
  const expanded = open || printing;
  const name = CARE_LABELS[principle.id];
  const quote = careQuote(principle, turns);
  const next = careNextAction(report, principle.id);
  const { behaviours } = principle;
  return (
    <div className="rp-care__panel" data-rp-origin={name}>
      <div className="rp-care__head">
        <h3 className="rp-care__name">{name}</h3>
        <LevelBadge level={principle.level} />
      </div>
      <Field label="What was observed">
        <ClampedText
          className="rp-care__summary"
          text={principle.summary}
          budget={CARE_WORDS}
          budgetKey="care"
        />
      </Field>
      <Field label="Evidence">
        {quote ? (
          <>
            <Quote quote={quote.quote} turnIndex={quote.turnIndex} />
            <p className="rp-care__shows">Shows: {quote.behaviour}</p>
          </>
        ) : (
          <InsufficientEvidence note="No quoted moment backs this principle." />
        )}
      </Field>
      {next ? (
        <Field label="Next action">
          <ClampedText
            className="rp-care__next"
            text={next.text}
            budget={CARE_WORDS}
            budgetKey="care-next"
          />
          <p className="rp-care__source">From the skill {dimensionLabel(next.dimension)}.</p>
        </Field>
      ) : null}
      {behaviours.length > 0 ? (
        <div className="rp-care__more">
          <Counts principle={principle} />
          <Disclosure
            appearance="inline"
            className="rp-care__toggle"
            open={expanded}
            onOpenChange={() => setOpen(!open)}
            summary={
              <>
                {expanded ? 'Hide behaviours' : 'Show behaviours'}{' '}
                <VisuallyHidden>for {name}</VisuallyHidden>
              </>
            }
          >
            <ul className="rp-behaviours" role="list">
              {behaviours.map((behaviour) => (
                <li className="rp-behaviour" key={behaviour.id}>
                  <p className="rp-behaviour__head">
                    <BehaviourBadge status={behaviour.status} />
                    <span className="rp-behaviour__label">{behaviour.label}</span>
                  </p>
                  {behaviour.note ? <p className="rp-behaviour__note">{behaviour.note}</p> : null}
                  {behaviour.evidence.length > 0 ? (
                    <div className="rp-quotes">
                      {behaviour.evidence.map((e) => (
                        <Quote
                          key={`${e.turnIndex}-${e.quote}`}
                          quote={e.quote}
                          turnIndex={e.turnIndex}
                        />
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}

/** Slides a line under the selected tab: only `transform` moves, from two numbers kept as custom properties. */
function useSlidingIndicator(selected: string) {
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = list.current?.querySelector<HTMLElement>('[role="tablist"]');
    if (!element) return;
    const place = () => {
      const tab = element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!tab) return;
      element.style.setProperty('--care-x', `${tab.offsetLeft}px`);
      element.style.setProperty('--care-w', String(tab.offsetWidth));
    };
    place();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => observer.disconnect();
  }, [selected]);
  return list;
}

/**
 * The four CARE principles behind one selector, with a line that slides to the one chosen. All four
 * sections are in the page (the selector only decides which is shown), so a printout carries them
 * all. Each says what was observed, shows the strongest quote the transcript backs and gives one
 * next action, worked out from the weakest skill that feeds the principle. The behaviours behind it
 * are a click away. CBCF is not applied, and the page says so in the report's own words.
 */
export function CareReview({ report }: { report: CoachingReport }) {
  const care = report.care ?? [];
  const [selected, setSelected] = useState<CareBehaviour>(care[0]?.id ?? 'communicate');
  const slider = useSlidingIndicator(selected);
  if (care.length === 0) return null;
  return (
    <Section id="care" title="CARE review" lead="How the four CARE principles showed in this call.">
      <div className="rp-care" ref={slider}>
        <Tabs<CareBehaviour> value={selected} onValueChange={setSelected}>
          <TabList label="CARE principles" className="rp-care__tabs">
            {care.map((principle) => (
              <Tab key={principle.id} value={principle.id}>
                <span className="rp-care__tab">
                  <span className="rp-care__tabname">{CARE_LABELS[principle.id]}</span>{' '}
                  <Coverage principle={principle} />
                </span>
              </Tab>
            ))}
            <span className="rp-care__indicator" aria-hidden="true" />
          </TabList>
          <TabPanels className="rp-care__panels">
            {care.map((principle) => (
              <TabPanel key={principle.id} value={principle.id} stacked>
                <Panel report={report} principle={principle} />
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
        {report.cbcf ? (
          <p className="rp-care__cbcf">
            <Icon name="info" size={16} />
            <span>{report.cbcf.note}</span>
          </p>
        ) : null}
      </div>
    </Section>
  );
}
