import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import {
  CARE_LABELS,
  DIMENSION_IDS,
  DIMENSIONS,
  SCORE_DESCRIPTIONS,
} from '#shared/domain/vocab.ts';
import type * as ApiModule from '../lib/api.ts';
import { ConfigProvider } from '../lib/config.tsx';
import About from './About.tsx';

const mocks = vi.hoisted(() => ({ config: vi.fn() }));
vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: mocks };
});

const CONFIG: AppConfigDTO = {
  app: { name: 'Firefly', version: '0.1.0' },
  provider: { kind: 'mock', label: 'Demo mode (built-in rules engine)', demo: true, notice: null },
  limits: { maxMessageChars: 1500, maxTraineeTurns: 60 },
  features: { devDiagnostics: false, testHooks: false },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockResolvedValue(CONFIG);
  render(
    <ConfigProvider>
      <MemoryRouter initialEntries={['/about']}>
        <About />
      </MemoryRouter>
    </ConfigProvider>,
  );
});

describe('About', () => {
  it('lists the six coaching dimensions with what they look at and their CARE behaviours', () => {
    const section = screen
      .getByRole('heading', { name: 'The six coaching dimensions' })
      .closest('section') as HTMLElement;

    for (const id of DIMENSION_IDS) {
      const heading = within(section).getByRole('heading', {
        level: 3,
        name: DIMENSIONS[id].label,
      });
      const card = heading.closest('li') as HTMLElement;
      expect(card).toHaveTextContent(DIMENSIONS[id].description);
      for (const behaviour of DIMENSIONS[id].care) {
        expect(within(card).getByText(CARE_LABELS[behaviour])).toBeInTheDocument();
      }
    }
    expect(within(section).getByText(SCORE_DESCRIPTIONS[3] as string)).toBeInTheDocument();
  });

  it('has one h1, an in-page contents list and the responsible AI statements', () => {
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const toc = screen.getByRole('navigation', { name: 'On this page' });
    expect(
      within(toc).getByRole('link', { name: 'Responsible AI and data safety' }),
    ).toHaveAttribute('href', '#responsible-ai');

    const section = screen
      .getByRole('heading', { name: 'Responsible AI and data safety' })
      .closest('section') as HTMLElement;
    expect(section).toHaveTextContent('Do not enter real customer information');
    expect(section).toHaveTextContent('AI feedback can be incomplete or wrong');
    expect(section).toHaveTextContent('not a performance rating');
    expect(section).toHaveTextContent('API keys stay on the server');
    expect(section).toHaveTextContent(
      'does not claim any compliance certification or legal guarantee',
    );
  });

  it('opens the repository safely and shows the version and provider from the server', async () => {
    const link = screen.getByRole('link', { name: /github\.com\/snowjug\/Firefly/ });
    expect(link).toHaveAttribute('href', 'https://github.com/snowjug/Firefly');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link).toHaveAccessibleName(/opens in a new tab/);

    expect(await screen.findByText('0.1.0')).toBeInTheDocument();
    expect(
      screen.getByText('Demo mode (built-in rules engine)', { selector: 'dd' }),
    ).toBeInTheDocument();
  });
});
