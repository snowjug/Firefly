import { describe, expect, it } from 'vitest';
import { createLogger, parseLogLevel } from './log.ts';

describe('logging', () => {
  const run = (level: Parameters<typeof createLogger>[1]) => {
    const lines: string[] = [];
    const log = createLogger((line) => lines.push(line), level);
    log.info('request', { route: 'GET /api/health' });
    log.warn('message.failed', { code: 'provider_unavailable' });
    log.error('request.unhandled');
    return lines.map((line) => (JSON.parse(line) as { level: string }).level);
  };

  it('prints everything at the default level and filters by the configured level', () => {
    expect(run(undefined)).toEqual(['info', 'warn', 'error']);
    expect(run('warn')).toEqual(['warn', 'error']);
    expect(run('error')).toEqual(['error']);
    expect(run('silent')).toEqual([]);
  });

  it('reads the level from the environment and falls back to info', () => {
    expect(parseLogLevel('WARN')).toBe('warn');
    expect(parseLogLevel(' silent ')).toBe('silent');
    expect(parseLogLevel('verbose')).toBe('info');
    expect(parseLogLevel(undefined)).toBe('info');
  });

  it('never prints transcripts, bodies or secrets even when a caller passes them', () => {
    const lines: string[] = [];
    createLogger((line) => lines.push(line)).info('x', {
      text: 'I am Jane at jane@example.com',
      apiKey: 'sk-secret',
      body: '{"a":1}',
      route: 'POST /api/sessions',
    });
    const printed = lines.join('');
    expect(printed).not.toContain('Jane');
    expect(printed).not.toContain('sk-secret');
    expect(printed).toContain('POST /api/sessions');
  });
});
