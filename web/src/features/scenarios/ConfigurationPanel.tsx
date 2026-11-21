import { useId, useRef, useState } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGES,
  CALL_STAGE_LABELS,
  CURVEBALL_LABELS,
  DIFFICULTIES,
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
import {
  Badge,
  Button,
  Checkbox,
  CUSTOMER_STATE_ICONS,
  Field,
  SegmentedControl,
  Select,
  Switch,
  useAnnouncer,
} from '../../design/index.ts';
import {
  changedFromDefault,
  fitCurveballs,
  hintsDefault,
  hintsOn,
  maxCurveballs,
  summarise,
  withDifficulty,
  type CallConfig,
  type ConfigKey,
} from './config-params.ts';
import { START_STATE, complicationCount, curveballChoices, difficultyLabel } from './labels.ts';
import './configuration.css';

type CurveballMode = 'none' | 'default' | 'choose';

const CURVEBALL_MODE_OPTIONS = [
  { value: 'none', label: 'Off' },
  { value: 'default', label: 'Default for this difficulty' },
  { value: 'choose', label: 'Choose' },
] as const;

const HINTS_DESCRIPTION =
  "Shows light cues during the call: the customer's mood trend and how much context you have found. Off for a realistic call.";

function pick<T extends string>(list: readonly T[], value: string): T | undefined {
  return list.find((item) => item === value);
}

/** A control's name, with "Changed from default" beside it in words when it is not at the scenario's setting. */
function Name({ children, changed }: { children: string; changed: boolean }) {
  return (
    <>
      {children}
      {changed ? (
        <Badge size="small" tone="neutral" icon={null} className="scn-changed">
          Changed from default
        </Badge>
      ) : null}
    </>
  );
}

/** One sentence of what a choice means, under the control it describes. */
function difficultyHint(difficulty: CallConfig['difficulty']): string {
  return DIFFICULTY_PROFILES[difficulty].summary;
}

function curveballHint(mode: CurveballMode, difficulty: CallConfig['difficulty']): string {
  if (mode === 'none') return 'The customer does not take an unexpected turn.';
  if (mode === 'choose') {
    return 'Choose which unexpected turns the customer may take. You will not be told when.';
  }
  const count = DIFFICULTY_PROFILES[difficulty].defaultCurveballCount;
  return count === 0
    ? `${difficultyLabel(difficulty)} calls have no complications by default.`
    : `${difficultyLabel(difficulty)} calls may include up to ${complicationCount(count)}. You will not be told when.`;
}

export interface ConfigurationPanelProps {
  scenario: PublicScenarioDTO;
  config: CallConfig;
  onChange(next: CallConfig): void;
  onReset(): void;
}

/**
 * Every setting that shapes the call, each starting at the scenario's own value. Each control
 * says in a sentence what the current choice means, marks itself in words when it has been changed,
 * and the preview at the end says what the call will be like. Nothing here reveals what the
 * customer keeps back, or what an unexpected turn is or when it comes.
 */
