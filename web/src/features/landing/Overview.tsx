import { Icon, type IconName } from '../../design/index.ts';
import { Band, BandHead } from './Band.tsx';

const FACTS: readonly { icon: IconName; lead: string; text: string }[] = [
  {
    icon: 'microphone',
    lead: 'Spoken or typed',
    text: 'Talk to the customer, or type if you prefer. Every call can be typed.',
  },
  {
    icon: 'person',
    lead: 'An unscripted customer',
    text: 'Their mood moves with what you say, and they share important details only when you ask relevant questions.',
  },
  {
    icon: 'document',
    lead: 'Coaching from your own words',
    text: 'Every score is tied to the exact things you said.',
  },
];

export function Overview() {
  return (
    <Band id="overview">
      <BandHead
        id="overview"
        title="A safe place to practise support conversations"
        intro="Firefly is for new technical-support engineers and apprentices. It trains the conversation rather than a product: how you open a call, scope an unclear problem, handle a frustrated customer, take ownership and agree next steps."
      />
      <ul role="list" className="lp-facts">
        {FACTS.map((fact) => (
          <li key={fact.lead} className="lp-fact">
            <Icon name={fact.icon} size={28} className="lp-fact__icon" />
            <p className="lp-fact__lead">{fact.lead}</p>
            <p className="lp-fact__text">{fact.text}</p>
          </li>
        ))}
      </ul>
    </Band>
  );
}
