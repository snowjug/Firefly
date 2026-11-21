import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { MAX_MESSAGE_CHARS } from '#shared/domain/text.ts';
import { useAnnouncer, type CustomerState } from '../../design/index.ts';
import type { CallActions, CallSnapshot, CallProblem } from '../call/contract.ts';
import {
  briefPathFor,
  composerGate,
  describeConnection,
  describeCustomerState,
  describeStatus,
  isEndFailure,
  latestCustomerTurn,
  stateChangeSentence,
  tracePoints,
  traineeTurnCount,
  type CustomerStateView,
} from './call-model.ts';
import { CallLoadError, CallSkeleton, CallUnavailable, OpeningReport } from './CallStates.tsx';
import { CommandBar } from './CommandBar.tsx';
import { Composer } from './Composer.tsx';
import { ContextBody, ContextPanel } from './ContextPanel.tsx';
import { CustomerPanel } from './CustomerPanel.tsx';
import { DetailsSheet } from './DetailsSheet.tsx';
import { EndCallDialog } from './EndCallDialog.tsx';
import { JumpLinks } from './JumpLinks.tsx';
import { Preflight } from './Preflight.tsx';
import { ProblemNotice } from './ProblemNotice.tsx';
import { StagePanel } from './StagePanel.tsx';
import { Transcript } from './Transcript.tsx';
import { findControlsZone, useRescueFocus } from './use-rescue-focus.ts';
import { VoiceSettings } from './VoiceSettings.tsx';
import { VoiceZone } from './VoiceZone.tsx';
import { useLayoutMode, useReducedMotion, useVisualViewportHeight } from './use-layout.ts';
import './workspace.css';

/** The screen's own open and closed state, which a fixture or a test can start from. */
export interface InitialUi {
  detailsOpen?: boolean;
  endOpen?: boolean;
  settingsOpen?: boolean;
  composerOpen?: boolean;
  draft?: string;
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
  initialUi?: InitialUi;
  /** Called with the session id once ending has finished, so the page can open the report. */
  onEnded?(sessionId: string): void;
  /**
   * Leaves a call that has nothing to report (no message was ever sent) without a report. The end
   * dialog offers it only when ending failed for that reason.
   */
  onDiscard?(): void | Promise<void>;
}

/**
 * The call screen as a pure view of a call's snapshot: it draws what the snapshot says and calls the
 * actions it is given, and never touches the microphone, audio or the speech APIs itself. Which
 * screen that is follows from the snapshot: loading, an error, the pre-flight step, or the workspace
 * with the end-of-call dialog over it.
 */
