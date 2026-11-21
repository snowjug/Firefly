import { useId, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGE_LABELS,
  CURVEBALL_LABELS,
  DIFFICULTIES,
  PROFICIENCY_LABELS,
  STYLE_LABELS,
  type CurveballType,
  type Difficulty,
} from '#shared/domain/vocab.ts';
import { Icon } from '../../design/icons.tsx';
import { IconButton, LinkButton } from '../../design/primitives/Button.tsx';
import { Disclosure } from '../../design/primitives/Disclosure.tsx';
import { useAnnouncer } from '../../design/primitives/LiveRegion.tsx';
import { SegmentedControl } from '../../design/primitives/SegmentedControl.tsx';
import { Skeleton } from '../../design/primitives/Skeleton.tsx';
import {
  changedFromDefault,
  hintsOn,
  maxCurveballs,
  withDifficulty,
  type CallConfig,
} from './config-params.ts';
import { customerPreview } from './customer-preview.ts';
import { CustomerPreview } from './CustomerPreview.tsx';
import { CustomisePanel } from './CustomisePanel.tsx';
import {
  complicationCount,
  difficultyLabel,
  impactLabel,
  minutesLabel,
  moodLabel,
  productLine,
} from './labels.ts';
import './pane.css';
import type { VoiceOption } from './voice-choice.ts';

export interface ScenarioPaneProps {
  scenario: PublicScenarioDTO;
  config: CallConfig;
  /** The customer voices on offer, for the voice setting. */
  voices: readonly VoiceOption[];
  onChange(next: CallConfig): void;
  onReset(): void;
  customiseOpen: boolean;
  onCustomiseOpenChange(open: boolean): void;
  /** Where "Review brief" goes: the case brief with this configuration. */
  briefTo: string;
  /** The title, which takes focus when the details open on a narrow screen. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** The title is the page's heading when the details have the page to themselves (narrow screens). */
  titleLevel?: 1 | 2;
}

/**
 * The chosen scenario: who and what, the customer as the call will start, a preset for how hard it
 * is, the rest of the setup behind "Customise", and the way on. The details fade in when another
 * scenario is chosen; the setup and the preview move when a setting changes.
 */
