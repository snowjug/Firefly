import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, createAppRouter, preloadPage } from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import { ConfigProvider } from './lib/config.tsx';
import { ThemeProvider } from './lib/theme.tsx';
import { ToastProvider } from './lib/toast.tsx';
import './styles/index.css';

// The longest the first render waits for the opening page. After that it starts anyway and the
// router shows a loading placeholder, so a slow connection still sees something happening.
const FIRST_RENDER_WAIT_MS = 1500;

function start() {
  const router = createAppRouter();
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <ThemeProvider>
        <ConfigProvider>
          <ToastProvider>
            <AppErrorBoundary>
              <App router={router} />
            </AppErrorBoundary>
          </ToastProvider>
        </ConfigProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

void Promise.race([
  preloadPage(window.location.pathname),
  new Promise<void>((resolve) => setTimeout(resolve, FIRST_RENDER_WAIT_MS)),
]).then(start);
