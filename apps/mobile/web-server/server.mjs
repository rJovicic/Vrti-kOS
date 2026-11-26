// Static server for the staging web preview of the mobile app (docs/architecture/mobile-web-staging.md).
// No dependencies: Node's http module only. Serves the Expo web export (`expo export --platform web`, output "single"):
//  - hashed bundles under /_expo/static and /assets are cached for a year (immutable);
//  - every route without a file extension gets index.html (client-side routing: reloads and direct URLs work);
//  - index.html and /health are never cached; strict security headers on every response;
//  - only GET and HEAD; paths are resolved inside the export folder (no traversal).
// It refuses to start for anything but synthetic environments: the web build keeps the session in the browser tab.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};
const ALLOWED_ENVS = ['staging', 'demo', 'local'];

/** Security headers for every response. `supabaseUrl` is the only other origin the app may talk to. */
export function securityHeaders(supabaseUrl) {
  const api = new URL(supabaseUrl);
  const ws = `${api.protocol === 'https:' ? 'wss:' : 'ws:'}//${api.host}`;
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      // react-native-web writes component styles at runtime and the export has one inline reset <style>.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' ${api.origin} ${ws}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

export function createWebServer({ root, supabaseUrl, appEnv }) {
  if (!ALLOWED_ENVS.includes(appEnv)) throw new Error(`WEB_PREVIEW_NOT_ALLOWED for APP_ENV=${appEnv}`);
  if (!supabaseUrl) throw new Error('EXPO_PUBLIC_SUPABASE_URL is required');
  const base = resolve(root);
  const index = join(base, 'index.html');
  if (!existsSync(index)) throw new Error(`no web export at ${base} (run the build first)`);
  const headers = securityHeaders(supabaseUrl);
  const health = JSON.stringify({ status: 'ok', app: 'mobile-web', appEnv, supabaseHost: new URL(supabaseUrl).host });

  const send = (res, status, extra, body) => {
    res.writeHead(status, { ...headers, ...extra });
    res.end(body);
  };
  const sendFile = (req, res, file, cache) => {
    const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { ...headers, 'Content-Type': type, 'Content-Length': statSync(file).size, 'Cache-Control': cache });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  };

  return createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' }, 'Method Not Allowed');
    let path;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    } catch {
      return send(res, 400, { 'Content-Type': 'text/plain' }, 'Bad Request');
    }
    if (path.includes('\0')) return send(res, 400, { 'Content-Type': 'text/plain' }, 'Bad Request');
    if (path === '/health') return send(res, 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, req.method === 'HEAD' ? undefined : health);
    if (path === '/robots.txt') return send(res, 200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, 'User-agent: *\nDisallow: /\n');

    const file = resolve(base, '.' + normalize(path));
    if (file !== base && !file.startsWith(base + sep)) return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
    if (path !== '/' && existsSync(file) && statSync(file).isFile()) {
      const immutable = path.startsWith('/_expo/static/') || path.startsWith('/assets/');
      return sendFile(req, res, file, immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
    // A missing file with an extension is a real 404; anything else is an app route → index.html.
    if (extname(path)) return send(res, 404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, 'Not Found');
    return sendFile(req, res, index, 'no-store');
  });
}

// Started directly (Railway start command): node web-server/server.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createWebServer({
    root: process.env.WEB_ROOT ?? new URL('../dist-web', import.meta.url).pathname,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? '',
  });
  const port = Number(process.env.PORT ?? 8080);
  server.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ event: 'mobile_web_listening', port })));
}
