import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from './OfflineBanner.tsx';

function setOnline(value: boolean) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

afterEach(() => vi.restoreAllMocks());

describe('OfflineBanner', () => {
  it('stays out of the way while connected', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says what is and is not affected while offline, and clears when the connection returns', () => {
    render(<OfflineBanner />);
    setOnline(false);
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('You appear to be offline');
    expect(notice).toHaveTextContent('What you have already sent is saved');
    setOnline(true);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
