import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '../Icon.tsx';

interface Step {
  title: string;
  text: string;
  links?: { to: string; label: string }[];
}

function steps(spotlightId: string | null): Step[] {
  return [
    {
      title: 'Configure the scenario',
      text: 'Change the difficulty, business impact, customer mood or communication style before the call.',
      links: spotlightId
        ? [{ to: `/scenarios/${encodeURIComponent(spotlightId)}/setup`, label: 'Open setup' }]
        : [{ to: '/scenarios', label: 'Browse scenarios' }],
    },
    {
      title: 'Run an unscripted call',
      text: 'Type whatever you like. The customer reacts to what you actually say; nothing is pre-written for any expected conversation.',
    },
    {
      title: 'Uncover a hidden fact',
      text: 'The customer holds back key details until you ask about them. Try timing, recent changes or who is affected.',
    },
    {
      title: 'Meet a curveball',
      text: 'Partway through, the customer may raise something unexpected, such as asking for a manager or setting a deadline. Respond as you would on a real call.',
    },
    {
      title: 'End the call',
      text: 'End it when it reaches a natural close. Firefly locks the transcript and builds the report from it.',
    },
    {
      title: 'Read the report',
      text: 'Look at the evidence-based report: quotes from your own words, what was found and missed, the customer\u2019s temperature timeline and alternative phrasing.',
    },
    {
      title: 'Open History and Progress',
      text: 'See the call in your history and how skills trend across completed sessions.',
      links: [
        { to: '/history', label: 'History' },
        { to: '/progress', label: 'Progress' },
      ],
    },
    {
      title: 'Open Calibration',
      text: 'Show how AI scores are compared with a mentor\u2019s scores on the same call.',
      links: [{ to: '/calibration', label: 'Calibration' }],
    },
  ];
}

/** A short "what to show" list for a live demo, with links to the places that need one. */
export function DemoChecklist({ spotlightId }: { spotlightId: string | null }): ReactNode {
  const titleId = useId();
  return (
    <section className="glass card stack tr-checklist" aria-labelledby={titleId}>
      <div>
        <h2 id={titleId} className="t-section">
          Demo checklist
        </h2>
        <p className="t-small t-muted">A suggested order for showing the product end to end.</p>
      </div>

      <ol role="list" className="tr-steps">
        {steps(spotlightId).map((step, index) => (
          <li key={step.title} className="tr-step">
            <span className="tr-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <div className="tr-step-body">
              <p className="tr-step-title">{step.title}</p>
              <p className="t-small t-muted">{step.text}</p>
              {step.links ? (
                <p className="tr-step-links">
                  {step.links.map((link) => (
                    <Link key={link.to} to={link.to} className="t-small" viewTransition>
                      {link.label}
                    </Link>
                  ))}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="callout">
        <Icon name="info" size={18} />
        <p>
          <strong>Unscripted by design.</strong> There are no canned answers for any anticipated
          conversation. The only pre-written content is the sample sessions, and those are always
          labelled Sample.
        </p>
      </div>
    </section>
  );
}
