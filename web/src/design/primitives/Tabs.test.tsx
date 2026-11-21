import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tab, TabList, TabPanel, Tabs } from '../index.ts';

afterEach(cleanup);

function Report({
  activation,
  onValueChange,
}: {
  activation?: 'automatic' | 'manual';
  onValueChange?: (value: string) => void;
}) {
  return (
    <Tabs defaultValue="summary" activation={activation} onValueChange={onValueChange}>
      <TabList label="Report sections">
        <Tab value="summary">Summary</Tab>
        <Tab value="skills">Skills</Tab>
        <Tab value="gone" disabled>
          Unavailable
        </Tab>
        <Tab value="transcript">Transcript</Tab>
      </TabList>
      <TabPanel value="summary">Summary panel</TabPanel>
      <TabPanel value="skills">Skills panel</TabPanel>
      <TabPanel value="gone">Unavailable panel</TabPanel>
      <TabPanel value="transcript">Transcript panel</TabPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('is a tab list with a name, one selected tab, and its panel labelled by it', () => {
    render(<Report />);
    expect(screen.getByRole('tablist', { name: 'Report sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Summary', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Skills', selected: false })).toBeInTheDocument();
    const panel = screen.getByRole('tabpanel', { name: 'Summary' });
    expect(panel).toHaveTextContent('Summary panel');
    expect(screen.queryByText('Skills panel')).not.toBeInTheDocument();
  });

  it('keeps one tab stop in the list (roving tabindex) and the panel is the next', async () => {
    const user = userEvent.setup();
    render(<Report />);
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('tabpanel', { name: 'Summary' })).toHaveFocus();
  });

  it('moves with the arrow keys, wraps, skips a disabled tab, and selects as it goes', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Report onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Skills' })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith('transcript');
  });

  it('jumps to the first and last tab with Home and End', async () => {
    const user = userEvent.setup();
    render(<Report />);
    await user.tab();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveFocus();
  });

  it('waits for Enter when activation is manual', async () => {
    const user = userEvent.setup();
    render(<Report activation="manual" />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'true');
  });

  it('selects on a click', async () => {
    const user = userEvent.setup();
    render(<Report />);
    await user.click(screen.getByRole('tab', { name: 'Transcript' }));
    expect(screen.getByRole('tabpanel', { name: 'Transcript' })).toHaveTextContent(
      'Transcript panel',
    );
  });
});
