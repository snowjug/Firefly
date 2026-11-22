import { useEffect, useRef, useState } from 'react';
import type { ClosingCheckDTO } from '#shared/domain/api.ts';
import { cx, Icon, Skeleton } from '../../design/index.ts';

/** How long the check may take. After this it is left out, quietly: ending never waits for it. */
export const CLOSING_CHECK_DEADLINE_MS = 1000;

export type ClosingChecks = ClosingCheckDTO['checks'];

/** The four things the check looks at, in the words of the dialog. */
export const CLOSING_ROWS = [
  { key: 'plan', label: 'Plan stated' },
  { key: 'owner', label: 'Owner stated' },
  { key: 'updateTime', label: 'Update time stated' },
  { key: 'agreement', label: 'Customer agreement confirmed' },
] as const satisfies ReadonlyArray<{ key: keyof ClosingChecks; label: string }>;

/** The four answers, or null when what came back is not four yes-or-no answers. */
export function readClosingChecks(value: unknown): ClosingChecks | null {
  const checks = (value as { checks?: Record<string, unknown> } | null)?.checks;
  if (!checks || typeof checks !== 'object') return null;
  if (!CLOSING_ROWS.every(({ key }) => typeof checks[key] === 'boolean')) return null;
  return {
    plan: checks.plan === true,
    owner: checks.owner === true,
    updateTime: checks.updateTime === true,
    agreement: checks.agreement === true,
  };
}

/** The one line before the rows: what they are, and that they are not a mark. */
export const CLOSING_LEAD = 'What the call has covered so far. This is not a score.';

type State =
  { status: 'loading' } | { status: 'ready'; checks: ClosingChecks } | { status: 'gone' };

export interface ClosingCheckProps {
  /**
   * Asks the server for the check. Left out, there is no check and nothing is shown. It is called
   * once, when this mounts (the dialog opens), and is told to stop when this unmounts or after the
   * deadline.
   */
  load?: (signal: AbortSignal) => Promise<ClosingCheckDTO>;
}

/**
 * A neutral look at the call as it stands, shown when ending a guided call: one line saying what it
 * is, then a plan, an owner, an update time and the customer's agreement, each "Done" or "Not yet".
 * Only a row that is covered has a mark; the rest are quiet, so four of them do not read as a failed
 * list. It is not a score, it is not red, and it never says what to say. It must never get in the way
 * of ending, so it asks once, shows a short skeleton while it waits, and shows nothing at all (no
 * message) when it fails or is slow.
 */
export function ClosingCheck({ load }: ClosingCheckProps) {
  const [state, setState] = useState<State>(load ? { status: 'loading' } : { status: 'gone' });
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    const ask = latest.current;
    if (!ask) return;
    const controller = new AbortController();
    let over = false;
    const finish = (next: State) => {
      if (over) return;
      over = true;
      window.clearTimeout(timer);
      setState(next);
    };
    const timer = window.setTimeout(() => {
      controller.abort();
      finish({ status: 'gone' });
    }, CLOSING_CHECK_DEADLINE_MS);
    ask(controller.signal).then(
      (dto) => {
        const checks = readClosingChecks(dto);
        finish(checks ? { status: 'ready', checks } : { status: 'gone' });
      },
      () => finish({ status: 'gone' }),
    );
    return () => {
      over = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  if (state.status === 'gone') return null;
  if (state.status === 'loading') {
    return (
      <div className="cw-closing" aria-hidden="true">
        <Skeleton className="cw-closing__skeleton" />
        <ul className="cw-close cw-close--loading" role="list" aria-hidden="true">
          {CLOSING_ROWS.map(({ key }) => (
            <li className="cw-close__row" key={key}>
              <Skeleton className="cw-close__skeleton" />
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="cw-closing">
      <p className="cw-closing__lead">{CLOSING_LEAD}</p>
      <ul className="cw-close" role="list" aria-label="Closing check">
        {CLOSING_ROWS.map(({ key, label }) => {
          const done = state.checks[key];
          return (
            <li className={cx('cw-close__row', done && 'cw-close__row--done')} key={key}>
              <Icon name={done ? 'check-circle' : 'clock'} size={18} className="cw-close__icon" />
              <span className="cw-close__label">{label}</span>
              <span className="cw-close__state">{done ? 'Done' : 'Not yet'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
