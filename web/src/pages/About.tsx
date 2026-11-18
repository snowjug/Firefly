import { Link } from 'react-router';
import { DimensionCards, ScaleList } from '../components/about/Dimensions.tsx';
import { TableOfContents, type TocItem } from '../components/about/TableOfContents.tsx';
import { Icon } from '../components/Icon.tsx';
import { Page, PageHeader } from '../components/Page.tsx';
import { useAppConfig } from '../lib/config.tsx';
import '../styles/about.css';

const REPOSITORY_URL = 'https://github.com/snowjug/Firefly';

const SECTIONS: TocItem[] = [
  { id: 'what-firefly-is', label: 'What Firefly is' },
  { id: 'how-a-session-works', label: 'How a practice session works' },
  { id: 'coaching-dimensions', label: 'The six coaching dimensions' },
  { id: 'how-feedback-is-produced', label: 'How feedback is produced' },
  { id: 'responsible-ai', label: 'Responsible AI and data safety' },
  { id: 'limitations', label: 'Known limitations' },
  { id: 'this-build', label: 'About this build' },
];

const SESSION_STEPS = [
  {
    title: 'Configure',
    text: 'Choose a scenario, then set the business impact, customer mood, communication style, call stage and difficulty.',
  },
  {
    title: 'Call',
    text: 'Talk with the customer by typing. The customer reacts to what you say, holds some facts back until you ask, and may raise a curveball.',
  },
  {
    title: 'End',
    text: 'Ending the call locks the transcript, so nothing can change before the feedback is built.',
  },
  {
    title: 'Report',
    text: 'Read coaching on six skills, with quotes from your own words, what you found and missed, and how the customer\u2019s mood moved.',
  },
  {
    title: 'History and progress',
    text: 'Past calls are saved so you can reread them and see how your skills change over time.',
  },
];

const FEEDBACK_POINTS = [
  {
    title: 'Grounded in your transcript.',
    text: 'Every strength and improvement points to a turn you wrote and quotes your own words. Each quote is checked against the turn it cites before a report is saved, and a quote that cannot be found there is dropped.',
  },
  {
    title: 'Scores need evidence.',
    text: 'A score of 4 needs at least one quoted example and a score of 5 needs two. Without that evidence the score is lowered.',
  },
  {
    title: 'A separate evaluator.',
    text: 'The simulated customer plays the call. A separate evaluator reads the finished transcript afterwards. The two have different roles and different instructions.',
  },
  {
    title: 'Some facts are computed, not written.',
    text: 'Which hidden facts you uncovered, the customer\u2019s temperature timeline and how a curveball was handled are worked out by Firefly\u2019s own code from what happened in the call. A model cannot change those figures.',
  },
  {
    title: 'Demo mode and live models.',
    text: 'In demo mode a built-in rules-based evaluator scores the call by looking for specific behaviours in your messages, such as questions, acknowledgements, ownership and summaries. With a live provider, a model drafts the scores and coaching text, and Firefly checks that draft against the transcript before saving it. Every report records which kind of evaluator produced it.',
  },
  {
    title: 'Fairness.',
    text: 'The evaluation instructions ask for behaviours in the transcript to be judged, not personality, and not to lower scores for concise writing or non-native English phrasing. The rules evaluator does not count length or grammar in its Clarity score. These are design intentions, not guarantees, which is one reason mentor review matters.',
  },
];

const LIMITATIONS = [
  'In demo mode the customer is rules-based. It is less flexible than a model and follows the scenario\u2019s facts closely.',
  'In demo mode the report is pattern-based. It looks for behaviours such as questions, acknowledgements, ownership and summaries, and can miss nuance that a person would notice.',
  'With a live provider, the quality of replies and coaching depends on the model that is configured.',
  'Calibration needs mentor time. Until enough mentors have reviewed enough varied sessions, treat AI scores as practice feedback, not as a measure.',
  'Scenarios and the interface are in English only.',
  'Practice is text only. Voice is not implemented.',
];

