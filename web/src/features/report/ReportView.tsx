import { useMemo, type ReactNode } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import {
  Badge,
  Breadcrumb,
  Button,
  MessageBar,
  StateBadge,
  TextLink,
  cx,
} from '../../design/index.ts';
import { formatDate, formatDateTime, formatDuration } from '../../lib/format.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { Actions } from './Actions.tsx';
import { Improvements, Strengths } from './Coaching.tsx';
import { DiscoveryReview, NextPractice } from './Discovery.tsx';
import { JourneySection } from './Journey.tsx';
import { ScoreSummary, SkillDetails } from './Scores.tsx';
import { JumpTo, SectionNav } from './SectionNav.tsx';
import { TranscriptReview } from './Transcript.tsx';
import {
  COMPLETION_WORDS,
  bandOf,
  customerPlayedBy,
  evaluatorByline,
  joinList,
  plainUnexpectedTurn,
} from './copy.ts';
import { jumpToSection } from './dom.ts';
import { EvidenceProvider } from './evidence.tsx';
import { Section } from './parts.tsx';
import { PrintProvider, usePrintedAt } from './print.tsx';
import { restsOnLimitedEvidence } from './report-model.ts';
import { hasSpokenTurns } from './transcript-model.ts';
import type { ReportClient } from './useReportSession.ts';
import './report.css';

const formatScore = (score: number) => (Number.isInteger(score) ? String(score) : score.toFixed(1));

/** On paper only: what this is, and when it was printed. */
function PrintHeader() {
  const printedAt = usePrintedAt();
  return (
    <div className="rp-print-head">
      <p className="rp-print-head__brand">Firefly: coaching report</p>
      <p>
        Printed {formatDate(printedAt.toISOString())}. Practice coaching, not performance
        assessment.
      </p>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rp-meta__item">
      <dt className="t-label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ReportHeader({
  session,
  report,
  onPrint,
}: {
  session: SessionDTO;
  report: CoachingReport;
  onPrint: () => void;
}) {
  const { scenario } = session;
  const started = bandOf(report.journey.start);
  const ended = bandOf(report.journey.end);
  const completed = report.completion.status === 'completed';
  return (
    <header className="rp-header">
      <Breadcrumb
        items={[{ label: 'Scenarios', to: '/scenarios' }, { label: 'Report' }]}
        className="no-print"
      />
      <div className="rp-header__top">
        <div className="rp-header__titles">
          <h1 id="report-title" className="t-title2" tabIndex={-1}>
            Coaching report
          </h1>
          <p className="rp-header__scenario">{scenario.title}</p>
        </div>
        <div className="rp-header__actions no-print">
          <Button icon="print" onClick={onPrint}>
            Print report
          </Button>
          <Button icon="document" onClick={() => jumpToSection('transcript')}>
            Review transcript
          </Button>
        </div>
      </div>
      <dl className="rp-meta">
        <Meta label="Customer">
          <span className="rp-meta__strong">{scenario.persona.name}</span>
          <span className="rp-meta__line">{scenario.persona.role}</span>
          <span className="rp-meta__line">{scenario.persona.organisation}</span>
        </Meta>
        <Meta label="Date and time">{formatDateTime(session.startedAt)}</Meta>
        <Meta label="Call duration">{formatDuration(session.durationSeconds)}</Meta>
        <Meta label="Completion">
          <Badge tone={completed ? 'success' : 'warning'}>
            {COMPLETION_WORDS[report.completion.status]}
          </Badge>
        </Meta>
        <Meta label="Starting state">
          <StateBadge state={started.id} />
        </Meta>
        <Meta label="Ending state">
          <StateBadge state={ended.id} />
        </Meta>
        <Meta label="Difficulty">{DIFFICULTY_PROFILES[scenario.config.difficulty].label}</Meta>
        <Meta label="Live hints">{scenario.config.mode === 'guided' ? 'On' : 'Off'}</Meta>
      </dl>
    </header>
  );
}

