import { Link } from 'react-router';
import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { Tag } from '../components/frame/Tag.tsx';
import { Icon } from '../components/Icon.tsx';
import { DoorInstrument } from '../components/entry/DoorInstrument.tsx';
import { PublicColophon } from '../components/entry/PublicColophon.tsx';
import { useWorldPose } from '../components/world/useWorldPose.ts';
import { useDocumentTitle, useMediaQuery } from '../lib/hooks.ts';
import { firstName, useProfile } from '../lib/profile.ts';
import { useReducedMotion } from '../lib/theme.tsx';
import '../styles/public.css';

// What a call really is, step by step. Each line is something the product does today.
const STEPS: readonly { name: string; text: string }[] = [
  {
    name: 'Configure',
    text: 'Choose one of the fictional scenarios, then shape the customer: what is at stake, how they feel when they pick up, how technical they are and how difficult the call is.',
  },
  {
    name: 'Simulate',
    text: 'Hold an unscripted conversation with the customer. Type your replies or, as a beta, speak them.',
  },
  {
    name: 'Adapt',
    text: 'The customer’s mood moves with what you say. Facts they held back come out only for a good question, and a surprise can land mid-call.',
  },
  {
    name: 'Evaluate',
    text: 'Ending the call opens a coaching report: six skills scored from 1 to 5, each with quotes from your own words.',
  },
  {
    name: 'Improve',
    text: 'Reopen a report from History, follow a quote into the transcript and see how each skill is trending. Points reward practising, never speed.',
  },
];

// The limits, said plainly. A few of these are also in the colophon and on the Help page.
const NOT: readonly { name: string; text: string }[] = [
  {
    name: 'Not an assessment.',
    text: 'Firefly is a training aid. Scores are for practice: they are never a performance rating, never ranked and never compared with anyone else’s.',
  },
  {
    name: 'Not a real customer.',
    text: 'Every scenario and customer is fictional. Never enter real customer information.',
  },
  {
    name: 'Not an account.',
    text: 'Your profile is a name saved in this browser. There is no password and no organisation sign-in.',
  },
  {
    name: 'Not always right.',
    text: 'Automatic coaching can be incomplete or wrong, so a mentor can review a call and compare scores. Firefly always says whether the customer is a built-in simulation or a live model.',
  },
];

export default function Landing() {
  useDocumentTitle('Practice difficult customer conversations');
  const profile = useProfile();
  const reduced = useReducedMotion();
  const wide = useMediaQuery('(min-width: 62rem)');
  // The field gathers round the instrument, wherever the layout puts it.
  useWorldPose({ intensity: 0.8, focus: wide ? { x: 0.74, y: 0.5 } : { x: 0.5, y: 0.34 } });

  const startTo = profile ? '/home' : '/sign-in';
  const startLabel = profile ? 'Continue' : 'Begin';

  return (
    <>
      <main id="main" tabIndex={-1} className="door">
        <section className="door__stage" aria-labelledby="door-title">
          <div className="door__copy">
            <p className="door__eyebrow type-label">
              {profile ? `Welcome back, ${firstName(profile.name)}` : 'Customer call practice'}
            </p>
            <h1 id="door-title" className="door__title">
              Practice difficult customer conversations before they become <em>real ones.</em>
            </h1>
            <p className="door__lead type-lead">
              Firefly is a practice environment for customer-facing support conversations. You talk
              with a fictional customer who reacts to what you say, then read coaching tied to your
              own words.
            </p>
            <div className="door__actions action-row">
              <Link to={startTo} className="action" viewTransition={!reduced}>
                {startLabel}
                <Icon name="arrow-right" size={18} />
              </Link>
              <a href="#how-a-call-goes" className="text-link">
                How a call goes
              </a>
            </div>
            <ul className="door__facts" role="list">
              <li>
                <Tag>Fictional customers</Tag>
              </li>
              <li>
                <Tag>No account</Tag>
              </li>
              <li>
                <Tag>Coaching, not ranking</Tag>
              </li>
            </ul>
          </div>

          <figure className="door__figure">
            <DoorInstrument />
            <figcaption className="door__caption">
              <span className="door__fig type-label">Fig. 1</span>
              <span>
                One call as an instrument, its six parts lettered A to F. Rings are difficulty, the
                lit band is business impact, the edge and needle are how the customer starts, and
                each tick is a minute.
              </span>
            </figcaption>
          </figure>
        </section>

        <section id="how-a-call-goes" className="door__section" aria-labelledby="door-how-title">
          <div className="door__head">
            <p className="type-label">Five steps, and then again</p>
            <h2 id="door-how-title" className="door__h2">
              How a call goes
            </h2>
          </div>
          <ol className="door__steps" role="list">
            {STEPS.map((step, index) => (
              <li key={step.name} className="door__step">
                <div className="door__step-head">
                  <span className="door__step-no type-number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="door__step-name">{step.name}</h3>
                </div>
                <p className="door__step-text">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="door__skills">
            <p className="type-label" id="door-skills-label">
              What the report looks at
            </p>
            <ul role="list" aria-labelledby="door-skills-label">
              {DIMENSION_IDS.map((id) => (
                <li key={id}>{DIMENSIONS[id].label}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="door__section" aria-labelledby="door-not-title">
          <div className="door__head">
            <p className="type-label">Said plainly</p>
            <h2 id="door-not-title" className="door__h2">
              What Firefly is not
            </h2>
          </div>
          <ul className="door__not" role="list">
            {NOT.map((item) => (
              <li key={item.name} className="door__not-item">
                <h3 className="door__not-name">{item.name}</h3>
                <p className="door__not-text">{item.text}</p>
              </li>
            ))}
          </ul>
          <div className="door__close">
            <p className="door__close-line">Ready when you are.</p>
            <Link to={startTo} className="action" viewTransition={!reduced}>
              {startLabel}
              <Icon name="arrow-right" size={18} />
            </Link>
          </div>
        </section>
      </main>

      <PublicColophon className="door__colophon" source />
    </>
  );
}
