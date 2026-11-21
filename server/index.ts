import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { loadAppConfig } from './config.ts';
import { createRuntime } from './bootstrap.ts';
import { createLogger } from './log.ts';

// Firefly server entry point: the JSON API plus (when built) the web app, in one process.
//   npm run build && npm start        production-style
//   npm run dev                       API with file watching + Vite dev server

try {
  process.loadEnvFile('.env'); // optional; values already in the environment win
} catch {
  // No .env file: that is fine.
}

const config = loadAppConfig();
const log = createLogger(undefined, config.logLevel);
const runtime = createRuntime({ config, log });

const server = createServer((req, res) => {
  runtime.handler(req, res).catch((error: unknown) => {
    log.error('request.unhandled', {
      error: String((error as Error)?.message ?? error).slice(0, 200),
    });
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Set FIREFLY_PORT to another port.`);
  } else {
    console.error(`Server error: ${error.message}`);
  }
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  console.log(`\nFirefly ${config.version} is running at http://${config.host}:${port}`);
  console.log(`  AI provider : ${runtime.provider.label}`);
  if (config.provider.problem)
    console.log(`  Notice      : ${config.provider.problem} Using demo mode instead.`);
  console.log(`  Speech      : ${runtime.speech.label}`);
  if (config.speech.problem) console.log(`  Notice      : ${config.speech.problem}`);
  console.log(`  Database    : ${config.dbPath}`);
  console.log(
    existsSync(config.webDir)
      ? '  Web app     : serving the built app'
      : '  Web app     : not built yet (run "npm run build", or use "npm run dev")',
  );
  if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
    console.log(
      '  Warning     : Firefly has no sign-in. Do not expose it beyond a trusted network.',
    );
  }
  console.log('');
});

let closing = false;
function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  log.info('server.stopping', { signal });
  server.close(() => {
    runtime.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
