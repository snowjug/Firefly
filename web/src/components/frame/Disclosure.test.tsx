import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Disclosure } from './index.ts';

describe('Disclosure', () => {
  it('is closed until it is opened, with the summary as the control', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Disclosure summary="How was this score worked out?">The rubric.</Disclosure>,
    );
    const details = container.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await user.click(screen.getByText('How was this score worked out?'));
    expect(details.open).toBe(true);
    await user.click(screen.getByText('How was this score worked out?'));
    expect(details.open).toBe(false);
  });

  it('can start open', () => {
    const { container } = render(
      <>
        <Disclosure summary="Open from the start" defaultOpen>
          Already here.
        </Disclosure>
        <Disclosure summary="Closed at first">Hidden.</Disclosure>
      </>,
    );
    const [first, second] = container.querySelectorAll('details');
    expect(first?.open).toBe(true);
    expect(second?.open).toBe(false);
  });

  it('draws its mark without announcing it', () => {
    const { container } = render(<Disclosure summary="More">Body</Disclosure>);
    expect(container.querySelector('.ff-disclosure__mark')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows everything on paper and goes back to what the reader chose', () => {
    const { container } = render(<Disclosure summary="Details">Body</Disclosure>);
    const details = container.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(details.open).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(details.open).toBe(false);
  });

  it('remembers what the reader chose when the page is printed', () => {
    const { container } = render(<Disclosure summary="Details">Body</Disclosure>);
    const details = container.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(details.open).toBe(true);
  });
});
