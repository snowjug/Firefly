import { useState } from 'react';
import { Link } from 'react-router';
import { MOOD_ATMOSPHERE, type Atmosphere } from '../call/atmosphere.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import { play, useSound } from '../../lib/sound.ts';
import { ChoiceRow } from '../frame/ChoiceRow.tsx';
import { Tag } from '../frame/Tag.tsx';
import { Toggle } from '../frame/Toggle.tsx';
import { Icon } from '../Icon.tsx';
import { SignalGlyph } from '../signal/SignalGlyph.tsx';
import { SignalPresence } from '../signal/SignalPresence.tsx';
import type { GlyphTraits } from '../signal/types.ts';

// The five working examples of the tour. Each one is small, fictional and says so; none of them
// calls anything or keeps anything, and the instrument that stands for the customer is the same
// object the call uses.

const MOOD_WORDS: Record<TemperatureBandId, string> = {
  calm: 'Calm',
  concerned: 'Concerned',
  frustrated: 'Frustrated',
  angry: 'Angry',
  escalating: 'Escalating',
};

/** The room for a mood, from the same numbers the call uses. */
function atmosphereOf(mood: TemperatureBandId): Atmosphere {
  return {
    mood,
    trend: 'steady',
    ...MOOD_ATMOSPHERE[mood],
    recovering: false,
    silent: false,
    label: MOOD_WORDS[mood],
    status: `Customer mood: ${MOOD_WORDS[mood]}.`,
  };
}

/** The customer, as the instrument: decorative, because the words say everything it does. */
function Customer({ mood, found = 0 }: { mood: TemperatureBandId; found?: number }) {
  return (
    <div className="tour-art" aria-hidden="true">
      <SignalPresence atmosphere={atmosphereOf(mood)} discovered={found} shifts={0} size={132} />
    </div>
  );
}

type Level = 'starter' | 'standard' | 'challenge';

const LEVELS: readonly { value: Level; label: string; text: string; traits: GlyphTraits }[] = [
  {
    value: 'starter',
    label: 'Starter',
    text: 'Calm and cooperative, with clear clues. A good first call.',
    traits: {
      difficulty: 'starter',
      impact: 'low',
      start: 'calm',
      stage: 'first-contact',
      status: 'new',
      minutes: 8,
    },
  },
  {
    value: 'standard',
    label: 'Standard',
    text: 'Short on patience. You need to ask good questions to get the full picture.',
    traits: {
      difficulty: 'standard',
      impact: 'medium',
      start: 'frustrated',
      stage: 'first-contact',
      status: 'new',
      minutes: 10,
    },
  },
  {
    value: 'challenge',
    label: 'Challenge',
    text: 'High pressure and sure it is not their fault. Expect surprises mid-call.',
    traits: {
      difficulty: 'challenge',
      impact: 'high',
      start: 'angry',
      stage: 'first-contact',
      status: 'new',
      minutes: 12,
    },
  },
];

export function StepPick() {
  const [chosen, setChosen] = useState<Level>('starter');
  const level = LEVELS.find((item) => item.value === chosen) ?? LEVELS[0];
  return (
    <div className="tour-demo">
      <div className="tour-art" aria-hidden="true">
        {level ? <SignalGlyph traits={level.traits} size={132} /> : null}
      </div>
      <div className="tour-demo-body">
        <ChoiceRow
          legend="Choose an example difficulty"
          name="tour-level"
          size="text"
          value={chosen}
          options={LEVELS.map(({ value, label }) => ({ value, label }))}
          onChange={(value) =>
            setChosen(LEVELS.find((item) => item.value === value)?.value ?? 'starter')
          }
        />
        <p className="tour-note" aria-live="polite">
          {level?.text}
        </p>
        <p className="tour-note tour-note--quiet">
          Rings show the difficulty and the edge shows how the customer starts. You will find real
          scenarios under <strong>Missions</strong> in the dock at the bottom of the screen, or
          search for one with Ctrl or Cmd+K. Pick one, then adjust the customer before you start.
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

export function StepHidden() {
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
      <Customer mood="concerned" found={found ? 1 : 0} />
      <div className="tour-demo-body">
        <p className="tour-label type-label">Example call, fictional customer</p>
        <div className="tour-lines">
          <p className="tour-line" data-who="customer">
            <span className="tour-who type-label">Customer</span>
            <span>My account is locked and I don&rsquo;t know why.</span>
          </p>
          {QUESTIONS.filter((q) => asked.includes(q.id)).map((q) => (
            <div key={q.id} className="tour-exchange">
              <p className="tour-line" data-who="you">
                <span className="tour-who type-label">You</span>
                <span>{q.ask}</span>
              </p>
              <p className="tour-line" data-who="customer">
                <span className="tour-who type-label">Customer</span>
                <span>{q.reply}</span>
              </p>
            </div>
          ))}
        </div>
        <div role="status" className="tour-found">
          {found ? <Tag tone="amber">Hidden fact found</Tag> : null}
        </div>
        <div className="tour-choices">
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
        <p className="tour-note tour-note--quiet">
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

export function StepReaction() {
  const [chosen, setChosen] = useState<string | null>(null);
  const reply = REPLIES.find((r) => r.id === chosen);
  const mood = reply?.mood ?? 'frustrated';
  return (
    <div className="tour-demo">
      <Customer mood={mood} />
      <div className="tour-demo-body">
        <p className="tour-label type-label">Example call, fictional customer</p>
        <p className="tour-line" data-who="customer">
          <span className="tour-who type-label">Customer</span>
          <span>This is the third time I have had to chase this. I need it fixed today.</span>
        </p>
        <div className="tour-choices">
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
        <p className="tour-mood type-label" aria-hidden="true">
          Customer mood: {MOOD_WORDS[mood]}
        </p>
      </div>
    </div>
  );
}

export function StepFeedback() {
  return (
    <div className="tour-demo tour-demo-single">
      <div className="tour-demo-body">
        <p className="tour-label type-label">Example of evidence in a report</p>
        <figure className="tour-quote">
          <figcaption className="type-label">Turn 4 · You said</figcaption>
          <blockquote>&ldquo;When did it start, and did anything change?&rdquo;</blockquote>
          <p className="tour-note tour-note--quiet">
            A hidden fact came out because of this question.
          </p>
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

export function StepReady({ onDone }: { onDone(): void }) {
  const [soundOn, setSound] = useSound();
  return (
    <div className="tour-demo tour-demo-single">
      <div className="tour-demo-body">
        <p className="tour-note">
          Start with a short Starter call. Nothing here uses real customer data. Points reward
          practising, and nobody is ranked. You can replay this tour from Settings, and{' '}
          <Link to="/help" className="text-link" onClick={onDone}>
            Help
          </Link>{' '}
          answers the common questions.
        </p>
        <div className="ff-rows">
          <Toggle
            checked={soundOn}
            onChange={setSound}
            label="Sound effects (optional, off by default)"
          />
        </div>
        <div className="action-row">
          <Link to="/practice" className="action" onClick={onDone}>
            Start practising
            <Icon name="arrow-right" size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
