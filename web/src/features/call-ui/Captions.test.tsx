import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Caption } from './call-model.ts';
import { Captions } from './Captions.tsx';

afterEach(cleanup);

const strip = (container: HTMLElement) => container.querySelector('.cw-captions') as HTMLElement;
const customer = (text: string, key = 'customer:t3'): Caption => ({
  who: 'customer',
  key,
  text,
});
const you = (text: string): Caption => ({ who: 'you', key: 'you', text });

describe('the live captions', () => {
  it('show the customer’s line under their name, hidden from assistive technology', () => {
    const { container } = render(
      <Captions
        caption={customer('Since Monday. Four or five people.')}
        customerName="Priya Raman"
      />,
    );
    expect(strip(container)).toHaveAttribute('aria-hidden', 'true');
    expect(strip(container)).toHaveAttribute('data-live', 'true');
    expect(strip(container)).toHaveAttribute('data-who', 'customer');
    expect(strip(container)).toHaveTextContent('Priya Raman');
    expect(strip(container).querySelector('.cw-captions__text')?.textContent?.trim()).toBe(
      'Since Monday. Four or five people.',
    );
  });

  it('show the trainee’s own words as "You", and are text alone: nothing to press, no bubbles, no style of their own', () => {
    const { container } = render(
      <Captions caption={you('Which headset are they using')} customerName="Priya Raman" />,
    );
    expect(strip(container)).toHaveAttribute('data-who', 'you');
    expect(strip(container).querySelector('.cw-captions__who')).toHaveTextContent('You');
    expect(strip(container).querySelector('button, a, input, [tabindex], [role]')).toBeNull();
    // The space they take is the stylesheet's, so that what is said never changes the page's layout.
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('fade out between turns but keep their place and their last words until they have gone', () => {
    const { container, rerender } = render(
      <Captions caption={customer('Since Monday.')} customerName="Priya Raman" />,
    );
    rerender(<Captions caption={null} customerName="Priya Raman" />);
    expect(strip(container)).toHaveAttribute('data-live', 'false');
    expect(strip(container)).toHaveAttribute('aria-hidden', 'true');
    // The words are still drawn while the strip fades, so they never vanish before they have faded.
    expect(strip(container)).toHaveTextContent('Since Monday.');
    rerender(
      <Captions
        caption={customer('Yes, all of them.', 'customer:t5')}
        customerName="Priya Raman"
      />,
    );
    expect(strip(container)).toHaveAttribute('data-live', 'true');
  });

  it('are an empty strip with a place of its own before anything has been said', () => {
    const { container } = render(<Captions caption={null} customerName="Priya Raman" />);
    expect(strip(container)).toHaveAttribute('data-live', 'false');
    expect(strip(container).textContent).toBe('');
  });

  it('cross-fade from one line to the next, and not from one word to the next', () => {
    const { container, rerender } = render(
      <Captions caption={customer('Since Monday.', 'customer:t3')} customerName="Priya Raman" />,
    );
    // The same line growing is the same layer: nothing fades out.
    rerender(
      <Captions
        caption={customer('Since Monday. Four people.', 'customer:t3')}
        customerName="Priya Raman"
      />,
    );
    expect(container.querySelector('.cw-fade__out')).toBeNull();

    // A different line is a different layer: the old one fades out, out of assistive technology's reach.
    rerender(<Captions caption={you('Thank you')} customerName="Priya Raman" />);
    const leaving = container.querySelector('.cw-fade__out') as HTMLElement;
    expect(leaving).toHaveTextContent('Since Monday. Four people.');
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.cw-fade__in')).toHaveTextContent('Thank you');
  });

  it('let each word settle in as it arrives, and leave the words that were there alone', () => {
    const { container, rerender } = render(
      <Captions caption={you('Which headset')} customerName="Priya Raman" />,
    );
    const words = () => [...container.querySelectorAll('.cw-captions__word')];
    const [which, headset] = words();
    expect(words().map((word) => word.textContent?.trim())).toEqual(['Which', 'headset']);

    rerender(<Captions caption={you('Which headset and version')} customerName="Priya Raman" />);
    expect(words().map((word) => word.textContent?.trim())).toEqual([
      'Which',
      'headset',
      'and',
      'version',
    ]);
    // The same elements: only the new words are new, so only they have an arrival to play.
    expect(words()[0]).toBe(which);
    expect(words()[1]).toBe(headset);

    // A word that was heard differently is a new word, and settles in again.
    rerender(<Captions caption={you('Which headsets and version')} customerName="Priya Raman" />);
    expect(words()[0]).toBe(which);
    expect(words()[1]).not.toBe(headset);
  });

  it('keep a name that reads right to left, and the words in the order they came', () => {
    const { container } = render(
      <Captions caption={customer('مرحبا بكم')} customerName="Priya Raman" />,
    );
    expect(container.querySelector('.cw-captions__text')).toHaveAttribute('dir', 'auto');
  });
});
