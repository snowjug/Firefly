import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { Badge, LinkButton, usePointerFx, useReveal } from '../../design/index.ts';
import { practiceLink } from './brief-href.ts';
import { dimensionLabel, plainUnexpectedTurn, splitSentences } from './copy.ts';
import { Field, Section } from './parts.tsx';
import { stagger } from './reveal.ts';
import type { ScenarioIndex } from './scenario-index.ts';
import './report.css';

/**
 * One scenario to practise next. The skill it is for is the heading, the learning focus is one
 * sentence shown whole (never cut), and what is left of the recommendation (the question worth
 * practising from this call) follows it plainly. If the scenario the report suggests no longer
 * exists, the button opens the scenario list instead. The whole card is the button's target, and it
 * answers a mouse (it rises) and a press (it settles) as the scenario cards do, where the pointer
 * is one that can hover and nobody asked for less motion.
 */
export function NextPractice({
  session,
  report,
  index,
}: {
  session: SessionDTO;
  report: CoachingReport;
  index: ScenarioIndex;
}) {
  const next = report.nextPractice;
  const link = practiceLink(session, next, index);
  const skill = dimensionLabel(next.dimension);
  const [focus, ...rest] = splitSentences(plainUnexpectedTurn(next.recommendation));
  const [ref, reveal] = useReveal<HTMLDivElement>();
  const fx = usePointerFx();
  return (
    <Section id="next-practice" title="Next practice">
      <div className="rp-next" ref={ref} {...reveal} style={stagger(1)} data-fx={fx ? 'on' : 'off'}>
        <div className="rp-next__body">
          <p className="rp-next__eyebrow">Target skill</p>
          <h3 className="rp-next__title">{skill}</h3>
          <p className="rp-next__meta">
            {link.scenario ? (
              <span className="rp-next__scenario">{link.scenario.title}</span>
            ) : null}
            {link.scenario?.product ? (
              <span className="rp-next__product">{link.scenario.product}</span>
            ) : null}
            <Badge tone="neutral" appearance="outline" icon={null}>
              {DIFFICULTY_PROFILES[next.suggestedDifficulty].label}
            </Badge>
          </p>
          <Field label="Learning focus">
            <p className="rp-next__text">{focus ?? next.recommendation}</p>
            {rest.length > 0 ? <p className="rp-next__more">{rest.join(' ')}</p> : null}
          </Field>
        </div>
        <LinkButton
          to={link.to}
          appearance="primary"
          size="large"
          icon="arrow-right"
          iconPosition="end"
          nudge
          className="rp-next__cta"
        >
          {link.scenario ? 'Practise this scenario' : 'Choose a scenario'}
        </LinkButton>
      </div>
    </Section>
  );
}
