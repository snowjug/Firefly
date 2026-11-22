import { useId, useState, type ReactNode } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { formatEstimate } from '#shared/domain/duration.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CURVEBALL_LABELS,
  DIFFICULTIES,
  DIMENSIONS,
  PRACTICE_MODE_LABELS,
  type CurveballType,
  type Difficulty,
  type PracticeMode,
} from '#shared/domain/vocab.ts';
import { cx } from '../../design/cx.ts';
import { Icon } from '../../design/icons.tsx';
import { accentClass } from '../../design/product-accent.ts';
import { StateBadge, Tag } from '../../design/primitives/Badge.tsx';
import { IconButton, LinkButton } from '../../design/primitives/Button.tsx';
import { Disclosure } from '../../design/primitives/Disclosure.tsx';
import { useAnnouncer } from '../../design/primitives/LiveRegion.tsx';
import { ProductIcon } from '../../design/primitives/ProductIcon.tsx';
import { SegmentedControl } from '../../design/primitives/SegmentedControl.tsx';
import { Skeleton } from '../../design/primitives/Skeleton.tsx';
import { useMediaQuery } from '../../lib/hooks.ts';
import {
  changedFromDefault,
  hintsDefault,
  hintsOn,
  maxCurveballs,
  withDifficulty,
  type CallConfig,
} from './config-params.ts';
import {
  customerPreview,
  LEVEL_LABELS,
  LEVEL_STEPS,
  type Level as Rating,
} from './customer-preview.ts';
import { CustomisePanel } from './CustomisePanel.tsx';
import {
  STAGE_SHORT,
  complicationCount,
  difficultyLabel,
  impactLabel,
  moodLabel,
  productLine,
} from './labels.ts';
import { Level } from './Level.tsx';
import './detail.css';
import './setup.css';
import { useTileTransition } from './view-transition.ts';
import type { VoiceOption } from './voice-choice.ts';

