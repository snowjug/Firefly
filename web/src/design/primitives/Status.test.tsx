import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PRODUCT_IDS, PRODUCT_INFO } from '#shared/domain/vocab.ts';
import { ProductIcon, ProgressShimmer, StatusBadge } from '../index.ts';

afterEach(cleanup);

describe('StatusBadge', () => {
  it('writes the state in words, with a dot that is not read out', () => {
    const { container } = render(<StatusBadge label="Listening" tone="info" live />);
    expect(screen.getByText('Listening')).toBeVisible();
    expect(container.querySelector('.ff-status__dot')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is not a live region unless it is asked to announce', () => {
    const { rerender } = render(<StatusBadge label="Ready" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    rerender(<StatusBadge label="Ready" announce />);
    expect(screen.getByRole('status')).toHaveTextContent('Ready');
  });

  it('replaces the word in place when the state changes, so the change can be seen and nothing else moves', () => {
    const { container, rerender } = render(<StatusBadge label="Listening" live />);
    const before = container.querySelector('.ff-status__label');
    rerender(<StatusBadge label="Customer speaking" live />);
    const after = container.querySelector('.ff-status__label');
    expect(after).toHaveTextContent('Customer speaking');
    expect(after).not.toBe(before);
    expect(screen.queryByText('Listening')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.ff-status__dot')).toHaveLength(1);
  });

  it('can show an icon instead of the dot', () => {
    const { container } = render(<StatusBadge label="Paused" icon="pause" />);
    expect(container.querySelector('.ff-status__dot')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ProgressShimmer', () => {
  it('is named work in progress with no number, because there is none to give', () => {
    render(<ProgressShimmer label="Transcribing your reply" />);
    const bar = screen.getByRole('progressbar', { name: 'Transcribing your reply' });
    expect(bar).toHaveAttribute('aria-busy', 'true');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar).not.toHaveTextContent('%');
  });

  it('takes a width when it should not fill its container', () => {
    render(<ProgressShimmer label="Working" width={120} />);
    expect(screen.getByRole('progressbar', { name: 'Working' })).toHaveStyle({
      inlineSize: '120px',
    });
  });
});

describe('ProductIcon', () => {
  it('draws a different neutral mark for every Microsoft product Firefly covers', () => {
    const marks = PRODUCT_IDS.map((product) => {
      const { container, unmount } = render(<ProductIcon product={product} />);
      const markup = container.querySelector('svg')?.innerHTML ?? '';
      unmount();
      return markup;
    });
    expect(marks.every(Boolean)).toBe(true);
    expect(new Set(marks).size).toBe(PRODUCT_IDS.length);
  });

  it('is decorative beside the product name, and a named image on its own', () => {
    const { container, rerender } = render(<ProductIcon product="teams" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<ProductIcon product="teams" label={PRODUCT_INFO.teams.name} />);
    expect(screen.getByRole('img', { name: 'Microsoft Teams' })).toBeInTheDocument();
  });
});
