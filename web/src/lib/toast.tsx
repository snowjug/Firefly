import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon.tsx';
import '../styles/toast.css';

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

/**
 * Transient status messages: a quiet glass strip above the dock, announced politely to screen
 * readers, never taking focus, gone after a few seconds. The region lives on the page body, outside
 * the app root, so a toast raised from inside a dialog is still announced and shown above it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const toast = useCallback<ToastApi['toast']>(
    ({ tone = 'info', title, message, durationMs = 5000 }) => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-2), { id, tone, title, message }]);
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        setItems((current) => current.filter((t) => t.id !== id));
      }, durationMs);
      timers.current.add(timer);
    },
    [],
  );

  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
          {items.map((t) => (
            <div key={t.id} className="toast glass glass--inspector" data-tone={t.tone}>
              <span className="toast__mark">
                <Icon
                  name={t.tone === 'positive' ? 'check' : t.tone === 'info' ? 'info' : 'alert'}
                  size={18}
                />
              </span>
              <div className="toast__text">
                <strong>{t.title}</strong>
                {t.message ? <p>{t.message}</p> : null}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
