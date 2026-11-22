import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedControl, type SegmentedControlProps } from '../index.ts';

afterEach(cleanup);

const TEMPERATURES = [
  { value: 'calm', label: 'Calm' },
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'angry', label: 'Angry' },
] as const;

function Controlled(props: Partial<SegmentedControlProps<string>>) {
  const [value, setValue] = useState<string | null>('calm');
  const { onChange, ...rest } = props;
  return (
    <SegmentedControl
      legend="Starting temperature"
      options={TEMPERATURES}
      value={value}
      {...rest}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('SegmentedControl', () => {
  it('is a group named by its legend, with one radio per option and the chosen one checked', () => {
    render(<Controlled />);
    const group = screen.getByRole('group', { name: 'Starting temperature' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Calm' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Angry' })).not.toBeChecked();
  });

  it('moves and chooses with the arrow keys, as a radio group does', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    screen.getByRole('radio', { name: 'Calm' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Frustrated' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Frustrated' })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith('frustrated');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Calm' })).toBeChecked();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Angry' })).toBeChecked();
  });

  it('is one stop in the tab order, not one per option', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Controlled />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Calm' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('chooses an option on a click', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByText('Angry'));
    expect(screen.getByRole('radio', { name: 'Angry' })).toBeChecked();
  });

  it('describes an option by its description', () => {
    render(
      <SegmentedControl
        legend="Practice mode"
        value="immersive"
        onChange={() => undefined}
        options={[
          { value: 'immersive', label: 'Immersive', description: 'Feels like a real call.' },
          { value: 'guided', label: 'Guided practice', description: 'Shows light cues.' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Immersive' })).toHaveAccessibleDescription(
      'Feels like a real call.',
    );
    expect(screen.getByRole('radio', { name: 'Guided practice' })).toHaveAccessibleDescription(
      'Shows light cues.',
    );
  });

  it('skips a disabled option, and can keep its legend for assistive technology only', async () => {
    const user = userEvent.setup();
    render(
      <SegmentedControl
        legend="Language"
        hideLegend
        value="a"
        onChange={() => undefined}
        options={[
          { value: 'a', label: 'One' },
          { value: 'b', label: 'Two', disabled: true },
          { value: 'c', label: 'Three' },
        ]}
      />,
    );
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    screen.getByRole('radio', { name: 'One' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Three' })).toHaveFocus();
  });
});

describe('SegmentedControl: the selection gliding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Three segments side by side, 100 px wide; jsdom has no layout, so each option's box comes from here.
  function layOut() {
    const left: Record<string, number> = { calm: 0, frustrated: 100, angry: 200 };
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const value = this.querySelector('input')?.getAttribute('value') ?? '';
      return value in left ? new DOMRect(left[value], 0, 100, 40) : new DOMRect();
    });
  }
  const option = (name: string) => screen.getByRole('radio', { name }).parentElement as HTMLElement;

  it('marks the chosen option, so the stylesheet can draw the selection on it', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    expect(option('Calm')).toHaveAttribute('data-selected');
    await user.click(screen.getByText('Angry'));
    expect(option('Angry')).toHaveAttribute('data-selected');
    expect(option('Calm')).not.toHaveAttribute('data-selected');
  });

  it('tells the newly chosen segment where the old one was, so the selection can glide', async () => {
    layOut();
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByText('Angry'));
    expect(option('Angry')).toHaveAttribute('data-sliding');
    expect(option('Angry').style.getPropertyValue('--slide-dx')).toBe('-200px');
  });

  it('does not glide a grid of cards: they change fill and tick, but stay where they are', async () => {
    layOut();
    const user = userEvent.setup();
    render(<Controlled layout="cards" />);
    await user.click(screen.getByText('Angry'));
    expect(option('Angry')).toHaveAttribute('data-selected');
    expect(option('Angry')).not.toHaveAttribute('data-sliding');
  });
});
