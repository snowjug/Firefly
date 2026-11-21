import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  updatePreferences,
  useProfile,
  usePreferences,
  type HintsPreference,
} from '../../lib/profile.ts';
import { useAmbient } from '../../lib/motion/ambient.tsx';
import { useSound } from '../../lib/sound.ts';
import { useTheme } from '../../lib/theme.tsx';
import { useToast } from '../../lib/toast.tsx';
import { requestTour } from '../../lib/tour.ts';
import { resetIgnition } from '../entry/ignition.ts';
import { ChoiceRow } from '../frame/ChoiceRow.tsx';
import { Ledger } from '../frame/Ledger.tsx';
import { Section } from '../frame/PageFrame.tsx';
import { Toggle } from '../frame/Toggle.tsx';
import { VoiceDisclosureDialog } from '../voice/VoiceDisclosureDialog.tsx';
import {
  DIFFICULTY_CHOICES,
  HINT_CHOICES,
  choiceLabel,
  motionChoices,
  pick,
  themeChoices,
} from './settings-model.ts';

const NEEDS_PROFILE = 'Create your profile first.';

/** The hint for a setting that is saved on the profile: its description, then what is missing. */
function profileHint(locked: boolean, description: ReactNode): ReactNode {
  return (
    <>
      {description}
      {locked ? (
        <>
          {' '}
          <strong className="st-locked">{NEEDS_PROFILE}</strong>
        </>
      ) : null}
    </>
  );
}

/** Starts downloading the tour while the pointer or focus is on the button that opens it. */
const warmTour = () => void import('../tour/FirstRunTour.tsx');

const AMBIENT_ON =
  'The slow drift of the field and the instruments. It is the same control as the pause button at the top right of every page.';
const AMBIENT_FORCED =
  'Reduced motion is on, so ambient motion is paused. Change Reduce motion above if you want it back.';

