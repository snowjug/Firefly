import { Link } from 'react-router';
import { DIMENSION_IDS, DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { Icon, type IconName } from '../components/Icon.tsx';
import { HeroOrb } from '../components/illustration/index.ts';
import { BrandMark } from '../components/shell/BrandMark.tsx';
import { useDocumentTitle } from '../lib/hooks.ts';
import { useProfile } from '../lib/profile.ts';
import '../styles/public.css';

const STRIP: readonly { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'users',
    title: 'Realistic scenarios',
    text: 'Fictional customers with details to uncover',
  },
  { icon: 'file-text', title: 'Evidence-based feedback', text: 'Coaching tied to your own words' },
  { icon: 'trophy', title: 'Earn points', text: 'Badges for practising, never a ranking' },
  { icon: 'chart', title: 'Track progress', text: 'Six skills, tracked over time' },
];

const FEATURES: readonly { icon: IconName; title: string; points: readonly string[] }[] = [
  {
    icon: 'sliders',
    title: 'Configure the customer',
    points: [
      'Issue type and business impact',
      'Customer temperature, from calm to angry',
      'Technical proficiency and communication style',
      'Call stage, and curveballs such as a request for a manager',
    ],
  },
  {
    icon: 'message',
    title: 'Talk it through',
    points: [
      'The customer reacts to what you actually say',
      'Hidden facts only come out when you ask the right question',
      'Type your replies, or speak them with voice (Beta)',
    ],
  },
  {
    icon: 'lightbulb',
    title: 'Get coaching tied to your words',
    points: [
      'Six skills scored 1 to 5, with quotes from your call',
      'A stronger way to say it, for the moments to rework',
      'Which hidden facts you found, partly found or missed',
    ],
  },
];

const STEPS: readonly { title: string; text: string }[] = [
  { title: 'Create your profile', text: 'A name is enough. It stays in your browser.' },
  { title: 'Pick a scenario', text: 'Choose an issue, then set how demanding the customer is.' },
  { title: 'Take the call', text: 'Type or speak, and watch the customer’s mood respond.' },
  { title: 'Review your feedback', text: 'Six skills, quotes from your call and one next target.' },
  { title: 'Keep practising', text: 'Points, badges and history show how you are growing.' },
];

const SKILL_ICONS: Record<DimensionId, IconName> = {
  'opening-rapport': 'smile',
  'scoping-discovery': 'search',
  'empathy-deescalation': 'users',
  clarity: 'lightbulb',
  'ownership-next-steps': 'flag',
  closing: 'check-circle',
};

const PRINCIPLES: readonly string[] = [
  'Every scenario and customer is fictional. Never enter real customer information.',
  'Scores are for practice. They are not a performance assessment and are never ranked.',
  'Automatic coaching can be wrong. A mentor can review a call and compare scores.',
  'Firefly always shows whether the customer is a built-in simulation or a live model.',
  'Practice is saved on the Firefly server you connect to. Your profile stays in your browser.',
];

