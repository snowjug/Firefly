import { useRef, useState } from 'react';
import { Link } from 'react-router';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import { play, useSound } from '../../lib/sound.ts';
import { setTourState, useTourState } from '../../lib/tour.ts';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';
import { CustomerAvatar } from '../illustration/index.ts';
import { Switch } from '../report/Switch.tsx';
import { SegmentedChoice } from '../trainer/SegmentedChoice.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import '../../styles/tour.css';

const STEP_COUNT = 5;

// Every customer in the tour is the same invented person, so the face stays put and only the mood
// changes.
const SEED = 'tour customer';

function Customer({ mood }: { mood: TemperatureBandId }) {
  return (
    <div className="tour-art" aria-hidden="true">
      <CustomerAvatar seed={SEED} mood={mood} />
    </div>
  );
}

type Level = 'starter' | 'standard' | 'challenge';

const LEVELS: { value: Level; label: string; mood: TemperatureBandId; text: string }[] = [
  {
    value: 'starter',
    label: 'Starter',
    mood: 'calm',
    text: 'Calm and cooperative, with clear clues. A good first call.',
  },
  {
    value: 'standard',
    label: 'Standard',
    mood: 'frustrated',
    text: 'Short on patience. You need to ask good questions to get the full picture.',
  },
  {
    value: 'challenge',
    label: 'Challenge',
    mood: 'angry',
    text: 'High pressure and sure it is not their fault. Expect surprises mid-call.',
  },
];

function StepPick() {
  const [chosen, setChosen] = useState<Level>('starter');
  const level = LEVELS.find((item) => item.value === chosen) ?? LEVELS[0];
  return (
    <div className="tour-demo">
      <Customer mood={level?.mood ?? 'calm'} />
      <div className="tour-demo-body">
        <p className="t-label">Example calls</p>
        <SegmentedChoice<Level>
          legend="Choose an example difficulty"
          value={chosen}
          options={LEVELS}
          onChange={setChosen}
        />
        <p className="tour-note" aria-live="polite">
          {level?.text}
        </p>
        <p className="tour-note">
          You will find real scenarios under <strong>Practice</strong> in the sidebar. Pick one,
          then adjust the customer before you start.
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

function StepHidden() {
  const [asked, setAsked] = useState<string[]>([]);
  const [found, setFound] = useState(false);
  const ask = (id: string) => {
    if (asked.includes(id)) return;
    setAsked((current) => [...current, id]);
    if (QUESTIONS.find((q) => q.id === id)?.found) {
      setFound(true);
      play('discovery');
    }
  };
  return (
    <div className="tour-demo">
      <Customer mood="concerned" />
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
        {found ? (
          <p className="chip chip-positive" role="status" style={{ justifySelf: 'start' }}>
            <Icon name="check-circle" size={14} /> Hidden fact found
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
          have offered, and your report shows which hidden facts you found and which you missed.
        </p>
      </div>
    </div>
  );
}

const REPLIES: { id: string; say: string; mood: TemperatureBandId; result: string }[] = [
  {
    id: 'ack',
    say: 'I can hear how frustrating this is. Let me take this on and update you by three.',
    mood: 'calm',
    result: 'The customer settles.',
  },
  {
    id: 'dismiss',
    say: 'That is not how it works.',
    mood: 'angry',
    result: 'The customer gets more tense.',
  },
];

function StepReaction() {
  const [chosen, setChosen] = useState<string | null>(null);
  const reply = REPLIES.find((r) => r.id === chosen);
  return (
    <div className="tour-demo">
      <Customer mood={reply?.mood ?? 'frustrated'} />
      <div className="tour-demo-body">
        <p className="t-label">Example call, fictional customer</p>
        <p className="tour-line" data-who="customer">
          This is the third time I have had to chase this. I need it fixed today.
        </p>
        <div className="tour-choices tour-choices-stack">
          {REPLIES.map((r) => (
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
          {reply
            ? `${reply.result} In guided practice you see the mood on screen; in immersive practice you have to read it from what they say.`
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
            <span className="chip">Turn 4</span> You said
          </figcaption>
          <blockquote>&ldquo;When did it start, and did anything change?&rdquo;</blockquote>
          <p className="t-meta">A hidden fact came out because of this question.</p>
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
          Start with a short Starter call. Nothing here uses real customer data. Points reward
          practising, and nobody is ranked. You can replay this tour from Settings, and{' '}
          <Link to="/help" onClick={onDone}>
            Help
          </Link>{' '}
          answers the common questions.
        </p>
        <Switch checked={soundOn} onChange={setSound}>
          Sound effects (optional, off by default)
        </Switch>
        <div className="cluster">
          <Link to="/practice" className="btn btn-primary btn-lg" onClick={onDone}>
            Start practising <Icon name="arrow-right" size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

const TITLES = [
  'Pick a practice call',
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
        <div className="tour-progress">
          <p className="t-meta tour-progress-text">
            Step {step + 1} of {STEP_COUNT}
          </p>
          <ProgressBar value={step + 1} max={STEP_COUNT} label="Tour progress" />
        </div>
        <h3 className="tour-title" tabIndex={-1} ref={heading}>
          {TITLES[step]}
        </h3>
        {step === 0 ? <StepPick /> : null}
        {step === 1 ? <StepHidden /> : null}
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
