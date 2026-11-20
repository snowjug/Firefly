import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Field, SelectInput, TextArea, TextInput, useFieldControl } from './index.ts';

describe('Field', () => {
  it('ties the label to the control', async () => {
    const user = userEvent.setup();
    render(
      <Field label="Display name">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText('Display name');
    expect(input).toBe(screen.getByRole('textbox', { name: 'Display name' }));
    await user.click(screen.getByText('Display name'));
    expect(input).toHaveFocus();
  });

  it('describes the control by its hint and its error, and marks it invalid', () => {
    const { rerender } = render(
      <Field label="Email" hint="We never send mail.">
        <TextInput type="email" />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('We never send mail.');
    expect(input).not.toHaveAttribute('aria-invalid');

    rerender(
      <Field
        label="Email"
        hint="We never send mail."
        error="Enter an address like name@example.com."
      >
        <TextInput type="email" />
      </Field>,
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'We never send mail. Enter an address like name@example.com.',
    );
  });

  it('puts the error in a live region that is there before the error is', () => {
    const { container, rerender } = render(
      <Field label="Email">
        <TextInput />
      </Field>,
    );
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toBeEmptyDOMElement();
    rerender(
      <Field label="Email" error="Required.">
        <TextInput />
      </Field>,
    );
    expect(container.querySelector('[aria-live="polite"]')).toBe(live);
    expect(live).toHaveTextContent('Required.');
  });

  it('keeps what the caller said about the control and adds its own', () => {
    render(
      <>
        <p id="extra">Extra help.</p>
        <Field label="Name" hint="Shown here only.">
          <TextInput aria-describedby="extra" />
        </Field>
      </>,
    );
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
      'Extra help. Shown here only.',
    );
  });

  it('counts what has been typed against the limit, controlled or not', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState('Hi');
      return (
        <Field label="Reply">
          <TextArea
            maxLength={10}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
      );
    }
    const { unmount } = render(<Controlled />);
    expect(screen.getByText('2 / 10')).toBeInTheDocument();
    const reply = screen.getByLabelText('Reply');
    expect(reply).toHaveAccessibleDescription('Up to 10 characters');
    await user.type(reply, ' there');
    expect(screen.getByText('8 / 10')).toHaveAttribute('data-state', 'ok');
    await user.type(reply, '!!');
    expect(screen.getByText('10 / 10')).toHaveAttribute('data-state', 'full');
    unmount();

    render(
      <Field label="Name">
        <TextInput maxLength={20} defaultValue="Sam" />
      </Field>,
    );
    expect(screen.getByText('3 / 20')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), ' Rivera');
    expect(screen.getByText('10 / 20')).toBeInTheDocument();
  });

  it('shows no count without a limit, or when it is turned off', () => {
    const { rerender } = render(
      <Field label="Name">
        <TextInput />
      </Field>,
    );
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
    rerender(
      <Field label="Name">
        <TextInput maxLength={5} counter={false} />
      </Field>,
    );
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });

  it('passes native props through and can set text in the reading serif', () => {
    render(
      <Field label="Your reply">
        <TextArea serif rows={2} placeholder="Say what you would say." required />
      </Field>,
    );
    const area = screen.getByPlaceholderText('Say what you would say.');
    expect(area).toHaveAttribute('rows', '2');
    expect(area).toBeRequired();
    expect(area).toHaveClass('ff-field__control--serif');
  });

  it('has a flat select with its options', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Field label="Difficulty">
          <SelectInput
            defaultValue="standard"
            options={[
              { value: 'starter', label: 'Starter' },
              { value: 'standard', label: 'Standard' },
              { value: 'challenge', label: 'Challenge', disabled: true },
            ]}
          />
        </Field>
        <Field label="Plain">
          <SelectInput>
            <option value="a">A</option>
          </SelectInput>
        </Field>
      </>,
    );
    const select = screen.getByRole('combobox', { name: 'Difficulty' });
    expect(select).toHaveValue('standard');
    await user.selectOptions(select, 'starter');
    expect(select).toHaveValue('starter');
    expect(screen.getByRole('option', { name: 'Challenge' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Plain' })).toHaveValue('a');
  });

  it('works for a custom control through useFieldControl, and stays plain outside a Field', () => {
    function Custom() {
      return <input data-testid="custom" {...useFieldControl()} />;
    }
    render(
      <Field label="Custom" error="Nope.">
        <Custom />
      </Field>,
    );
    expect(screen.getByLabelText('Custom')).toBe(screen.getByTestId('custom'));
    expect(screen.getByTestId('custom')).toHaveAttribute('aria-invalid', 'true');

    render(<TextInput aria-label="Alone" />);
    expect(screen.getByRole('textbox', { name: 'Alone' })).not.toHaveAttribute('aria-invalid');
  });
});
