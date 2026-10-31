import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'microphone=(self), camera=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8', '.png':'image/png', '.ico':'image/x-icon', '.woff2':'font/woff2' };

export function createAppServer(root = defaultRoot) {
  const absoluteRoot = resolve(root);
  return createServer(async (req, res) => {
    for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value);
    const reply = (status, message) => {
      res.writeHead(status, { 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store' });
      res.end(req.method === 'HEAD' ? undefined : message);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD'); reply(405, 'Method not allowed'); return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url || '/', 'http://server.invalid').pathname);
      if (pathname === '/health') {
        const body = '{"status":"ok"}\n';
        res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Content-Length':Buffer.byteLength(body), 'Cache-Control':'no-store' });
        res.end(req.method === 'HEAD' ? undefined : body); return;
      }
      if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) {
        reply(404, 'Not found'); return;
      }
      const requested = resolve(absoluteRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!requested.startsWith(absoluteRoot + sep)) { reply(404, 'Not found'); return; }
      const canonical = await realpath(requested);
      if (!canonical.startsWith(absoluteRoot + sep)) { reply(404, 'Not found'); return; }
      const info = await stat(canonical);
      if (!info.isFile()) { reply(404, 'Not found'); return; }
      res.writeHead(200, {
        'Content-Type': mime[extname(canonical)] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = createReadStream(canonical);
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      if (error instanceof URIError) reply(400, 'Invalid path');
      else reply(404, 'Not found');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  await stat(resolve(defaultRoot, 'index.html'));
  const server = createAppServer();
  server.listen(port, '0.0.0.0', () => console.log(`Momo web listening on port ${port}`));
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 5000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
