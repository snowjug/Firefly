import type { CoachingReport, DiscoveryResult } from '#shared/domain/report.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { Badge, LinkButton, Tag, type BadgeTone } from '../../design/index.ts';
import { IMPORTANCE_WORDS, dimensionLabel, seeTurnText } from './copy.ts';
import { TurnLink } from './evidence.tsx';
import { practiceHref } from './brief-href.ts';
import { Field, Quote, Section } from './parts.tsx';
import { discoveryGroups } from './report-model.ts';

const STATUS: Record<
  DiscoveryResult['status'],
  { word: string; tone: BadgeTone; icon: 'check-circle' | 'warning' | 'error' }
> = {
  discovered: { word: 'Found', tone: 'success', icon: 'check-circle' },
  partial: { word: 'Partly found', tone: 'warning', icon: 'warning' },
  missed: { word: 'Missed', tone: 'danger', icon: 'error' },
};

function FactItem({ result }: { result: DiscoveryResult }) {
  const status = STATUS[result.status];
  const found = result.status !== 'missed';
  return (
    <li className="rp-fact">
      <div className="rp-fact__head">
        <h4 className="rp-fact__title">{result.label}</h4>
        <div className="rp-fact__badges">
          <Badge tone={status.tone} icon={status.icon} size="small">
            {status.word}
          </Badge>
          <Tag size="small">Importance: {IMPORTANCE_WORDS[result.importance]}</Tag>
        </div>
      </div>
      {found && result.revealedAtTurn !== null ? (
        <Field label={`Revealed at turn ${result.revealedAtTurn} by your question`}>
          {result.revealingQuestion ? (
            <Quote quote={result.revealingQuestion} turnIndex={result.revealedAtTurn} />
          ) : (
            <p className="rp-turnref">
              <TurnLink turnIndex={result.revealedAtTurn}>
                {seeTurnText(result.revealedAtTurn)}
              </TurnLink>
            </p>
          )}
        </Field>
      ) : null}
      {found ? (
        <Field label="What the customer had held back">
          <p className="t-reading">{result.whatWasHidden}</p>
        </Field>
      ) : null}
      {result.status !== 'discovered' ? (
        <>
          <Field label="A question worth asking">
            <p className="rp-suggestion t-reading">{result.betterQuestion}</p>
          </Field>
          <Field label="Why it mattered">
            <p className="t-reading">{result.consequence}</p>
          </Field>
        </>
      ) : null}
    </li>
  );
}

/** Every hidden fact, grouped by whether the trainee found it. This is the only place the count is shown. */
export function DiscoveryReview({ report }: { report: CoachingReport }) {
  const { discovery } = report;
  const groups = discoveryGroups(discovery);
  return (
    <Section
      id="discovery"
      title="Discovery review"
      lead="Customers rarely volunteer everything. These are the facts this customer held back, and whether your questions brought them out."
    >
      {discovery.total === 0 ? (
        <p className="rp-empty">This scenario had no hidden facts to find.</p>
      ) : (
        <>
          <p className="rp-discovery__total">
            You found {discovery.found} of {discovery.total} hidden facts
            {discovery.partial > 0
              ? `, and ${discovery.partial} more ${discovery.partial === 1 ? 'was' : 'were'} found partly`
              : ''}
            .
          </p>
          <p className="t-meta">
            {discovery.found} found, {discovery.partial} partly found, {discovery.missed} missed
          </p>
          {groups.map((group) => (
            <div className="rp-group" key={group.status}>
              <h3 className="rp-subtitle">
                {group.title} ({group.results.length})
              </h3>
              <ul className="rp-facts-list" role="list">
                {group.results.map((result) => (
                  <FactItem key={result.factId} result={result} />
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </Section>
  );
}

/** One suggestion for the next call: the skill, what to do, how hard, and a scenario that suits it. */
export function NextPractice({ report }: { report: CoachingReport }) {
  const next = report.nextPractice;
  const skill = DIMENSIONS[next.dimension];
  return (
    <Section
      id="next-practice"
      title="Next practice"
      lead="One thing to work on in your next call, not a list of everything."
    >
      <div className="rp-next">
        <div className="rp-next__body">
          <p className="rp-next__skill">
            <span className="t-label">Skill to practise</span>
            <strong>{dimensionLabel(next.dimension)}</strong>
          </p>
          <p className="t-meta rp-next__what">{skill.description}</p>
          <p className="t-reading">{next.recommendation}</p>
          <dl className="rp-facts">
            <div className="rp-facts__item">
              <dt>Suggested difficulty</dt>
              <dd>{DIFFICULTY_PROFILES[next.suggestedDifficulty].label}</dd>
            </div>
            {next.suggestedScenarioTitle ? (
              <div className="rp-facts__item">
                <dt>Suggested scenario</dt>
                <dd>{next.suggestedScenarioTitle}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <LinkButton
          to={practiceHref(next)}
          appearance="primary"
          size="large"
          icon="arrow-right"
          iconPosition="end"
          className="rp-next__cta"
        >
          Practise this next
        </LinkButton>
      </div>
    </Section>
  );
}
