import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

// Serves the built web app (dist/web) with a single-page-app fallback. Hashed assets are cached for
// a year; index.html is never cached so a new build is picked up immediately.

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  webDir: string,
  pathname: string,
): Promise<boolean> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (!existsSync(webDir)) return false;

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  const root = resolve(webDir);
  let file = resolve(join(root, normalize(decoded)));
  if (file !== root && !file.startsWith(root + sep)) return false; // path traversal

  let isIndex = false;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // Unknown paths with a file extension are real 404s; everything else is an app route.
    if (extname(decoded) !== '') return false;
    file = join(root, 'index.html');
    isIndex = true;
  }
  if (!existsSync(file)) return false;

  const body = await readFile(file);
  const ext = extname(file).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
  res.setHeader('Content-Length', body.length);
  res.setHeader(
    'Cache-Control',
    isIndex || ext === '.html'
      ? 'no-cache'
      : decoded.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600',
  );
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}
