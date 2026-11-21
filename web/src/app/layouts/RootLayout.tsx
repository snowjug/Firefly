import { Outlet } from 'react-router';
import { RouteEffects } from '../route-effects.tsx';
import { NavigationProgress } from '../shell/Shell.tsx';

/** The root of every route: scroll and focus after navigation, and a progress line while waiting. */
export function RootLayout() {
  return (
    <>
      <RouteEffects />
      <NavigationProgress />
      <Outlet />
    </>
  );
}
