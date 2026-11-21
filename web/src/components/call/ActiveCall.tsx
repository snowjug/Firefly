import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { VoiceOptIn } from '../voice/VoiceOptIn.tsx';
import { VoicePanel } from '../voice/VoicePanel.tsx';
import { atmosphereFor, cueLevelFor, shiftAnnouncement } from './atmosphere.ts';
import { CallDetails } from './CallDetails.tsx';
import { CallStrip } from './CallStrip.tsx';
import { ChamberModal } from './ChamberModal.tsx';
import { Composer } from './Composer.tsx';
import { Conversation } from './Conversation.tsx';
import { EndCallDialog } from './EndCallDialog.tsx';
import { HintLinks } from './HintLinks.tsx';
import { PresenceRail } from './PresenceRail.tsx';
import { useWorldPose } from './signal-bridge.tsx';
import { hintsFor, withStarter, type Hint, type HintId } from './hints.ts';
import { useCall } from './useCall.ts';
import { useCallVoice } from './useCallVoice.ts';
import { useCueEvents } from './useCueEvents.ts';

// The height of what is actually visible, kept as a number that is only read when the viewport
// says it changed. Reading `visualViewport.height` makes the browser lay the page out, and React
// asks for the snapshot on every render and every commit, so asking each time made every keystroke
// pay for a layout.
let visibleHeightNow = 0;
// How much of the page something (an on-screen keyboard) covers: the layout viewport minus the
// visible one. Pinch zoom shrinks the visible viewport too, and covers nothing, so it is not counted.
let coveredHeightNow = 0;
function readViewport() {
  const viewport = window.visualViewport;
  visibleHeightNow = viewport ? Math.round(viewport.height) : 0;
  coveredHeightNow =
    viewport && viewport.scale <= 1.05
      ? Math.max(0, Math.round(window.innerHeight - viewport.height))
      : 0;
}

function subscribeViewport(onChange: () => void) {
  const viewport = window.visualViewport;
  readViewport();
  const changed = () => {
    readViewport();
    onChange();
  };
  viewport?.addEventListener('resize', changed);
  return () => viewport?.removeEventListener('resize', changed);
}
const viewportHeight = () => visibleHeightNow;
const coveredHeight = () => coveredHeightNow;

/** The height of what is actually visible, so the composer stays above a mobile keyboard. */
function useVisibleHeight(): number {
  return useSyncExternalStore(subscribeViewport, viewportHeight, () => 0);
}

