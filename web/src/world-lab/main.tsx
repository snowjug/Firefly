import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { EASING_ENERGY_CAP, MOOD_ATMOSPHERE } from '../components/call/atmosphere.ts';
import { pulseWorld, useWorldPose, type WorldPose } from '../components/world/useWorldPose.ts';
import { WorldLayer } from '../components/world/WorldLayer.tsx';
import { AmbientProvider, useAmbient } from '../lib/motion/ambient.tsx';
import { PerfTierProvider, usePerfTier } from '../lib/PerfTierProvider.tsx';
import { ThemeProvider, useTheme } from '../lib/theme.tsx';
import '../styles/index.css';
import './lab.css';

// Dev only (never part of the production build): the field on its own, with controls for every
// number it takes, sample text over it so legibility can be judged, and readouts. Open
// /world.html. Query: mood=calm|concerned|frustrated|angry|escalating|recovering, route=/home,
// theme=dark|light, perf=high|medium|low, panel=0 (hide the panel), veil=1 (veil behind the text),
// worldstats=1 (live cost), t/o/w/e/i=0..1 (pose numbers), focus=x,y.

type Mood = keyof typeof MOOD_ATMOSPHERE;
type Choice = Mood | 'recovering';
const MOODS: Choice[] = ['calm', 'concerned', 'frustrated', 'angry', 'escalating', 'recovering'];
const ROUTES = [
  '/',
  '/home',
  '/scenarios',
  '/scenarios/x/setup',
  '/calls/x',
  '/sessions/x/report',
  '/history',
  '/progress',
  '/trainer',
  '/settings',
  '/unknown',
];

const params = new URLSearchParams(window.location.search);
const num = (key: string) => {
  const raw = params.get(key);
  return raw === null || raw === '' ? undefined : Number(raw);
};

function poseFor(
  choice: Choice,
): Pick<WorldPose, 'tension' | 'open' | 'warmth' | 'energy' | 'recovering'> {
  if (choice === 'recovering') {
    // Easing back from frustration: the band's numbers, the energy cap, and the recovering flag.
    return { ...MOOD_ATMOSPHERE.frustrated, energy: EASING_ENERGY_CAP, recovering: true };
  }
  return { ...MOOD_ATMOSPHERE[choice], recovering: false };
}

interface Controls {
  useRoute: boolean;
  tension: number;
  open: number;
  warmth: number;
  energy: number;
  intensity: number;
  recovering: boolean;
  lean: boolean;
  fx: number;
  fy: number;
}

function initial(): Controls {
  const asked = params.get('mood') as Choice | null;
  const base = poseFor(asked && MOODS.includes(asked) ? asked : 'calm');
  const focus = params.get('focus')?.split(',').map(Number);
  return {
    useRoute: asked === null && params.get('t') === null,
    tension: num('t') ?? base.tension,
    open: num('o') ?? base.open,
    warmth: num('w') ?? base.warmth,
    energy: num('e') ?? base.energy,
    intensity: num('i') ?? 1,
    recovering: base.recovering === true,
    lean: focus !== undefined && focus.length === 2,
    fx: focus?.[0] ?? 0.5,
    fy: focus?.[1] ?? 0.5,
  };
}

