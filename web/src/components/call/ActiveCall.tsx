import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { REDACTION_LABELS, type RedactionKind } from '#shared/domain/text.ts';
import { api, errorMessage } from '../../lib/api.ts';
import { useAppConfig } from '../../lib/config.tsx';
import { useDocumentTitle, useMediaQuery } from '../../lib/hooks.ts';
import { usePreferences } from '../../lib/profile.ts';
import { useSound } from '../../lib/sound.ts';
import { useStoredState } from '../../lib/storage.ts';
import { useToast } from '../../lib/toast.tsx';
import { forgetVoiceSession } from '../../lib/voice-sessions.ts';
import { Dialog } from '../Dialog.tsx';
import { VoiceOptIn } from '../voice/VoiceOptIn.tsx';
import { VoicePanel } from '../voice/VoicePanel.tsx';
import { CallHeader } from './CallHeader.tsx';
import { Composer } from './Composer.tsx';
import { ContextPanel } from './ContextPanel.tsx';
import { EndCallDialog } from './EndCallDialog.tsx';
import { HintChips } from './HintChips.tsx';
import { MessageList } from './MessageList.tsx';
import { CustomerStage } from './StagePanel.tsx';
import { hintsFor, withStarter, type Hint, type HintId } from './hints.ts';
import { useCall } from './useCall.ts';
import { useCallVoice } from './useCallVoice.ts';

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

