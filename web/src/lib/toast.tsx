import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '../components/Icon.tsx';

type Tone = 'info' | 'positive' | 'caution' | 'negative';
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  message?: string;
}

interface ToastApi {
  toast(item: { tone?: Tone; title: string; message?: string; durationMs?: number }): void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Transient status messages. They are announced politely to screen readers and never steal focus. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback<ToastApi['toast']>(
    ({ tone = 'info', title, message, durationMs = 5000 }) => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-2), { id, tone, title, message }]);
      window.setTimeout(
        () => setItems((current) => current.filter((t) => t.id !== id)),
        durationMs,
      );
    },
    [],
  );

  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className="toast glass glass-strong">
            <Icon name={t.tone === 'positive' ? 'check' : t.tone === 'info' ? 'info' : 'alert'} />
            <div>
              <strong>{t.title}</strong>
              {t.message ? <p className="t-small t-muted">{t.message}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
