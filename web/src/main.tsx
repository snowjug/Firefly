import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, createAppRouter, preloadPage } from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import { ConfigProvider } from './lib/config.tsx';
import { AmbientProvider } from './lib/motion/ambient.tsx';
import { installViewTransitionSkip } from './lib/motion/transitions.ts';
import { ThemeProvider } from './lib/theme.tsx';
import { ToastProvider } from './lib/toast.tsx';
import './styles/index.css';

// The longest the first render waits for the opening page. After that it starts anyway and the
// router shows a loading placeholder, so a slow connection still sees something happening.
const FIRST_RENDER_WAIT_MS = 1500;

function start() {
  // A route animation must never get in the way: the first press or key skips it.
  installViewTransitionSkip();
  const router = createAppRouter();
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <ThemeProvider>
        <AmbientProvider>
          <ConfigProvider>
            <ToastProvider>
              <AppErrorBoundary>
                <App router={router} />
              </AppErrorBoundary>
            </ToastProvider>
          </ConfigProvider>
        </AmbientProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

void Promise.race([
  preloadPage(window.location.pathname),
  new Promise<void>((resolve) => setTimeout(resolve, FIRST_RENDER_WAIT_MS)),
]).then(start);
