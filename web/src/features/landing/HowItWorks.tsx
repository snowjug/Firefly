import { Band, BandHead } from './Band.tsx';

const STEPS: readonly { title: string; text: string }[] = [
  {
    title: 'Choose a scenario',
    text: 'Pick a situation, set how demanding the customer is, and read the call brief. The brief tells you what you are allowed to know, and nothing more.',
  },
  {
    title: 'Conduct the call',
    text: 'Speak naturally with the AI customer. Ask questions, handle frustration, take ownership and agree what happens next.',
  },
  {
    title: 'Review the coaching report',
    text: 'Six skills are scored from the transcript. The report shows the exact words behind each score, stronger ways to say things, and the facts you found or missed.',
  },
];

export function HowItWorks() {
  return (
    <Band id="how-it-works" tone="quiet">
      <BandHead id="how-it-works" title="How it works" />
      <ol role="list" className="lp-steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="lp-step">
            <span className="lp-step__marker" aria-hidden="true">
              {index + 1}
            </span>
            <div className="lp-step__body">
              <h3 className="lp-step__title">{step.title}</h3>
              <p className="lp-step__text">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="lp-why">
        <h3 className="lp-why__title">Why practise out loud</h3>
        <p className="lp-why__text measure">
          Real support calls are spoken. Practising aloud builds pacing, listening and tone in a way
          typing cannot. Firefly coaches the words you say, not how you sound. If you cannot or
          would rather not use a microphone, any call can be typed.
        </p>
      </div>
    </Band>
  );
}
