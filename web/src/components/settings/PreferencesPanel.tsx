import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Difficulty } from '#shared/domain/vocab.ts';
import {
  updatePreferences,
  useProfile,
  usePreferences,
  type HintsPreference,
} from '../../lib/profile.ts';
import { useSound } from '../../lib/sound.ts';
import { useTheme, type MotionPreference, type ThemePreference } from '../../lib/theme.tsx';
import { useToast } from '../../lib/toast.tsx';
import { requestTour } from '../../lib/tour.ts';
import { Icon } from '../Icon.tsx';
import { VoiceDisclosureDialog } from '../voice/VoiceDisclosureDialog.tsx';
import { ActionRow, SelectRow, SettingGroup, SwitchRow } from './SettingRows.tsx';
import {
  DIFFICULTY_OPTIONS,
  HINT_OPTIONS,
  MOTION_OPTIONS,
  THEME_OPTIONS,
  motionStatus,
  optionLabel,
  themeStatus,
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

export function PreferencesPanel() {
  const profile = useProfile();
  const preferences = usePreferences();
  const { theme, setTheme, motion, setMotion, reducedMotion, resolvedTheme } = useTheme();
  const [soundOn, setSoundOn] = useSound();
  const { toast } = useToast();
  const saved = (title: string) => toast({ tone: 'positive', title, durationMs: 3000 });

  const [asking, setAsking] = useState(false);
  const voiceSwitch = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(false);
  // The dialog restores focus after this render, so put it back on the switch once it has gone.
  useEffect(() => {
    if (asking || !returnFocus.current) return;
    returnFocus.current = false;
    voiceSwitch.current?.focus();
  }, [asking]);

  const locked = profile === null;
  const closeDialog = () => {
    returnFocus.current = true;
    setAsking(false);
  };

  return (
    <div className="st-panel-body">
      <SettingGroup id="st-group-practice" title="Practice">
        <SelectRow<Difficulty>
          id="st-difficulty"
          label="Default difficulty"
          hint={profileHint(
            locked,
            'The difficulty a new call starts on. You can still change it for each call.',
          )}
          value={preferences.defaultDifficulty}
          options={DIFFICULTY_OPTIONS}
          disabled={locked}
          onChange={(value) => {
            updatePreferences({ defaultDifficulty: value });
            saved(`Default difficulty is now ${optionLabel(DIFFICULTY_OPTIONS, value)}.`);
          }}
        />
        <SelectRow<HintsPreference>
          id="st-hints"
          label="Show hints"
          hint={profileHint(
            locked,
            'Guided practice shows light cues, such as the customer’s mood. Immersive practice shows none.',
          )}
          value={preferences.hints}
          options={HINT_OPTIONS}
          disabled={locked}
          onChange={(value) => {
            updatePreferences({ hints: value });
            saved(`Hints: ${optionLabel(HINT_OPTIONS, value)}.`);
          }}
        />
        <SwitchRow
          id="st-voice"
          label="Enable voice (Beta)"
          hint={profileHint(
            locked,
            <>
              Speak instead of typing and hear the customer. Works best in Chrome or Edge.{' '}
              <Link to="/help#voice">How voice works and your privacy</Link>
            </>,
          )}
          checked={preferences.voice}
          disabled={locked}
          inputRef={voiceSwitch}
          onChange={(on) => {
            if (on) {
              setAsking(true);
              return;
            }
            updatePreferences({ voice: false });
            saved('Voice is off.');
          }}
        />
      </SettingGroup>

      <SettingGroup id="st-group-device" title="This device">
        <SelectRow<ThemePreference>
          id="st-theme"
          label="Theme"
          hint={themeStatus(theme, resolvedTheme)}
          value={theme}
          options={THEME_OPTIONS}
          onChange={(value) => {
            setTheme(value);
            saved(`Theme: ${optionLabel(THEME_OPTIONS, value)}.`);
          }}
        />
        <SelectRow<MotionPreference>
          id="st-motion"
          label="Reduce motion"
          hint={motionStatus(motion, reducedMotion)}
          value={motion}
          options={MOTION_OPTIONS}
          onChange={(value) => {
            setMotion(value);
            saved(`Reduce motion: ${optionLabel(MOTION_OPTIONS, value)}.`);
          }}
        />
        <SwitchRow
          id="st-sound"
          label="Sound effects"
          hint="Short, soft tones when a customer reveals something, a call connects or a report opens. Nothing plays unless you turn this on, and the tones are made in your browser, so no audio files are loaded."
          checked={soundOn}
          onChange={(on) => {
            setSoundOn(on);
            saved(on ? 'Sound effects are on.' : 'Sound effects are off.');
          }}
        />
        <SelectRow<'en-GB'>
          id="st-language"
          label="Language"
          hint="English is the only language for now"
          value="en-GB"
          options={[{ value: 'en-GB', label: 'English (UK)' }]}
          disabled
          onChange={() => undefined}
        />
        <ActionRow
          id="st-tour"
          label="Quick tour"
          hint="Five small examples of how a call, a hidden fact and your feedback work. You can skip it at any step."
        >
          <button
            type="button"
            className="btn btn-secondary"
            aria-describedby="st-tour-hint"
            onClick={requestTour}
            onPointerEnter={warmTour}
            onFocus={warmTour}
          >
            <Icon name="compass" size={16} /> Take the 45-second tour
          </button>
        </ActionRow>
      </SettingGroup>

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
