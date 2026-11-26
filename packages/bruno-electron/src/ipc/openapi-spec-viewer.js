const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const jsyaml = require('js-yaml');
const { app, shell } = require('electron');

// The same icon the app window uses (see `icon` in index.js).
const APP_ICON_PATH = path.join(__dirname, '..', 'about', '256x256.png');

const SWAGGER_UI_ASSETS = {
  '/swagger-ui.css': 'text/css',
  '/swagger-ui-bundle.js': 'application/javascript'
};

const DEFAULT_TITLE = 'API Spec';

const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const isAbsoluteHttpUrl = (url) => /^https?:\/\//i.test(url);

// Swagger UI builds request URLs from the spec's `servers`. A spec without them (FastAPI's default) or with
// relative ones would resolve against this local viewer, so point them at the host the spec was fetched from.
const withDefaultServer = (content, defaultServerUrl) => {
  try {
    const spec = jsyaml.load(content);
    if (!spec || typeof spec !== 'object' || spec.swagger) return content;

    const servers = Array.isArray(spec.servers) && spec.servers.length ? spec.servers : [{ url: '/' }];
    if (servers.every((server) => isAbsoluteHttpUrl(server.url))) return content;

    spec.servers = servers.map((server) => (
      isAbsoluteHttpUrl(server.url) ? server : { ...server, url: new URL(server.url, defaultServerUrl).href }
    ));
    return JSON.stringify(spec);
  } catch {
    return content;
  }
};

const getSpecTitle = (content) => {
  try {
    const title = jsyaml.load(content)?.info?.title;
    return typeof title === 'string' && title.trim() ? title.trim() : DEFAULT_TITLE;
  } catch {
    return DEFAULT_TITLE;
  }
};

const renderViewerHtml = (title) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="stylesheet" href="/swagger-ui.css" />
  </head>
  <body>
    <div id="ui"></div>
    <script src="/swagger-ui-bundle.js"></script>
    <script>
      // The page is served from 127.0.0.1, so "Try it out" calls to the API would be blocked by CORS.
      // They are sent to this server instead, which forwards them (see /proxy).
      SwaggerUIBundle({
        url: '/spec',
        dom_id: '#ui',
        requestInterceptor: (request) => {
          // Swagger UI may hand over relative URLs (such as the /spec load), so resolve before comparing origins.
          const target = new URL(request.url, location.href);
          if (target.origin !== location.origin) {
            request.headers['X-Proxy-Target'] = target.href;
            request.url = location.origin + '/proxy';
          }
          return request;
        }
      });
    </script>
  </body>
</html>`;

// One viewer server per collection, kept until the app quits so reopening reuses the same URL.
const viewers = new Map();

// Registered on first use, not at load, so modules that only import this file do not need `app`.
let isQuitCleanupRegistered = false;
const closeViewersOnQuit = () => {
  if (isQuitCleanupRegistered) return;
  isQuitCleanupRegistered = true;
  app.on('before-quit', () => {
    viewers.forEach(({ server }) => server.close());
    viewers.clear();
  });
};

const PROXY_REQUEST_HEADERS_TO_DROP = new Set([
  'host', 'origin', 'referer', 'connection', 'content-length', 'accept-encoding', 'x-proxy-target'
]);
// fetch already decoded the body, so these no longer describe what is sent back.
const PROXY_RESPONSE_HEADERS_TO_DROP = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie']);
const PROXY_TIMEOUT_MS = 60000;

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
};

// Forwards a Swagger UI "Try it out" call to the URL named in X-Proxy-Target. Browsers cannot send that
// custom header cross-origin without a preflight, which this server never answers, so only this page can use it.
const forwardRequest = async (req, res) => {
  const target = req.headers['x-proxy-target'];
  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    res.writeHead(400).end('Missing or invalid X-Proxy-Target');
    return;
  }
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    res.writeHead(400).end('Only http and https targets are supported');
    return;
  }

  const headers = Object.fromEntries(Object.entries(req.headers).filter(([name]) => !PROXY_REQUEST_HEADERS_TO_DROP.has(name)));
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? await readBody(req) : undefined,
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS)
    });
    const responseHeaders = {};
    upstream.headers.forEach((value, name) => {
      if (!PROXY_RESPONSE_HEADERS_TO_DROP.has(name)) responseHeaders[name] = value;
    });
    res.writeHead(upstream.status, responseHeaders).end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    const reason = error.cause?.code || error.name || 'unknown';
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Could not reach ${targetUrl.origin} (${reason})`);
  }
};

const getSwaggerUiDir = () => path.dirname(require.resolve('swagger-ui-dist/package.json'));

const createViewerServer = (readSpec, getDefaultServerUrl) => {
  const server = http.createServer((req, res) => {
    // Only answer requests addressed to the loopback host so a rebinding DNS name cannot read the spec.
    const hostname = (req.headers.host || '').replace(/:\d+$/, '');
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
      res.writeHead(403).end();
      return;
    }

    const { pathname } = new URL(req.url, 'http://127.0.0.1');

    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(renderViewerHtml(getSpecTitle(readSpec() ?? '')));
    } else if (pathname === '/proxy') {
      forwardRequest(req, res);
    } else if (pathname === '/spec') {
      let content = readSpec();
      if (content == null) {
        res.writeHead(404).end('Spec file not found');
        return;
      }
      const defaultServerUrl = getDefaultServerUrl();
      if (defaultServerUrl) content = withDefaultServer(content, defaultServerUrl);
      const contentType = content.trimStart().startsWith('{') ? 'application/json' : 'text/yaml';
      res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8`, 'Cache-Control': 'no-store' }).end(content);
    } else if (pathname === '/favicon.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      fs.createReadStream(APP_ICON_PATH).pipe(res);
    } else if (SWAGGER_UI_ASSETS[pathname]) {
      res.writeHead(200, { 'Content-Type': SWAGGER_UI_ASSETS[pathname] });
      fs.createReadStream(path.join(getSwaggerUiDir(), pathname)).pipe(res);
    } else {
      res.writeHead(404).end();
    }
  });

  server.unref();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    // Port 0 lets the OS hand out a free port.
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
};

/**
 * Serves the collection's stored OpenAPI spec as Swagger UI on a free loopback port and opens it in the
 * default browser. `readSpec` returns the spec text, or null when none is stored; it runs on every request
 * so a reload shows the latest stored spec. `getDefaultServerUrl` returns the origin to call when the spec
 * names no usable server (or nothing), and is read per request too.
 */
const openSpecInBrowser = async (collectionPath, readSpec, getDefaultServerUrl = () => null) => {
  if (readSpec() == null) {
    return { error: 'Spec file not found. Sync your collection first.' };
  }

  let viewer = viewers.get(collectionPath);
  if (!viewer) {
    closeViewersOnQuit();
    const server = await createViewerServer(readSpec, getDefaultServerUrl);
    viewer = { server, url: `http://127.0.0.1:${server.address().port}/` };
    viewers.set(collectionPath, viewer);
  }

  await shell.openExternal(viewer.url);
  return { url: viewer.url };
};

module.exports = { openSpecInBrowser };
