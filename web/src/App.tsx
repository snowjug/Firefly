import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { NotFound, LoadingCards, Page } from './components/Page.tsx';
import { Shell } from './components/Shell.tsx';

// Every page is its own chunk, loaded on demand, so the first screen stays small.
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const Library = lazy(() => import('./pages/Library.tsx'));
const Setup = lazy(() => import('./pages/Setup.tsx'));
const Brief = lazy(() => import('./pages/Brief.tsx'));
const Call = lazy(() => import('./pages/Call.tsx'));
const Report = lazy(() => import('./pages/Report.tsx'));
const Transcript = lazy(() => import('./pages/Transcript.tsx'));
const History = lazy(() => import('./pages/History.tsx'));
const Progress = lazy(() => import('./pages/Progress.tsx'));
const Calibration = lazy(() => import('./pages/Calibration.tsx'));
const Trainer = lazy(() => import('./pages/Trainer.tsx'));
const About = lazy(() => import('./pages/About.tsx'));
const Settings = lazy(() => import('./pages/Settings.tsx'));

function Loading() {
  return (
    <Page title="Loading">
      <LoadingCards count={3} />
    </Page>
  );
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="scenarios" element={<Library />} />
          <Route path="scenarios/:id/setup" element={<Setup />} />
          <Route path="scenarios/:id/brief" element={<Brief />} />
          <Route path="calls/:id" element={<Call />} />
          <Route path="sessions/:id/report" element={<Report />} />
          <Route path="sessions/:id/transcript" element={<Transcript />} />
          <Route path="history" element={<History />} />
          <Route path="progress" element={<Progress />} />
          <Route path="calibration" element={<Calibration />} />
          <Route path="trainer" element={<Trainer />} />
          <Route path="about" element={<About />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
