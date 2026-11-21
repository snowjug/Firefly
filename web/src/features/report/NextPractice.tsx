import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { Badge, LinkButton } from '../../design/index.ts';
import { practiceLink } from './brief-href.ts';
import { dimensionLabel } from './copy.ts';
import { ClampedText, Section } from './parts.tsx';
import type { ScenarioIndex } from './scenario-index.ts';
import './report.css';

/** The most words the recommendation shows before "Show more". */
const RECOMMENDATION_WORDS = 30;

/**
 * One scenario to practise next: its title, its difficulty and the skill it is for. If the scenario
 * the report suggests no longer exists, no title is shown (the skill takes its place) and the
 * button opens the scenario list instead.
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
  return (
    <Section id="next-practice" title="Next practice">
      <div className="rp-next">
        <div className="rp-next__body">
          <h3 className="rp-next__title">{link.scenario ? link.scenario.title : skill}</h3>
          <p className="rp-next__meta">
            {link.scenario?.product ? (
              <span className="rp-next__product">{link.scenario.product}</span>
            ) : null}
            <Badge tone="neutral" appearance="outline" icon={null}>
              {DIFFICULTY_PROFILES[next.suggestedDifficulty].label}
            </Badge>
            {link.scenario ? <span>Skill: {skill}</span> : null}
          </p>
          <ClampedText
            className="rp-next__text"
            text={next.recommendation}
            budget={RECOMMENDATION_WORDS}
          />
        </div>
        <LinkButton
          to={link.to}
          appearance="secondary"
          size="large"
          icon="arrow-right"
          iconPosition="end"
          className="rp-next__cta"
        >
          {link.scenario ? 'Practise this scenario' : 'Choose a scenario'}
        </LinkButton>
      </div>
    </Section>
  );
}