/** Adds recognised speech after what is already in the box. */
function appendWords(draft: string, words: string): string {
  if (draft.trim() === '') return words;
  return `${draft}${/\s$/.test(draft) ? '' : ' '}${words}`;
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
  const { voice: voiceOn } = usePreferences();
  const [soundOn] = useSound();
  // The shell drops its sidebar at this width, and the portrait becomes a strip above the chat.
  const wide = useMediaQuery('(min-width: 961px)');
  const visibleHeight = useVisibleHeight();
  const landscapePhone = useMediaQuery('(max-height: 520px)');
  // Short on room: a landscape phone, or the keyboard covering most of a portrait one.
  const short = landscapePhone || (visibleHeight > 0 && visibleHeight < 520);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [notes, setNotes] = useStoredState(`firefly.notes.${session.id}`, '', 'session');
  const [reply, setReply] = useState('');
  const [usedHints, setUsedHints] = useState<HintId[]>([]);
  const [focusReply, setFocusReply] = useState(0);
  const [focusVoice, setFocusVoice] = useState(0);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const callButtonRef = useRef<HTMLButtonElement>(null);
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

  // After words are put into the box, put the caret at the end so the person can carry on.
  useEffect(() => {
    if (focusReply === 0) return;
    const box = replyRef.current;
    if (!box) return;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }, [focusReply]);

  // Once voice is turned on from here, the way to start a call is the next thing to reach.
  useEffect(() => {
    if (focusVoice > 0 && voiceOn) callButtonRef.current?.focus();
  }, [focusVoice, voiceOn]);

  const tell = useCallback(
    (kinds: RedactionKind[]) => {
      if (kinds.length > 0)
        toast({ tone: 'info', title: 'Details removed', message: redactionNotice(kinds) });
    },
    [toast],
  );
  const handleSend = async (text: string) => {
    const result = await send(text);
    tell(result.redactions);
    return result;
  };
  // Stable between keystrokes, so the conversation is not redrawn while the person types.
  const handleRetry = useCallback(
    (key: string) => {
      void retry(key).then((result) => tell(result.redactions));
    },
    [retry, tell],
  );

  const limit = config?.limits.maxMessageChars ?? 1500;
  const { voice, calling, handsFree, setHandsFree, toggleCall, hangUp } = useCallVoice({
    sessionId: session.id,
    allowed: voiceOn,
    customer: session.scenario.persona.name,
    mood: chat.state.band.id,
    busy: chat.pending,
    turns: chat.turns,
    playTones: soundOn,
    canSend: (text) => !chat.limitReached && text.length <= limit,
    send: handleSend,
    putInBox: (words) => {
      setReply((current) => appendWords(current, words));
      setFocusReply((tick) => tick + 1);
    },
  });

  // Typing or sending takes the turn: the customer's voice stops.
  const changeReply = (next: string) => {
    voice.stopSpeaking();
    setReply(next);
  };
  const sendTyped = (text: string) => {
    voice.stopSpeaking();
    return handleSend(text);
  };

  const pickHint = (hint: Hint) => {
    voice.stopSpeaking();
    setReply((current) => withStarter(current, hint.starter));
    setUsedHints((used) => [...used, hint.id]);
    setFocusReply((tick) => tick + 1);
  };

  const savedTraineeTurns = chat.turns.filter(
    (turn) => turn.role === 'trainee' && (turn.status === 'sent' || turn.saved),
  ).length;

  const confirmEnd = async () => {
    setEnding(true);
    setEndError(null);
    try {
      hangUp();
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
      hangUp();
      await api.deleteSession(session.id);
      forgetVoiceSession(session.id);
      setEndOpen(false);
      toast({ tone: 'info', title: 'Call discarded', message: 'Nothing was saved.' });
      navigate('/home', { replace: true });
    } catch (error) {
      setEndError(errorMessage(error));
      setEnding(false);
    }
  };

  const openEnd = () => {
    setEndError(null);
    setEndOpen(true);
  };

  const { persona, config: setup } = session.scenario;
  const guided = setup.mode === 'guided';
  const latestCustomer = [...chat.turns].reverse().find((turn) => turn.role === 'customer');
  const hints = guided
    ? hintsFor({
        areas: session.scenario.expectedDiscoveryAreas,
        band: chat.state.band.id,
        traineeTurns: savedTraineeTurns,
        used: usedHints,
      })
    : [];
  const canHear = voiceOn && voice.support.synthesis;
  // The customer's voice is the announcement while a voice call is on; reading it too would say it twice.
  const announcement = calling && voice.support.synthesis ? '' : chat.announcement;

  return (
    <div
      className="call"
      data-mode={setup.mode}
      data-short={short || undefined}
      style={visibleHeight > 0 ? { ['--vvh' as string]: `${visibleHeight}px` } : undefined}
    >
      <div className="call-frame">
        <CallHeader session={session} onOpenDetails={() => setDetailsOpen(true)} onEnd={openEnd} />
        <div className="call-body">
          <CustomerStage
            session={session}
            state={chat.state}
            typing={chat.pending}
            speaking={voice.customerSpeaking}
            latest={latestCustomer?.text ?? null}
            discoveries={chat.discoveries}
            variant={wide ? 'panel' : 'strip'}
          />
          <div className="chat glass">
            <MessageList
              turns={chat.turns}
              persona={persona}
              typing={chat.pending}
              onRetry={handleRetry}
              onListen={canHear ? voice.replay : undefined}
              guided={guided}
              signalKeys={chat.signalKeys}
              shifts={chat.shifts}
            />
            <p className="sr-only" role="status" aria-live="polite">
              {announcement}
            </p>
            <div className="chat-dock">
              <HintChips hints={hints} onPick={pickHint} />
              <Composer
                value={reply}
                onChange={changeReply}
                inputRef={replyRef}
                maxChars={limit}
                busy={chat.pending}
                blockedMessage={
                  chat.limitReached
                    ? 'This call has reached its message limit. End the call to get your coaching.'
                    : null
                }
                turnsRemaining={chat.turnsRemaining}
                onSend={sendTyped}
                voiceBar={
                  voiceOn ? (
                    <VoicePanel
                      voice={voice}
                      calling={calling}
                      handsFree={handsFree}
                      onHandsFree={setHandsFree}
                      onToggleCall={toggleCall}
                      customer={persona.name}
                      hasDraft={reply.trim() !== ''}
                      callRef={callButtonRef}
                    />
                  ) : undefined
                }
                footerExtra={
                  voiceOn ? undefined : <VoiceOptIn onEnabled={() => setFocusVoice((n) => n + 1)} />
                }
              />
            </div>
          </div>
        </div>
      </div>
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Call details"
        variant={wide ? 'dialog' : 'sheet'}
      >
        <ContextPanel session={session} state={chat.state} notes={notes} onNotes={setNotes} />
      </Dialog>
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
