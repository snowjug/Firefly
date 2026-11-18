import { createServer } from 'node:http';

// Placeholder entry point; replaced by the real server in the next commit.
const port = Number(process.env.FIREFLY_PORT ?? 8787);
const server = createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ status: 'ok' }));
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Firefly placeholder listening on http://127.0.0.1:${port}`);
});
