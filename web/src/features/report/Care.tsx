import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  CareBehaviourResult,
  CarePrincipleResult,
  CoachingReport,
} from '#shared/domain/report.ts';
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
  mergeRefs,
  useReveal,
} from '../../design/index.ts';
import {
  behaviourEvidence,
  careNextAction,
  careQuotes,
  splitCaseClause,
  type BehaviourEvidence,
  type CareQuote,
} from './care-model.ts';
import { BEHAVIOUR_STATUS_WORDS, CBCF_PLAIN, dimensionLabel } from './copy.ts';
import { TurnLink, useEvidence } from './evidence.tsx';
import {
  BehaviourBadge,
  ClampedText,
  Field,
  InsufficientEvidence,
  LevelBadge,
  Quote,
  Section,
} from './parts.tsx';
import { careCounts } from './report-model.ts';
import { stagger } from './reveal.ts';
import './scores.css';

/** The most words a CARE observation shows before "Show more". */
export const CARE_WORDS = 30;

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

/**
 * What the level rests on, beside the level: how many behaviours were shown, and how the call did
 * against what the case needed. They come from the report's own sentence and behaviours, so the
 * level, the count and the sentence below cannot disagree.
 */
function Basis({ principle, fit }: { principle: CarePrincipleResult; fit: string | null }) {
  const { shown, partly } = careCounts(principle);
  const total = principle.behaviours.length;
  return (
    <p className="rp-care__basis">
      <span>
        {total === 0
          ? 'No behaviours listed'
          : `${shown} of ${total} behaviours shown${partly > 0 ? ` (${partly} partly)` : ''}`}
      </span>
      {fit ? <span>{fit}</span> : null}
    </p>
  );
}

/** What stands under one behaviour of the list: a quote, a pointer to one already shown, or nothing. */
function Proof({
  status,
  proof,
}: {
  status: CareBehaviourResult['status'];
  proof: BehaviourEvidence | undefined;
}) {
  switch (proof?.kind) {
    case 'quote':
      return <Quote quote={proof.quote} turnIndex={proof.turnIndex} />;
    case 'repeat':
      return (
        <p className="rp-behaviour__note">
          The same words as above. <TurnLink turnIndex={proof.turnIndex} />
        </p>
      );
    case 'absence':
      return (
        <p className="rp-behaviour__note">Nothing to quote: this is about what was left out.</p>
      );
    default:
      return status === 'not-shown' ? null : <InsufficientEvidence />;
  }
}

