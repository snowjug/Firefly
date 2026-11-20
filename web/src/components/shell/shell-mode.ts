import { createContext, useContext } from 'react';

/**
 * What the frame is doing: showing the whole app ('app'), stepping out of the way of a live call
 * ('call') or showing the front door ('public': no dock, only the wordmark and the display
 * controls). Pages read it with `useShellMode()` to adapt; the frame also sets `data-shell` (and
 * `data-call="true"` during a call) on its root element for CSS.
 */
export type ShellMode = 'app' | 'call' | 'public';

export const ShellModeContext = createContext<ShellMode>('app');

export function useShellMode(): ShellMode {
  return useContext(ShellModeContext);
}
