import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Two projects: pure TypeScript logic and the Node API run in a Node environment,
// React components run in jsdom. E2E tests are run separately by Playwright.
// scripts/_tmp is a git-ignored scratch folder for throwaway tooling; it is never tested.
const exclude = [...configDefaults.exclude, 'scripts/_tmp/**'];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude,
          testTimeout: 20_000,
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['web/src/**/*.test.{ts,tsx}'],
          exclude,
          setupFiles: ['web/src/test-setup.ts'],
        },
      },
    ],
  },
});
