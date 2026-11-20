import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAppConfig } from './config.ts';

describe('loadAppConfig: where the web app is served from', () => {
  it('serves dist/web by default', () => {
    expect(loadAppConfig({}).webDir.replaceAll('\\', '/')).toMatch(/\/dist\/web$/);
  });

  it('can serve another build, so copies of the app can run side by side', () => {
    const elsewhere = resolve('some', 'other', 'build');
    expect(loadAppConfig({ FIREFLY_WEB_DIR: elsewhere }).webDir).toBe(elsewhere);
    expect(loadAppConfig({ FIREFLY_WEB_DIR: '  ' }).webDir.replaceAll('\\', '/')).toMatch(
      /\/dist\/web$/,
    );
  });
});