export function ConfigurationPanel({
  scenario,
  config,
  onChange,
  onReset,
}: ConfigurationPanelProps) {
  const announce = useAnnouncer();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [choosing, setChoosing] = useState(false);
  const [trimNote, setTrimNote] = useState<string | null>(null);

  const changed = changedFromDefault(config, scenario);
  const isChanged = (key: ConfigKey) => changed.includes(key);

  const { curveballs } = config;
  const mode: CurveballMode =
    curveballs.mode === 'choose' || (choosing && curveballs.mode === 'none')
      ? 'choose'
      : curveballs.mode;
  const offered = curveballChoices(scenario);
  const modes =
    offered.length > 0
      ? CURVEBALL_MODE_OPTIONS
      : CURVEBALL_MODE_OPTIONS.filter((option) => option.value !== 'choose');
  const max = maxCurveballs(config.difficulty);
  const picked = curveballs.mode === 'choose' ? curveballs.types : [];
  const atLimit = picked.length >= max;

  const changeDifficulty = (difficulty: CallConfig['difficulty']) => {
    const hintsBefore = hintsOn(config);
    const { config: next, dropped } = withDifficulty(config, difficulty, scenario);
    onChange(next);
    if (dropped.length > 0) {
      const kept = next.curveballs.mode === 'choose' ? next.curveballs.types : [];
      const quoted = (types: readonly CurveballType[]) =>
        types.map((type) => `\u201C${CURVEBALL_LABELS[type].label}\u201D`).join(', ');
      const note = `${difficultyLabel(difficulty)} allows ${complicationCount(maxCurveballs(difficulty))}. Removed: ${quoted(dropped)}. Kept: ${quoted(kept)}.`;
      setTrimNote(note);
      announce(note);
    } else {
      setTrimNote(null);
    }
    if (hintsOn(next) !== hintsBefore) {
      announce(`Live hints are now ${hintsOn(next) ? 'on' : 'off'}.`);
    }
  };

  const changeCurveballMode = (next: CurveballMode) => {
    setTrimNote(null);
    setChoosing(next === 'choose');
    if (next === 'default') onChange({ ...config, curveballs: { mode: 'default' } });
    else if (next === 'none') onChange({ ...config, curveballs: { mode: 'none' } });
    else if (curveballs.mode === 'default') onChange({ ...config, curveballs: { mode: 'none' } });
  };

  const toggleCurveball = (type: CurveballType, on: boolean) => {
    setTrimNote(null);
    const types = on
      ? [...picked.filter((t) => t !== type), type]
      : picked.filter((t) => t !== type);
    const kept = fitCurveballs(types, config.difficulty, scenario).kept;
    onChange({
      ...config,
      curveballs: kept.length > 0 ? { mode: 'choose', types: kept } : { mode: 'none' },
    });
  };

  const reset = () => {
    setChoosing(false);
    setTrimNote(null);
    onReset();
    announce('Settings reset to the scenario defaults.');
    heading.current?.focus();
  };

  const limitText = `${picked.length} of ${max} chosen.${
    atLimit
      ? ` You have reached the limit for ${difficultyLabel(config.difficulty)}: untick one to choose another.`
      : ''
  }`;

  return (
    <div className="scn-config">
      <div className="scn-config__head">
        <div className="scn-config__intro">
          <h3 className="scn-config__title" id={headingId} tabIndex={-1} ref={heading}>
            Call setup
          </h3>
          <p className="scn-config__lead">
            Every setting starts as the scenario was written. Change what you want to practise.
          </p>
        </div>
        {changed.length > 0 ? (
          <Button size="small" appearance="outline" icon="refresh" onClick={reset}>
            Reset to scenario defaults
          </Button>
        ) : null}
      </div>

      <div className="scn-config__grid">
        <div className="scn-cfg scn-cfg--full">
          <SegmentedControl
            className="scn-seg"
            legend={<Name changed={isChanged('difficulty')}>Difficulty</Name>}
            hint={difficultyHint(config.difficulty)}
            layout="segments"
            fullWidth
            options={DIFFICULTIES.map((difficulty) => ({
              value: difficulty,
              label: DIFFICULTY_PROFILES[difficulty].label,
            }))}
            value={config.difficulty}
            onChange={changeDifficulty}
          />
        </div>

        <div className="scn-cfg">
          <SegmentedControl
            className="scn-seg"
            legend={<Name changed={isChanged('impact')}>Business impact</Name>}
            hint={IMPACT_LABELS[config.impact].description}
            layout="segments"
            fullWidth
            options={IMPACTS.map((impact) => ({
              value: impact,
              label: IMPACT_LABELS[impact].label,
            }))}
            value={config.impact}
            onChange={(impact) => onChange({ ...config, impact })}
          />
        </div>

        <div className="scn-cfg">
          <Field
            className="scn-field"
            label={<Name changed={isChanged('stage')}>Call stage</Name>}
            hint={CALL_STAGE_LABELS[config.stage].description}
          >
            <Select
              className="scn-select"
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
          </Field>
        </div>

        <div className="scn-cfg scn-cfg--full">
          <SegmentedControl
            className="scn-seg scn-seg--mood"
            legend={<Name changed={isChanged('temperature')}>Customer starting temperature</Name>}
            hint={START_TEMPERATURE_LABELS[config.temperature].description}
            layout="segments"
            fullWidth
            options={START_TEMPERATURES.map((temperature) => ({
              value: temperature,
              label: START_TEMPERATURE_LABELS[temperature].label,
              icon: CUSTOMER_STATE_ICONS[START_STATE[temperature]],
            }))}
            value={config.temperature}
            onChange={(temperature) => onChange({ ...config, temperature })}
          />
        </div>

        <div className="scn-cfg">
          <SegmentedControl
            className="scn-seg"
            legend={<Name changed={isChanged('proficiency')}>Technical proficiency</Name>}
            hint={PROFICIENCY_LABELS[config.proficiency].description}
            layout="segments"
            fullWidth
            options={PROFICIENCIES.map((proficiency) => ({
              value: proficiency,
              label: PROFICIENCY_LABELS[proficiency].label,
            }))}
            value={config.proficiency}
            onChange={(proficiency) => onChange({ ...config, proficiency })}
          />
        </div>

        <div className="scn-cfg">
          <Field
            className="scn-field"
            label={<Name changed={isChanged('style')}>Communication style</Name>}
            hint={STYLE_LABELS[config.style].description}
          >
            <Select
              className="scn-select"
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
          </Field>
        </div>

        <div className="scn-cfg scn-cfg--full">
          <SegmentedControl<CurveballMode>
            className="scn-seg scn-seg--modes"
            legend={<Name changed={isChanged('curveballs')}>Curveballs</Name>}
            hint={curveballHint(mode, config.difficulty)}
            layout="segments"
            fullWidth
            options={modes}
            value={mode}
            onChange={changeCurveballMode}
          />
          {mode === 'choose' ? (
            <fieldset className="scn-picks">
              <legend className="scn-picks__legend">
                Choose up to {max} {max === 1 ? 'complication' : 'complications'}
              </legend>
              <p className="scn-picks__status" role="status">
                {limitText}
              </p>
              <div className="scn-picks__grid">
                {offered.map((type) => {
                  const checked = picked.includes(type);
                  return (
                    <Checkbox
                      key={type}
                      label={CURVEBALL_LABELS[type].label}
                      description={CURVEBALL_LABELS[type].description}
                      checked={checked}
                      disabled={!checked && atLimit}
                      onChange={(event) => toggleCurveball(type, event.target.checked)}
                    />
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          {trimNote ? (
            <p className="scn-note" role="status">
              {trimNote}
            </p>
          ) : null}
        </div>

        <div className="scn-cfg scn-cfg--full">
          <Switch
            label={<Name changed={isChanged('hints')}>Live hints during the call</Name>}
            description={`${HINTS_DESCRIPTION} On by default for ${DIFFICULTIES.filter(hintsDefault)
              .map(difficultyLabel)
              .join(' and ')}.`}
            checked={hintsOn(config)}
            onChange={(event) =>
              onChange({
                ...config,
                hints:
                  event.target.checked === hintsDefault(config.difficulty)
                    ? null
                    : event.target.checked,
              })
            }
          />
        </div>
      </div>

      <CallPreview scenario={scenario} config={config} />
    </div>
  );
}

/** The call in plain sentences. It changes as the controls change. */
export function CallPreview({
  scenario,
  config,
}: {
  scenario: PublicScenarioDTO;
  config: CallConfig;
}) {
  return (
    <div className="scn-preview">
      <h4 className="scn-preview__title">Call preview</h4>
      <div className="scn-preview__text">
        {summarise(config, scenario).map((sentence) => (
          <p key={sentence}>{sentence}</p>
        ))}
      </div>
    </div>
  );
}
