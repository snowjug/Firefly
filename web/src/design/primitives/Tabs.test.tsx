import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '../index.ts';

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

describe('Tabs with stacked panels', () => {
  function Products() {
    return (
      <Tabs defaultValue="teams">
        <TabList label="Products">
          <Tab value="teams">Teams</Tab>
          <Tab value="outlook">Outlook</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="teams" stacked>
            Teams call
          </TabPanel>
          <TabPanel value="outlook" stacked>
            Outlook call
          </TabPanel>
        </TabPanels>
      </Tabs>
    );
  }

  it('keeps every panel in the layout but exposes, and lets you reach, only the selected one', () => {
    render(<Products />);
    // Both are in the document, so the group is as tall as the taller of the two.
    expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel', { name: 'Teams' })).toHaveTextContent('Teams call');
    const hidden = document.querySelector('[role="tabpanel"][aria-hidden="true"]');
    expect(hidden).toHaveTextContent('Outlook call');
    expect(hidden).toHaveAttribute('inert');
    expect(hidden).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel', { name: 'Teams' })).toHaveAttribute('data-selected');
  });

  it('swaps which panel is exposed when the selection changes, by arrow key as well as by click', async () => {
    const user = userEvent.setup();
    render(<Products />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tabpanel', { name: 'Outlook' })).toHaveTextContent('Outlook call');
    expect(screen.queryByRole('tabpanel', { name: 'Teams' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Teams' }));
    expect(screen.getByRole('tabpanel', { name: 'Teams' })).toBeInTheDocument();
    expect(document.querySelectorAll('[role="tabpanel"][data-selected]')).toHaveLength(1);
  });
});

describe('Tabs: the selected tab’s line gliding', () => {
  afterEach(() => vi.restoreAllMocks());

  // Tabs side by side, 100 px wide; jsdom has no layout, so each tab's box comes from here.
  function layOut() {
    const left: Record<string, number> = { Summary: 0, Skills: 110, Transcript: 330 };
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const name = this.getAttribute('role') === 'tab' ? (this.textContent ?? '') : '';
      return name in left ? new DOMRect(left[name], 0, 100, 44) : new DOMRect();
    });
  }

  it('tells the newly selected tab where the old one was, so its line can glide', async () => {
    layOut();
    const user = userEvent.setup();
    render(<Report />);
    await user.click(screen.getByRole('tab', { name: 'Transcript' }));
    const tab = screen.getByRole('tab', { name: 'Transcript' });
    expect(tab).toHaveAttribute('data-sliding');
    expect(tab.style.getPropertyValue('--slide-dx')).toBe('-330px');
  });

  it('has no glide in a column, where the line is on the side', async () => {
    layOut();
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="summary" orientation="vertical">
        <TabList label="Report sections">
          <Tab value="summary">Summary</Tab>
          <Tab value="skills">Skills</Tab>
        </TabList>
        <TabPanel value="summary">Summary panel</TabPanel>
        <TabPanel value="skills">Skills panel</TabPanel>
      </Tabs>,
    );
    await user.click(screen.getByRole('tab', { name: 'Skills' }));
    expect(document.querySelector('[data-sliding]')).toBeNull();
  });
});
