import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AmbientProvider, useAmbient } from '../lib/motion/ambient.tsx';
import { PerfTierProvider, usePerfTier } from '../lib/PerfTierProvider.tsx';
import { ThemeProvider, useTheme, type ThemePreference } from '../lib/theme.tsx';
import { CoreSection } from './CoreSection.tsx';
import { GlyphSheet } from './GlyphSheet.tsx';
import { KeySection } from './KeySection.tsx';
import { PresenceSection } from './PresenceSection.tsx';
import '../styles/index.css';
import './gallery.css';

const THEMES: ThemePreference[] = ['dark', 'light', 'system'];
const TIERS = ['high', 'medium', 'low'] as const;

function withPerf(tier: string): string {
  const params = new URLSearchParams(window.location.search);
  params.set('perf', tier);
  return `?${params.toString()}`;
}

function Controls() {
  const { theme, setTheme, motion, setMotion } = useTheme();
  const ambient = useAmbient();
  const tier = usePerfTier();
  return (
    <header className="gal-bar">
      <div>
        <p className="gal-eyebrow">Design gallery (development only)</p>
        <h1 className="gal-title">The signal instrument</h1>
      </div>
      <div className="gal-controls" role="group" aria-label="Gallery controls">
        <div role="radiogroup" aria-label="Theme" className="gal-seg">
          {THEMES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Motion" className="gal-seg">
          {(['system', 'reduce', 'full'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={motion === value}
              onClick={() => setMotion(value)}
            >
              motion: {value}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="gal-toggle"
          aria-pressed={ambient.preference === 'paused'}
          onClick={ambient.toggle}
        >
          Pause ambient motion
        </button>
        <nav aria-label="Performance tier" className="gal-seg">
          {TIERS.map((value) => (
            <a
              key={value}
              href={withPerf(value)}
              aria-current={tier === value ? 'true' : undefined}
            >
              perf: {value}
            </a>
          ))}
        </nav>
      </div>
      <nav aria-label="Sections" className="gal-jump">
        <a href="#glyph">Glyph</a>
        <a href="#core">Core</a>
        <a href="#presence">Presence</a>
        <a href="#key">Key and legend</a>
      </nav>
    </header>
  );
}

function Gallery() {
  return (
    <main className="gal">
      <Controls />
      <GlyphSheet />
      <CoreSection />
      <PresenceSection />
      <KeySection />
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ThemeProvider>
      <AmbientProvider>
        <PerfTierProvider>
          <Gallery />
        </PerfTierProvider>
      </AmbientProvider>
    </ThemeProvider>
  </StrictMode>,
);
