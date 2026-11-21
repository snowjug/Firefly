import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import { api } from './api.ts';

interface ConfigState {
  config: AppConfigDTO | null;
  loading: boolean;
  error: boolean;
  reload(): void;
}

const ConfigContext = createContext<ConfigState | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<ConfigState, 'reload'>>({
    config: null,
    loading: true,
    error: false,
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .config(controller.signal)
      .then((config) => setState({ config, loading: false, error: false }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ config: null, loading: false, error: true });
      });
    return () => controller.abort();
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const value = useMemo(() => ({ ...state, reload }), [state, reload]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useAppConfig(): ConfigState {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used inside ConfigProvider');
  return ctx;
}
