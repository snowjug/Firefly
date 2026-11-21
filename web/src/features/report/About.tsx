import { useState, type ReactNode } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  DIMENSIONS,
  DIMENSION_IDS,
  PRACTICE_MODE_LABELS,
  SCORE_DESCRIPTIONS,
  SCORE_LABELS,
} from '#shared/domain/vocab.ts';
import { Icon, TextLink } from '../../design/index.ts';
import { formatDateTime } from '../../lib/format.ts';
import { customerPlayedBy, evaluatorByline } from './copy.ts';
import { usePrinting } from './print.tsx';
import './report.css';

/** The one plain line about what the report is and is not. CBCF is never claimed. */
export function honestLine(cbcf: CoachingReport['cbcf']): string {
  const mapping = cbcf
    ? 'CBCF mapping is not applied: it is awaiting an authoritative source.'
    : 'CBCF mapping is not applied.';
  return `Automatic practice feedback, not an assessment. ${mapping}`;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rp-facts__item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * The part of the report that explains itself, closed until it is wanted: what the report is and
 * is not, how the 1 to 5 scores and the six skills are defined, who the customer was, and who or
 * what wrote the coaching. Open on paper.
 */
export function About({ session, report }: { session: SessionDTO; report: CoachingReport }) {
  const { evaluator, cbcf } = report;
  const { persona, config } = session.scenario;
  const [open, setOpen] = useState(false);
  const printing = usePrinting();
  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className="rp-section rp-about"
      data-rp-origin="About this report"
    >
      <details
        className="rp-about__details"
        data-rp-disclosure=""
        open={open || printing}
        onToggle={(event) => {
          if (!printing) setOpen(event.currentTarget.open);
        }}
      >
        <summary className="rp-about__summary">
          <h2 id="about-title" className="rp-section__title" tabIndex={-1} data-rp-heading>
            About this report
          </h2>
          <Icon name="chevron-down" size={18} className="rp-about__chevron" />
        </summary>
        <div className="rp-about__body">
          <p className="rp-about__plain">{honestLine(cbcf)}</p>

          <h3 className="rp-subtitle">How scores work</h3>
          <dl className="rp-facts">
            {[5, 4, 3, 2, 1].map((score) => (
              <div className="rp-facts__item" key={score}>
                <dt>
                  {score} of 5, {SCORE_LABELS[score - 1]}
                </dt>
                <dd>{SCORE_DESCRIPTIONS[score]}</dd>
              </div>
            ))}
          </dl>

          <h3 className="rp-subtitle">The six skills</h3>
          <dl className="rp-facts">
            {DIMENSION_IDS.map((id) => (
              <div className="rp-facts__item" key={id}>
                <dt>{DIMENSIONS[id].label}</dt>
                <dd>{DIMENSIONS[id].description}</dd>
              </div>
            ))}
          </dl>

          <h3 className="rp-subtitle">This call</h3>
          <dl className="rp-facts">
            <Fact label="Customer">
              {persona.name}, {persona.role}, {persona.organisation} (synthetic)
            </Fact>
            <Fact label="Difficulty">{DIFFICULTY_PROFILES[config.difficulty].label}</Fact>
            <Fact label="Practice mode">{PRACTICE_MODE_LABELS[config.mode].label}</Fact>
            <Fact label="The customer was played by">
              {customerPlayedBy(session.providerKind, session.providerLabel)}
            </Fact>
            <Fact label="Coaching written by">
              {evaluatorByline(evaluator, session.providerKind)}
            </Fact>
            <Fact label="Evaluator">
              {evaluator.name} ({evaluator.version}), {evaluator.providerLabel}
            </Fact>
            <Fact label="Report created">{formatDateTime(report.generatedAt)}</Fact>
          </dl>

          <p className="rp-about__note">{report.trainingNote}</p>
          <p>
            <TextLink to="/responsible-ai">How Firefly uses AI and speech</TextLink>
          </p>
        </div>
      </details>
    </section>
  );
}
