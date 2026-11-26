const http = require('node:http');

jest.mock('electron', () => ({
  app: { on: jest.fn() },
  shell: { openExternal: jest.fn().mockResolvedValue(undefined) }
}));

const { shell } = require('electron');
const { openSpecInBrowser } = require('./openapi-spec-viewer');

const get = (url, headers = {}) => new Promise((resolve, reject) => {
  http.get(url, { headers }, (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
  }).on('error', reject);
});

describe('openSpecInBrowser', () => {
  it('reports an error without opening the browser when no spec is stored', async () => {
    const result = await openSpecInBrowser('/no-spec', () => null);

    expect(result.error).toMatch(/Spec file not found/);
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('serves the viewer and the latest spec on a loopback port and reuses it for the same collection', async () => {
    let spec = '{"openapi":"3.0.0","paths":{}}';
    const { url } = await openSpecInBrowser('/with-spec', () => spec);

    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(shell.openExternal).toHaveBeenCalledWith(url);

    const page = await get(url);
    expect(page.status).toBe(200);
    expect(page.body).toContain('SwaggerUIBundle');

    expect(await get(`${url}spec`)).toMatchObject({ status: 200, type: expect.stringContaining('application/json'), body: spec });

    spec = 'openapi: 3.0.0\npaths: {}';
    expect(await get(`${url}spec`)).toMatchObject({ type: expect.stringContaining('text/yaml'), body: spec });

    const again = await openSpecInBrowser('/with-spec', () => spec);
    expect(again.url).toBe(url);
  });

  it('points servers at the spec source when the spec has none or only relative ones', async () => {
    const getServers = async (spec, defaultServer) => {
      const { url } = await openSpecInBrowser(`/servers-${Math.random()}`, () => spec, () => defaultServer);
      return JSON.parse((await get(`${url}spec`)).body).servers;
    };
    const noServers = '{"openapi":"3.1.0","info":{"title":"t","version":"1"},"paths":{}}';

    expect(await getServers(noServers, 'https://api.example.com')).toEqual([{ url: 'https://api.example.com/' }]);
    expect(await getServers('{"openapi":"3.0.0","servers":[{"url":"/v1","description":"d"}],"paths":{}}', 'https://api.example.com'))
      .toEqual([{ url: 'https://api.example.com/v1', description: 'd' }]);
    // Absolute servers and specs without a known source are served untouched.
    expect(await getServers('{"openapi":"3.0.0","servers":[{"url":"http://localhost:8080/"}],"paths":{}}', 'https://api.example.com'))
      .toEqual([{ url: 'http://localhost:8080/' }]);
    expect(await getServers(noServers, null)).toBeUndefined();
  });

  it('uses the app icon as the page favicon', async () => {
    const { url } = await openSpecInBrowser('/favicon', () => '{}');

    expect((await get(url)).body).toContain('<link rel="icon" type="image/png" href="/favicon.png" />');
    const icon = await get(`${url}favicon.png`);
    expect(icon).toMatchObject({ status: 200, type: 'image/png' });
    expect(icon.body.length).toBeGreaterThan(0);
  });

  it('titles the page after the spec and falls back to a default', async () => {
    const titled = await openSpecInBrowser('/titled', () => '{"openapi":"3.0.0","info":{"title":"Orders <API> & more","version":"1"},"paths":{}}');
    expect((await get(titled.url)).body).toContain('<title>Orders &#60;API&#62; &#38; more</title>');

    const yamlTitled = await openSpecInBrowser('/titled-yaml', () => 'openapi: 3.0.0\ninfo:\n  title: Billing\n  version: "1"\npaths: {}');
    expect((await get(yamlTitled.url)).body).toContain('<title>Billing</title>');

    const untitled = await openSpecInBrowser('/untitled', () => '{"openapi":"3.0.0","paths":{}}');
    expect((await get(untitled.url)).body).toContain('<title>API Spec</title>');
  });

  describe('proxy for Try it out', () => {
    let upstream;
    let upstreamUrl;
    let lastUpstreamRequest;

    beforeAll(async () => {
      upstream = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          lastUpstreamRequest = { method: req.method, url: req.url, headers: req.headers, body };
          res.writeHead(201, { 'Content-Type': 'application/json', 'X-From': 'upstream' }).end('{"ok":true}');
        });
      });
      await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
      upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
    });

    afterAll(() => new Promise((resolve) => upstream.close(resolve)));

    const send = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
      const req = http.request(url, { method, headers }, (res) => {
        let text = '';
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text }));
      });
      req.on('error', reject);
      req.end(body);
    });

    it('forwards the call to the target and returns its response', async () => {
      const { url } = await openSpecInBrowser('/proxy', () => '{}');

      const response = await send(`${url}proxy`, {
        method: 'POST',
        headers: { 'X-Proxy-Target': `${upstreamUrl}/orders?limit=2`, 'Content-Type': 'application/json', 'Authorization': 'Bearer t' },
        body: '{"a":1}'
      });

      expect(response).toMatchObject({ status: 201, body: '{"ok":true}' });
      expect(response.headers['x-from']).toBe('upstream');
      expect(lastUpstreamRequest).toMatchObject({ method: 'POST', url: '/orders?limit=2', body: '{"a":1}' });
      expect(lastUpstreamRequest.headers.authorization).toBe('Bearer t');
      expect(lastUpstreamRequest.headers['x-proxy-target']).toBeUndefined();
    });

    it('rejects a missing or non-http target and reports an unreachable one', async () => {
      const { url } = await openSpecInBrowser('/proxy', () => '{}');

      expect((await send(`${url}proxy`)).status).toBe(400);
      expect((await send(`${url}proxy`, { headers: { 'X-Proxy-Target': 'file:///etc/passwd' } })).status).toBe(400);

      const unreachable = await send(`${url}proxy`, { headers: { 'X-Proxy-Target': 'http://127.0.0.1:1/' } });
      expect(unreachable.status).toBe(502);
      expect(unreachable.body).toContain('Could not reach http://127.0.0.1:1');
    });
  });

  it('refuses requests whose Host is not loopback and unknown paths', async () => {
    const { url } = await openSpecInBrowser('/with-spec', () => '{}');

    expect((await get(url, { Host: 'evil.example' })).status).toBe(403);
    expect((await get(`${url}other`)).status).toBe(404);
  });
});
