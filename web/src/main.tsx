import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import { ConfigProvider } from './lib/config.tsx';
import { ThemeProvider } from './lib/theme.tsx';
import { ToastProvider } from './lib/toast.tsx';
import './styles/index.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ThemeProvider>
      <ConfigProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppErrorBoundary>
              <App />
            </AppErrorBoundary>
          </BrowserRouter>
        </ToastProvider>
      </ConfigProvider>
    </ThemeProvider>
  </StrictMode>,
);
