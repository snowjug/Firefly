import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VoiceDisclosureDialog } from './VoiceDisclosureDialog.tsx';

describe('VoiceDisclosureDialog', () => {
  it('says what leaves the device, and switches nothing on until it is accepted', async () => {
    const onAccept = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<VoiceDisclosureDialog open onAccept={onAccept} onCancel={onCancel} />);

    const dialog = screen.getByRole('dialog', { name: 'Turn on voice (Beta)?' });
    expect(dialog).toHaveTextContent(/never records, keeps or uploads audio/);
    expect(dialog).toHaveTextContent(/online speech service run by the browser’s maker/);
    expect(dialog).toHaveTextContent(/never use real customer information/);
    expect(screen.getByRole('button', { name: 'Turn on voice' })).toHaveFocus();
    expect(onAccept).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Turn on voice' }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('closes like a cancel on Escape and renders nothing when closed', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <VoiceDisclosureDialog open onAccept={() => undefined} onCancel={onCancel} />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    rerender(<VoiceDisclosureDialog open={false} onAccept={() => undefined} onCancel={onCancel} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
