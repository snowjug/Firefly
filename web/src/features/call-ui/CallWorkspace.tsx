import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ClosingCheckDTO } from '#shared/domain/api.ts';
import { MAX_MESSAGE_CHARS } from '#shared/domain/text.ts';
import { Button, cx, Dialog, useAnnouncer, type CustomerState } from '../../design/index.ts';
import { TipsStrip } from '../tips/index.ts';
import type { CallActions, CallSnapshot } from '../call/contract.ts';
import {
  briefPathFor,
  composerGate,
  customerTurnCount,
  describeCaption,
  describeConnection,
  describeControls,
  describeCustomerState,
  describeStatus,
  isEndFailure,
  latestCustomerTurn,
  recoveryOptions,
  stateChangeSentence,
  traineeTurnCount,
  unsavedMessage,
  type CustomerStateView,
  type RecoveryAction,
} from './call-model.ts';
import { CallBar } from './CallBar.tsx';
import { CallLoadError, CallSkeleton, CallUnavailable, OpeningReport } from './CallStates.tsx';
import { CaseBody, CaseContext } from './CaseContext.tsx';
import { Composer } from './Composer.tsx';
import { Controls } from './Controls.tsx';
import { CustomerStage } from './CustomerStage.tsx';
import { EndCallDialog } from './EndCallDialog.tsx';
import { JumpLinks } from './JumpLinks.tsx';
import { Preflight } from './Preflight.tsx';
import { Recovery, RecoveryConfirmed, useRecoveryFeedback } from './Recovery.tsx';
import { Transcript } from './Transcript.tsx';
import {
  findControlsZone,
  findPauseControl,
  findTalkControl,
  useRescueFocus,
} from './use-rescue-focus.ts';
import {
  useLayoutMode,
  useReducedMotion,
  useShortScreen,
  useVisualViewportHeight,
} from './use-layout.ts';
import { VoiceSettings } from './VoiceSettings.tsx';
import './workspace.css';

/**
 * How long the call-ended moment lasts at least, counted from the press of End and review: long
 * enough to read "Call ended" and its time, and short enough that it is only what is left of a beat
 * after the real work (the call is closed on the server in a moment). It is the time of the ring's
 * collapse in the stylesheet (`--dur-slower`) and a little over; reduced motion has none.
 */
const ENDED_MOMENT_MS = 800;

/** The screen's own open and closed state, which a fixture or a test can start from. */
export interface InitialUi {
  caseOpen?: boolean;
  endOpen?: boolean;
  settingsOpen?: boolean;
  /** The tips strip is put away, as if "Hide tips" had been pressed. */
  tipsHidden?: boolean;
  /** What is already typed in the reply box. */
  draft?: string;
  notes?: string;
}

export interface CallWorkspaceProps {
  snapshot: CallSnapshot;
  actions: CallActions;
  /** Who writes the customer's replies: the built-in rules engine (`demo`) or a live model. */
  provider: { demo: boolean; label: string };
  /** The longest message the server accepts. */
  maxMessageChars?: number;
  /** The browser's own online state, read by the page. */
  online?: boolean;
  /** The address asked for a typed call (`?input=text`): the pre-flight leads with it. */
  preferText?: boolean;
  /** Where "Back to brief" goes. Left out, it is the brief for this scenario with this call's choices. */
  briefTo?: string;
  /** Developer diagnostics: say how each trainee turn arrived. Never on for a trainee. */
  showInputMode?: boolean;
  initialUi?: InitialUi;
  /** Called with the session id once ending has finished, so the page can open the report. */
  onEnded?(sessionId: string): void;
  /**
   * Said when ending starts (true), and again (false) if it did not work. While ending, the way to
   * the report is `onEnded` alone, which waits for the call-ended moment to be read: a page that
   * also opens the report when the engine says the call is over must hold back until then.
   */
  onEndingChange?(ending: boolean): void;
  /**
   * Leaves a call that has nothing to report (no message was ever sent) without a report. The end
   * dialog offers it only when ending failed for that reason.
   */
  onDiscard?(): void | Promise<void>;
  /**
   * Asks the server for the closing check shown when ending a guided call. The screen only draws
   * what comes back and never waits for it: a check that is slow or fails is left out.
   */
  loadClosingCheck?(signal: AbortSignal): Promise<ClosingCheckDTO>;
}

/**
 * The call screen as a pure view of a call's snapshot: it draws what the snapshot says and calls the
 * actions it is given, and never touches the microphone, audio or the speech APIs itself. Which
 * screen that is follows from the snapshot: loading, an error, the pre-flight step, or the workspace
 * with the end-of-call dialog over it. A call that is over opens the report, and in the moment
 * between, "Opening your review" is all there is; but when End and review was pressed here the
 * call-ended moment stays until it has been read, and then the report opens.
 */
