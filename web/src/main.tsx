// The design system's global stylesheets load first, so every component stylesheet that follows can
// rely on the tokens and the base rules being there and can override them by specificity alone.
import './design/styles.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, AppProviders, createAppRouter } from './App.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element.');

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <App router={createAppRouter()} />
    </AppProviders>
  </StrictMode>,
);
