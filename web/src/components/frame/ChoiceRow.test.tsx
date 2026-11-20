import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceRow, type ChoiceOption } from './index.ts';

const IMPACT: ChoiceOption[] = [
  { value: 'low', label: 'Low', hint: 'One person is affected.' },
  { value: 'medium', label: 'Medium', hint: 'A team is slowed down.' },
  { value: 'high', label: 'High', hint: 'The business is losing time or money.' },
];

function Demo({
  options = IMPACT,
  onChange,
  ...rest
}: {
  options?: ChoiceOption[];
  onChange?: (value: string) => void;
  size?: 'display' | 'text';
  describedBy?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('medium');
  return (
    <ChoiceRow
      legend="Impact"
      name="impact"
      value={value}
      options={options}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      {...rest}
    />
  );
}

describe('ChoiceRow', () => {
  it('is a named group of radios with the current value chosen', () => {
    render(<Demo />);
    const group = screen.getByRole('group', { name: 'Impact' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Low' })).not.toBeChecked();
  });

  it('chooses on click and reports the new value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Demo onChange={onChange} />);
    await user.click(screen.getByText('High'));
    expect(onChange).toHaveBeenCalledWith('high');
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Medium' })).not.toBeChecked();
  });

  it('moves with the arrow keys like any radio group', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Demo onChange={onChange} />);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Medium' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'High' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith('low');
  });

  it('describes the chosen radio with the hint of the chosen option', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    expect(screen.getByRole('radio', { name: 'Medium' })).toHaveAccessibleDescription(
      'A team is slowed down.',
    );
    expect(screen.getByRole('radio', { name: 'Low' })).not.toHaveAccessibleDescription();
    await user.click(screen.getByText('High'));
    expect(screen.getByRole('radio', { name: 'High' })).toHaveAccessibleDescription(
      'The business is losing time or money.',
    );
  });

  it('shows no hint line when no option has a hint', () => {
    const plain = IMPACT.map(({ value, label }) => ({ value, label }));
    const { container } = render(<Demo options={plain} />);
    expect(container.querySelector('.ff-choice__hint')).toBeNull();
    expect(container.querySelector('.ff-choice__hints')).toBeNull();
  });

  it('keeps every hint in place and shows only the chosen one, so nothing moves when the choice does', async () => {
    const user = userEvent.setup();
    const { container } = render(<Demo />);
    const hints = () => [...container.querySelectorAll<HTMLElement>('.ff-choice__hint')];
    expect(hints()).toHaveLength(3);
    expect(hints().filter((hint) => hint.hasAttribute('data-on'))).toHaveLength(1);
    expect(container.querySelector('[data-on]')).toHaveTextContent('A team is slowed down.');
    await user.click(screen.getByText('Low'));
    expect(container.querySelector('[data-on]')).toHaveTextContent('One person is affected.');
    expect(hints().filter((hint) => hint.id)).toHaveLength(1);
  });

  it('describes nothing when the chosen option has no hint of its own', () => {
    render(<Demo options={[{ value: 'medium', label: 'Medium' }, ...IMPACT.slice(0, 1)]} />);
    expect(screen.getByRole('radio', { name: 'Medium' })).not.toHaveAccessibleDescription();
  });

  it('slides the amber point from the old choice to the new one', async () => {
    const lefts: Record<string, number> = { Low: 0, Medium: 200, High: 400 };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      // The mark sits right after its word, so it is placed where the word is.
      const left = lefts[this.previousElementSibling?.textContent ?? ''] ?? 0;
      return { left, right: left + 60, width: 60, top: 70, bottom: 100, height: 30 } as DOMRect;
    });
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    try {
      const user = userEvent.setup();
      render(<Demo />);
      expect(animate).not.toHaveBeenCalled();
      await user.click(screen.getByText('High'));
      expect(animate).toHaveBeenCalledTimes(1);
      const [keyframes, options] = animate.mock.calls[0] as [Keyframe[], KeyframeAnimationOptions];
      expect(keyframes[0]?.transform).toBe('translate(-200px, 0px) scale(1)');
      expect(options.pseudoElement).toBe('::after');
      expect((animate.mock.contexts[0] as HTMLElement).previousElementSibling).toHaveTextContent(
        'High',
      );
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
      vi.restoreAllMocks();
    }
  });

  it('cannot choose a disabled option, and a disabled group chooses nothing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [...IMPACT, { value: 'critical', label: 'Critical', disabled: true }];
    const { rerender } = render(<Demo options={options} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Critical' })).toBeDisabled();
    await user.click(screen.getByText('Critical'));
    expect(onChange).not.toHaveBeenCalled();

    rerender(<Demo options={options} onChange={onChange} disabled />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });

  it('can be described by other text, and sizes itself for text or display', () => {
    render(
      <>
        <p id="why">Pick what the business feels.</p>
        <Demo describedBy="why" size="text" />
      </>,
    );
    expect(screen.getByRole('group', { name: 'Impact' })).toHaveAccessibleDescription(
      'Pick what the business feels.',
    );
    expect(screen.getByRole('group', { name: 'Impact' })).toHaveAttribute('data-size', 'text');
  });

  it('keeps very long labels as they are', () => {
    const label = 'An option whose label is long enough to need to wrap onto several lines';
    render(<Demo options={[{ value: 'long', label }]} />);
    expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
  });
});