export function ScenarioPane({
  scenario,
  config,
  voices,
  onChange,
  onReset,
  customiseOpen,
  onCustomiseOpenChange,
  briefTo,
  headingRef,
  titleLevel = 2,
}: ScenarioPaneProps) {
  const Title = titleLevel === 1 ? 'h1' : 'h2';
  // The sections under the title are one level below it.
  const sectionLevel = titleLevel === 1 ? 2 : 3;
  const Section = sectionLevel === 2 ? 'h2' : 'h3';
  const announce = useAnnouncer();
  const titleId = useId();
  const presetHelpId = useId();
  const scroll = useRef<HTMLDivElement>(null);
  const [trimNote, setTrimNote] = useState<string | null>(null);
  const [presetHelp, setPresetHelp] = useState(false);

  // Another scenario starts at the top.
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [scenario.id]);

  const changePreset = (difficulty: Difficulty) => {
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

  const changed = changedFromDefault(config, scenario).filter((key) => key !== 'difficulty');
  const preview = customerPreview(config);
  const impactText = scenario.publicBrief?.impact?.[config.impact];

  return (
    <section className="scn-pane" aria-labelledby={titleId}>
      <div className="scn-pane__scroll" ref={scroll}>
        <div className="scn-fade" key={scenario.id}>
          <header className="scn-pane__head">
            <p className="scn-pane__product">{productLine(scenario.product)}</p>
            <Title className="scn-pane__title" id={titleId} tabIndex={-1} ref={headingRef}>
              {scenario.title}
            </Title>
          </header>
          <p className="scn-pane__summary">{scenario.summary}</p>

          <dl className="scn-facts">
            <div className="scn-fact scn-fact--wide">
              <dt>Impact</dt>
              <dd>
                <span className="scn-swap" key={config.impact}>
                  <strong>{impactLabel(config.impact)}</strong>
                  {impactText ? <> &middot; {impactText}</> : null}
                </span>
              </dd>
            </div>
            <div className="scn-fact">
              <dt>Call stage</dt>
              <dd>
                <span className="scn-swap" key={config.stage}>
                  {CALL_STAGE_LABELS[config.stage].label}
                </span>
              </dd>
            </div>
            <div className="scn-fact">
              <dt>Style</dt>
              <dd>
                <span className="scn-swap" key={`${config.style}-${config.proficiency}`}>
                  {STYLE_LABELS[config.style].label},{' '}
                  {PROFICIENCY_LABELS[config.proficiency].label.toLowerCase()} user
                </span>
              </dd>
            </div>
            <div className="scn-fact">
              <dt>Duration</dt>
              <dd>{minutesLabel(scenario.estimatedMinutes)}</dd>
            </div>
          </dl>

          <div className="scn-block">
            <Section className="scn-block__title">Starting state</Section>
            <CustomerPreview persona={scenario.persona} preview={preview} />
          </div>

          <div className="scn-block">
            <div className="scn-preset">
              <SegmentedControl
                className="scn-preset__control"
                legend="Preset"
                layout="segments"
                fullWidth
                options={DIFFICULTIES.map((difficulty) => ({
                  value: difficulty,
                  label: difficultyLabel(difficulty),
                }))}
                value={config.difficulty}
                onChange={changePreset}
              />
              <IconButton
                icon="help"
                size="small"
                label="About presets"
                className="scn-preset__help"
                aria-expanded={presetHelp}
                aria-controls={presetHelpId}
                onClick={() => setPresetHelp((open) => !open)}
              />
            </div>
            <p className="scn-note" id={presetHelpId} hidden={!presetHelp}>
              {DIFFICULTY_PROFILES[config.difficulty].summary}
            </p>
            {trimNote ? <p className="scn-note">{trimNote}</p> : null}
          </div>

          <Disclosure
            summary="Customise"
            icon="sliders"
            headingLevel={sectionLevel}
            meta={changed.length > 0 ? `${changed.length} changed` : undefined}
            open={customiseOpen}
            onOpenChange={onCustomiseOpenChange}
            className="scn-pane__custom"
          >
            <CustomisePanel
              scenario={scenario}
              config={config}
              voices={voices}
              onChange={onChange}
              onReset={onReset}
            />
          </Disclosure>
        </div>
      </div>
      <div className="scn-pane__bar">
        <p className="scn-pane__summary-line">
          <span
            className="scn-swap"
            key={`${config.difficulty}-${config.impact}-${config.temperature}`}
          >
            {difficultyLabel(config.difficulty)} &middot; {impactLabel(config.impact)} impact
            &middot; {moodLabel(config.temperature)}
          </span>
        </p>
        <LinkButton to={briefTo} appearance="primary" icon="arrow-right" iconPosition="end">
          Review brief
        </LinkButton>
      </div>
    </section>
  );
}

/** The details' shape while the scenarios load. */
export function PaneSkeleton() {
  return (
    <div className="scn-pane scn-pane--quiet" aria-hidden="true">
      <div className="scn-pane__scroll">
        <Skeleton width="30%" />
        <Skeleton width="70%" height="1.75rem" />
        <Skeleton lines={3} />
        <Skeleton variant="rect" height="5rem" />
        <Skeleton variant="rect" height="2.75rem" />
      </div>
    </div>
  );
}

/** What the details say when nothing is chosen (every scenario is filtered out). */
export function PaneEmpty() {
  return (
    <section className="scn-pane scn-pane--quiet scn-pane--empty" aria-label="Selected scenario">
      <Icon name="document" size={28} />
      <p className="scn-pane__empty-title">No scenario selected</p>
    </section>
  );
}
