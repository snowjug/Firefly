import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { api } from '../../lib/api.ts';
import { useAmbient } from '../../lib/motion/ambient.tsx';
import { useReducedMotion, useTheme } from '../../lib/theme.tsx';
import { Icon } from '../Icon.tsx';
import { arrange, buildEntries, flatten, type PaletteEntry } from './palette-model.ts';
import '../../styles/palette.css';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';

const slug = (text: string) => text.toLowerCase().replace(/\W+/g, '-');

// The mission titles are fetched when the palette opens, never before. The last answer is kept so a
// second opening shows them at once while a fresh list is fetched quietly.
let lastMissions: readonly PublicScenarioDTO[] | null = null;

export function resetPaletteForTests(): void {
  lastMissions = null;
}

/**
 * Search and commands, as a glass dialog: a combobox over a listbox (focus stays in the field and
 * the highlighted row is named by `aria-activedescendant`). It is mounted only while it is open.
 * Choosing a page navigates; choosing a command runs it; either way the palette closes, and focus
 * goes back to where it was, or to the new page when the choice was a page.
 */
export function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const ambient = useAmbient();
  const reduced = useReducedMotion();
  const uid = useId();

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [missions, setMissions] = useState(lastMissions);
  const [missionsFailed, setMissionsFailed] = useState(false);
  const [spoken, setSpoken] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(true);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const controller = new AbortController();
    // An async wrapper turns any failure, however it happens, into a quiet "unavailable".
    void (async () => api.scenarios(controller.signal))().then(
      (list) => {
        lastMissions = list;
        setMissions(list);
        setMissionsFailed(false);
      },
      () => {
        if (!controller.signal.aborted) setMissionsFailed(true);
      },
    );
    return () => controller.abort();
  }, []);

  const entries = useMemo(
    () =>
      buildEntries({
        theme: resolvedTheme,
        ambientPaused: ambient.paused,
        ambientForced: ambient.forced,
        scenarios: missions ?? [],
      }),
    [resolvedTheme, ambient.paused, ambient.forced, missions],
  );
  const sections = useMemo(() => arrange(entries, query), [entries, query]);
  const flat = useMemo(() => flatten(sections), [sections]);
  const current = Math.max(0, Math.min(active, flat.length - 1));

  // Take the keyboard, stop the page behind from reacting, and give everything back on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      } else if (event.key === 'Tab' && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      root?.removeAttribute('inert');
      document.body.style.overflow = overflow;
      if (restoreFocus.current && opener?.isConnected) opener.focus?.();
    };
  }, []);

  // Keep the highlighted row in view as the arrow keys walk the list.
  useEffect(() => {
    document.getElementById(`${uid}-option-${current}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [uid, current, flat]);

  // What a screen reader hears about the results, said once typing pauses.
  const resultsText = useMemo(() => {
    const text = query.trim();
    if (!text) return '';
    const found = flat.length - 1;
    if (found <= 0) {
      return `No pages or missions match. Press Enter to search missions for \u201c${text}\u201d.`;
    }
    return `${found} ${found === 1 ? 'result' : 'results'}.`;
  }, [query, flat.length]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSpoken(resultsText), 350);
    return () => window.clearTimeout(timer);
  }, [resultsText]);

  const choose = (entry: PaletteEntry) => {
    const { action } = entry;
    if (action.kind === 'navigate') {
      restoreFocus.current = false;
      const moved = Promise.resolve(navigate(action.to, { viewTransition: !reduced }));
      onClose();
      // The page's own change of focus covers a move to another page; this covers choosing the one
      // that is already open.
      void moved.then(() => document.getElementById('main')?.focus({ preventScroll: true }));
      return;
    }
    if (action.kind === 'theme') setTheme(action.next);
    else ambient.toggle();
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    const count = flat.length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(count ? (current + 1) % count : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(count ? (current - 1 + count) % count : 0);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(Math.max(0, count - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = flat[current];
      if (entry) choose(entry);
    }
  };

  return createPortal(
    <div
      className="palette-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="palette glass glass--modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-label`}
        data-palette=""
      >
        <div className="palette__head">
          <label id={`${uid}-label`} htmlFor={`${uid}-input`} className="palette__kicker">
            Search and commands
          </label>
          <button type="button" className="palette__close" onClick={onClose}>
            Close <kbd aria-hidden="true">Esc</kbd>
          </button>
        </div>
        <div className="palette__field">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            id={`${uid}-input`}
            className="palette__input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${uid}-list`}
            aria-autocomplete="list"
            aria-activedescendant={flat.length ? `${uid}-option-${current}` : undefined}
            data-allow-palette=""
            value={query}
            maxLength={80}
            placeholder="A page, a mission, a command"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="palette__rule rule rule--point" aria-hidden="true" />
        <div className="palette__results" id={`${uid}-list`} role="listbox" aria-label="Results">
          {sections.map((section) => (
            <div
              key={section.group}
              className="palette__section"
              data-pinned={section.group === 'Search' ? 'true' : undefined}
              role="group"
              aria-labelledby={`${uid}-group-${slug(section.group)}`}
            >
              <div
                id={`${uid}-group-${slug(section.group)}`}
                className="palette__group"
                role="presentation"
              >
                {section.group}
              </div>

              {section.entries.map((entry) => {
                const at = flat.indexOf(entry);
                return (
                  <div
                    key={entry.id}
                    id={`${uid}-option-${at}`}
                    className="palette__option"
                    data-stacked={entry.group === 'Missions' ? 'true' : undefined}
                    role="option"
                    tabIndex={-1}
                    aria-selected={at === current}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActive(at)}
                    onClick={() => choose(entry)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') choose(entry);
                    }}
                  >
                    <span className="palette__label">{entry.label}</span>
                    {entry.hint ? <span className="palette__hint">{entry.hint}</span> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {!missions && !query.trim() ? (
          <p className="palette__note">
            {missionsFailed ? 'Missions are unavailable right now.' : 'Loading missions\u2026'}
          </p>
        ) : null}
        <p className="palette__keys" aria-hidden="true">
          <span>
            <kbd>{'\u2191'}</kbd>
            <kbd>{'\u2193'}</kbd> move
          </span>
          <span>
            <kbd>{'\u21B5'}</kbd> open
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </p>
        <p className="sr-only" role="status">
          {spoken}
        </p>
      </div>
    </div>,
    document.body,
  );
}
