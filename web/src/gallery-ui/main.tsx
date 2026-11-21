import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { AmbientProvider } from '../lib/motion/ambient.tsx';
import { PerfTierProvider } from '../lib/PerfTierProvider.tsx';
import { ThemeProvider } from '../lib/theme.tsx';
import { ToastProvider } from '../lib/toast.tsx';
import '../styles/index.css';
import { Gallery } from './Gallery.tsx';

// Dev only: serve with `vite` and open /gallery-ui.html. The same providers as the app, in the same
// order. Options: ?bg=strands|live, ?w=<px>, ?view=settings, ?perf=low|medium|high (read by the
// PerfTierProvider, which also sets data-perf on the root).
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ThemeProvider>
      <AmbientProvider>
        <PerfTierProvider>
          <ToastProvider>
            <MemoryRouter>
              <Gallery />
            </MemoryRouter>
          </ToastProvider>
        </PerfTierProvider>
      </AmbientProvider>
    </ThemeProvider>
  </StrictMode>,
);