export default function About() {
  const { config, loading, error } = useAppConfig();

  return (
    <Page title="About Firefly">
      <PageHeader
        eyebrow="Responsible AI and how it works"
        title="About Firefly"
        lead="A safe place to practise customer conversations, and a plain account of how its feedback is produced and what happens to your data."
      />

      <div className="ab-layout">
        <div className="ab-aside">
          <TableOfContents items={SECTIONS} />
        </div>

        <div className="ab-content">
          <section
            id="what-firefly-is"
            className="ab-section"
            aria-labelledby="what-firefly-is-title"
          >
            <h2 id="what-firefly-is-title" className="t-section">
              What Firefly is
            </h2>
            <p>
              Firefly is a practice environment for apprentice technical support engineers. You hold
              a text conversation with a simulated customer, end the call, and get coaching based on
              what you actually said.
            </p>
            <p>
              It is product-agnostic. It trains conversation skills such as scoping an unclear
              problem, handling frustration and agreeing next steps, not knowledge of any particular
              product. Every scenario, customer and organisation in it is fictional.
            </p>
          </section>

          <section
            id="how-a-session-works"
            className="ab-section"
            aria-labelledby="how-a-session-works-title"
          >
            <h2 id="how-a-session-works-title" className="t-section">
              How a practice session works
            </h2>
            <ol role="list" className="ab-steps">
              {SESSION_STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="ab-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <p>
                    <strong>{step.title}.</strong> {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section
            id="coaching-dimensions"
            className="ab-section"
            aria-labelledby="coaching-dimensions-title"
          >
            <h2 id="coaching-dimensions-title" className="t-section">
              The six coaching dimensions
            </h2>
            <p>
              Feedback covers six skills. Each maps to one or more CARE behaviours. The mapping is a
              working guide for coaching conversations, not an official standard.
            </p>
            <DimensionCards />
            <h3 className="ab-subhead">The 1 to 5 scale</h3>
            <p>Every skill is scored from 1 to 5, using the same descriptors for each.</p>
            <ScaleList />
          </section>

          <section
            id="how-feedback-is-produced"
            className="ab-section"
            aria-labelledby="how-feedback-is-produced-title"
          >
            <h2 id="how-feedback-is-produced-title" className="t-section">
              How feedback is produced
            </h2>
            <ul className="ab-points">
              {FEEDBACK_POINTS.map((point) => (
                <li key={point.title}>
                  <strong>{point.title}</strong> {point.text}
                </li>
              ))}
            </ul>
          </section>

          <section
            id="responsible-ai"
            className="ab-section"
            aria-labelledby="responsible-ai-title"
          >
            <h2 id="responsible-ai-title" className="t-section">
              Responsible AI and data safety
            </h2>
            <div className="callout">
              <Icon name="shield" size={18} />
              <p>
                <strong>Firefly is a training aid.</strong> Its scenarios use invented people and
                organisations, and its scores are for practice, not for judging anyone.
              </p>
            </div>

            <h3 className="ab-subhead">Use fictional information only</h3>
            <p>
              Do not enter real customer information: names, case details, credentials, logs,
              screenshots or identifiers. Firefly removes some obvious patterns from your messages
              before they are saved or sent to any model: email addresses, phone numbers, long digit
              sequences such as card numbers, and identifiers in GUID format. This is a safety net,
              not a guarantee. It cannot recognise everything, so the rule is not to type real
              information at all.
            </p>

            <h3 className="ab-subhead">What AI feedback can and cannot do</h3>
            <p>
              AI feedback can be incomplete or wrong. Use it as input for a conversation with a
              mentor, not as a verdict. Mentor review remains valuable, and the{' '}
              <Link to="/calibration">Calibration page</Link> lets mentors score the same calls
              without seeing the AI&rsquo;s scores, then compare.
            </p>

            <h3 className="ab-subhead">Scores are for practice</h3>
            <p>
              Scores guide coaching and practice. They are not a performance rating, and they should
              not be used to evaluate, rank or compare colleagues. Firefly does not compare people
              with each other.
            </p>

            <h3 className="ab-subhead">Where your data lives</h3>
            <p>
              Firefly stores sessions, transcripts, coaching reports and mentor scores in a local
              SQLite database file on the machine that runs the Firefly server. It has no sign-in:
              an anonymous cookie in your browser keeps your practice data separate from other
              browsers that use the same server. Your browser also keeps your display preferences
              and the call setup you are working on. Because there is no sign-in, run Firefly only
              on a machine or network you trust.
            </p>

            <h3 className="ab-subhead">What leaves the machine</h3>
            <p>
              In demo mode, nothing is sent to an AI service. With a live provider, the server sends
              call text and scenario details to the configured model service to write the
              customer&rsquo;s replies and the coaching, and that service&rsquo;s own data terms
              apply. API keys stay on the server and are never sent to your browser. Firefly
              includes no analytics or tracking, and its server logs record identifiers, counts and
              timings, not transcript text.
            </p>

            <h3 className="ab-subhead">Deleting your data</h3>
            <p>
              Practice and sample sessions can be deleted from the{' '}
              <Link to="/trainer">Trainer page</Link>. Deleting a session also deletes its
              transcript, report and mentor scores. <Link to="/settings">Settings</Link> shows how
              many sessions are stored.
            </p>

            <p>
              Firefly does not claim any compliance certification or legal guarantee. If your
              organisation has data or AI policies, they apply here too.
            </p>
          </section>

          <section id="limitations" className="ab-section" aria-labelledby="limitations-title">
            <h2 id="limitations-title" className="t-section">
              Known limitations
            </h2>
            <ul className="ab-points">
              {LIMITATIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section id="this-build" className="ab-section" aria-labelledby="this-build-title">
            <h2 id="this-build-title" className="t-section">
              About this build
            </h2>
            <dl className="ab-build">
              <div>
                <dt>Version</dt>
                <dd>{config ? config.app.version : loading ? 'Loading\u2026' : 'Unavailable'}</dd>
              </div>
              <div>
                <dt>AI provider</dt>
                <dd>
                  {config
                    ? config.provider.label
                    : loading
                      ? 'Loading\u2026'
                      : error
                        ? 'Unavailable: the server could not be reached'
                        : 'Unavailable'}
                </dd>
              </div>
              <div>
                <dt>Source code</dt>
                <dd>
                  <a href={REPOSITORY_URL} target="_blank" rel="noreferrer noopener">
                    github.com/snowjug/Firefly
                    <Icon name="external" size={14} />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </Page>
  );
}
