const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const { User } = require('../dist/models/User');
const { createAiRouter } = require('../dist/routes/ai.routes');

const serviceToken = 'test-only-service-token-never-use-in-production';
const userId = '000000000000000000000001';
const disabledId = '000000000000000000000002';
const auth = (id = userId) => `Bearer ${jwt.sign({ id }, config.jwtSecret, { expiresIn: '1h' })}`;
const wav = Buffer.concat([Buffer.from('RIFFxxxxWAVE'), Buffer.alloc(80)]);
const originalFind = User.findById;
before(() => { User.findById = async id => ({ _id: id, status: id === disabledId ? 'disabled' : 'active', role: 'user' }); });
after(() => { User.findById = originalFind; });

async function serve(app, t) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function setup(t, options = {}) {
  let forwarded = 0;
  const upstream = express();
  upstream.post('/transcribe', multer().single('audio'), async (req, res) => {
    forwarded++;
    assert.equal(req.headers.authorization, `Bearer ${serviceToken}`);
    assert.deepEqual(Object.keys(req.body), ['language']);
    assert.equal(req.file.fieldname, 'audio');
    assert.equal(req.file.originalname, 'recording.wav');
    if (options.inspect) options.inspect(req);
    if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
    if (res.destroyed) return;
    if (options.raw) return res.status(options.status || 200).send(options.raw);
    if (options.error) return res.status(options.status).set('Retry-After', '7').json({ error: { code: options.error, message: 'private-upstream-detail' }, token: serviceToken });
    res.json({ transcript: req.body.language === 'yo' ? 'Ẹ káàárọ̀' : 'Good morning', language: req.body.language,
      model: req.body.language === 'yo' ? 'NCAIR1/Yoruba-ASR' : 'NCAIR1/NigerianAccentedEnglish', processing_time_ms: 10,
      secret: 'never-forward-this', ...options.result });
  });
  const url = await serve(upstream, t);
  const app = express();
  app.use('/api/ai', createAiRouter({ ...config.ai, url, token: serviceToken, rateLimitMax: 100, ...options.settings }));
  return { url: await serve(app, t), forwarded: () => forwarded };
}

function form(language = 'yo', bytes = wav, mime = 'audio/wav', field = 'audio') {
  const data = new FormData();
  data.append(field, new Blob([bytes], { type: mime }), 'private-filename.wav');
  data.append('language', language);
  return data;
}

const send = (url, body = form(), authorization = auth()) => fetch(`${url}/api/ai/transcribe`, {
  method: 'POST', body, headers: authorization ? { Authorization: authorization } : {},
});

test('real JWT authentication and safe multipart forwarding for both languages', async t => {
  const api = await setup(t, { inspect: req => assert.deepEqual(req.file.buffer, wav) });
  for (const language of ['yo', 'en-NG']) {
    const response = await send(api.url, form(language));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const json = await response.json();
    assert.equal(json.data.language, language);
    assert.ok(json.data.transcript);
    assert.deepEqual(Object.keys(json.data).sort(), ['language', 'model', 'processing_time_ms', 'transcript']);
  }
  assert.equal(api.forwarded(), 2);
});

test('missing/invalid/expired auth and disabled users are rejected before inference', async t => {
  const api = await setup(t);
  for (const token of [null, 'Bearer wrong', `Bearer ${jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: -1 })}`]) {
    assert.equal((await send(api.url, form(), token)).status, 401);
  }
  assert.equal((await send(api.url, form(), auth(disabledId))).status, 403);
  assert.equal(api.forwarded(), 0);
});

test('rejects unsupported language, empty audio, MIME spoofing and wrong field names', async t => {
  const api = await setup(t);
  for (const [body, status] of [
    [form('fr'), 422], [form('yo', Buffer.alloc(0)), 400], [form('yo', wav, 'audio/mpeg'), 415],
    [form('yo', wav, 'audio/ogg'), 415], [form('yo', Buffer.from('not a recording')), 415],
    [form('yo', wav, 'audio/wav', 'file'), 400],
  ]) assert.equal((await send(api.url, body)).status, status);
  const duplicate = form(); duplicate.append('language', 'en-NG');
  assert.equal((await send(api.url, duplicate)).status, 400);
  const extra = form(); extra.append('extra', 'unwanted');
  assert.equal((await send(api.url, extra)).status, 400);
  assert.equal(api.forwarded(), 0);
});

