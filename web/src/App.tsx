import type { ReactNode } from 'react';
import { RouterProvider } from 'react-router';
import { AnnouncerProvider } from './design/primitives/LiveRegion.tsx';
import { ConfigProvider } from './lib/config.tsx';
import type { AppRouter } from './app/router.tsx';

export { appRoutes, createAppRouter, type AppRouter } from './app/router.tsx';

/** The providers every page may rely on: the server's config, and the polite announcer. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider>
      <AnnouncerProvider>{children}</AnnouncerProvider>
    </ConfigProvider>
  );
}

/** The router. Pass `createAppRouter()` in the browser, or `createAppRouter(['/path'])` in a test. */
export function App({ router }: { router: AppRouter }) {
  return <RouterProvider router={router} />;
}
