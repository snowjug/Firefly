import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SplitView } from '../index.ts';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'matchMedia');
});

/** jsdom has no layout: say whether the viewport counts as narrow (below 64em). */
function viewport(narrow: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: narrow && query.includes('max-width'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
}

function View({ detailOpen, onBack }: { detailOpen: boolean; onBack?: () => void }) {
  return (
    <SplitView
      listLabel="Scenarios"
      detailLabel="Scenario details"
      list={<p>The list</p>}
      detail={<p>The detail</p>}
      detailOpen={detailOpen}
      onBack={onBack}
      backLabel="Back to scenarios"
    />
  );
}

describe('SplitView', () => {
  it('has two named regions: the list and the detail', () => {
    render(<View detailOpen={false} />);
    expect(screen.getByRole('region', { name: 'Scenarios' })).toHaveTextContent('The list');
    expect(screen.getByRole('region', { name: 'Scenario details' })).toHaveTextContent(
      'The detail',
    );
  });

  it('offers a Back control only when asked, and it calls back once', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { rerender } = render(<View detailOpen />);
    expect(screen.queryByRole('button', { name: 'Back to scenarios' })).not.toBeInTheDocument();
    rerender(<View detailOpen onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back to scenarios' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the detail when it opens on a narrow screen, and back to the list when it closes', () => {
    viewport(true);
    const { rerender } = render(<View detailOpen={false} />);
    expect(document.body).toHaveFocus();
    rerender(<View detailOpen />);
    expect(screen.getByRole('region', { name: 'Scenario details' })).toHaveFocus();
    rerender(<View detailOpen={false} />);
    expect(screen.getByRole('region', { name: 'Scenarios' })).toHaveFocus();
  });

  it('leaves focus alone on a wide screen, where both panes are already in view', () => {
    viewport(false);
    const { rerender } = render(<View detailOpen={false} />);
    rerender(<View detailOpen />);
    expect(document.body).toHaveFocus();
  });

  it('never takes focus on the first render, even when the detail starts open', () => {
    viewport(true);
    render(<View detailOpen />);
    expect(document.body).toHaveFocus();
  });

  it('shows the detail again, as new content, when its key changes', () => {
    const { container, rerender } = render(
      <SplitView
        listLabel="Scenarios"
        detailLabel="Details"
        list="list"
        detail="first"
        detailKey="a"
      />,
    );
    const first = container.querySelector('.ff-split__content');
    expect(first).toHaveTextContent('first');
    act(() => {
      rerender(
        <SplitView
          listLabel="Scenarios"
          detailLabel="Details"
          list="list"
          detail="second"
          detailKey="b"
        />,
      );
    });
    const second = container.querySelector('.ff-split__content');
    expect(second).toHaveTextContent('second');
    expect(second).not.toBe(first);
  });
});
