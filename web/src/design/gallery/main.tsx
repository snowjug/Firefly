import '../styles.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { AnnouncerProvider } from '../index.ts';
import './gallery.css';
import { Gallery } from './Gallery.tsx';

// Development only: served by the Vite dev server at /gallery.html. The production build includes
// only index.html, so none of this ships.
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
