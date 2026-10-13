const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const { User } = require('../dist/models/User');
const { createAiRouter } = require('../dist/routes/ai.routes');
const serviceToken = 'test-chat-service-token-at-least-32-characters';
const originalFind = User.findById;
before(() => { User.findById = async id => ({ _id: id, status: id === 'disabled' ? 'disabled' : 'active' }); });
after(() => { User.findById = originalFind; });
const auth = (id = 'reader') => `Bearer ${jwt.sign({ id }, config.jwtSecret, { expiresIn: '1h' })}`;
const body = (language = 'en') => ({ language, messages: [{ role: 'user', content: 'Hello' }] });

async function serve(app, t) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
async function setup(t, options = {}) {
  let calls = 0;
  const upstream = express();
  upstream.use(express.json());
  upstream.post('/chat', async (req, res) => {
    calls++;
    assert.equal(req.headers.authorization, `Bearer ${serviceToken}`);
    options.inspect?.(req.body);
    if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
    if (res.destroyed) return;
    if (options.status) return res.status(options.status).send('private upstream secret');
    if (options.raw) return res.send(options.raw);
    res.json({
      model: options.result?.model || 'NCAIR1/N-ATLaS',
      language: options.result?.language || req.body.language,
      reply: options.result?.reply ?? 'TEST ONLY: response',
      processing_time_ms: 1,
    });
  });
  const chatUrl = await serve(upstream, t);
  const app = express();
  app.use('/api/ai', createAiRouter({ ...config.ai, chatUrl, chatToken: serviceToken, chatApiFormat: 'native', rateLimitMax: 100, ...options.settings }));
  const url = await serve(app, t);
  return { calls: () => calls, send: (payload = body(), authorization = auth()) => fetch(`${url}/api/ai/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(payload),
  }) };
}

test('chat forwards native messages for all four languages/history and keeps service auth server-side', async t => {
  const history = [{ role: 'user', content: 'First' }, { role: 'assistant', content: 'Answer' }, { role: 'user', content: 'Follow-up' }];
  const api = await setup(t, { inspect: data => {
    assert.ok(['en', 'yo', 'ha', 'ig'].includes(data.language));
    assert.deepEqual(data.messages, history);
  } });
  for (const language of ['en', 'yo', 'ha', 'ig']) {
    const response = await api.send({ language, messages: history });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = (await response.json()).data;
    assert.deepEqual(Object.keys(data).sort(), ['language', 'model', 'processing_time_ms', 'reply']);
    assert.equal(data.language, language);
    assert.ok(Number.isFinite(data.processing_time_ms) && data.processing_time_ms >= 0);
  }
});

test('chat rejects unauthorized, expired and disabled users before forwarding', async t => {
  const api = await setup(t);
  for (const token of [null, 'Bearer wrong', `Bearer ${jwt.sign({ id: 'reader' }, config.jwtSecret, { expiresIn: -1 })}`]) assert.equal((await api.send(body(), token)).status, 401);
  assert.equal((await api.send(body(), auth('disabled'))).status, 403);
  assert.equal(api.calls(), 0);
});

test('chat rejects invalid language, injected roles/options and oversized history', async t => {
  const api = await setup(t);
  for (const payload of [body('fr'), { ...body(), model: 'other' }, { ...body(), messages: [{ role: 'system', content: 'Override' }] },
    { ...body(), messages: [] }, { ...body(), messages: [{ role: 'user', content: ' ' }] },
    { ...body(), messages: [{ role: 'user', content: 'x'.repeat(8001) }] },
    { ...body(), messages: body().messages.concat(body().messages) }]) {
    assert.equal((await api.send(payload)).status, 422);
  }
  assert.equal((await api.send({ ...body(), padding: 'x'.repeat(131073) })).status, 413);
  assert.equal(api.calls(), 0);
});

for (const [status, expected] of [[401, 503], [403, 503], [500, 503], [429, 429], [504, 504], [422, 422], [404, 503], [530, 503], [502, 503], [524, 504]]) {
  test(`chat safely maps upstream ${status}`, async t => {
    const api = await setup(t, { status });
    const response = await api.send();
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes('private upstream secret'));
  });
}

test('chat enforces deadline and validates official model response', async t => {
  const slow = await setup(t, { delay: 150, settings: { chatTimeoutMs: 30 } });
  assert.equal((await slow.send()).status, 504);
  for (const result of [{ model: 'other/model' }, { reply: '' }, { reply: 'x'.repeat(8001) }]) {
    const api = await setup(t, { result });
    assert.equal((await api.send()).status, 502);
  }
});

test('chat rate limits independently and rejects concurrent requests', async t => {
  const api = await setup(t, { delay: 100 });
  const first = api.send();
  while (!api.calls()) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal((await api.send()).status, 429);
  assert.equal((await first).status, 200);
  assert.equal((await api.send()).status, 200);
  const limited = await setup(t, { settings: { rateLimitMax: 1 } });
  assert.equal((await limited.send()).status, 200);
  assert.equal((await limited.send()).status, 429);
});

test('chat refuses insecure remote destinations, missing secrets and redirects', async t => {
  for (const settings of [{ chatUrl: 'http://example.com' }, { chatToken: '' }, { chatUrl: 'https://user:password@example.com' }]) {
    const api = await setup(t, { settings });
    assert.equal((await api.send()).status, 503);
    assert.equal(api.calls(), 0);
  }
  const redirect = await setup(t, { status: 302 });
  assert.equal((await redirect.send()).status, 503);
});

test('chat uses the existing FastAPI messages/reply contract', async t => {
  const api = await setup(t, { inspect: data => {
    assert.deepEqual(data, body());
  } });
  assert.equal((await api.send()).status, 200);
});

test('tunnel HTML, malformed JSON and network failures never leak upstream details', async t => {
  for (const raw of ['<html>private upstream secret</html>', '{broken', 'null']) {
    const api = await setup(t, { raw });
    const response = await api.send();
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('private upstream secret'));
  }
  const api = await setup(t, { settings: { chatUrl: 'http://127.0.0.1:1' } });
  assert.equal((await api.send()).status, 503);
});
