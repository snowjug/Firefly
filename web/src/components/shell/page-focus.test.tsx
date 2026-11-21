import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePageFocus } from './page-focus.ts';

beforeEach(() => {
  window.scrollTo = vi.fn();
});

// Two stand-ins for the shells: each has the hook and its own page.
function Frame({ name, to }: { name: string; to: string }) {
  usePageFocus(() => document.getElementById('main'));
  return (
    <>
      <Link to={to}>go from {name}</Link>
      <main id="main" tabIndex={-1}>
        {name}
      </main>
    </>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/front" element={<Frame name="front door" to="/app" />} />
        <Route path="/app" element={<Frame name="app" to="/front" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('usePageFocus', () => {
  it('leaves focus alone when the document has just loaded', () => {
    renderAt('/front');
    expect(document.body).toHaveFocus();
  });

  it('puts focus on the new page when a link goes to a different frame, which has just mounted', async () => {
    const user = userEvent.setup();
    renderAt('/front');
    await user.click(screen.getByRole('link', { name: 'go from front door' }));
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    expect(screen.getByRole('main')).toHaveTextContent('app');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
