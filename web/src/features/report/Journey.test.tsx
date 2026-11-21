import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import { ReportView } from './ReportView.tsx';
import { callFixtures } from './fixtures.ts';
import { journeyListItems } from './journey-model.ts';
import { renderAtReport, scriptedClient } from './test-utils.tsx';

afterEach(cleanup);

async function show(name: 'strong' | 'curveball' | 'weak' | 'unresolved') {
  const call = (await callFixtures())[name];
  renderAtReport(
    <ReportView
      session={call.session}
      report={call.report}
      client={scriptedClient(call.session)}
      reveal={false}
    />,
  );
  return call;
}

const section = () => screen.getByRole('region', { name: 'Customer temperature' });

// This file renders the chart first, so the placeholder for its separate chunk is still on screen.
describe('the customer temperature section', () => {
  it('shows a placeholder while the chart loads, with the list and the table already there', async () => {
    const call = await show('strong');
    expect(
      within(section()).getByText('Loading the customer temperature chart'),
    ).toBeInTheDocument();
    expect(within(section()).getByRole('list', { name: '' })).toBeDefined();
    expect(
      within(section()).getByRole('heading', { level: 3, name: 'What moved the customer' }),
    ).toBeInTheDocument();
    expect(within(section()).getAllByRole('listitem').length).toBe(
      journeyListItems(call.report.journey).length,
    );
    // Then the chart arrives, named, with the same facts in words.
    const chart = await within(section()).findByRole('img', {
      name: /Customer temperature through the call/,
    });
    expect(chart).toHaveAccessibleName(/started Frustrated and ended Calm/);
    expect(chart).toHaveAccessibleName(/listed below the chart/);
    expect(
      within(section()).queryByText('Loading the customer temperature chart'),
    ).not.toBeInTheDocument();
  });

  it('labels the five bands in text and has a key for the markers', async () => {
    await show('strong');
    const chart = await within(section()).findByRole('img', { name: /Customer temperature/ });
    for (const band of ['Escalating', 'Angry', 'Frustrated', 'Concerned', 'Calm']) {
      expect(chart).toHaveTextContent(band);
    }
    const key = within(section()).getByRole('list', { name: 'Chart key' });
    expect(
      within(key)
        .getAllByRole('listitem')
        .map((i) => i.textContent),
    ).toEqual(['Start', 'Turn', 'Turning point', 'Unexpected turn', 'End']);
  });

  it('lists what moved the customer as "Turn N: from to to", with the reason, the words and a link', async () => {
    const call = await show('strong');
    const moves = within(section()).getByRole('heading', { name: 'What moved the customer' })
      .nextElementSibling as HTMLElement;
    const items = within(moves).getAllByRole('listitem');
    expect(items[1]).toHaveTextContent('Turn 2: Frustrated to Concerned');
    expect(items[1]).toHaveTextContent('Acknowledged the business impact');
    expect(items[1]).toHaveTextContent(
      /You said: .I.m sorry your team can.t open the project workspace/,
    );
    expect(
      within(items[1] as HTMLElement).getByRole('link', { name: 'See turn 2 in the transcript' }),
    ).toHaveAttribute('href', '#turn-2');
    expect(call.report.journey.points.length).toBeGreaterThan(items.length);
  });

  it('gives the same data as a table behind "Show as a table"', async () => {
    const call = await show('strong');
    expect(within(section()).getByText('Show as a table')).toBeInTheDocument();
    const table = within(section()).getByRole('table', {
      name: 'Customer temperature at each point in the call',
    });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Turn', 'Point', 'Customer', 'Change', 'What happened']);
    expect(within(table).getAllByRole('row')).toHaveLength(call.report.journey.points.length + 1);
  });

  it('describes an unexpected turn after the call: what it was, when, how it went and the assessment', async () => {
    const call = await show('curveball');
    const block = within(section()).getByRole('heading', { level: 3, name: 'Unexpected turn' })
      .parentElement as HTMLElement;
    expect(block).toHaveTextContent(CURVEBALL_LABELS['previous-bad-experience'].label);
    expect(block).toHaveTextContent(`After turn ${call.report.curveball?.firedAtTurn}`);
    expect(block).toHaveTextContent('Resolved');
    expect(block).toHaveTextContent((call.report.curveball?.assessment ?? '').slice(0, 40));
    expect(
      within(block).getByRole('link', { name: /See turn \d+ in the transcript/ }),
    ).toBeInTheDocument();
  });

  it('says Not resolved, and Still open when the call ended, for the other outcomes', async () => {
    await show('unresolved');
    expect(
      within(section()).getByRole('heading', { level: 3, name: 'Unexpected turn' }).parentElement,
    ).toHaveTextContent('Not resolved');
    cleanup();
    await show('weak');
    expect(
      within(section()).getByRole('heading', { level: 3, name: 'Unexpected turn' }).parentElement,
    ).toHaveTextContent('Still open when the call ended');
  });
});