function Lab() {
  const [c, setC] = useState<Controls>(initial);
  const set = useCallback(
    (patch: Partial<Controls>) => setC((prev) => ({ ...prev, ...patch })),
    [],
  );
  const { setTheme, setMotion, motion, resolvedTheme } = useTheme();
  const ambient = useAmbient();
  const tier = usePerfTier();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [stats, setStats] = useState('');
  const veil = params.get('veil') === '1';

  useEffect(() => {
    const theme = params.get('theme');
    if (theme === 'dark' || theme === 'light') setTheme(theme);
    const route = params.get('route');
    if (route) void navigate(route);
  }, [setTheme, navigate]);

  const pose = useMemo<Partial<WorldPose> | null>(
    () =>
      c.useRoute
        ? null
        : {
            tension: c.tension,
            open: c.open,
            warmth: c.warmth,
            energy: c.energy,
            intensity: c.intensity,
            recovering: c.recovering,
            focus: c.lean ? { x: c.fx, y: c.fy } : null,
          },
    [c],
  );
  useWorldPose(pose);

  useEffect(() => {
    const lab = {
      mood: (name: Choice) => set({ useRoute: false, ...poseFor(name) }),
      pose: (patch: Partial<Controls>) => set({ useRoute: false, ...patch }),
      pulse: pulseWorld,
    };
    (window as unknown as { __lab: typeof lab }).__lab = lab;
  }, [set]);

  useEffect(() => {
    if (params.get('worldstats') !== '1') return;
    const id = window.setInterval(() => {
      const read = (window as unknown as { __fireflyWorld?: Record<string, number | string> })
        .__fireflyWorld;
      if (!read) return setStats('no stats yet (the field has not started)');
      const f = (v: unknown) => (typeof v === 'number' ? v.toFixed(2) : String(v));
      setStats(
        `${read.mode} ${read.tier} ${read.strands}x${read.points} · avg ${f(read.avgMs)} ms · p95 ${f(read.p95Ms)} ms · max ${f(read.maxMs)} ms · ${read.frames} frames`,
      );
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const slider = (key: 'tension' | 'open' | 'warmth' | 'energy' | 'intensity') => (
    <label className="lab-slider" key={key}>
      <span className="type-label">{key}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={c[key]}
        onChange={(e) => set({ useRoute: false, [key]: Number(e.target.value) })}
      />
      <output className="type-number">{c[key].toFixed(2)}</output>
    </label>
  );

  const pick = (choice: Choice) => set({ useRoute: false, ...poseFor(choice) });
  const withVeil = veil ? ' world-veil' : '';

  return (
    <>
      <WorldLayer />
      <main className="lab" id="main">
        <section className={`lab-read${withVeil}`} aria-label="Sample text">
          <p className="type-label">Calibration · Starter · First contact</p>
          <h1 className="type-display">Locked out after a password reset</h1>
          <p className="type-lead">
            Maya Okafor, front-desk coordinator, Fabrikam Dental Group. The staff portal stopped
            letting her in after she changed her password this morning.
          </p>
          <p className="type-read">
            The conversation is a room, and the room listens. When the customer is composed the
            strands run long and wide and slow; as the conversation tightens they gather, cross and
            shorten. Reading must stay easy through all of it, in body text like this, in smaller
            interface text, and in the telemetry labels at the edge.
          </p>
          <p className="type-ui">
            Interface text in Hanken Grotesk at sixteen pixels, ink-1 on the field, with a{' '}
            <a className="text-link" href="#main">
              text link
            </a>{' '}
            and some secondary text in <span className="lab-ink2">ink-2 (the second tone)</span> and{' '}
            <span className="lab-ink3">ink-3 (the quietest tone)</span> to check contrast.
          </p>
          <p className="type-small lab-ink2">
            Smaller text, fourteen pixels, in the second tone: Scores are for practice, not
            performance reviews.
          </p>
        </section>

        <section className={`lab-thread${withVeil}`} aria-label="Sample conversation">
          <article className="lab-turn">
            <p className="type-label">Maya Okafor · 01 · Calm</p>
            <p className="lab-customer">
              Hello, thanks for picking up. I can&rsquo;t sign in to the staff portal. It stopped
              letting me in after I changed my password this morning.
            </p>
          </article>
          <article className="lab-turn lab-turn--you">
            <p className="type-label">You · 02</p>
            <p className="lab-trainee">
              Thanks, Maya. Can you tell me when it started and whether anything else changed?
            </p>
          </article>
          <article className="lab-turn">
            <p className="type-label">Maya Okafor · 03 · Concerned</p>
            <p className="lab-customer">
              Right after I changed it, around ten past eight. My phone has been acting up too.
            </p>
          </article>
        </section>
      </main>

      <aside
        className="lab-panel glass glass--inspector"
        aria-label="Field controls"
        hidden={params.get('panel') === '0'}
      >
        <h2 className="type-label">
          World lab · {resolvedTheme} · tier {tier}
        </h2>
        <div className="lab-row" role="group" aria-label="Mood">
          {MOODS.map((m) => (
            <button type="button" key={m} className="lab-btn" onClick={() => pick(m)}>
              {m}
            </button>
          ))}
        </div>
        {slider('tension')}
        {slider('open')}
        {slider('warmth')}
        {slider('energy')}
        {slider('intensity')}
        <div className="lab-row">
          <label className="lab-check">
            <input
              type="checkbox"
              checked={c.recovering}
              onChange={(e) => set({ useRoute: false, recovering: e.target.checked })}
            />
            <span className="type-small">recovering</span>
          </label>
          <label className="lab-check">
            <input
              type="checkbox"
              checked={c.lean}
              onChange={(e) => set({ useRoute: false, lean: e.target.checked })}
            />
            <span className="type-small">lean</span>
          </label>
          <label className="lab-check">
            <input
              type="checkbox"
              checked={c.useRoute}
              onChange={(e) => set({ useRoute: e.target.checked })}
            />
            <span className="type-small">route default</span>
          </label>
        </div>
        <label className="lab-slider">
          <span className="type-label">focus x</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={c.fx}
            onChange={(e) => set({ useRoute: false, lean: true, fx: Number(e.target.value) })}
          />
          <output className="type-number">{c.fx.toFixed(2)}</output>
        </label>
        <label className="lab-slider">
          <span className="type-label">focus y</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={c.fy}
            onChange={(e) => set({ useRoute: false, lean: true, fy: Number(e.target.value) })}
          />
          <output className="type-number">{c.fy.toFixed(2)}</output>
        </label>
        <div className="lab-row">
          <button
            type="button"
            className="lab-btn"
            onClick={() => pulseWorld('discovery', { x: 0.62, y: 0.4 })}
          >
            discovery
          </button>
          <button
            type="button"
            className="lab-btn"
            onClick={() => pulseWorld('curveball', { x: 0.55, y: 0.5 })}
          >
            curveball
          </button>
          <button type="button" className="lab-btn" onClick={() => pulseWorld('discovery')}>
            discovery (no point)
          </button>
        </div>
        <div className="lab-row" role="group" aria-label="Theme and motion">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button type="button" key={t} className="lab-btn" onClick={() => setTheme(t)}>
              {t}
            </button>
          ))}
          <button
            type="button"
            className="lab-btn"
            aria-pressed={ambient.paused}
            onClick={ambient.toggle}
          >
            {ambient.paused ? 'ambient paused' : 'ambient on'}
          </button>
          <button
            type="button"
            className="lab-btn"
            aria-pressed={motion === 'reduce'}
            onClick={() => setMotion(motion === 'reduce' ? 'system' : 'reduce')}
          >
            reduce motion {motion === 'reduce' ? 'on' : 'off'}
          </button>
        </div>
        <div className="lab-row" role="group" aria-label="Effects tier">
          {(['high', 'medium', 'low'] as const).map((t) => (
            <a key={t} className="lab-btn" href={`?perf=${t}&worldstats=1`}>
              perf={t}
            </a>
          ))}
        </div>
        <label className="lab-slider">
          <span className="type-label">route</span>
          <select
            value={pathname}
            onChange={(e) => {
              set({ useRoute: true });
              void navigate(e.target.value);
            }}
          >
            {ROUTES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <p className="type-label lab-stats" role="status">
          {stats || 'add ?worldstats=1 for live cost'}
        </p>
      </aside>
    </>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ThemeProvider>
      <AmbientProvider>
        <PerfTierProvider>
          <MemoryRouter initialEntries={['/calls/lab']}>
            <Lab />
          </MemoryRouter>
        </PerfTierProvider>
      </AmbientProvider>
    </ThemeProvider>
  </StrictMode>,
);