export interface ScenarioDetailProps {
  scenario: PublicScenarioDTO;
  config: CallConfig;
  /** The customer voices on offer, for the voice setting. */
  voices: readonly VoiceOption[];
  onChange(next: CallConfig): void;
  onReset(): void;
  customiseOpen: boolean;
  onCustomiseOpenChange(open: boolean): void;
  /** Where "Start configuration" goes: the case brief with this configuration. */
  briefTo: string;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
/** Under 360 px the recap beside the way on does not fit: it is left out of sight, not out of reach. */
const NARROWEST = '(max-width: 22.49em)';

/** Guided practice first: it is the one that adds something. */
const MODES: readonly PracticeMode[] = ['guided', 'immersive'];

function Fact({
  term,
  wide,
  children,
}: {
  term: string;
  /** Spans the whole row. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cx('scn-fact', wide && 'scn-fact--wide')}>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Meter({ label, level }: { label: string; level: Rating }) {
  return (
    <div className="scn-meter">
      <dt className="scn-meter__label">{label}</dt>
      <dd className="scn-meter__value">
        <span className="scn-meter__bars" data-steps={LEVEL_STEPS[level]} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="scn-swap" key={level}>
          {LEVEL_LABELS[level]}
        </span>
      </dd>
    </div>
  );
}

/**
 * The chosen scenario, below the carousel. On the left, what it is: the issue, the impact, the
 * customer and how they start, the call stage, the difficulty, how long it takes and what it
 * practises. On the right, how to run it: the preset, the practice mode, the rest of the setup
 * behind "Customise", and the way on. The values that a setting changes fade in, so a change is seen
 * rather than jumped to. Below 64em everything stacks; the way on is pinned to the bottom of the
 * screen, across the page below 64em and in the right-hand column from 64em. Nothing here says what
 * the customer keeps back.
 */
export function ScenarioDetail({
  scenario,
  config,
  voices,
  onChange,
  onReset,
  customiseOpen,
  onCustomiseOpenChange,
  briefTo,
}: ScenarioDetailProps) {
  const announce = useAnnouncer();
  const titleId = useId();
  const presetHelpId = useId();
  const [trimNote, setTrimNote] = useState<string | null>(null);
  const [presetHelp, setPresetHelp] = useState(false);
  // A view transition between this page and the brief only where the person allows motion.
  const reduced = useMediaQuery(REDUCED_MOTION);
  const slim = useMediaQuery(NARROWEST);
  const tile = useTileTransition(briefTo);

  const mode: PracticeMode = hintsOn(config) ? 'guided' : 'immersive';

  const changePreset = (difficulty: Difficulty) => {
    const modeBefore = hintsOn(config);
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
    if (hintsOn(next) !== modeBefore) {
      announce(
        `Practice mode is now ${PRACTICE_MODE_LABELS[hintsOn(next) ? 'guided' : 'immersive'].label}.`,
      );
    }
  };

  const changeMode = (next: PracticeMode) => {
    const on = next === 'guided';
    onChange({ ...config, hints: on === hintsDefault(config.difficulty) ? null : on });
  };

  const changed = changedFromDefault(config, scenario).filter(
    (key) => key !== 'difficulty' && key !== 'hints',
  );
  const preview = customerPreview(config);
  const impactText = scenario.publicBrief.impact[config.impact];
  const { persona } = scenario;

  return (
    <section className="scn-detail" aria-labelledby={titleId}>
      <div className="scn-detail__main" key={scenario.id}>
        <header className="scn-detail__head">
          <span
            className={cx('scn-detail__tile', accentClass(scenario.product.id))}
            style={tile}
            aria-hidden="true"
          >
            <ProductIcon product={scenario.product.id} size={24} />
          </span>
          <div className="scn-detail__heading">
            <p className="scn-detail__product">{productLine(scenario.product)}</p>
            <h2 className="scn-detail__title" id={titleId}>
              {scenario.title}
            </h2>
          </div>
        </header>

        <dl className="scn-facts">
          <Fact term="Issue" wide>
            {scenario.publicBrief.issue}
          </Fact>
          <Fact term="Business impact" wide>
            <span className="scn-swap" key={config.impact}>
              <strong>{impactLabel(config.impact)}</strong>
              {impactText ? <> &middot; {impactText}</> : null}
            </span>
          </Fact>
          <Fact term="Customer">
            <strong>{persona.name}</strong>
            <span className="scn-sub">
              {persona.role}, {persona.organisation}
            </span>
            <span className="scn-note-line">
              <Icon name="person" size={14} />
              Synthetic customer
            </span>
          </Fact>
          <Fact term="Customer state">
            <span className="scn-swap" key={preview.mood}>
              <StateBadge state={preview.state} label={preview.mood} />
            </span>
            <dl className="scn-meters">
              <Meter label="Patience" level={preview.patience} />
              <Meter label="Trust" level={preview.trust} />
            </dl>
          </Fact>
          <Fact term="Call stage">
            <span className="scn-swap" key={config.stage}>
              {STAGE_SHORT[config.stage]}
            </span>
          </Fact>
          <Fact term="Difficulty">
            <span className="scn-swap" key={config.difficulty}>
              <Level difficulty={config.difficulty} />
            </span>
          </Fact>
          <Fact term="Estimated duration">
            <span className="scn-time">
              <Icon name="clock" size={14} />
              {formatEstimate(scenario.estimatedMinutes)}
            </span>
          </Fact>
          <Fact term="Coaching focus" wide>
            <ul className="scn-focus" role="list">
              {scenario.coachingFocus.map((id) => (
                <li key={id}>
                  <Tag size="small">{DIMENSIONS[id].label}</Tag>
                </li>
              ))}
            </ul>
          </Fact>
        </dl>
      </div>

      <div className="scn-detail__side">
        <div className="scn-setup" key={scenario.id}>
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

          <SegmentedControl<PracticeMode>
            className="scn-mode"
            legend="Practice mode"
            layout="cards"
            options={MODES.map((value) => ({
              value,
              label: PRACTICE_MODE_LABELS[value].label,
              description: PRACTICE_MODE_LABELS[value].description,
            }))}
            value={mode}
            onChange={changeMode}
          />

          <Disclosure
            summary="Customise"
            icon="sliders"
            headingLevel={3}
            meta={changed.length > 0 ? `${changed.length} changed` : undefined}
            open={customiseOpen}
            onOpenChange={onCustomiseOpenChange}
            className="scn-detail__custom"
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

        <div className="scn-detail__bar">
          <p className={cx('scn-detail__summary-line', slim && 'visually-hidden')}>
            <span
              className="scn-swap"
              key={`${config.difficulty}-${config.impact}-${config.temperature}-${mode}`}
            >
              {difficultyLabel(config.difficulty)} &middot; {impactLabel(config.impact)} impact
              &middot; {moodLabel(config.temperature)} &middot; {PRACTICE_MODE_LABELS[mode].label}
            </span>
          </p>
          <LinkButton
            to={briefTo}
            appearance="primary"
            icon="arrow-right"
            iconPosition="end"
            nudge
            viewTransition={!reduced}
          >
            Start configuration
          </LinkButton>
        </div>
      </div>
    </section>
  );
}

/** The details' shape while the scenarios load. */
export function DetailSkeleton() {
  return (
    <div className="scn-detail scn-detail--quiet" aria-hidden="true">
      <div className="scn-detail__main">
        <div className="scn-detail__head">
          <Skeleton variant="rect" width="3rem" height="3rem" />
          <div className="scn-detail__heading">
            <Skeleton width="30%" />
            <Skeleton width="70%" height="1.75rem" />
          </div>
        </div>
        <Skeleton lines={3} />
        <Skeleton variant="rect" height="5rem" />
      </div>
    </div>
  );
}

/** What the details say when nothing is chosen (every scenario is filtered out). */
export function DetailEmpty() {
  return (
    <section
      className="scn-detail scn-detail--quiet scn-detail--empty"
      aria-label="Selected scenario"
    >
      <Icon name="document" size={28} />
      <p className="scn-detail__empty-title">No scenario selected</p>
    </section>
  );
}
