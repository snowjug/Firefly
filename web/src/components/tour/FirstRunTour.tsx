import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { play, useSound } from '../../lib/sound.ts';
import { setTourState, useTourState } from '../../lib/tour.ts';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';
import { FireflyCore } from '../core/FireflyCore.tsx';
import type { CoreMood, CoreTone } from '../core/engine.ts';

const STEP_COUNT = 5;

const MISSIONS = [
  {
    id: 'starter',
    label: 'Starter',
    mood: 'calm' as CoreMood,
    text: 'Calm and cooperative, with clear clues. A good first call.',
  },
  {
    id: 'standard',
    label: 'Standard',
    mood: 'frustrated' as CoreMood,
    text: 'Short on patience. You need to ask good questions to get the full picture.',
  },
  {
    id: 'challenge',
    label: 'Challenge',
    mood: 'angry' as CoreMood,
    text: 'High pressure and sure it is not their fault. Expect surprises mid-call.',
  },
];

function StepMission() {
  const [chosen, setChosen] = useState('starter');
  const mission = MISSIONS.find((m) => m.id === chosen) ?? MISSIONS[0];
  return (
    <div className="tour-demo">
      <div className="tour-core" aria-hidden="true">
        <FireflyCore mood={mission?.mood ?? 'calm'} quality="low" />
      </div>
      <div className="tour-demo-body">
        <p className="t-label">Example missions</p>
        <div role="radiogroup" aria-label="Choose an example mission" className="tour-choices">
          {MISSIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={m.id === chosen}
              className="tour-choice"
              onClick={() => setChosen(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="tour-note" aria-live="polite">
          {mission?.text}
        </p>
      </div>
    </div>
  );
}

const QUESTIONS = [
  {
    id: 'restart',
    ask: 'Have you tried restarting it?',
    reply: 'Yes, it says the same thing.',
    found: false,
  },
  {
    id: 'when',
    ask: 'When did it start, and did anything change?',
    reply: 'Right after I changed my password this morning. My phone is still on the old one.',
    found: true,
  },
];

function StepSignal() {
  const [asked, setAsked] = useState<string[]>([]);
  const [discoveries, setDiscoveries] = useState(0);
  const ask = (id: string) => {
    if (asked.includes(id)) return;
    setAsked((current) => [...current, id]);
    if (QUESTIONS.find((q) => q.id === id)?.found) {
      setDiscoveries((n) => n + 1);
      play('discovery');
    }
  };
  return (
    <div className="tour-demo">
      <div className="tour-core" aria-hidden="true">
        <FireflyCore
          mood="neutral"
          signals={{ total: 3, lit: discoveries }}
          discoveryKey={discoveries}
          quality="low"
        />
      </div>
      <div className="tour-demo-body">
        <p className="t-label">Example call, fictional customer</p>
        <p className="tour-line" data-who="customer">
          My account is locked and I don&rsquo;t know why.
        </p>
        {QUESTIONS.filter((q) => asked.includes(q.id)).map((q) => (
          <div key={q.id} className="tour-exchange">
            <p className="tour-line" data-who="you">
              {q.ask}
            </p>
            <p className="tour-line" data-who="customer">
              {q.reply}
            </p>
          </div>
        ))}
        {discoveries > 0 ? (
          <p className="tour-found" role="status">
            <span className="signal-found-dot" aria-hidden="true" /> Signal found
          </p>
        ) : null}
        <div className="tour-choices tour-choices-stack">
          {QUESTIONS.map((q) => (
            <button
              key={q.id}
              type="button"
              className="tour-choice"
              disabled={asked.includes(q.id)}
              onClick={() => ask(q.id)}
            >
              {q.ask}
            </button>
          ))}
        </div>
        <p className="tour-note">
          Customers do not volunteer everything. A good question brings out a fact they would not
          have offered. Firefly shows that a signal was found, never what it was.
        </p>
      </div>
    </div>
  );
}

const RESPONSES: { id: string; say: string; mood: CoreMood; tone: CoreTone; result: string }[] = [
  {
    id: 'ack',
    say: 'I can hear how frustrating this is. Let me take this on and update you by three.',
    mood: 'calm',
    tone: 'falling',
    result: 'The customer settles.',
  },
  {
    id: 'dismiss',
    say: 'That is not how it works.',
    mood: 'frustrated',
    tone: 'rising',
    result: 'The customer gets more tense.',
  },
];

function StepReaction() {
  const [chosen, setChosen] = useState<string | null>(null);
  const response = RESPONSES.find((r) => r.id === chosen);
  return (
    <div className="tour-demo">
      <div className="tour-core" aria-hidden="true">
        <FireflyCore
          mood={response?.mood ?? 'concerned'}
          tone={response?.tone ?? 'steady'}
          pulseKey={chosen}
          quality="low"
        />
      </div>
      <div className="tour-demo-body">
        <p className="t-label">Example call, fictional customer</p>
        <p className="tour-line" data-who="customer">
          This is the third time I have had to chase this. I need it fixed today.
        </p>
        <div className="tour-choices tour-choices-stack">
          {RESPONSES.map((r) => (
            <button
              key={r.id}
              type="button"
              className="tour-choice"
              aria-pressed={r.id === chosen}
              onClick={() => setChosen(r.id)}
            >
              {r.say}
            </button>
          ))}
        </div>
        <p className="tour-note" aria-live="polite">
          {response
            ? `${response.result} In guided practice you see the mood on screen; in immersive practice you have to read it from what they say.`
            : 'Choose a reply to see how the customer reacts.'}
        </p>
      </div>
    </div>
  );
}

function StepFeedback() {
  return (
    <div className="tour-demo tour-demo-single">
      <div className="tour-demo-body">
        <p className="t-label">Example of evidence in a report</p>
        <figure className="tour-quote">
          <figcaption>
            <span className="tour-pill">Turn 4</span> You said
          </figcaption>
          <blockquote>&ldquo;When did it start, and did anything change?&rdquo;</blockquote>
          <p className="t-meta">A critical fact came out because of this question.</p>
        </figure>
        <p className="tour-note">
          After the call, every score and every piece of advice points to the exact words you used.
          The scores are practice signals for you, not a performance rating, and the coaching can be
          imperfect, so talk it through with a mentor.
        </p>
      </div>
    </div>
  );
}

function StepReady({ onDone }: { onDone(): void }) {
  const [soundOn, setSound] = useSound();
  return (
    <div className="tour-demo tour-demo-single">
      <div className="tour-demo-body">
        <p className="tour-note">
          Start with a short Starter call. Nothing here uses real customer data, and you can replay
          this tour any time from Settings.
        </p>
        <label className="tour-toggle">
          <input
            type="checkbox"
            checked={soundOn}
            onChange={(event) => setSound(event.target.checked)}
          />
          <span>
            Sound effects <span className="t-meta">(optional, off by default)</span>
          </span>
        </label>
        <div className="cluster">
          <Link to="/scenarios" className="btn btn-primary btn-lg" onClick={onDone}>
            Choose a mission <Icon name="arrow-right" size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

const TITLES = [
  'Pick a mission',
  'Some things stay hidden',
  'The customer reacts to you',
  'Feedback in your own words',
  'Ready when you are',
];

/**
 * An optional, under-a-minute tour built from small working examples (fictional, clearly marked).
 * It never opens by itself on a page you did not choose, can be skipped at any step, and what you
 * chose is remembered on this device only.
 */
export function FirstRunTour({ open, onClose }: { open: boolean; onClose(): void }) {
  const state = useTourState();
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  const finish = (outcome: 'done' | 'skipped') => {
    if (state === 'new' || outcome === 'done') setTourState(outcome);
    setStep(0);
    onClose();
  };

  const go = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <Dialog
      open={open}
      onClose={() => finish(step === STEP_COUNT - 1 ? 'done' : 'skipped')}
      title="A short tour of Firefly"
      description="Five small examples, under a minute. Skip any time."
    >
      <div className="tour">
        <p className="t-meta tour-progress">
          Step {step + 1} of {STEP_COUNT}
        </p>
        <h3 className="tour-title" tabIndex={-1} ref={heading}>
          {TITLES[step]}
        </h3>
        {step === 0 ? <StepMission /> : null}
        {step === 1 ? <StepSignal /> : null}
        {step === 2 ? <StepReaction /> : null}
        {step === 3 ? <StepFeedback /> : null}
        {step === 4 ? <StepReady onDone={() => finish('done')} /> : null}
        <div className="tour-foot">
          <button type="button" className="btn btn-ghost" onClick={() => finish('skipped')}>
            Skip tour
          </button>
          <span className="tour-foot-nav">
            {step > 0 ? (
              <button type="button" className="btn btn-secondary" onClick={() => go(step - 1)}>
                Back
              </button>
            ) : null}
            {step < STEP_COUNT - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                data-autofocus
                onClick={() => go(step + 1)}
              >
                Next <Icon name="arrow-right" size={16} />
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => finish('done')}>
                Done
              </button>
            )}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