export function CallWorkspace(props: CallWorkspaceProps) {
  const { snapshot, actions, onEndingChange } = props;
  const session = snapshot.session;
  const [endingHere, setEndingHere] = useState(false);
  if (snapshot.loading && !session) return <CallSkeleton />;
  if (snapshot.loadProblem) {
    return <CallLoadError problem={snapshot.loadProblem} onRetry={() => actions.retry()} />;
  }
  if (!session) return <CallUnavailable />;
  if (session.status !== 'active' && !endingHere) return <OpeningReport />;
  return (
    <ActiveCall
      {...props}
      onEndingChange={(ending) => {
        setEndingHere(ending);
        onEndingChange?.(ending);
      }}
    />
  );
}

// ---- What a screen reader hears ------------------------------------------------------------------

/**
 * The call announces itself in whole sentences through the page's one polite region: what the
 * engine says changed, and a change in the customer's state (once, and never why). Transcript text
 * is not announced here: the transcript log is the only place for that.
 */
function useCallAnnouncements(
  announcement: CallSnapshot['announcement'],
  state: CustomerStateView | null,
) {
  const announce = useAnnouncer();
  // An assertive announcement is for a problem that stops the trainee being heard: its card is an
  // alert, which says it, so the polite announcer must not say it a second time.
  const said = announcement && announcement.politeness === 'polite' ? announcement.text : '';
  const id = announcement?.id ?? 0;
  useEffect(() => {
    if (said) announce(said);
  }, [id, said, announce]);

  const tone = state?.tone ?? null;
  const previous = useRef<CustomerState | null>(tone);
  useEffect(() => {
    if (state && previous.current !== null && tone !== previous.current) {
      announce(stateChangeSentence(state));
    }
    previous.current = tone;
  }, [tone, state, announce]);
}

// ---- One active call -----------------------------------------------------------------------------

function ActiveCall(props: CallWorkspaceProps) {
  const { snapshot, actions, provider, preferText = false, briefTo } = props;
  const session = snapshot.session as NonNullable<CallSnapshot['session']>;
  const state = snapshot.customerState ?? session.state;
  const stateView = useMemo(
    () => describeCustomerState(state, snapshot.stateHistory),
    [state, snapshot.stateHistory],
  );
  useCallAnnouncements(snapshot.announcement, stateView);

  if (snapshot.phase === 'idle' || snapshot.phase === 'requesting-microphone') {
    return (
      <Preflight
        snapshot={snapshot}
        actions={actions}
        provider={provider}
        preferText={preferText}
        briefTo={briefTo ?? briefPathFor(session)}
      />
    );
  }
  return <Workspace {...props} stateView={stateView} />;
}

