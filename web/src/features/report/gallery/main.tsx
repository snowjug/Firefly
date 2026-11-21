import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppLayout } from '../../../app/layouts/AppLayout.tsx';
import { RootLayout } from '../../../app/layouts/RootLayout.tsx';
import { AnnouncerProvider } from '../../../design/index.ts';
import '../../../design/styles.ts';
import { ConfigProvider } from '../../../lib/config.tsx';
import { ReportPage } from '../ReportPage.tsx';
import { GALLERY_STATES, galleryScenario } from './states.ts';

// Development only: served by the Vite dev server at /gallery-report.html?state=<name>. The
// production build includes only index.html, so none of this ships. It mounts the real app layout
// and the real report page; only the server is replaced by the fixtures in ../fixtures.ts.

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element.');

const state = new URLSearchParams(window.location.search).get('state');

function Stub({ title }: { title: string }) {
  return (
    <div className="l-page l-section">
      <h1 className="t-title2">{title}</h1>
      <p className="t-reading t-muted">This is a stand-in for the page the link goes to.</p>
    </div>
  );
}

function Chooser() {
  return (
    <div className="l-page l-section l-stack l-gap-4">
      <h1 className="t-title2">Report gallery</h1>
      <p className="t-reading t-muted">Choose a state: gallery-report.html?state=&lt;name&gt;</p>
      <ul className="l-stack l-gap-2" role="list">
        {GALLERY_STATES.map((name) => (
          <li key={name}>
            <a href={`?state=${name}`}>{name}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function start() {
  const known = state !== null && (GALLERY_STATES as readonly string[]).includes(state);
  const scenario = known && state ? await galleryScenario(state) : null;
  const router = createMemoryRouter(
    [
      {
        Component: RootLayout,
        children: [
          {
            Component: AppLayout,
            children: [
              {
                path: 'sessions/:id/report',
                element: scenario ? (
                  <ReportPage
                    sessionId="gallery"
                    client={scenario.client}
                    slowAfterMs={scenario.slowAfterMs}
                  />
                ) : (
                  <Chooser />
                ),
              },
              { path: 'scenarios', element: <Stub title="Scenarios" /> },
              { path: 'scenarios/:id/brief', element: <Stub title="Call brief" /> },
              { path: 'calls/:id', element: <Stub title="Call" /> },
              { path: 'responsible-ai', element: <Stub title="Responsible AI" /> },
              { path: '/', element: <Stub title="Home" /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: ['/sessions/gallery/report'] },
  );
  createRoot(root as HTMLElement).render(
    <StrictMode>
      <ConfigProvider>
        <AnnouncerProvider>
          <RouterProvider router={router} />
        </AnnouncerProvider>
      </ConfigProvider>
    </StrictMode>,
  );
}

void start();
