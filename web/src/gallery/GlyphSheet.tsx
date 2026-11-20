import { CALL_STAGES, DIFFICULTIES, IMPACTS, START_TEMPERATURES } from '#shared/domain/vocab.ts';
import { useEffect, useState } from 'react';
import { buildAtlas, type AtlasMission } from '../components/atlas/atlas-model.ts';
import { SignalGlyph } from '../components/signal/SignalGlyph.tsx';
import { describeGlyph } from '../components/signal/describe.ts';
import type { GlyphStatus, GlyphTraits } from '../components/signal/types.ts';
import { api } from '../lib/api.ts';

const STATUSES: GlyphStatus[] = ['new', 'attempted', 'completed'];
const MINUTES = [5, 8, 10, 12, 15, 7];

/** Twenty-four glyphs that between them show every value of every channel at least twice. */
export const REPRESENTATIVE: GlyphTraits[] = Array.from({ length: 24 }, (_, i) => ({
  difficulty: DIFFICULTIES[i % 3] ?? 'standard',
  impact: IMPACTS[(i + Math.floor(i / 3)) % 3] ?? 'medium',
  start: START_TEMPERATURES[i % 4] ?? 'calm',
  stage: CALL_STAGES[Math.floor(i / 2) % 4] ?? 'first-contact',
  status: STATUSES[(i + Math.floor(i / 4)) % 3] ?? 'new',
  minutes: MINUTES[i % 6] ?? 10,
  recommended: i === 5,
}));

const SIZES = [28, 48, 92, 140];

function useMissions(): AtlasMission[] | 'error' | null {
  const [state, setState] = useState<AtlasMission[] | 'error' | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api
      .scenarios(controller.signal)
      .then((scenarios) => {
        const first = scenarios[0]?.id ?? null;
        setState(buildAtlas(scenarios, [], first).missions);
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, []);
  return state;
}

export function GlyphSheet() {
  const missions = useMissions();
  return (
    <section id="glyph" aria-labelledby="glyph-h" className="gal-section">
      <h2 id="glyph-h" className="gal-h">
        Glyph
      </h2>
      <p className="gal-note">
        Rings are difficulty, size is impact, the edge is how the customer starts, the heart shape
        is the call stage and its fill is the status. One tick is a minute. The amber glint marks
        the recommended mission (the sixth one here).
      </p>

      <h3 className="gal-sub">Sizes</h3>
      <div className="gal-sizes">
        {REPRESENTATIVE.slice(0, 8).map((traits, i) => (
          <div className="gal-sizes__row" key={i}>
            {SIZES.map((size) => (
              <SignalGlyph key={size} traits={traits} size={size} label={describeGlyph(traits)} />
            ))}
          </div>
        ))}
      </div>

      <h3 className="gal-sub">Representative 24</h3>
      <ul className="gal-grid" aria-label="Representative glyphs">
        {REPRESENTATIVE.map((traits, i) => (
          <li key={i} className="gal-cell">
            <SignalGlyph traits={traits} size={92} />
            <span className="gal-cell__cap">{describeGlyph(traits)}</span>
          </li>
        ))}
      </ul>

      <h3 className="gal-sub">The 13 missions from /api/scenarios</h3>
      {missions === null ? <p className="gal-note">Loading the missions.</p> : null}
      {missions === 'error' ? (
        <p className="gal-note">The API on this port did not answer, so there are no missions.</p>
      ) : null}
      {Array.isArray(missions) ? (
        <ul className="gal-grid" aria-label="Missions">
          {missions.map((mission) => (
            <li key={mission.id} className="gal-cell">
              <SignalGlyph traits={mission} size={92} />
              <span className="gal-cell__cap">
                <b>{mission.title}</b>
                <br />
                {describeGlyph(mission)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