function Workspace({
  snapshot,
  actions,
  provider,
  maxMessageChars = MAX_MESSAGE_CHARS,
  online = true,
  showInputMode = false,
  initialUi,
  onEnded,
  onEndingChange,
  onDiscard,
  loadClosingCheck,
  stateView,
}: CallWorkspaceProps & { stateView: CustomerStateView | null }) {
  const session = snapshot.session as NonNullable<CallSnapshot['session']>;
  const { scenario } = session;
  const { persona } = scenario;
  const publicState = snapshot.customerState ?? session.state;
  const layout = useLayoutMode();
  const narrow = layout === 'narrow';
  const wide = layout === 'wide';
  const short = useShortScreen();
  const reducedMotion = useReducedMotion();
  const announce = useAnnouncer();
  const root = useRef<HTMLDivElement>(null);
  useVisualViewportHeight(root, narrow);

  const transcriptTitle = useId();
  const caseTitle = useId();
  const statusId = useId();

  const [caseOpen, setCaseOpen] = useState(initialUi?.caseOpen ?? false);
  const [settingsOpen, setSettingsOpen] = useState(initialUi?.settingsOpen ?? false);
  const [endOpen, setEndOpen] = useState(initialUi?.endOpen ?? false);
  const [endBusy, setEndBusy] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [notes, setNotes] = useState(initialUi?.notes ?? '');

  const { phase, stage, problem } = snapshot;
  const voice = snapshot.mode === 'voice';
  const closing = phase === 'ending' || phase === 'completed';
  const guided = scenario.config.mode === 'guided';
  const feedback = useRecoveryFeedback(snapshot, announce);

  const status = useMemo(
    () =>
      describeStatus({
        stage,
        mode: snapshot.mode,
        phase,
        speechDetected: snapshot.speechDetected,
        microphone: snapshot.microphone,
        problem,
        online,
        micOpen: snapshot.micOpen,
      }),
    [
      stage,
      snapshot.mode,
      phase,
      snapshot.speechDetected,
      snapshot.microphone,
      snapshot.micOpen,
      problem,
      online,
    ],
  );
  const connection = describeConnection({ online, reconnecting: feedback.reconnecting });
  const limitReached = problem?.code === 'turn-limit';
  const blocking = problem?.severity === 'blocking' ? problem : null;
  // A failure to end the call is told inside the end dialog, never as a second card.
  const card = problem && !isEndFailure(problem) ? problem : feedback.retrying;
  const controls = describeControls({
    phase,
    stage,
    mode: snapshot.mode,
    muted: snapshot.muted,
    paused: snapshot.paused,
    audio: snapshot.audio,
    canReplay: latestCustomerTurn(snapshot.turns) !== undefined,
    blocked: blocking !== null,
    limitReached,
    micOpen: snapshot.micOpen,
    handsFree: snapshot.handsFree,
    speechHeard: snapshot.speechDetected,
    autoListening: snapshot.autoListening,
    cardShown: card !== null,
  });
  const gate = composerGate({ phase, problem });
  // The words under the customer, where there is room for them (a narrow screen has the transcript
  // beside the stage, with the same words highlighted).
  const caption = useMemo(
    () =>
      narrow
        ? undefined
        : describeCaption({
            statusId: status.id,
            turns: snapshot.turns,
            interim: snapshot.interim,
          }),
    [narrow, status.id, snapshot.turns, snapshot.interim],
  );

  // A card that appears or goes takes the control that was pressed on it: if the keyboard was on
  // something that is gone, it goes to the call's controls and not to the top of the page.
  useRescueFocus(card?.code ?? null, findControlsZone);
  // Back to voice removes the reply box that held the keyboard: it goes to the microphone control.
  useRescueFocus(snapshot.mode, findTalkControl);
  // Pausing swaps the Pause button for Resume in the slot, and resuming swaps it back: the keyboard
  // follows to the button that now does the opposite.
  useRescueFocus(snapshot.paused, snapshot.paused ? findTalkControl : findPauseControl);
  // A hands-free call's slot holds what a press is for, and each thing in it leaves once it has been
  // used (Done speaking when the turn is sent, Stop customer audio when the voice stops): the keyboard
  // stays with the call's controls.
  useRescueFocus(
    `${controls.talk.kind}:${controls.finish.visible}:${controls.stopAudio.visible}`,
    findControlsZone,
  );
  // The pre-flight's button is gone once the call has begun: the keyboard starts on the microphone.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) findTalkControl()?.focus({ preventScroll: true });
  }, []);

  // Pressing End and review starts the call-ended moment, which is read before the report opens: a
  // short beat counted from the press, so it is only what is left of it after the real work (and
  // none at all when motion is reduced). The page holds back its own way to the report until then.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const confirmEnd = async () => {
    const started = performance.now();
    let opened = false;
    setEndBusy(true);
    onEndingChange?.(true);
    try {
      const result = await actions.endCall();
      if (result) {
        const left = reducedMotion ? 0 : ENDED_MOMENT_MS - (performance.now() - started);
        if (left > 0) await new Promise((resolve) => window.setTimeout(resolve, left));
        if (alive.current) onEnded?.(result.sessionId);
        opened = true;
      }
    } finally {
      setEndBusy(false);
      if (!opened) onEndingChange?.(false);
    }
  };
  const continueCall = () => {
    setEndOpen(false);
    // A failed attempt to end is not worth carrying about once the person has chosen to carry on.
    if (isEndFailure(problem)) actions.dismissProblem();
  };
  const discardCall = async () => {
    setDiscarding(true);
    try {
      await onDiscard?.();
    } finally {
      setDiscarding(false);
    }
  };

  const recover = (action: RecoveryAction) => {
    const target = problem ?? feedback.retrying;
    switch (action) {
      case 'retry':
        if (target) feedback.begin(target);
        actions.retry();
        return;
      case 'replay':
        if (target) feedback.begin(target);
        actions.replay();
        return;
      case 'use-text':
        actions.useText();
        return;
      case 'continue-without-audio':
        actions.setAudio(false);
        return;
      case 'end-safely':
      case 'end':
        setEndOpen(true);
        return;
    }
  };

  const zone = (layoutName: 'panel' | 'dock') => (
    <div className={cx('cw-zone', `cw-zone--${layoutName}`)}>
      {card ? (
        <Recovery
          problem={card}
          options={recoveryOptions(card, { mode: snapshot.mode })}
          busy={feedback.retrying !== null}
          live={card.announce === 'assertive'}
          onAction={recover}
        />
      ) : feedback.confirmed ? (
        <RecoveryConfirmed text={feedback.confirmed} onDismiss={feedback.dismiss} />
      ) : null}
      <Controls
        layout={layoutName}
        view={controls}
        statusId={statusId}
        hint={snapshot.hint}
        actions={actions}
        onSettings={() => setSettingsOpen(true)}
      />
    </div>
  );

  const caseBody = {
    session,
    found: publicState.discoveredCount,
    guided,
    notes,
    onNotes: setNotes,
  };
  const speaking = phase === 'customer-speaking' && !snapshot.paused;

  return (
    <div className="cw-root" ref={root} data-layout={layout}>
      <JumpLinks reply={!voice} />
      <h1 className="visually-hidden">Call with {persona.name}</h1>
      <CallBar
        showCase={!wide}
        scenarioTitle={scenario.title}
        product={scenario.product ? { id: scenario.product.id, name: scenario.product.name } : null}
        connection={connection}
        elapsedSeconds={snapshot.elapsedSeconds}
        provider={provider}
        onCase={() => setCaseOpen(true)}
        onEnd={() => setEndOpen(true)}
      />

      <div className="cw-body">
        <section className="cw-stage" aria-label="Customer">
          <div className="cw-stage__scroll">
            <CustomerStage
              name={persona.name}
              role={persona.role}
              organisation={persona.organisation}
              speaking={speaking}
              state={stateView}
              status={status}
              statusId={statusId}
              micLevel={snapshot.micLevel}
              customerLevel={snapshot.customerLevel}
              customerLevelMeasured={snapshot.customerLevelMeasured}
              reducedMotion={reducedMotion}
              compact={narrow}
              trace={guided ? snapshot.stateHistory : null}
              caption={caption}
            />
          </div>
          {narrow ? null : <div className="cw-stage__zone">{zone('panel')}</div>}
        </section>

        <div className="cw-transcript">
          <h2 className="cw-transcript__title" id={transcriptTitle}>
            Transcript
          </h2>
          <Transcript
            turns={snapshot.turns}
            customerName={persona.name}
            startedAt={session.startedAt}
            interim={phase === 'listening' ? snapshot.interim : ''}
            speaking={speaking}
            reducedMotion={reducedMotion}
            titleId={transcriptTitle}
            showInputMode={showInputMode}
          />
          {guided && !(narrow && short) ? (
            // A small phone has no room for the strip beside the transcript and the dock: the
            // transcript is what the screen is for, so the strip is left out there altogether.
            <TipsStrip
              stage={scenario.config.callStage}
              traineeTurns={traineeTurnCount(snapshot.turns)}
              customerTurns={customerTurnCount(snapshot.turns)}
              customerBusy={phase === 'customer-speaking'}
              defaultHidden={initialUi?.tipsHidden ?? false}
            />
          ) : null}
          {voice ? null : (
            <Composer
              maxChars={maxMessageChars}
              gate={gate}
              turnsRemaining={snapshot.turnsRemaining}
              sendText={actions.sendText}
              initialDraft={initialUi?.draft}
            />
          )}
        </div>

        {wide ? <CaseContext titleId={caseTitle} {...caseBody} /> : null}
      </div>

      {narrow ? <div className="cw-dock">{zone('dock')}</div> : null}

      <Dialog
        open={caseOpen && !wide}
        onClose={() => setCaseOpen(false)}
        title="Case"
        size="md"
        mobile="fullscreen"
        closeLabel="Close case"
        actions={
          <Button appearance="primary" onClick={() => setCaseOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="cw-sheet">
          <CaseBody {...caseBody} />
        </div>
      </Dialog>

      <VoiceSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        handsFree={snapshot.handsFree}
        language={snapshot.voiceDetails.language}
        audio={snapshot.audio}
        voice={snapshot.voiceDetails.voice}
        style={snapshot.voiceDetails.style}
        support={snapshot.support}
        provider={provider}
        actions={actions}
      />

      <EndCallDialog
        open={endOpen}
        ending={closing}
        progressLabel={status.label}
        busy={endBusy || closing}
        customerName={persona.name}
        elapsedSeconds={snapshot.elapsedSeconds}
        traineeTurns={traineeTurnCount(snapshot.turns)}
        stateLabel={stateView?.label ?? null}
        unsaved={unsavedMessage(snapshot.turns)}
        problem={problem}
        onDiscard={onDiscard ? () => void discardCall() : undefined}
        discarding={discarding}
        guided={guided}
        loadClosingCheck={loadClosingCheck}
        onContinue={continueCall}
        onConfirm={() => void confirmEnd()}
      />
    </div>
  );
}
