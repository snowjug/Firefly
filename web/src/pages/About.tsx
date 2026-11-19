import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { DimensionCards, ScaleList } from '../components/about/Dimensions.tsx';
import { TableOfContents, type TocItem } from '../components/about/TableOfContents.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';
import { Page, PageHeader } from '../components/Page.tsx';
import { useAppConfig } from '../lib/config.tsx';
import '../styles/about.css';

const REPOSITORY_URL = 'https://github.com/snowjug/Firefly';

const SECTIONS: TocItem[] = [
  { id: 'what-firefly-is', label: 'What Firefly is' },
  { id: 'how-a-session-works', label: 'How a practice call works' },
  { id: 'coaching-dimensions', label: 'The six coaching dimensions' },
  { id: 'how-feedback-is-produced', label: 'How feedback is produced' },
  { id: 'points-and-badges', label: 'How points and badges work' },
  { id: 'voice', label: 'Voice (Beta)' },
  { id: 'mentor', label: 'Using Firefly with a mentor' },
  { id: 'responsible-ai', label: 'Responsible AI and data safety' },
  { id: 'faq', label: 'Questions and answers' },
  { id: 'limitations', label: 'What Firefly can’t do' },
  { id: 'this-build', label: 'About this build' },
];

const CALL_STEPS = [
  {
    title: 'Configure',
    text: 'Choose a scenario, then set the business impact, customer mood, communication style, call stage and difficulty.',
  },
  {
    title: 'Call',
    text: 'Talk with the customer by typing, or by voice if you have turned on Voice (Beta). The customer reacts to what you say, holds some facts back until you ask, and may raise a curveball.',
  },
  {
    title: 'End',
    text: 'Ending the call locks the transcript, so nothing can change before the feedback is built.',
  },
  {
    title: 'Report',
    text: 'Read coaching on six skills, with quotes from your own words, what you found and missed, and how the customer’s mood moved.',
  },
  {
    title: 'History and progress',
    text: 'Past calls are saved in History so you can reread them, and My Progress shows how your skills change over time.',
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
    text: 'Which hidden facts you uncovered, the customer’s temperature timeline and how a curveball was handled are worked out by Firefly’s own code from what happened in the call. A model cannot change those figures.',
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

const POINTS_LINES = [
  'Points reward practising: finishing a full call, bringing out something the customer held back, and trying a different kind of call. Every point comes with a reason you can read.',
  'There is no ranking and no leaderboard. Points are private to you and are never compared with anyone else’s.',
  'There are no points for speed, for a long call or for sending lots of messages.',
  'A missed day costs nothing, and a low score never takes away points or a badge you have earned.',
];

const VOICE_HOW = [
  'You speak and your browser turns your speech into text. Firefly receives only that text and treats it like typed text, with obvious personal details replaced.',
  'The customer answers out loud, using a voice from your browser. The transcript is still the record, and coaching reads the words, not your tone, accent or pace.',
  'Speech recognition makes mistakes, and those mistakes are not yours. Keep an eye on the transcript, and switch to typing at any time.',
];

const VOICE_PRIVACY = [
  'Firefly never records, keeps or uploads audio.',
  'In Chrome and Edge, speech recognition is normally done by an online speech service run by the browser’s maker, so your audio is sent to that service under its privacy terms. If your browser can recognise speech on your device, Firefly asks it to.',
  'Some browser voices for the customer are online voices. They send the customer’s (fictional) words to the browser maker’s speech service. Your audio is not part of that.',
  'The microphone is never opened until you turn voice on and start a voice call. Hang up or leave the page and it stops at once.',
];

const FAQ = [
  {
    question: 'Do I need an account?',
    answer:
      'No. Firefly has no sign-in. Your profile is a name, an optional role and an optional place, saved in this browser only. “Sign out of this device” in Settings removes it; your saved practice calls are kept.',
  },
  {
    question: 'Where are my calls saved?',
    answer:
      'On the Firefly server this app talks to, not in your browser. You can delete any call from History.',
  },
  {
    question: 'Is the customer a real person or an AI?',
    answer:
      'The customer is always fictional. In demo mode its replies come from a built-in rules engine. With a live provider, a language model writes them. The badge at the top of the page says which one you are using.',
  },
  {
    question: 'Why does my report say the call ended early?',
    answer:
      'You ended the call before it reached a natural close, so there was less to coach on. The report says so and treats its feedback as a first look. A call that ends early earns no points.',
  },
  {
    question: 'My score is lower than I expected. Is it wrong?',
    answer:
      'It might be. Scores are practice signals, not a verdict. Read the quoted moments, then talk the report through with a mentor.',
  },
  {
    question: 'Can I practise without typing?',
    answer:
      'Yes, if you turn on Voice (Beta) in Settings. It works best in Chrome or Edge, and typing always keeps working.',
  },
];

const LIMITATIONS = [
  'It cannot judge how you handle real customers. Scores are for practice, not performance assessment.',
  'In demo mode the customer is rules-based. It is less flexible than a model and follows the scenario’s facts closely.',
  'In demo mode the report is pattern-based. It looks for behaviours such as questions, acknowledgements, ownership and summaries, and can miss nuance that a person would notice.',
  'With a live provider, the quality of replies and coaching depends on the model that is configured.',
  'It does not teach any product or your organisation’s policies. It trains conversation skills.',
  'Calibration needs mentor time. Until enough mentors have reviewed enough varied calls, treat the scores as practice feedback, not as a measure.',
  'Voice is a beta. It works best in Chrome or Edge, you cannot interrupt the customer, and speech recognition makes mistakes.',
  'Scenarios and the interface are in English only.',
  'There are no accounts, teams or sharing. Your profile, points and badges are private to this browser, and notices appear in the app only.',
];

/** A card for one topic: a small icon, the heading and the text. The card is an anchor target. */
function Section({
  id,
  icon,
  tone,
  title,
  children,
}: {
  id: string;
  icon: IconName;
  tone: 'blue' | 'violet' | 'amber' | 'green' | 'red';
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      className="glass card ab-section"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className="ab-title">
        <span className="tone-icon" data-tone={tone} aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

/** A link such as /help#voice lands on its section: scrolled into view, with focus on it. */
function useHashTarget() {
  const { hash } = useLocation();
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    // After the shell has put the page back at the top.
    const timer = window.setTimeout(() => {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView?.({ block: 'start' });
      target.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [hash]);
}

export default function About() {
  const { config, loading, error } = useAppConfig();
  useHashTarget();

  return (
    <Page title="Help" className="ab-root">
      <PageHeader
        title="Help & responsible AI"
        lead="How Firefly works, how its feedback is produced, what happens to your data and what it can’t do."
      />

      <div className="ab-layout">
        <div className="ab-aside">
          <TableOfContents items={SECTIONS} />
        </div>

        <div className="ab-content">
          <Section id="what-firefly-is" icon="spark" tone="blue" title="What Firefly is">
            <p>
              Firefly is a practice environment for apprentice technical support engineers. You hold
              a conversation with a simulated customer, end the call, and get coaching based on what
              you actually said.
            </p>
            <p>
              It is product-agnostic. It trains conversation skills such as scoping an unclear
              problem, handling frustration and agreeing next steps, not knowledge of any particular
              product. Every scenario, customer and organisation in it is fictional.
            </p>
          </Section>

          <Section
            id="how-a-session-works"
            icon="headset"
            tone="violet"
            title="How a practice call works"
          >
            <ol role="list" className="ab-steps">
              {CALL_STEPS.map((step, index) => (
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
          </Section>

          <Section
            id="coaching-dimensions"
            icon="chart"
            tone="green"
            title="The six coaching dimensions"
          >
            <p>
              Feedback covers six skills. Each maps to one or more CARE behaviours. The mapping is a
              working guide for coaching conversations, not an official standard.
            </p>
            <DimensionCards />
            <h3 className="ab-subhead">The 1 to 5 scale</h3>
            <p>Every skill is scored from 1 to 5, using the same descriptors for each.</p>
            <ScaleList />
          </Section>

          <Section
            id="how-feedback-is-produced"
            icon="notes"
            tone="blue"
            title="How feedback is produced"
          >
            <ul role="list" className="ab-points">
              {FEEDBACK_POINTS.map((point) => (
                <li key={point.title}>
                  <strong>{point.title}</strong> {point.text}
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="points-and-badges"
            icon="trophy"
            tone="amber"
            title="How points and badges work"
          >
            <ul role="list" className="ab-points">
              {POINTS_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>
              <Link to="/rewards" className="link-more" viewTransition>
                See your points and badges <Icon name="arrow-right" size={16} />
              </Link>
            </p>
          </Section>

          <Section
            id="voice"
            icon="mic"
            tone="violet"
            title="Voice (Beta): how it works and your privacy"
          >
            <p>
              Voice lets you speak to the customer and hear them answer. It is optional, it is off
              until you turn it on in{' '}
              <Link to="/settings" viewTransition>
                Settings
              </Link>
              , and typing always keeps working. It works best in Chrome or Edge.
            </p>
            <h3 className="ab-subhead">How it works</h3>
            <ul role="list" className="ab-points">
              {VOICE_HOW.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <h3 className="ab-subhead">Your privacy</h3>
            <ul role="list" className="ab-points">
              {VOICE_PRIVACY.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Section>

          <Section id="mentor" icon="users" tone="blue" title="Using Firefly with a mentor">
            <p>
              <strong>Coaching, not assessment.</strong> A report helps you see what to try next. It
              is not a performance rating, and it should not be used to judge, rank or compare
              people.
            </p>
            <p>
              <strong>A mentor adds what automatic feedback can’t.</strong> Open a report together,
              read the quoted moments and talk about the choices you made. Automatic feedback can be
              incomplete or wrong, and a mentor can tell you when it is.
            </p>
            <p>
              <strong>Calibration.</strong> On the <Link to="/calibration">Calibration page</Link> a
              mentor can score a finished call without seeing the automatic scores, then compare the
              two. Over time this shows whether the automatic scores roughly agree with an
              experienced mentor. The <Link to="/trainer">Trainer page</Link> helps you run a clean
              demo and manage the saved practice.
            </p>
          </Section>

          <Section
            id="responsible-ai"
            icon="shield-check"
            tone="green"
            title="Responsible AI and data safety"
          >
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
              Firefly stores calls, transcripts, coaching reports and mentor scores in a local
              SQLite database file on the machine that runs the Firefly server. It has no sign-in:
              an anonymous cookie in your browser keeps your practice separate from other browsers
              that use the same server. Your browser also keeps your profile (name, role and place),
              your preferences, your display choices and the call setup you are working on. Because
              there is no sign-in, run Firefly only on a machine or network you trust.
            </p>

            <h3 className="ab-subhead">What leaves the machine</h3>
            <p>
              In demo mode, nothing is sent to an AI service. With a live provider, the server sends
              call text and scenario details to the configured model service to write the
              customer&rsquo;s replies and the coaching, and that service&rsquo;s own data terms
              apply. If you use voice, your browser, not Firefly, turns speech into text and may use
              an online speech service (see Voice above). API keys stay on the server and are never
              sent to your browser. Firefly includes no analytics or tracking, and its server logs
              record identifiers, counts and timings, not transcript text.
            </p>

            <h3 className="ab-subhead">Deleting your data</h3>
            <p>
              You can delete any call from <Link to="/history">History</Link>, and practice and
              sample calls can be deleted or reset from the <Link to="/trainer">Trainer page</Link>.
              Deleting a call also deletes its transcript, report and mentor scores.{' '}
              <Link to="/settings">Settings</Link> shows how many calls are stored and lets you sign
              out of this device to remove your profile.
            </p>

            <p>
              Firefly does not claim any compliance certification or legal guarantee. If your
              organisation has data or AI policies, they apply here too.
            </p>
          </Section>

          <Section id="faq" icon="help" tone="violet" title="Questions and answers">
            <dl className="ab-faq">
              {FAQ.map((item) => (
                <div key={item.question}>
                  <dt>{item.question}</dt>
                  <dd>{item.answer}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="limitations" icon="alert" tone="red" title="What Firefly can’t do">
            <ul role="list" className="ab-points">
              {LIMITATIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>

          <Section id="this-build" icon="info" tone="blue" title="About this build">
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
          </Section>
        </div>
      </div>
    </Page>
  );
}
