import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkbox, Field, SearchBox, Select, Switch, TextArea, TextInput } from '../index.ts';

afterEach(cleanup);

describe('Field', () => {
  it('names the control with its label and describes it with its hint', () => {
    render(
      <Field label="Scenario name" hint="Shown in your recent calls.">
        <TextInput />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Scenario name' });
    expect(input).toHaveAccessibleDescription('Shown in your recent calls.');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks the control invalid and adds the error to its description', () => {
    render(
      <Field label="Name" hint="At least three characters." error="Enter a longer name.">
        <TextInput />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toBeInvalid();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('At least three characters. Enter a longer name.');
  });

  it('says a field is required to assistive technology, and shows a star to everyone else', () => {
    render(
      <Field label="Reply" required>
        <TextArea />
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: 'Reply' })).toBeRequired();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('wires a Select the same way', () => {
    render(
      <Field label="Speech language" error="Choose a language.">
        <Select defaultValue="">
          <option value="">Choose</option>
          <option value="en-GB">English (United Kingdom)</option>
        </Select>
      </Field>,
    );
    const select = screen.getByRole('combobox', { name: 'Speech language' });
    expect(select).toBeInvalid();
    expect(select).toHaveAccessibleDescription('Choose a language.');
  });

  it('keeps the label for assistive technology only when asked', () => {
    render(
      <Field label="Search scenarios" hideLabel>
        <TextInput />
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: 'Search scenarios' })).toBeInTheDocument();
  });

  it('announces a new error politely from a region that was there before it', () => {
    const { container, rerender } = render(
      <Field label="Name">
        <TextInput />
      </Field>,
    );
    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toBeEmptyDOMElement();
    rerender(
      <Field label="Name" error="Enter a name.">
        <TextInput />
      </Field>,
    );
    expect(container.querySelector('[aria-live="polite"]')).toBe(region);
    expect(region).toHaveTextContent('Enter a name.');
  });
});

describe('SearchBox', () => {
  function Search({ initial = 'billing' }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return <SearchBox label="Search scenarios" value={value} onChange={setValue} />;
  }

  it('is named, and clears with its button, handing focus back to the box', async () => {
    const user = userEvent.setup();
    render(<Search />);
    const box = screen.getByRole('searchbox', { name: 'Search scenarios' });
    expect(box).toHaveValue('billing');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('clears on Escape while it has text, and leaves Escape alone when it is empty', async () => {
    const user = userEvent.setup();
    const reached = vi.fn();
    const listen = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) reached();
    };
    document.addEventListener('keydown', listen);
    render(<Search />);
    const box = screen.getByRole('searchbox');
    box.focus();
    await user.keyboard('{Escape}');
    expect(box).toHaveValue('');
    expect(reached).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(reached).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', listen);
  });
});

describe('Checkbox and Switch', () => {
  it('is a checkbox whose whole label is its name, with a description read after it', async () => {
    const user = userEvent.setup();
    function Box() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox
          label="Share with my coach"
          description="Only the words in the transcript."
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
      );
    }
    render(<Box />);
    const box = screen.getByRole('checkbox', { name: 'Share with my coach' });
    expect(box).toHaveAccessibleDescription('Only the words in the transcript.');
    await user.click(screen.getByText('Share with my coach'));
    expect(box).toBeChecked();
  });

  it('can be partly chosen', () => {
    render(
      <Checkbox label="Some chosen" indeterminate checked={false} onChange={() => undefined} />,
    );
    expect(screen.getByRole('checkbox', { name: 'Some chosen' })).toBePartiallyChecked();
  });

  it('is a switch that is on or off, and toggles with the space bar', async () => {
    const user = userEvent.setup();
    function Toggle() {
      const [on, setOn] = useState(false);
      return (
        <Switch
          label="Show captions"
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
        />
      );
    }
    render(<Toggle />);
    const toggle = screen.getByRole('switch', { name: 'Show captions' });
    expect(toggle).not.toBeChecked();
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle).toBeChecked();
  });
});
