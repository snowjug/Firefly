import { useId, useState, type ReactNode } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGES,
  CALL_STAGE_LABELS,
  CURVEBALL_LABELS,
  IMPACTS,
  IMPACT_LABELS,
  PROFICIENCIES,
  PROFICIENCY_LABELS,
  START_TEMPERATURES,
  START_TEMPERATURE_LABELS,
  STYLES,
  STYLE_LABELS,
  type CallStage,
  type CommunicationStyle,
  type CurveballType,
} from '#shared/domain/vocab.ts';
import { cx } from '../../design/cx.ts';
import { CUSTOMER_STATE_ICONS } from '../../design/primitives/Badge.tsx';
import { Button, IconButton } from '../../design/primitives/Button.tsx';
import { Checkbox } from '../../design/primitives/Choice.tsx';
import { useAnnouncer } from '../../design/primitives/LiveRegion.tsx';
import { SegmentedControl } from '../../design/primitives/SegmentedControl.tsx';
import { Select } from '../../design/primitives/TextInput.tsx';
import {
  changedFromDefault,
  effectiveVoice,
  fitCurveballs,
  maxCurveballs,
  type CallConfig,
  type ConfigKey,
} from './config-params.ts';
import {
  START_STATE,
  complicationCount,
  curveballChoices,
  difficultyLabel,
  moodLabel,
} from './labels.ts';
import { defaultVoiceFor, isVoiceId, offeredVoice, type VoiceOption } from './voice-choice.ts';

type CurveballMode = 'none' | 'default' | 'choose';

const CURVEBALL_MODES = [
  { value: 'none', label: 'Off' },
  { value: 'default', label: 'Default' },
  { value: 'choose', label: 'Choose' },
] as const;

const VOICE_HELP = 'A synthetic voice. It does not change how the customer behaves.';

function pick<T extends string>(list: readonly T[], value: string): T | undefined {
  return list.find((item) => item === value);
}

/** What the complications setting means for the current choice. */
function complicationsHelp(mode: CurveballMode, config: CallConfig): string {
  if (mode === 'none') return 'The customer does not take an unexpected turn.';
  if (mode === 'choose') {
    return 'Choose which unexpected turns the customer may take. You will not be told when.';
  }
  const count = DIFFICULTY_PROFILES[config.difficulty].defaultCurveballCount;
  const level = difficultyLabel(config.difficulty);
  return count === 0
    ? `${level} calls have no complications by default.`
    : `${level} calls may include up to ${complicationCount(count)}. You will not be told when.`;
}

interface FrameProps {
  /** Wide enough to hold a row of options. */
  full?: boolean;
  label: string;
  /** The control's own group names it, so the visible label is not read a second time. */
  decorative?: boolean;
  labelId: string;
  changed: boolean;
  help: ReactNode;
  helpOpen: boolean;
  onHelp(): void;
  children: ReactNode;
}

/** One setting: its name, a help button that opens a plain explanation, and the control. */
function Frame({
  full,
  label,
  decorative,
  labelId,
  changed,
  help,
  helpOpen,
  onHelp,
  children,
}: FrameProps) {
  const helpId = `${labelId}-help`;
  return (
    <div className={cx('scn-cf', full && 'scn-cf--full')}>
      <div className="scn-cf__head">
        <span className="scn-cf__label" id={labelId} aria-hidden={decorative || undefined}>
          {label}
        </span>
        {changed ? <span className="scn-cf__changed">Changed</span> : null}
        <IconButton
          icon="help"
          size="small"
          label={`About ${label.toLowerCase()}`}
          aria-expanded={helpOpen}
          aria-controls={helpId}
          onClick={onHelp}
        />
      </div>
      {children}
      <div className="scn-cf__help" id={helpId} hidden={!helpOpen}>
        {help}
      </div>
    </div>
  );
}

