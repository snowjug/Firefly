import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router';
import { AppLayout } from '../../../app/layouts/AppLayout.tsx';
import { RootLayout } from '../../../app/layouts/RootLayout.tsx';
import { AnnouncerProvider } from '../../../design/index.ts';
import '../../../design/styles.ts';
import { ConfigProvider } from '../../../lib/config.tsx';
import Brief from '../../../pages/Brief.tsx';
import Scenarios from '../../../pages/Scenarios.tsx';
import { GALLERY_STATES, installPretendServer, isGalleryState } from './pretend-server.ts';

// Development only: served by the Vite dev server at /gallery-scenarios.html. The production build
// includes only index.html, so none of this ships. It mounts the real app layout and the real
// scenario and brief pages; only the server is replaced (see pretend-server.ts).
//
//   ?state=<name>   what the pretend server does (default: "default")
//   ?path=<route>   where to start, URL-encoded (default: /scenarios)

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element.');

const params = new URLSearchParams(window.location.search);
const requested = params.get('state');
const state = isGalleryState(requested) ? requested : 'default';
const start = params.get('path');
const path = start?.startsWith('/') ? start : '/scenarios';

installPretendServer(state);

/** A page the screens link to: it says where the link led, so the address can be checked by eye. */
function Stand({ title }: { title: string }) {
  const location = useLocation();
  return (
    <div className="l-page l-section l-stack l-gap-3">
      <h1 className="t-title2">{title}</h1>
      <p className="t-reading t-muted">A stand-in for the page the link goes to. It opened at:</p>
      <p className="t-reading" data-testid="where">
        {`${location.pathname}${location.search}`}
      </p>
      <p className="t-small t-muted">{`Pretend server state: ${state} (${GALLERY_STATES[state]})`}</p>
    </div>
  );
}

const router = createMemoryRouter(
  [
    {
      Component: RootLayout,
      children: [
        {
          Component: AppLayout,
          children: [
            { path: 'scenarios', Component: Scenarios },
            { path: 'scenarios/:id/brief', Component: Brief },
            { path: 'calls/:id', element: <Stand title="Call" /> },
            { path: 'sessions/:id/report', element: <Stand title="Report" /> },
            { path: 'responsible-ai', element: <Stand title="Responsible AI" /> },
            { path: '*', element: <Stand title="Somewhere else" /> },
          ],
        },
      ],
    },
  ],
  { initialEntries: [path] },
);

createRoot(root).render(
  <StrictMode>
    <ConfigProvider>
      <AnnouncerProvider>
        <RouterProvider router={router} />
      </AnnouncerProvider>
    </ConfigProvider>
  </StrictMode>,
);
