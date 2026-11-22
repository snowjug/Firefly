import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import { defaultVoiceFor, isVoiceId } from '#shared/domain/voices.ts';
import { preferredLanguage } from '../features/call-ui/call-model.ts';
import { CallWorkspace } from '../features/call-ui/CallWorkspace.tsx';
import { CallLoadError, CallSkeleton, COULD_NOT_OPEN } from '../features/call-ui/CallStates.tsx';
import { useCall } from '../features/call/useCall.ts';
import { useAppConfig } from '../lib/config.tsx';
import { api } from '../lib/api.ts';
import { useDocumentTitle, useOnline } from '../lib/hooks.ts';

const reportPath = (sessionId: string) => `/sessions/${encodeURIComponent(sessionId)}/report`;

/**
 * The call page: the call engine feeding the call screen. This file only joins the two. It waits for
 * the server's settings (the call needs to know what speech the server offers), runs the engine for
 * the session in the address, and opens the report once the call is over.
 */
export default function Call() {
  const { id = '' } = useParams();
  const { config, error, reload } = useAppConfig();
  if (error) {
    return (
      <Titled>
        <CallLoadError problem={COULD_NOT_OPEN} onRetry={reload} />
      </Titled>
    );
  }
  if (!config) {
    return (
      <Titled>
        <CallSkeleton />
      </Titled>
    );
  }
  return <CallSession key={id} sessionId={id} config={config} />;
}

/** The page title while there is no call to name yet. */
function Titled({ children }: { children: ReactNode }) {
  useDocumentTitle('Call');
  return children;
}

function CallSession({ sessionId, config }: { sessionId: string; config: AppConfigDTO }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const online = useOnline();
  // The voice the trainee chose arrives in the address (`?voice=`); a call opened without one, or
  // with one that is not a voice, speaks in its scenario's own. The scenario is only known once the
  // call has loaded, so it is read back from the snapshot, in the render that follows.
  const asked = params.get('voice');
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const voice = isVoiceId(asked) ? asked : scenarioId === null ? null : defaultVoiceFor(scenarioId);
  const { snapshot, actions } = useCall(sessionId, {
    serverSpeech: config.speech,
    language: preferredLanguage(
      typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]),
    ),
    maxTraineeTurns: config.limits.maxTraineeTurns,
    ...(voice ? { voice } : {}),
  });
  const { session } = snapshot;
  const loadedScenario = session?.scenarioId ?? null;
  if (loadedScenario !== scenarioId) setScenarioId(loadedScenario);

  useDocumentTitle(session ? `Call with ${session.scenario.persona.name}` : 'Call');

  // A call that is over (or never was open) belongs to the report, not to this page. That includes a
  // call that turned out to have ended somewhere else, such as in another tab: the report says what
  // became of it, whether it was finished or deleted. While End and review shows the call-ended
  // moment the workspace opens the report itself, when the moment has been read, so the engine
  // saying the call is over must not open it underneath.
  const [ending, setEnding] = useState(false);
  const over =
    !ending &&
    ((session !== null && session.status !== 'active') ||
      snapshot.phase === 'completed' ||
      snapshot.problem?.code === 'session-ended');
  useEffect(() => {
    if (over) navigate(reportPath(sessionId), { replace: true });
  }, [over, navigate, sessionId]);

  // A call with no message in it has nothing to report. Leaving it closes the empty call; if that
  // cannot be done (offline, busy) the person still leaves, and nothing is lost: there was nothing.
  const discard = async () => {
    try {
      await api.deleteSession(sessionId);
    } catch {
      // An empty call that stays open is harmless.
    }
    navigate('/scenarios', { replace: true });
  };

  return (
    <CallWorkspace
      snapshot={snapshot}
      actions={actions}
      provider={{ demo: config.provider.demo, label: config.provider.label }}
      maxMessageChars={config.limits.maxMessageChars}
      online={online}
      preferText={params.get('input') === 'text'}
      showInputMode={config.features.devDiagnostics}
      onEnded={(endedId) => navigate(reportPath(endedId), { replace: true })}
      onEndingChange={setEnding}
      onDiscard={discard}
      loadClosingCheck={(signal) => api.closingCheck(sessionId, signal)}
    />
  );
}