function Summary({ session, report }: { session: SessionDTO; report: CoachingReport }) {
  const { overallScore, coachingFocus } = report.summary;
  const limited = restsOnLimitedEvidence(report);
  const spoken = hasSpokenTurns(session);
  return (
    <Section id="summary" title="Overall coaching summary" className="rp-section--first">
      <div className="rp-summary">
        <p className="rp-summary__text t-reading">{plainUnexpectedTurn(report.summary.overall)}</p>
        <div className="rp-overall">
          <p className="t-label">Overall</p>
          {overallScore !== null ? (
            <p className="rp-overall__score">
              <span className="rp-overall__number">{formatScore(overallScore)}</span> of 5
            </p>
          ) : (
            <p className="rp-overall__none">Not enough evidence for an overall score</p>
          )}
          <p className="t-meta">
            {overallScore !== null ? 'Average across the six skills. ' : ''}A practice signal, not a
            grade.
          </p>
        </div>
      </div>
      {coachingFocus.length > 0 ? (
        <p className="rp-focus">
          <span className="t-label">Skills this scenario practises</span>
          <span>{joinList(coachingFocus.map((id) => DIMENSIONS[id].label))}</span>
        </p>
      ) : null}
      <div className="rp-aid">
        <Badge tone="ai" icon="sparkle">
          Written by the coaching evaluator
        </Badge>
        <p className="rp-aid__text">
          <strong>Training aid.</strong> Practice coaching, not employee-performance assessment.
          Written by {evaluatorByline(report.evaluator, session.providerKind)}. It can be incomplete
          or wrong: review it with a mentor.
        </p>
      </div>
      {limited ? (
        <MessageBar intent="info" live={false}>
          {report.completion.note ??
            'This call was short, so the coaching rests on limited evidence. More turns would give firmer coaching.'}
        </MessageBar>
      ) : null}
      {spoken ? (
        <MessageBar intent="info" live={false}>
          Parts of this call were spoken and transcribed automatically. Speech recognition can
          mishear words, so check the quotes against what you said.
        </MessageBar>
      ) : null}
    </Section>
  );
}

function About({ session, report }: { session: SessionDTO; report: CoachingReport }) {
  const { evaluator } = report;
  return (
    <Section id="about" title="About this report">
      <dl className="rp-facts rp-facts--stacked">
        <div className="rp-facts__item">
          <dt>Written by</dt>
          <dd>
            {evaluator.name} ({evaluator.version})
          </dd>
        </div>
        <div className="rp-facts__item">
          <dt>Kind of evaluator</dt>
          <dd>
            {evaluator.kind === 'model'
              ? 'A language model, checked against the transcript'
              : 'Built-in rules, not a language model'}
          </dd>
        </div>
        <div className="rp-facts__item">
          <dt>Evaluation provider</dt>
          <dd>{evaluator.providerLabel}</dd>
        </div>
        <div className="rp-facts__item">
          <dt>The customer was played by</dt>
          <dd>{customerPlayedBy(session.providerKind, session.providerLabel)}</dd>
        </div>
        <div className="rp-facts__item">
          <dt>Report created</dt>
          <dd>{formatDateTime(report.generatedAt)}</dd>
        </div>
      </dl>
      <p className="t-reading rp-about__note">{report.trainingNote}</p>
      <ul className="rp-disclaimers t-reading">
        <li>This is practice coaching, not an assessment of your performance.</li>
        <li>
          Automatic feedback can be incomplete or wrong, whether it comes from built-in rules or a
          language model.
        </li>
        <li>A mentor&rsquo;s review adds what automatic coaching cannot.</li>
        <li>Scores are not compared with anyone else&rsquo;s.</li>
        <li>
          The CARE behaviours named under each skill are a working framework for coaching
          conversations, not an official standard.
        </li>
      </ul>
      <p className="t-reading">
        <TextLink to="/responsible-ai">How Firefly uses AI and speech</TextLink>
      </p>
    </Section>
  );
}

/**
 * The coaching report: one page, in the order a reader needs it. Scores first, then what moved the
 * customer, what went well and what to change, the evidence behind every score, the facts that were
 * and were not uncovered, one thing to practise next, and the whole transcript. Every quote links to
 * the turn it came from.
 */
export function ReportView({
  session,
  report,
  client,
  reveal,
}: {
  session: SessionDTO;
  report: CoachingReport;
  client: ReportClient;
  /** The report has just been made while the page was open: show it in with a short fade. */
  reveal: boolean;
}) {
  const turnIndexes = useMemo(() => session.turns.map((turn) => turn.index), [session.turns]);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <PrintProvider>
      <EvidenceProvider turnIndexes={turnIndexes}>
        <div className={cx('rp-page', 'l-page', reveal && !reduced && 'rp-reveal')}>
          <PrintHeader />
          {/* The title and its actions come first, then the navigation, then the report itself;
              on wide screens the navigation is drawn to the left of both. */}
          <div className="rp-layout">
            <ReportHeader session={session} report={report} onPrint={() => window.print()} />
            <SectionNav />
            <JumpTo />
            <div className="rp-main">
              <Summary session={session} report={report} />
              <ScoreSummary report={report} />
              <JourneySection report={report} />
              <Strengths report={report} />
              <Improvements report={report} />
              <SkillDetails report={report} />
              <DiscoveryReview report={report} />
              <NextPractice report={report} />
              <Actions session={session} client={client} onPrint={() => window.print()} />
              <TranscriptReview session={session} report={report} />
              <About session={session} report={report} />
            </div>
          </div>
        </div>
      </EvidenceProvider>
    </PrintProvider>
  );
}
