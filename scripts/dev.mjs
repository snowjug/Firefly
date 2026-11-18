// Runs the API server (with file watching) and the Vite dev server together.
// Open http://localhost:5173 - Vite proxies /api to the Node server.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const children = [];

function run(name, args) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env });
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[dev] ${name} exited with code ${code}; stopping.`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
}

let shuttingDown = false;
function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('server', ['--watch', '--disable-warning=ExperimentalWarning', 'server/index.ts']);
run('web', [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--config', 'vite.config.ts']);
