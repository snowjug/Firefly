import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { markVoiceSession } from '../../lib/voice-sessions.ts';
import { ReportMeta } from './ReportMeta.tsx';
import { makeReport, makeSession } from './report.fixtures.ts';

function renderMeta(sessionId: string) {
  return render(
    <MemoryRouter>
      <ReportMeta session={makeSession({ id: sessionId })} report={makeReport()} />
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

describe('ReportMeta: voice caution', () => {
  it('stays quiet for a call that was typed', () => {
    renderMeta('typed-call');
    expect(screen.queryByText(/You used voice in this call/)).not.toBeInTheDocument();
  });

  it('reminds the learner that recognition can mishear words when the call used voice', () => {
    markVoiceSession('spoken-call');
    renderMeta('spoken-call');
    const note = screen.getByText(/You used voice in this call/);
    expect(note).toHaveTextContent(/check the quotes below against the transcript/);
    expect(note).toHaveTextContent(/words only, not tone, accent or pace/);
  });
});