test('file and total request sizes are bounded', async t => {
  const api = await setup(t, { settings: { maxUploadBytes: 32 } });
  assert.equal((await send(api.url)).status, 413);
  assert.equal((await send(api.url, form('yo', Buffer.alloc(70000)))).status, 413);
  assert.equal(api.forwarded(), 0);
});

test('per-user rate limit responds with Retry-After', async t => {
  const api = await setup(t, { settings: { rateLimitMax: 1 } });
  assert.equal((await send(api.url)).status, 200);
  const response = await send(api.url);
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('retry-after')) > 0);
  assert.equal((await send(api.url, form(), auth('000000000000000000000003'))).status, 200);
});

test('rejects simultaneous requests from the same user and releases admission afterwards', async t => {
  const api = await setup(t, { delay: 150 });
  const first = send(api.url);
  while (!api.forwarded()) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await send(api.url)).status, 429);
  assert.equal((await first).status, 200);
  assert.equal((await send(api.url)).status, 200);
});

for (const [upstreamStatus, code, status] of [[401, 'unauthorized', 503], [403, 'unauthorized', 503],
  [503, 'model_access_denied', 503], [503, 'model_initialization_failed', 503],
  [422, 'audio_too_long', 422], [429, 'service_busy', 429], [504, 'inference_timeout', 504]]) {
  test(`maps upstream ${code}/${upstreamStatus} without exposing credentials`, async t => {
    const api = await setup(t, { error: code, status: upstreamStatus });
    const response = await send(api.url);
    assert.equal(response.status, status);
    if (status === 429) assert.equal(response.headers.get('retry-after'), '7');
    const body = await response.text();
    assert.ok(!body.includes(serviceToken));
    assert.ok(!body.includes('private-upstream-detail'));
  });
}

test('backend deadline covers the upstream request', async t => {
  const api = await setup(t, { delay: 300, settings: { timeoutMs: 40 } });
  const response = await send(api.url);
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, 'ai_timeout');
});

test('a delayed upstream response succeeds within the configured deadline', async t => {
  const api = await setup(t, { delay: 150, settings: { timeoutMs: 1500 } });
  const response = await send(api.url);
  assert.equal(response.status, 200);
});

test('the deadline also aborts an upstream response that stalls after headers', async t => {
  const upstream = http.createServer((req, res) => {
    req.resume();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { upstream.closeAllConnections(); upstream.close(resolve); }));
  const { AiService } = require('../dist/services/ai.service');
  const service = new AiService({ ...config.ai, token: serviceToken,
    url: `http://127.0.0.1:${upstream.address().port}`, timeoutMs: 100 });
  await assert.rejects(service.transcribe({ buffer: wav, mimetype: 'audio/wav' }, 'yo', new AbortController().signal),
    error => error.status === 504 && error.code === 'ai_timeout');
});

test('upstream unavailability and missing configuration return safe 503 responses', async t => {
  const unavailable = await setup(t, { settings: { url: 'http://127.0.0.1:1' } });
  assert.equal((await send(unavailable.url)).status, 503);
  const missing = await setup(t, { settings: { token: '' } });
  assert.equal((await send(missing.url)).status, 503);
  assert.equal(missing.forwarded(), 0);
});

test('rejects malformed, oversized or mismatched upstream responses', async t => {
  for (const options of [{ raw: '<html>error</html>' }, { raw: 'x'.repeat(65537) }, { result: { language: 'ig' } }]) {
    const api = await setup(t, options);
    assert.equal((await send(api.url)).status, 502);
  }
});

test('slow multipart upload times out', async t => {
  const api = await setup(t, { settings: { uploadTimeoutMs: 50 } });
  const status = await new Promise((resolve, reject) => {
    const request = http.request(`${api.url}/api/ai/transcribe`, { method: 'POST', headers: {
      Authorization: auth(), 'Content-Type': 'multipart/form-data; boundary=slow',
    } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    request.on('error', reject);
    request.write('--slow\r\n');
  });
  assert.equal(status, 408);
  assert.equal(api.forwarded(), 0);
});

test('existing cover/avatar Multer middleware still accepts image uploads', async t => {
  const { upload } = require('../dist/middlewares/upload');
  const app = express();
  app.post('/image', upload.single('avatar'), (req, res) => res.json({ size: req.file.size, type: req.file.mimetype }));
  const url = await serve(app, t);
  const data = new FormData(); data.append('avatar', new Blob(['test-image'], { type: 'image/png' }), 'avatar.png');
  const response = await fetch(`${url}/image`, { method: 'POST', body: data });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).type, 'image/png');
});