/** How much of the page is under something that will go away (a keyboard), in pixels. */
function useCoveredHeight(): number {
  return useSyncExternalStore(subscribeViewport, coveredHeight, () => 0);
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

/** The presence's size: large beside the conversation, small above it, a point on a phone. */
function presenceSize(layout: 'wide' | 'middle' | 'narrow', tall: boolean): number {
  if (layout === 'narrow') return 56;
  if (layout === 'middle') return 124;
  return tall ? 320 : 236;
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
  const [soundOn, setSound] = useSound();
  const wide = useMediaQuery('(min-width: 1024px)');
  const narrow = useMediaQuery('(max-width: 719px)');
  const tall = useMediaQuery('(min-height: 780px)');
  const visibleHeight = useVisibleHeight();
  const coveredHeight = useCoveredHeight();
  const landscapePhone = useMediaQuery('(max-height: 520px)');
  // Short on room: a landscape phone, a small window, or the keyboard covering most of a portrait phone.
  const short = landscapePhone || (visibleHeight > 0 && visibleHeight < 520);
  // Something that is about to go away (the keyboard) covers a good part of the page, as opposed to
  // a window that is simply small (a phone held sideways, a desktop zoomed to 400%).
  const keyboard = short && coveredHeight > 120;
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
  const { persona, config: setup } = session.scenario;
  const { voice, calling, handsFree, setHandsFree, toggleCall, hangUp } = useCallVoice({
    sessionId: session.id,
    allowed: voiceOn,
    customer: persona.name,
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
      void navigate('/home', { replace: true });
    } catch (error) {
      setEndError(errorMessage(error));
      setEnding(false);
    }
  };

  const openEnd = useCallback(() => {
    setEndError(null);
    setEndOpen(true);
  }, []);
  const openDetails = useCallback(() => setDetailsOpen(true), []);

  const guided = setup.mode === 'guided';
  const cue = cueLevelFor(setup.mode);
  // What the room is told about the customer. With cues off it is the same whatever the state is.
  const atmosphere = useMemo(() => atmosphereFor(chat.state, cue), [chat.state, cue]);
  const pose = useMemo(
    () => ({
      tension: atmosphere.tension,
      open: atmosphere.open,
      warmth: atmosphere.warmth,
      energy: atmosphere.energy,
      intensity: 1,
      recovering: atmosphere.recovering,
    }),
    [atmosphere],
  );
  useWorldPose(pose);

  const curveballs = chat.shifts.filter((shift) => shift.kind === 'curveball').length;
  const { announceFound } = useCueEvents({ cue, discoveries: chat.discoveries, curveballs });

  const hints = guided
    ? hintsFor({
        areas: session.scenario.expectedDiscoveryAreas,
        band: chat.state.band.id,
        traineeTurns: savedTraineeTurns,
        used: usedHints,
      })
    : [];
  const canHear = voiceOn && voice.support.synthesis;

  // A screen reader is told about each reply once (and, in guided practice, how the conversation
  // moved with it). The customer's voice is the announcement while a voice call is on; reading
  // it too would say it twice.
  const newestCustomer = chat.turns.findLast((turn) => turn.role === 'customer');
  const moved = chat.shifts
    .filter((shift) => shift.afterKey === newestCustomer?.key)
    .map((shift) => shiftAnnouncement(shift, persona.name, cue))
    .filter(Boolean);
  const announcement =
    calling && voice.support.synthesis
      ? ''
      : [chat.announcement, ...moved].filter(Boolean).join(' ');

  const layout = narrow ? 'narrow' : wide ? 'wide' : 'middle';
  const frame = visibleHeight > 0 ? { ['--vvh' as string]: `${visibleHeight}px` } : undefined;

  return (
    <div
      className="ch"
      data-mood={atmosphere.mood}
      data-trend={atmosphere.trend}
      data-mode={setup.mode}
      data-layout={layout}
      data-silent={atmosphere.silent || undefined}
      data-short={short || undefined}
      data-keyboard={keyboard || undefined}
      data-ending={ending || undefined}
      style={frame}
    >
      <CallStrip session={session} />
      <PresenceRail
        persona={persona}
        atmosphere={atmosphere}
        guided={guided}
        found={chat.state.discoveredCount}
        shifts={chat.state.shifts}
        announceFound={announceFound}
        speaking={chat.pending || voice.customerSpeaking}
        ending={ending}
        size={presenceSize(layout, tall)}
        soundOn={soundOn}
        onSound={setSound}
        onOpenDetails={openDetails}
        onEnd={openEnd}
      />
      <div className="ch-main world-veil">
        {guided && session.scenario.brief.goal ? (
          <p className="ch-objective">
            <span className="ch-eyebrow">Objective</span>
            <em>{session.scenario.brief.goal}</em>
          </p>
        ) : null}
        <Conversation
          turns={chat.turns}
          customer={persona.name}
          typing={chat.pending}
          cue={cue}
          signalKeys={chat.signalKeys}
          shifts={chat.shifts}
          moods={chat.moods}
          onRetry={handleRetry}
          onListen={canHear ? voice.replay : undefined}
        />
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
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
          ideas={<HintLinks hints={chat.limitReached ? [] : hints} onPick={pickHint} />}
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
      <ChamberModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Call details"
        variant="inspector"
      >
        <CallDetails session={session} notes={notes} onNotes={setNotes} />
      </ChamberModal>
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
