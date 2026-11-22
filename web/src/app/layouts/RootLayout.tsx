import { Outlet } from 'react-router';
import { RouteEffects } from '../route-effects.tsx';
import { NavigationState } from '../shell/RouteStage.tsx';
import { NavigationProgress } from '../shell/Shell.tsx';

/**
 * The root of every route: scroll and focus after navigation, a progress line while waiting, and the
 * memory of whether the app has navigated yet (the first page does not enter; the next ones do).
 */
export function RootLayout() {
  return (
    <NavigationState>
      <RouteEffects />
      <NavigationProgress />
      <Outlet />
    </NavigationState>
  );
}
