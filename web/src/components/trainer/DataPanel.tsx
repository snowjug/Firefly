import { useId, useRef, useState } from 'react';
import type { DemoStatusDTO } from '#shared/domain/api.ts';
import { errorMessage } from '../../lib/api.ts';
import type { AsyncState } from '../../lib/hooks.ts';
import { useToast } from '../../lib/toast.tsx';
import { LoadingNotice } from './bridge.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { buildActions, runAction, type ActionId } from './data-actions.ts';
import { StudioError, StudioSection } from './StudioFrame.tsx';

/**
 * Counts and the actions that change them. Every action is confirmed in a dialog that spells out
 * what will be created or deleted; the result is announced and the counts refreshed.
 */
export function DataPanel({ status }: { status: AsyncState<DemoStatusDTO> }) {
  const rowId = useId();
  const { toast } = useToast();
  const busy = useRef(false);
  const [openId, setOpenId] = useState<ActionId | null>(null);
  const [pending, setPending] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const counts = status.data;
  const specs = buildActions(counts?.practiceSessions ?? 0, counts?.sampleSessions ?? 0);
  const open = specs.find((spec) => spec.id === openId) ?? null;

  async function confirm() {
    if (!open || busy.current) return;
    busy.current = true;
    setPending(true);
    setDialogError(null);
    try {
      const outcome = await runAction(open.id);
      setOpenId(null);
      setMessage(outcome.message);
      toast({ tone: 'positive', title: outcome.title });
      status.reload();
    } catch (error) {
      setDialogError(errorMessage(error));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <StudioSection
      title="Demo data"
      about="Counts are for sessions linked to this browser. They are stored on the machine that runs Firefly’s server."
    >
      {counts ? (
        <dl className="tr-counts">
          <div>
            <dt>Practice sessions</dt>
            <dd>{counts.practiceSessions}</dd>
          </div>
          <div>
            <dt>Sample sessions</dt>
            <dd>{counts.sampleSessions}</dd>
          </div>
        </dl>
      ) : null}

      {!counts ? (
        status.error ? (
          <StudioError
            error={status.error}
            onRetry={status.reload}
            title="The session counts could not be loaded"
          />
        ) : (
          <LoadingNotice label="Loading session counts" lines={3} />
        )
      ) : (
        <ul className="tr-actions">
          {specs.map((spec) => {
            const unavailable = !spec.available || pending;
            const textId = `${rowId}-${spec.id}`;
            return (
              <li key={spec.id} className="tr-action">
                <div className="tr-action__text">
                  <p className="tr-action__title">{spec.rowTitle}</p>
                  <p id={textId} className="tr-action__hint">
                    {spec.rowText}
                    {spec.available ? null : <> {spec.unavailableText}</>}
                  </p>
                </div>
                <button
                  type="button"
                  className="action action--quiet"
                  aria-disabled={unavailable || undefined}
                  aria-describedby={textId}
                  onClick={() => {
                    if (unavailable) return;
                    setDialogError(null);
                    setOpenId(spec.id);
                  }}
                >
                  {spec.button}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p role="status" className="tr-status">
        {message}
      </p>

      {open ? (
        <ConfirmDialog
          title={open.dialog.title}
          description={open.dialog.description}
          will={open.dialog.will}
          wont={open.dialog.wont}
          confirmLabel={open.dialog.confirm}
          pendingLabel={open.dialog.pending}
          tone={open.dialog.tone}
          pending={pending}
          error={dialogError}
          onConfirm={() => void confirm()}
          onCancel={() => setOpenId(null)}
        />
      ) : null}
    </StudioSection>
  );
}