export function PreferencesPanel() {
  const profile = useProfile();
  const preferences = usePreferences();
  const { theme, setTheme, motion, setMotion, reducedMotion, resolvedTheme } = useTheme();
  const ambient = useAmbient();
  const [soundOn, setSoundOn] = useSound();
  const { toast } = useToast();
  const navigate = useNavigate();
  const saved = (title: string) => toast({ tone: 'positive', title, durationMs: 3000 });

  const [asking, setAsking] = useState(false);
  const returnFocus = useRef(false);
  // The dialog restores focus after this render; make sure it lands on the switch once it has gone.
  useEffect(() => {
    if (asking || !returnFocus.current) return;
    returnFocus.current = false;
    document.getElementById('st-voice')?.focus();
  }, [asking]);
  const closeDialog = () => {
    returnFocus.current = true;
    setAsking(false);
  };

  const locked = profile === null;
  const themes = themeChoices(resolvedTheme);
  const motions = motionChoices(reducedMotion);

  return (
    <div className="st-panel-body">
      <Section title="Practice">
        <div className="st-stack">
          <p className="st-lede">
            What a new call starts with. You can change any of it for each call.
          </p>
          {locked ? (
            <p id="st-locked" className="st-lede">
              <strong className="st-locked">{NEEDS_PROFILE}</strong> Practice settings are saved on
              your profile.
            </p>
          ) : null}
          <ChoiceRow
            legend="Default difficulty"
            name="st-difficulty"
            size="text"
            value={preferences.defaultDifficulty}
            options={DIFFICULTY_CHOICES}
            disabled={locked}
            describedBy={locked ? 'st-locked' : undefined}
            onChange={(value) => {
              const difficulty = pick(DIFFICULTY_CHOICES, value);
              if (!difficulty) return;
              updatePreferences({ defaultDifficulty: difficulty });
              saved(`Default difficulty is now ${choiceLabel(DIFFICULTY_CHOICES, difficulty)}.`);
            }}
          />
          <ChoiceRow
            legend="Show hints"
            name="st-hints"
            size="text"
            value={preferences.hints}
            options={HINT_CHOICES}
            disabled={locked}
            describedBy={locked ? 'st-locked' : undefined}
            onChange={(value) => {
              const hints: HintsPreference | null = pick(HINT_CHOICES, value);
              if (!hints) return;
              updatePreferences({ hints });
              saved(`Hints: ${choiceLabel(HINT_CHOICES, hints)}.`);
            }}
          />
          <div className="ff-rows">
            <Toggle
              id="st-voice"
              label="Enable voice (Beta)"
              hint={profileHint(
                locked,
                <>
                  Speak instead of typing and hear the customer. Works best in Chrome or Edge.{' '}
                  <Link to="/help#voice" className="text-link">
                    How voice works and your privacy
                  </Link>
                </>,
              )}
              checked={preferences.voice}
              disabled={locked}
              onChange={(on) => {
                if (on) {
                  setAsking(true);
                  return;
                }
                updatePreferences({ voice: false });
                saved('Voice is off.');
              }}
            />
          </div>
        </div>
      </Section>

      <Section title="This device">
        <div className="st-stack">
          <p className="st-lede">Saved in this browser only. None of this needs a profile.</p>
          <ChoiceRow
            legend="Theme"
            name="st-theme"
            size="text"
            value={theme}
            options={themes}
            onChange={(value) => {
              const next = pick(themes, value);
              if (!next) return;
              setTheme(next);
              saved(`Theme: ${choiceLabel(themes, next)}.`);
            }}
          />
          <ChoiceRow
            legend="Reduce motion"
            name="st-motion"
            size="text"
            value={motion}
            options={motions}
            onChange={(value) => {
              const next = pick(motions, value);
              if (!next) return;
              setMotion(next);
              saved(`Reduce motion: ${choiceLabel(motions, next)}.`);
            }}
          />
          <div className="ff-rows">
            <Toggle
              id="st-ambient"
              label="Ambient motion"
              hint={ambient.forced ? AMBIENT_FORCED : AMBIENT_ON}
              checked={!ambient.paused}
              disabled={ambient.forced}
              onChange={(on) => {
                ambient.setPreference(on ? 'on' : 'paused');
                saved(on ? 'Ambient motion is on.' : 'Ambient motion is paused.');
              }}
            />
            <Toggle
              id="st-sound"
              label="Sound effects"
              hint="Short, soft tones when a customer reveals something, a call connects or a report opens. Nothing plays unless you turn this on, and the tones are made in your browser, so no audio files are loaded."
              checked={soundOn}
              onChange={(on) => {
                setSoundOn(on);
                saved(on ? 'Sound effects are on.' : 'Sound effects are off.');
              }}
            />
          </div>
          <Ledger
            rows={[
              {
                label: 'Language',
                value: 'English (UK)',
                note: 'English is the only language for now',
              },
            ]}
          />
        </div>
      </Section>

      <Section title="The introduction">
        <div className="st-stack">
          <div className="st-act">
            <div className="st-act__text">
              <h3 className="st-act__title">Quick tour</h3>
              <p id="st-tour-hint" className="st-act__hint">
                Five small examples of how a call, a hidden fact and your feedback work. You can
                skip it at any step.
              </p>
            </div>
            <button
              type="button"
              className="action action--quiet"
              aria-describedby="st-tour-hint"
              onClick={requestTour}
              onPointerEnter={warmTour}
              onFocus={warmTour}
            >
              Take the 45-second tour
            </button>
          </div>
          <div className="st-act">
            <div className="st-act__text">
              <h3 className="st-act__title">Front page introduction</h3>
              <p id="st-replay-hint" className="st-act__hint">
                The front page lights its instrument once, the first time Firefly opens on a device.{' '}
                {reducedMotion
                  ? 'Motion is reduced here, so it will appear without the animation.'
                  : 'Replay it to see it again.'}
              </p>
            </div>
            <button
              type="button"
              className="action action--quiet"
              aria-describedby="st-replay-hint"
              onClick={() => {
                resetIgnition();
                void navigate('/', { viewTransition: !reducedMotion });
              }}
            >
              Replay the introduction
            </button>
          </div>
        </div>
      </Section>

      <VoiceDisclosureDialog
        open={asking}
        onCancel={closeDialog}
        onAccept={() => {
          updatePreferences({ voice: true });
          saved('Voice (Beta) is on.');
          closeDialog();
        }}
      />
    </div>
  );
}
