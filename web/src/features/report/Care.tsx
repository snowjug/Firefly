import { useState } from 'react';
import type { CarePrincipleResult } from '#shared/domain/report.ts';
import { CARE_LABELS } from '#shared/domain/vocab.ts';
import { Disclosure, VisuallyHidden } from '../../design/index.ts';
import { BEHAVIOUR_STATUS_WORDS } from './copy.ts';
import { BehaviourBadge, LevelBadge, Quote, Section } from './parts.tsx';
import { usePrinting } from './print.tsx';
import { careCounts } from './report-model.ts';
import './report.css';

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

function CareItem({ principle }: { principle: CarePrincipleResult }) {
  const [open, setOpen] = useState(false);
  const printing = usePrinting();
  const expanded = open || printing;
  const name = CARE_LABELS[principle.id];
  const has = principle.behaviours.length > 0;
  return (
    <li className="rp-care__item" data-rp-origin={name}>
      <div className="rp-care__head">
        <h3 className="rp-care__name">{name}</h3>
        <LevelBadge level={principle.level} />
      </div>
      <p className="rp-care__summary" data-budget="care">
        {principle.summary}
      </p>
      {has ? (
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
              {principle.behaviours.map((behaviour) => (
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
    </li>
  );
}

/**
 * The four CARE principles as one line each: how the call went, in a sentence, with the behaviours
 * behind it a click away. Reports saved before CARE was read from the call have none: this part is
 * then left out, and nothing is made up in its place.
 */
export function CareSummary({ care }: { care: readonly CarePrincipleResult[] }) {
  return (
    <Section id="care" title="CARE summary">
      <ul className="rp-care" role="list">
        {care.map((principle) => (
          <CareItem key={principle.id} principle={principle} />
        ))}
      </ul>
    </Section>
  );
}
