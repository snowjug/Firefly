import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDTO } from '#shared/domain/api.ts';
import { ApiError, api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import { useStartCall, type CallRequest } from './use-start-call.ts';

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { createSession: vi.fn() } };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/scenarios/s/brief']}>{children}</MemoryRouter>
);

const base: CallRequest = { scenarioId: 's', overrides: {}, mode: 'immersive', voice: 'voice-b' };
const session = (id: string) => ({ id }) as unknown as SessionDTO;
const body = (call = 0) => vi.mocked(api.createSession).mock.calls[call]?.[0];

/** The hook, and where the router is, so a test can see where starting a call led. */
function setup(request: CallRequest = base) {
  const view = renderHook(
    (props: CallRequest) => ({ call: useStartCall(props), location: useLocation() }),
    { wrapper, initialProps: request },
  );
  const where = () =>
    `${view.result.current.location.pathname}${view.result.current.location.search}`;
  return { ...view, where };
}

beforeEach(() => {
  vi.mocked(api.createSession).mockResolvedValue(session('call-0001'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(api.createSession).mockReset();
});

describe('starting a call from the brief', () => {
  it('sends the part of the day from the trainee\u2019s clock, with the request id', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 21, 9, 5));
    const { result } = setup();
    await act(() => result.current.call.start('voice'));
    expect(body()).toMatchObject({ scenarioId: 's', mode: 'immersive', timeOfDay: 'morning' });
    expect(body()?.clientRequestId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('opens the call as a voice call, saying which voice was chosen', async () => {
    const { result, where } = setup();
    await act(() => result.current.call.start('voice'));
    await waitFor(() => expect(where()).toBe('/calls/call-0001?input=voice&voice=voice-b'));
  });

  it('opens a typed call too, and leaves the voice out when none is known', async () => {
    const { result, where } = setup({ ...base, voice: undefined });
    await act(() => result.current.call.start('text'));
    await waitFor(() => expect(where()).toBe('/calls/call-0001?input=text'));
  });

  it('does not send the voice to the server: it is not part of the request', async () => {
    const { result } = setup();
    await act(() => result.current.call.start('voice'));
    expect(body()).not.toHaveProperty('voice');
  });

  it('never makes two calls from two presses at once', async () => {
    let finish: (value: SessionDTO) => void = () => undefined;
    vi.mocked(api.createSession).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result, where } = setup();
    act(() => {
      void result.current.call.start('voice');
      void result.current.call.start('voice');
    });
    expect(api.createSession).toHaveBeenCalledTimes(1);
    await act(async () => finish(session('call-0002')));
    await waitFor(() => expect(where()).toContain('/calls/call-0002'));
  });

  it('retries with the same request id and the same part of the day, even after the clock moves on', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 21, 11, 59));
    vi.mocked(api.createSession).mockRejectedValueOnce(new ApiError(0, 'network', 'x', true));
    const { result } = setup();
    await act(() => result.current.call.start('voice'));
    expect(result.current.call.failure?.retryable).toBe(true);

    vi.setSystemTime(new Date(2026, 10, 21, 12, 1));
    await act(() => result.current.call.retry());
    expect(api.createSession).toHaveBeenCalledTimes(2);
    expect(body(1)?.clientRequestId).toBe(body(0)?.clientRequestId);
    expect(body(0)?.timeOfDay).toBe('morning');
    expect(body(1)?.timeOfDay).toBe('morning');
  });

  it('keeps the request id when only the voice changes, because the server never sees the voice', async () => {
    vi.mocked(api.createSession).mockRejectedValueOnce(new ApiError(0, 'network', 'x', true));
    const { result, rerender, where } = setup();
    await act(() => result.current.call.start('voice'));
    rerender({ ...base, voice: 'voice-d' });
    await act(() => result.current.call.retry());
    expect(body(1)?.clientRequestId).toBe(body(0)?.clientRequestId);
    await waitFor(() => expect(where()).toBe('/calls/call-0001?input=voice&voice=voice-d'));
  });

  it('gives a different request a new id', async () => {
    vi.mocked(api.createSession).mockRejectedValue(new ApiError(0, 'network', 'x', true));
    const { result, rerender } = setup();
    await act(() => result.current.call.start('voice'));
    rerender({ ...base, overrides: { difficulty: 'challenge' } });
    await act(() => result.current.call.start('voice'));
    expect(body(1)?.clientRequestId).not.toBe(body(0)?.clientRequestId);
    expect(body(1)?.overrides).toEqual({ difficulty: 'challenge' });
  });
});