export interface CustomisePanelProps {
  scenario: PublicScenarioDTO;
  config: CallConfig;
  /** The customer voices on offer; none where the voice is not the trainee's to choose. */
  voices: readonly VoiceOption[];
  onChange(next: CallConfig): void;
  onReset(): void;
}

/**
 * Every setting that shapes the call except the preset and the practice mode (which sit above it).
 * Each starts at the scenario's own value, says in a word when it has been changed, and explains
 * itself only when asked. Nothing here reveals what the customer keeps back, or what an unexpected
 * turn is or when it comes.
 */
export function CustomisePanel({
  scenario,
  config,
  voices,
  onChange,
  onReset,
}: CustomisePanelProps) {
  const announce = useAnnouncer();
  const base = useId();
  const [choosing, setChoosing] = useState(false);
  const [helping, setHelping] = useState<ReadonlySet<ConfigKey>>(new Set());

  const changed = changedFromDefault(config, scenario);
  const isChanged = (key: ConfigKey) => changed.includes(key);
  const toggleHelp = (key: ConfigKey) =>
    setHelping((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const field = (key: ConfigKey, label: string, help: ReactNode) => ({
    label,
    labelId: `${base}-${key}`,
    changed: isChanged(key),
    help,
    helpOpen: helping.has(key),
    onHelp: () => toggleHelp(key),
  });
  const name = (label: string, key: ConfigKey) => (isChanged(key) ? `${label}, changed` : label);

  const { curveballs } = config;
  const mode: CurveballMode =
    curveballs.mode === 'choose' || (choosing && curveballs.mode === 'none')
      ? 'choose'
      : curveballs.mode;
  const offered = curveballChoices(scenario);
  const modes =
    offered.length > 0
      ? CURVEBALL_MODES
      : CURVEBALL_MODES.filter((item) => item.value !== 'choose');
  const max = maxCurveballs(config.difficulty);
  const picked = curveballs.mode === 'choose' ? curveballs.types : [];
  const atLimit = picked.length >= max;

  const changeCurveballMode = (next: CurveballMode) => {
    setChoosing(next === 'choose');
    if (next === 'default') onChange({ ...config, curveballs: { mode: 'default' } });
    else if (next === 'none') onChange({ ...config, curveballs: { mode: 'none' } });
    else if (curveballs.mode === 'default') onChange({ ...config, curveballs: { mode: 'none' } });
  };

  const toggleCurveball = (type: CurveballType, on: boolean) => {
    const types = on
      ? [...picked.filter((item) => item !== type), type]
      : picked.filter((item) => item !== type);
    const kept = fitCurveballs(types, config.difficulty, scenario).kept;
    onChange({
      ...config,
      curveballs: kept.length > 0 ? { mode: 'choose', types: kept } : { mode: 'none' },
    });
  };

  const reset = () => {
    setChoosing(false);
    onReset();
    announce('Settings reset to the scenario defaults.');
  };

  const voice = offeredVoice(voices, effectiveVoice(config, scenario.id));

  return (
    <div className="scn-custom">
      <div className="scn-custom__head">
        <Button
          size="small"
          appearance="subtle"
          icon="refresh"
          disabledFocusable={changed.length === 0}
          aria-label="Reset to scenario defaults"
          onClick={reset}
        >
          Reset
        </Button>
      </div>
      <div className="scn-custom__grid">
        <Frame
          {...field('impact', 'Impact', IMPACT_LABELS[config.impact].description)}
          decorative
          full
        >
          <SegmentedControl
            legend={name('Impact', 'impact')}
            hideLegend
            layout="segments"
            fullWidth
            options={IMPACTS.map((impact) => ({
              value: impact,
              label: IMPACT_LABELS[impact].label,
            }))}
            value={config.impact}
            onChange={(impact) => onChange({ ...config, impact })}
          />
        </Frame>

        <Frame
          {...field(
            'temperature',
            'Starting state',
            START_TEMPERATURE_LABELS[config.temperature].description,
          )}
          decorative
          full
        >
          <SegmentedControl
            className="scn-cf__states"
            legend={name('Starting state', 'temperature')}
            hideLegend
            layout="segments"
            fullWidth
            options={START_TEMPERATURES.map((temperature) => ({
              value: temperature,
              label: moodLabel(temperature),
              icon: CUSTOMER_STATE_ICONS[START_STATE[temperature]],
            }))}
            value={config.temperature}
            onChange={(temperature) => onChange({ ...config, temperature })}
          />
        </Frame>

        <Frame
          {...field(
            'proficiency',
            'Proficiency',
            PROFICIENCY_LABELS[config.proficiency].description,
          )}
          decorative
          full
        >
          <SegmentedControl
            legend={name('Proficiency', 'proficiency')}
            hideLegend
            layout="segments"
            fullWidth
            options={PROFICIENCIES.map((proficiency) => ({
              value: proficiency,
              label: PROFICIENCY_LABELS[proficiency].label,
            }))}
            value={config.proficiency}
            onChange={(proficiency) => onChange({ ...config, proficiency })}
          />
        </Frame>

        <Frame {...field('style', 'Style', STYLE_LABELS[config.style].description)}>
          <Select
            aria-labelledby={`${base}-style`}
            value={config.style}
            onChange={(event) => {
              const style = pick<CommunicationStyle>(STYLES, event.target.value);
              if (style) onChange({ ...config, style });
            }}
          >
            {STYLES.map((style) => (
              <option key={style} value={style}>
                {STYLE_LABELS[style].label}
              </option>
            ))}
          </Select>
        </Frame>

        <Frame {...field('stage', 'Call stage', CALL_STAGE_LABELS[config.stage].description)}>
          <Select
            aria-labelledby={`${base}-stage`}
            value={config.stage}
            onChange={(event) => {
              const stage = pick<CallStage>(CALL_STAGES, event.target.value);
              if (stage) onChange({ ...config, stage });
            }}
          >
            {CALL_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {CALL_STAGE_LABELS[stage].label}
              </option>
            ))}
          </Select>
        </Frame>

        {voices.length > 0 ? (
          <Frame {...field('voice', 'Customer voice', VOICE_HELP)}>
            <Select
              aria-labelledby={`${base}-voice`}
              value={voice}
              onChange={(event) => {
                const next = event.target.value;
                if (isVoiceId(next)) {
                  onChange({
                    ...config,
                    voice: next === defaultVoiceFor(scenario.id) ? null : next,
                  });
                }
              }}
            >
              {voices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </Select>
          </Frame>
        ) : null}

        <Frame
          {...field(
            'curveballs',
            'Complications',
            <>
              <p>{complicationsHelp(mode, config)}</p>
              {mode === 'choose' ? (
                <ul className="scn-cf__defs" role="list">
                  {offered.map((type) => (
                    <li key={type}>
                      <strong>{CURVEBALL_LABELS[type].label}.</strong>{' '}
                      {CURVEBALL_LABELS[type].description}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>,
          )}
          decorative
          full
        >
          <SegmentedControl<CurveballMode>
            legend={name('Complications', 'curveballs')}
            hideLegend
            layout="segments"
            fullWidth
            options={modes}
            value={mode}
            onChange={changeCurveballMode}
          />
          {mode === 'choose' ? (
            <fieldset className="scn-picks">
              <legend className="scn-picks__legend">
                {picked.length} of {max} chosen
                {atLimit ? '. Untick one to choose another.' : ''}
              </legend>
              <div className="scn-picks__grid">
                {offered.map((type) => {
                  const checked = picked.includes(type);
                  return (
                    <Checkbox
                      key={type}
                      label={CURVEBALL_LABELS[type].label}
                      checked={checked}
                      disabled={!checked && atLimit}
                      onChange={(event) => toggleCurveball(type, event.target.checked)}
                    />
                  );
                })}
              </div>
            </fieldset>
          ) : null}
        </Frame>
      </div>
    </div>
  );
}
