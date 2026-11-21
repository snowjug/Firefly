import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { AnnouncerProvider } from '../../../design/index.ts';
import '../../../design/styles.ts';
import './gallery.css';
import { Gallery } from './Gallery.tsx';

// Development only: served by the Vite dev server at /gallery-call.html. The production build
// includes only index.html, so none of this ships.
//   /gallery-call.html                 a list of every state
//   /gallery-call.html?state=<name>    one state, full screen
//   &animate=1   moves the levels  &provider=live  labels a live model  &online=0  goes offline
const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element.');
createRoot(root).render(
  <StrictMode>
    <AnnouncerProvider>
      <MemoryRouter>
        <Gallery />
      </MemoryRouter>
    </AnnouncerProvider>
  </StrictMode>,
);