export function CallWorkspace(props: CallWorkspaceProps) {
  const { snapshot, actions } = props;
  const session = snapshot.session;
  if (snapshot.loading && !session) return <CallSkeleton />;
  if (snapshot.loadProblem) {
    return <CallLoadError problem={snapshot.loadProblem} onRetry={() => actions.retry()} />;
  }
  if (!session) return <CallUnavailable />;
  if (session.status !== 'active') return <OpeningReport />;
  return <ActiveCall {...props} />;
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
  const said = announcement?.text ?? '';
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

function ActiveCall({
  snapshot,
  actions,
  provider,
  maxMessageChars = MAX_MESSAGE_CHARS,
  online = true,
  preferText = false,
  briefTo,
  initialUi,
  onEnded,
  onDiscard,
}: CallWorkspaceProps) {
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
  return (
    <Workspace
      snapshot={snapshot}
      actions={actions}
      provider={provider}
      maxMessageChars={maxMessageChars}
      online={online}
      initialUi={initialUi}
      onEnded={onEnded}
      onDiscard={onDiscard}
      stateView={stateView}
    />
  );
}

interface WorkspaceProps {
  snapshot: CallSnapshot;
  actions: CallActions;
  provider: { demo: boolean; label: string };
  maxMessageChars: number;
  online: boolean;
  initialUi?: InitialUi;
  onEnded?(sessionId: string): void;
  onDiscard?(): void | Promise<void>;
  stateView: CustomerStateView | null;
}

/** A problem that is shown once the call can carry on through it, or when ending failed. */
function inlineProblem(problem: CallProblem | null, endDialogOpen: boolean): CallProblem | null {
  if (!problem || problem.severity !== 'degraded') return null;
  return isEndFailure(problem) && endDialogOpen ? null : problem;
}

function Workspace({
  snapshot,
  actions,
  provider,
  maxMessageChars,
  online,
  initialUi,
  onEnded,
  onDiscard,
  stateView,
}: WorkspaceProps) {
  const session = snapshot.session as NonNullable<CallSnapshot['session']>;
  const { scenario } = session;
  const { persona } = scenario;
  const publicState = snapshot.customerState ?? session.state;
  const layout = useLayoutMode();
  const narrow = layout === 'narrow';
  const reducedMotion = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  useVisualViewportHeight(root, narrow);

  const transcriptTitle = useId();
  const stageTitle = useId();
  const contextTitle = useId();

  const [detailsOpen, setDetailsOpen] = useState(initialUi?.detailsOpen ?? false);
  const [settingsOpen, setSettingsOpen] = useState(initialUi?.settingsOpen ?? false);
  const [endOpen, setEndOpen] = useState(initialUi?.endOpen ?? false);
  const [endBusy, setEndBusy] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [composer, setComposer] = useState({
    open: initialUi?.composerOpen ?? false,
    focusRequest: 0,
  });

  const { phase, problem } = snapshot;
  const voice = snapshot.mode === 'voice';
  const closing = phase === 'ending' || phase === 'completed';
  const guided = scenario.config.mode === 'guided';
  const status = useMemo(
    () =>
      describeStatus({
        phase,
        mode: snapshot.mode,
        muted: snapshot.muted,
        paused: snapshot.paused,
        speechDetected: snapshot.speechDetected,
        handsFree: snapshot.handsFree,
        problem,
        hint: snapshot.hint,
      }),
    [
      phase,
      snapshot.mode,
      snapshot.muted,
      snapshot.paused,
      snapshot.speechDetected,
      snapshot.handsFree,
      snapshot.hint,
      problem,
    ],
  );
  const connection = describeConnection(snapshot, online);
  const points = useMemo(
    () => tracePoints(snapshot.stateHistory, publicState),
    [snapshot.stateHistory, publicState],
  );
  const gate = composerGate({ phase, problem });
  const limitReached = problem?.code === 'turn-limit';
  const traineeTurns = traineeTurnCount(snapshot.turns);
  const canReplay =
    snapshot.support.playback !== 'none' && latestCustomerTurn(snapshot.turns) !== undefined;
  const blocking = problem?.severity === 'blocking' ? problem : null;
  const inline = inlineProblem(problem, endOpen);
  // A notice above the reply box goes away with the button that was pressed on it.
  useRescueFocus(inline?.code ?? null, findControlsZone);

  const openComposer = useCallback(
    () => setComposer((current) => ({ open: true, focusRequest: current.focusRequest + 1 })),
    [],
  );
  const closeComposer = useCallback(
    () => setComposer((current) => ({ ...current, open: false })),
    [],
  );
  // The same function every render, so the transcript's rows are not redrawn when only the clock or
  // the microphone level changed (see Transcript.tsx).
  const retryTurn = useCallback(() => actions.retry(), [actions]);
  // A typed call always has the box; a spoken one also shows it while a problem offers typing.
  const composerOpen = !voice || composer.open || Boolean(problem?.textFallback);

  const confirmEnd = async () => {
    setEndBusy(true);
    try {
      const result = await actions.endCall();
      if (result) onEnded?.(result.sessionId);
    } finally {
      setEndBusy(false);
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

  const zone = (layoutName: 'panel' | 'dock') => (
    <VoiceZone
      layout={layoutName}
      status={status}
      micLevel={snapshot.micLevel}
      customerLevel={snapshot.customerLevel}
      reducedMotion={reducedMotion}
      voice={voice}
      blocking={blocking}
      problemActions={{
        onRetry: () => actions.retry(),
        onTypeInstead: openComposer,
        onEnd: () => setEndOpen(true),
      }}
      controls={{
        phase,
        muted: snapshot.muted,
        paused: snapshot.paused,
        handsFree: snapshot.handsFree,
        canReplay,
        limitReached,
        hint: snapshot.hint,
        actions,
        onTypeInstead: openComposer,
        onOpenSettings: () => setSettingsOpen(true),
      }}
    />
  );

  const customer = {
    name: persona.name,
    role: persona.role,
    organisation: persona.organisation,
    speaking: phase === 'customer-speaking' && !snapshot.paused,
    view: stateView,
    points,
    guided,
    contextFound: publicState.discoveredCount,
  };

  return (
    <div className="cw-root" ref={root} data-layout={layout}>
      <JumpLinks onReply={openComposer} />
      <h1 className="visually-hidden">Call with {persona.name}</h1>
      <CommandBar
        compact={narrow}
        showDetails={layout !== 'wide'}
        scenarioTitle={scenario.title}
        customerName={persona.name}
        customerRole={persona.role}
        connection={connection}
        elapsedSeconds={snapshot.elapsedSeconds}
        difficulty={scenario.config.difficulty}
        provider={provider}
        state={stateView}
        onDetails={() => setDetailsOpen(true)}
        onEnd={() => setEndOpen(true)}
      />

      <div className="cw-body">
        {narrow ? null : (
          <StagePanel titleId={stageTitle} customer={customer}>
            {zone('panel')}
          </StagePanel>
        )}

        <section className="cw-transcript">
          <header className="cw-transcript__head">
            <h2 className="cw-transcript__title" id={transcriptTitle}>
              Transcript
            </h2>
            <p className="cw-transcript__note">
              Everything the customer says is shown here as it is spoken.
            </p>
          </header>
          <Transcript
            turns={snapshot.turns}
            customerName={persona.name}
            startedAt={session.startedAt}
            interim={phase === 'listening' ? snapshot.interim : ''}
            reducedMotion={reducedMotion}
            titleId={transcriptTitle}
            onRetry={retryTurn}
          />
          {inline ? (
            <ProblemNotice
              problem={inline}
              variant="inline"
              onRetry={() => actions.retry()}
              onTypeInstead={openComposer}
              onDismiss={() => actions.dismissProblem()}
              onPlay={() => actions.replay()}
            />
          ) : null}
          <Composer
            open={composerOpen}
            canClose={voice && composer.open && !problem?.textFallback}
            showRow={voice && !narrow}
            focusRequest={composer.focusRequest}
            onOpen={openComposer}
            onClose={closeComposer}
            maxChars={maxMessageChars}
            gate={gate}
            turnsRemaining={snapshot.turnsRemaining}
            sendText={actions.sendText}
            initialDraft={initialUi?.draft}
          />
        </section>

        {layout === 'wide' ? (
          <ContextPanel session={session} provider={provider} titleId={contextTitle} />
        ) : null}
      </div>

      {narrow ? <div className="cw-dock">{zone('dock')}</div> : null}

      <DetailsSheet open={detailsOpen && layout !== 'wide'} onClose={() => setDetailsOpen(false)}>
        {narrow ? <CustomerPanel {...customer} /> : null}
        <ContextBody session={session} provider={provider} />
      </DetailsSheet>

      <VoiceSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        handsFree={snapshot.handsFree}
        language={snapshot.voiceDetails.language}
        voice={snapshot.voiceDetails.voice}
        style={snapshot.voiceDetails.style}
        support={snapshot.support}
        actions={actions}
      />

      <EndCallDialog
        open={endOpen}
        ending={closing}
        busy={endBusy || closing}
        elapsedSeconds={snapshot.elapsedSeconds}
        traineeTurns={traineeTurns}
        voice={voice}
        stateLabel={stateView?.label ?? null}
        problem={problem}
        onDiscard={onDiscard ? () => void discardCall() : undefined}
        discarding={discarding}
        onContinue={continueCall}
        onConfirm={() => void confirmEnd()}
      />
    </div>
  );
}
