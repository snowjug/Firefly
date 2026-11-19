import { useCallback, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { REDACTION_LABELS, type RedactionKind } from '#shared/domain/text.ts';
import { api, errorMessage } from '../../lib/api.ts';
import { useAppConfig } from '../../lib/config.tsx';
import { useDocumentTitle, useMediaQuery } from '../../lib/hooks.ts';
import { useStoredState } from '../../lib/storage.ts';
import { useToast } from '../../lib/toast.tsx';
import { Dialog } from '../Dialog.tsx';
import { CallHeader } from './CallHeader.tsx';
import { Composer } from './Composer.tsx';
import { ContextPanel } from './ContextPanel.tsx';
import { EndCallDialog } from './EndCallDialog.tsx';
import { MessageList } from './MessageList.tsx';
import { useCall } from './useCall.ts';

function subscribeViewport(onChange: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', onChange);
  return () => viewport?.removeEventListener('resize', onChange);
}
const viewportHeight = () => (window.visualViewport ? Math.round(window.visualViewport.height) : 0);

/** The height of what is actually visible, so the composer stays above a mobile keyboard. */
function useVisibleHeight(): number {
  return useSyncExternalStore(subscribeViewport, viewportHeight, () => 0);
}

function redactionNotice(kinds: RedactionKind[]): string {
  const what = kinds.map((kind) => REDACTION_LABELS[kind]).join(' and ');
  return `Firefly removed ${what} from your message before saving it. Please never use real customer details.`;
}

export function ActiveCall({
  session,
  onEnded,
}: {
  session: SessionDTO;
  onEnded(next: SessionDTO): void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config } = useAppConfig();
  const wide = useMediaQuery('(min-width: 1000px)');
  const visibleHeight = useVisibleHeight();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [notes, setNotes] = useStoredState(`firefly.notes.${session.id}`, '', 'session');
  useDocumentTitle(`Call: ${session.scenario.title}`);

  // If the server says the call is no longer active, show whatever state it is in now.
  const resync = useCallback(() => {
    api
      .getSession(session.id)
      .then(onEnded)
      .catch(() => undefined);
  }, [session.id, onEnded]);

  const { chat, send, retry } = useCall(session, {
    maxTurns: config?.limits.maxTraineeTurns ?? null,
    onEnded: resync,
  });

  const tell = (kinds: RedactionKind[]) => {
    if (kinds.length > 0)
      toast({ tone: 'info', title: 'Details removed', message: redactionNotice(kinds) });
  };
  const handleSend = async (text: string) => {
    const result = await send(text);
    tell(result.redactions);
    return result;
  };
  const handleRetry = async (key: string) => {
    const result = await retry(key);
    tell(result.redactions);
  };

  const savedTraineeTurns = chat.turns.filter(
    (turn) => turn.role === 'trainee' && (turn.status === 'sent' || turn.saved),
  ).length;

  const confirmEnd = async () => {
    setEnding(true);
    setEndError(null);
    try {
      const next = await api.endSession(session.id);
      setEndOpen(false);
      onEnded(next);
    } catch (error) {
      setEndError(errorMessage(error));
    } finally {
      setEnding(false);
    }
  };

  const discard = async () => {
    setEnding(true);
    setEndError(null);
    try {
      await api.deleteSession(session.id);
      setEndOpen(false);
      toast({ tone: 'info', title: 'Call discarded', message: 'Nothing was saved.' });
      navigate('/', { replace: true });
    } catch (error) {
      setEndError(errorMessage(error));
      setEnding(false);
    }
  };

  const openEnd = () => {
    setEndError(null);
    setEndOpen(true);
  };

  const context = (
    <ContextPanel session={session} state={chat.state} notes={notes} onNotes={setNotes} />
  );
  const limit = config?.limits.maxMessageChars ?? 1500;

  return (
    <div
      className="call"
      style={visibleHeight > 0 ? { ['--vvh' as string]: `${visibleHeight}px` } : undefined}
    >
      <CallHeader session={session} onOpenDetails={() => setDetailsOpen(true)} onEnd={openEnd} />
      <div className="call-body">
        <div className="call-main">
          <MessageList
            turns={chat.turns}
            persona={session.scenario.persona}
            typing={chat.pending}
            onRetry={(key) => void handleRetry(key)}
          />
          <p className="sr-only" role="status" aria-live="polite">
            {chat.announcement}
          </p>
          <Composer
            maxChars={limit}
            busy={chat.pending}
            blockedMessage={
              chat.limitReached
                ? 'This call has reached its message limit. End the call to get your coaching.'
                : null
            }
            turnsRemaining={chat.turnsRemaining}
            onSend={handleSend}
          />
        </div>
        {wide ? (
          <aside className="call-aside surface" aria-label="Call details">
            <h2 className="sr-only">Call details</h2>
            {context}
          </aside>
        ) : null}
      </div>
      {wide ? null : (
        <Dialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          title="Call details"
          variant="sheet"
        >
          {context}
        </Dialog>
      )}
      <EndCallDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        traineeTurns={savedTraineeTurns}
        replying={chat.pending}
        pending={ending}
        error={endError}
        onConfirm={() => void confirmEnd()}
        onDiscard={() => void discard()}
      />
    </div>
  );
}
