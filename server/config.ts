import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json' with { type: 'json' };
import { parseLogLevel, type LogLevel } from './log.ts';
import { loadProviderConfig, type LoadedProviderConfig } from './providers/types.ts';

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  webDir: string;
  version: string;
  logLevel: LogLevel;
  devDiagnostics: boolean;
  testHooks: boolean;
  provider: LoadedProviderConfig;
}

const root = fileURLToPath(new URL('..', import.meta.url));

const flag = (value: string | undefined) => value === '1' || value?.toLowerCase() === 'true';

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.FIREFLY_PORT ?? 8787);
  const dbSetting = env.FIREFLY_DB_PATH?.trim() || './data/firefly.db';
  return {
    port: Number.isInteger(port) && port >= 0 && port < 65536 ? port : 8787,
    host: env.FIREFLY_HOST?.trim() || '127.0.0.1',
    // ":memory:" keeps everything in RAM and is used by automated browser tests.
    dbPath: dbSetting === ':memory:' ? dbSetting : resolve(root, dbSetting),
    webDir: resolve(root, 'dist/web'),
    version: pkg.version,
    logLevel: parseLogLevel(env.FIREFLY_LOG_LEVEL),
    devDiagnostics: flag(env.FIREFLY_DEV_DIAGNOSTICS),
    testHooks: flag(env.FIREFLY_TEST_HOOKS),
    provider: loadProviderConfig(env),
  };
}
