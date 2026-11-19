import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import type { MissionRecommendation, ScenarioPractice } from '#shared/domain/recommend.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { setupPath } from '../scenario/paths.ts';
import { ScenarioChips } from '../scenario/ScenarioChips.tsx';
import { temperatureBandFor } from '../scenario/setup-model.ts';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  layoutMissionMap,
  nextMissionId,
  type MapKey,
} from './map-layout.ts';
import { practiceBrief, practiceText } from './practice-text.ts';

const MAP_KEYS: readonly string[] = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
];

interface MissionMapProps {
  /** Every scenario, so positions never change when the filters do. */
  scenarios: readonly PublicScenarioDTO[];
  /** The scenarios that pass the current search and filters. */
  matchIds: ReadonlySet<string>;
  practice: ReadonlyMap<string, ScenarioPractice>;
  recommendation: MissionRecommendation | null;
  onPreview(scenario: PublicScenarioDTO): void;
}

/**
 * The missions as a map: three difficulty territories along one winding path. Each mission is a
 * button (arrow keys move between them, Enter or Space selects), and the details of the selected
 * one sit beside the map with the same Preview and Set up call actions as the list.
 */
export function MissionMap({
  scenarios,
  matchIds,
  practice,
  recommendation,
  onPreview,
}: MissionMapProps) {
  const layout = useMemo(() => layoutMissionMap(scenarios), [scenarios]);
  const byId = useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios]);
  const [picked, setPicked] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const helpId = useId();
  const titleId = useId();

  const recommendedId = recommendation?.scenario.id ?? null;
  const firstMatch = layout.nodes.find((n) => matchIds.has(n.id))?.id ?? null;
  const current =
    picked && matchIds.has(picked)
      ? picked
      : recommendedId && matchIds.has(recommendedId)
        ? recommendedId
        : firstMatch;
  const tabStop = focused && matchIds.has(focused) ? focused : current;
  const selected = current ? byId.get(current) : undefined;
  const isRecommended = selected !== undefined && selected.id === recommendedId;

  const select = useCallback((id: string) => {
    setPicked(id);
    setFocused(id);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!MAP_KEYS.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    const id = (event.target as HTMLElement).closest<HTMLElement>('[data-mission]')?.dataset
      .mission;
    if (!id) return;
    const next = nextMissionId(layout.nodes, id, event.key as MapKey, matchIds);
    event.preventDefault();
    if (next) {
      setFocused(next);
      buttons.current.get(next)?.focus();
    }
  };

  const practised = (id: string) => practice.get(id)?.state === 'practised';

  return (
    <section className="mm" aria-label="Mission map">
      <div className="mm-board-wrap">
        <p id={helpId} className="sr-only">
          Missions are grouped by difficulty. Use the arrow keys to move between them, and Enter or
          Space to select one.
        </p>
        <div
          className="mm-board"
          role="toolbar"
          aria-label="Missions"
          aria-describedby={helpId}
          onKeyDown={onKeyDown}
          style={{
            aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}`,
            ['--rows' as string]: layout.rows.length,
          }}
        >
          {layout.rows.map((row) => (
            <div
              key={row.difficulty}
              className="mm-band"
              data-difficulty={row.difficulty}
              style={{ top: `${row.bandPct}%` }}
            >
              <span className="mm-band-label">{DIFFICULTY_PROFILES[row.difficulty].label}</span>
            </div>
          ))}
          <svg
            className="mm-links"
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            aria-hidden="true"
            focusable="false"
          >
            {layout.links.map((link, index) => (
              <path
                key={`${link.from}-${link.to}`}
                className="mm-link"
                d={link.d}
                pathLength={1}
                data-lit={practised(link.to)}
                style={{ ['--i' as string]: index }}
              />
            ))}
          </svg>
          {layout.nodes.map((node, index) => {
            const scenario = byId.get(node.id);
            if (!scenario) return null;
            const match = matchIds.has(node.id);
            const state = practice.get(node.id)?.state ?? 'new';
            const isCurrent = node.id === current;
            const recommended = node.id === recommendedId;
            return (
              <div
                key={node.id}
                className="mm-slot"
                style={{ left: `${node.xPct}%`, top: `${node.yPct}%` }}
              >
                <button
                  type="button"
                  className="mm-node"
                  data-mission={node.id}
                  data-state={state}
                  data-band={temperatureBandFor(scenario.startingTemperature)}
                  data-impact={scenario.impact}
                  data-selected={isCurrent || undefined}
                  data-recommended={recommended || undefined}
                  data-match={match}
                  aria-pressed={isCurrent}
                  inert={!match}
                  tabIndex={node.id === tabStop ? 0 : -1}
                  style={{ ['--i' as string]: index }}
                  ref={(element) => {
                    if (element) buttons.current.set(node.id, element);
                    else buttons.current.delete(node.id);
                  }}
                  onClick={() => select(node.id)}
                  onFocus={() => setFocused(node.id)}
                >
                  <span className="mm-orb" aria-hidden="true">
                    <span className="mm-orb-core" />
                  </span>
                  {recommended ? <span className="mm-badge">Recommended</span> : null}
                  <span className="mm-name">{scenario.title}</span>
                  <span className="mm-meta">
                    {practiceBrief(practice.get(node.id))} · {scenario.estimatedMinutes} min
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <p className="sr-only" role="status">
          {selected
            ? `Selected: ${selected.title}. ${DIFFICULTY_PROFILES[selected.difficulty].label}. ${practiceText(practice.get(selected.id))}.`
            : ''}
        </p>
      </div>

      {selected ? (
        <article className="mm-panel" aria-labelledby={titleId}>
          {isRecommended ? (
            <p className="mm-rec">
              <Icon name="spark" size={14} /> Recommended next mission
            </p>
          ) : null}
          {selected.spotlight ? (
            <p className="mm-rec">
              <Icon name="spark" size={14} /> Demo spotlight
            </p>
          ) : null}
          <h2 id={titleId} className="mm-panel-title">
            {selected.title}
          </h2>
          <div className="cluster">
            <DifficultyChip difficulty={selected.difficulty} />
            <span className="chip">About {selected.estimatedMinutes} min</span>
            <span className="chip" data-practice={practice.get(selected.id)?.state ?? 'new'}>
              {practiceText(practice.get(selected.id))}
            </span>
          </div>
          <p className="mm-persona">
            <strong>{selected.persona.name}</strong>, {selected.persona.role},{' '}
            {selected.persona.organisation}
          </p>
          <p className="mm-summary">{selected.summary}</p>
          {isRecommended && recommendation ? (
            <p className="mm-reason">{recommendation.reason}</p>
          ) : null}
          <ScenarioChips scenario={selected} />
          <p className="scn-focus">
            <span className="scn-focus-label">Coaching focus</span>{' '}
            {selected.coachingFocus.map((id) => DIMENSIONS[id].short).join(' \u00b7 ')}
          </p>
          <div className="mm-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onPreview(selected)}
              aria-label={`Preview ${selected.title}`}
            >
              Preview
            </button>
            <Link
              to={setupPath(selected.id)}
              className="btn btn-primary"
              viewTransition
              aria-label={`Set up call: ${selected.title}`}
            >
              Set up call <Icon name="arrow-right" size={18} />
            </Link>
          </div>
        </article>
      ) : null}
    </section>
  );
}