export default function Landing() {
  useDocumentTitle('Firefly: practise difficult customer conversations');
  const profile = useProfile();
  const startTo = profile ? '/home' : '/sign-in';
  const startLabel = profile ? 'Open your dashboard' : 'Get started';

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-nav">
          <Link to="/" className="brand" aria-label="Firefly home">
            <BrandMark />
            <span>Firefly</span>
          </Link>
          <nav aria-label="On this page" className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#about">About</a>
          </nav>
          <div className="lp-nav-end">
            <Link to={startTo} className="btn btn-primary btn-sm">
              {profile ? 'Open dashboard' : 'Sign in'}
            </Link>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <div className="lp-dark">
          <section className="lp-hero" aria-labelledby="lp-title">
            <div>
              <p className="lp-eyebrow">Customer call practice for support engineers</p>
              <h1 id="lp-title" className="lp-title">
                Practice real conversations. Build real impact.
              </h1>
              <p className="lp-lead">
                Rehearse difficult customer calls with a simulated customer who reacts to what you
                say, then get coaching tied to your own words, before the call is a real one.
              </p>
              <div className="lp-cta">
                <Link to={startTo} className="btn btn-primary btn-lg">
                  {startLabel} <Icon name="arrow-right" size={18} />
                </Link>
                <a href="#how-it-works" className="btn btn-outline-light btn-lg">
                  Learn more
                </a>
              </div>
              <p className="lp-trust">
                <span>
                  <Icon name="shield" size={16} /> Fictional customers only
                </span>
                <span>
                  <Icon name="lock" size={16} /> Profile stays in your browser
                </span>
                <span>
                  <Icon name="target" size={16} /> Coaching, not ranking
                </span>
              </p>
            </div>
            <div className="lp-orb">
              <HeroOrb>
                <p>Better conversations.</p>
                <p>Stronger engineers.</p>
              </HeroOrb>
            </div>
          </section>

          <section className="lp-strip" aria-label="Highlights">
            <ul role="list">
              {STRIP.map((item) => (
                <li key={item.title}>
                  <span className="lp-strip-icon">
                    <Icon name={item.icon} size={22} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section id="features" className="lp-section" aria-labelledby="features-title">
          <header>
            <p className="lp-kicker">What you do</p>
            <h2 id="features-title" className="lp-h2">
              Configure, talk, then learn from it
            </h2>
            <p>
              Technical knowledge is not the whole job. Firefly is a safe place to practise scoping
              unclear problems, calming a frustrated customer and agreeing next steps.
            </p>
          </header>
          <div className="lp-cards">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="glass lp-card">
                <span className="tone-icon">
                  <Icon name={feature.icon} size={22} />
                </span>
                <h3>{feature.title}</h3>
                <ul>
                  {feature.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="lp-section" aria-labelledby="how-title">
          <header>
            <p className="lp-kicker">How it works</p>
            <h2 id="how-title" className="lp-h2">
              Five steps from sign-in to better calls
            </h2>
          </header>
          <ol className="lp-steps" role="list">
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section" aria-labelledby="skills-title">
          <header>
            <p className="lp-kicker">What the coaching covers</p>
            <h2 id="skills-title" className="lp-h2">
              Six skills, scored against what you actually said
            </h2>
            <p>
              They support four everyday behaviours: communicate effectively, be accountable, be
              resourceful and be empathetic.
            </p>
          </header>
          <ul className="lp-skills" role="list">
            {DIMENSION_IDS.map((id) => (
              <li key={id}>
                <span className="tone-icon" data-tone="violet">
                  <Icon name={SKILL_ICONS[id]} size={20} />
                </span>
                <span>
                  <strong>{DIMENSIONS[id].label}</strong>
                  <span>{DIMENSIONS[id].description}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section id="about" className="lp-section" aria-labelledby="about-title">
          <div className="lp-about">
            <div>
              <p className="lp-kicker">About</p>
              <h2 id="about-title" className="lp-h2">
                A training aid, not an assessment
              </h2>
              <p className="t-muted" style={{ marginTop: 'var(--sp-3)', maxWidth: '56ch' }}>
                Firefly is a collaborative apprentice project. It exists so that mistakes are made
                in practice, where they are free, instead of in front of a real customer.
              </p>
            </div>
            <ul role="list" className="glass card" aria-label="How Firefly treats your practice">
              {PRINCIPLES.map((text) => (
                <li key={text}>
                  <Icon name="check-circle" size={18} />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-final" aria-labelledby="final-title">
          <div className="banner">
            <div>
              <h2 id="final-title" className="t-title">
                Ready for your first call?
              </h2>
              <p style={{ marginTop: 'var(--sp-2)' }}>
                Start with a Starter scenario. It takes about ten minutes, and nothing you say here
                can reach a real customer.
              </p>
            </div>
            <Link to={startTo} className="btn btn-light btn-lg">
              {startLabel} <Icon name="arrow-right" size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <span>
          Firefly is a training aid. Scenarios are fictional; never enter real customer information.
          Scores are for practice, not performance assessment.
        </span>
        <span className="cluster" style={{ ['--cluster-gap' as string]: 'var(--sp-4)' }}>
          <Link to="/help">Help</Link>
          <Link to="/help#responsible-ai">Responsible AI</Link>
          <a href="https://github.com/snowjug/Firefly" target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
        </span>
      </footer>
    </div>
  );
}
