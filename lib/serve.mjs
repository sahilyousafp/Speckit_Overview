// Serves the verified archives to `specify ... --from` over loopback HTTP, which specify
// accepts only for loopback hosts. Bound to 127.0.0.1 on a random port, reachable only under a
// random 256-bit path token, GET/HEAD only, and shut down as soon as the install finishes.
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** @param {Map<string, Buffer>} files */
export async function serveArchives(files, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const token = randomBytes(32).toString('hex');
  let expectedHost = '';

  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers.host !== expectedHost) {
      res.writeHead(400).end();
      return;
    }
    const name = req.url?.startsWith(`/${token}/`) ? req.url.slice(token.length + 2) : null;
    const data = name !== null && files.has(name) ? files.get(name) : null;
    if (!data) {
      res.writeHead(404).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: HOST, port: 0, exclusive: true }, resolve);
  });
  const { port } = server.address();
  expectedHost = `${HOST}:${port}`;

  let closed = false;
  const close = () => {
    if (closed) return Promise.resolve();
    closed = true;
    clearTimeout(timer);
    server.closeAllConnections();
    return new Promise((resolve) => server.close(() => resolve()));
  };
  const timer = setTimeout(close, timeoutMs);
  timer.unref();

  return {
    port,
    url: (name) => `http://${expectedHost}/${token}/${name}`,
    close,
  };
}
