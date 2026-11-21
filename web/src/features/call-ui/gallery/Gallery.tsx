import { useEffect, useMemo, useRef, useState } from 'react';
import type { CallActions, CallSnapshot, CallStage } from '../../call/contract.ts';
import { SkipLink } from '../../../app/shell/Shell.tsx';
import { TextLink } from '../../../design/index.ts';
import { CallWorkspace } from '../CallWorkspace.tsx';
import {
  FIXTURE_NAMES,
  FIXTURES,
  isFixtureName,
  type CallFixture,
  type FixtureGroup,
  type FixtureName,
} from '../call-fixtures.ts';

const GROUPS: FixtureGroup[] = [
  'Screens',
  'Stages of a turn',
  'Modes',
  'Problems',
  'Customer state',
  'Dialogs',
];

const DEMO_PROVIDER = { demo: true, label: 'Demo mode (built-in rules engine)' };
const LIVE_PROVIDER = { demo: false, label: 'Azure OpenAI (gpt-4o)' };

/** A level that wanders like a voice does: slow swells with quick flutter. */
function wander(time: number, floor: number, span: number): number {
  const swell = 0.5 + 0.5 * Math.sin(time * 2.1);
  const flutter = 0.5 + 0.5 * Math.sin(time * 9.7 + Math.sin(time * 3.3));
  return Math.min(1, floor + span * swell * flutter);
}

function Index() {
  return (
    <main id="main" className="cg-index">
      <SkipLink />
      <div className="cg-index__intro">
        <h1 className="t-title2">Call screen gallery</h1>
        <p className="t-reading t-muted">
          Every state of the call screen, from typed fixtures. Add <code>&amp;animate=1</code> to
          move the levels, <code>&amp;provider=live</code> to label a live model and{' '}
          <code>&amp;online=0</code> to go offline. Development only.
        </p>
      </div>
      {GROUPS.map((group) => {
        const names = FIXTURE_NAMES.filter((name) => FIXTURES[name].group === group);
        return (
          <section className="cg-index__group" key={group} aria-labelledby={`group-${group}`}>
            <h2 className="t-subtitle1" id={`group-${group}`}>
              {group}
            </h2>
            <ul className="cg-index__list" role="list">
              {names.map((name) => (
                <li className="cg-index__item" key={name}>
                  <TextLink href={`?state=${name}`}>{FIXTURES[name].title}</TextLink>
                  <span className="cg-index__name">{name}</span>
                  <span className="t-meta">{FIXTURES[name].description}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

function FixtureView({
  fixture,
  animate,
  live,
  offline,
}: {
  fixture: CallFixture;
  animate: boolean;
  live: boolean;
  offline: boolean;
}) {
  const [snapshot, setSnapshot] = useState<CallSnapshot>(fixture.snapshot);
  const before = useRef<{ phase: CallSnapshot['phase']; stage: CallStage }>({
    phase: fixture.snapshot.phase,
    stage: fixture.snapshot.stage,
  });

  // A few actions do something, so the controls can be tried by hand. None of them goes anywhere.
  const actions = useMemo<CallActions>(() => {
    const update = (
      change: Partial<CallSnapshot> | ((current: CallSnapshot) => Partial<CallSnapshot>),
    ) =>
      setSnapshot((current) => ({
        ...current,
        ...(typeof change === 'function' ? change(current) : change),
      }));
    return {
      begin: async ({ voice }) =>
        update({
          phase: 'ready-for-next-turn',
          stage: 'ready',
          mode: voice ? 'voice' : 'text',
          microphone: voice ? 'granted' : 'unknown',
          problem: null,
        }),
      talk: () => update({ phase: 'listening', stage: 'listening', micOpen: true, hint: null }),
      stopTalking: () =>
        update({
          phase: 'transcribing',
          stage: 'transcribing',
          speechDetected: false,
          micLevel: 0,
        }),
      toggleMute: () =>
        update((current) => ({
          muted: !current.muted,
          stage: current.muted ? 'ready' : 'muted',
          phase: 'ready-for-next-turn',
        })),
      togglePause: () =>
        update((current) => ({
          paused: !current.paused,
          stage: current.paused ? 'ready' : 'paused',
          phase: 'ready-for-next-turn',
        })),
      setHandsFree: (on) => update({ handsFree: on }),
      setLanguage: (language) =>
        update((current) => ({ voiceDetails: { ...current.voiceDetails, language } })),
      useText: () => update({ mode: 'text', phase: 'ready-for-next-turn', stage: 'ready' }),
      setAudio: (on) => update({ audio: on ? 'on' : 'off', problem: null }),
      interrupt: () =>
        update({
          phase: 'ready-for-next-turn',
          stage: 'ready',
          customerLevel: 0,
        }),
      replay: () =>
        update({ phase: 'customer-speaking', stage: 'customer-speaking', problem: null }),
      sendText: async () => true,
      retry: () => update({ problem: null, stage: 'retrying', phase: 'processing' }),
      dismissProblem: () => update({ problem: null }),
      endCall: async () => {
        before.current = { phase: fixture.snapshot.phase, stage: fixture.snapshot.stage };
        update({ phase: 'ending', stage: 'evaluating' });
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        update(before.current);
        return null;
      },
    };
  }, [fixture]);

  useEffect(() => {
    document.title = `${fixture.title} · call gallery`;
  }, [fixture.title]);

  useEffect(() => {
    if (!animate) return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const time = (performance.now() - started) / 1000;
      setSnapshot((current) => ({
        ...current,
        micLevel:
          current.phase === 'listening'
            ? current.speechDetected
              ? wander(time, 0.25, 0.7)
              : wander(time, 0.02, 0.18)
            : 0,
        customerLevel: current.phase === 'customer-speaking' ? wander(time, 0.15, 0.7) : 0,
      }));
    }, 66);
    return () => window.clearInterval(timer);
  }, [animate]);

  return (
    <>
      <SkipLink />
      <main id="main" tabIndex={-1} className="ff-main">
        <CallWorkspace
          snapshot={snapshot}
          actions={actions}
          provider={live ? LIVE_PROVIDER : (fixture.view?.provider ?? DEMO_PROVIDER)}
          online={offline ? false : (fixture.view?.online ?? true)}
          preferText={fixture.view?.preferText}
          briefTo="/scenarios"
          initialUi={fixture.view?.initialUi}
          showInputMode={fixture.view?.showInputMode}
          onDiscard={() => undefined}
        />
      </main>
    </>
  );
}

export function Gallery() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('state');
  if (!isFixtureName(name)) return <Index />;
  const fixtureName: FixtureName = name;
  return (
    <FixtureView
      key={fixtureName}
      fixture={FIXTURES[fixtureName]}
      animate={params.get('animate') === '1'}
      live={params.get('provider') === 'live'}
      offline={params.get('online') === '0'}
    />
  );
}