function Panel({
  report,
  principle,
  quote,
}: {
  report: CoachingReport;
  principle: CarePrincipleResult;
  quote: CareQuote | null;
}) {
  const { turns } = useEvidence();
  const [open, setOpen] = useState(false);
  const name = CARE_LABELS[principle.id];
  const next = careNextAction(report, principle.id);
  const { text: observed, fit } = splitCaseClause(principle.summary);
  const proofs = useMemo(() => behaviourEvidence(principle, turns), [principle, turns]);
  const { behaviours } = principle;
  return (
    <div className="rp-care__panel" data-rp-origin={name}>
      <div className="rp-care__head">
        <h3 className="rp-care__name">{name}</h3>
        <LevelBadge level={principle.level} />
        <Basis principle={principle} fit={fit} />
      </div>
      <Field label="What was observed">
        <ClampedText
          className="rp-care__summary"
          text={observed}
          budget={CARE_WORDS}
          budgetKey="care"
        />
      </Field>
      <Field label="Evidence">
        {quote ? (
          <>
            <Quote quote={quote.quote} turnIndex={quote.turnIndex} />
            <p className="rp-care__shows">
              {BEHAVIOUR_STATUS_WORDS[quote.status]}: {quote.behaviour}
            </p>
          </>
        ) : (
          <InsufficientEvidence note="No quoted moment backs this principle." />
        )}
      </Field>
      {next ? (
        <Field label="Next action" className="rp-care__action">
          <p className="rp-care__next" data-budget="care-next">
            {next.action}
          </p>
          {next.more ? <p className="rp-care__nextmore">{next.more}</p> : null}
          <p className="rp-care__source">From the skill {dimensionLabel(next.dimension)}.</p>
        </Field>
      ) : null}
      {behaviours.length > 0 ? (
        <div className="rp-care__more">
          <Disclosure
            appearance="inline"
            className="rp-care__toggle"
            open={open}
            onOpenChange={() => setOpen(!open)}
            summary={
              <>
                {open ? 'Hide behaviours' : 'Show behaviours'}{' '}
                <VisuallyHidden>for {name}</VisuallyHidden>
              </>
            }
          >
            <ul className="rp-behaviours" role="list">
              {behaviours.map((behaviour, index) => (
                <li className="rp-behaviour" key={behaviour.id}>
                  <p className="rp-behaviour__head">
                    <BehaviourBadge status={behaviour.status} />
                    <span className="rp-behaviour__label">{behaviour.label}</span>
                  </p>
                  {behaviour.note ? <p className="rp-behaviour__note">{behaviour.note}</p> : null}
                  <Proof status={behaviour.status} proof={proofs[index]} />
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Keeps the strip of tabs honest at every width: a line slides under the chosen tab (only
 * `transform` moves, from two numbers kept as custom properties), the chosen tab is kept in view
 * when the strip scrolls, and `data-more` says which edges have more beyond them, for the fade.
 */
function useTabStrip(selected: string) {
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = list.current?.querySelector<HTMLElement>('[role="tablist"]');
    if (!element) return;
    const place = () => {
      const tab = element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!tab) return;
      element.style.setProperty('--care-x', `${tab.offsetLeft}px`);
      element.style.setProperty('--care-w', String(tab.offsetWidth));
      const left = tab.offsetLeft;
      const right = left + tab.offsetWidth;
      if (left < element.scrollLeft) element.scrollLeft = left;
      else if (right > element.scrollLeft + element.clientWidth) {
        element.scrollLeft = right - element.clientWidth;
      }
    };
    const edges = () => {
      const reach = element.scrollWidth - element.clientWidth;
      const at = Math.abs(element.scrollLeft);
      const sides = [at > 1 ? 'start' : '', at < reach - 1 ? 'end' : ''].filter(Boolean).join(' ');
      if (sides) element.dataset.more = sides;
      else delete element.dataset.more;
    };
    place();
    edges();
    element.addEventListener('scroll', edges, { passive: true });
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        place();
        edges();
      });
      observer.observe(element);
    }
    return () => {
      element.removeEventListener('scroll', edges);
      observer?.disconnect();
    };
  }, [selected]);
  return list;
}

/**
 * The four CARE principles behind one selector: one row of tabs (it scrolls sideways when the four
 * do not fit, with a fade at the edge that has more), and a line that slides to the one chosen. All
 * four sections are in the page (the selector only decides which is shown), so a printout carries
 * them all. Each says what the level rests on and what was observed, shows the one quote the
 * transcript backs for it (never the same words under two principles) and gives one next action,
 * worked out from the weakest skill that feeds the principle. The behaviours behind it are a click
 * away. CBCF is not applied, and the page says so plainly and in the report's own words.
 */
export function CareReview({ report }: { report: CoachingReport }) {
  const { turns } = useEvidence();
  const care = useMemo(() => report.care ?? [], [report.care]);
  const [selected, setSelected] = useState<CareBehaviour>(care[0]?.id ?? 'communicate');
  const strip = useTabStrip(selected);
  const [revealed, reveal] = useReveal<HTMLDivElement>();
  const box = useMemo(() => mergeRefs(strip, revealed), [strip, revealed]);
  const quotes = useMemo(() => careQuotes(care, turns), [care, turns]);
  if (care.length === 0) return null;
  return (
    <Section id="care" title="CARE review" lead="How the four CARE principles showed in this call.">
      <div className="rp-care" ref={box} {...reveal} style={stagger(2)}>
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
                <Panel
                  report={report}
                  principle={principle}
                  quote={quotes.get(principle.id) ?? null}
                />
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
        {report.cbcf ? (
          <p className="rp-care__cbcf">
            <Icon name="info" size={16} />
            <span>
              {CBCF_PLAIN} <span>{report.cbcf.note}</span>
            </span>
          </p>
        ) : null}
      </div>
    </Section>
  );
}
