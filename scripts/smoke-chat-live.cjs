// Explicit live browser test: real React, production Express server, real DB/auth,
// and configured Kaggle endpoint. No inference/auth mocks. No secret artifacts.
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const net = require('node:net');
const mongoose = require('mongoose');
const { config } = require('../dist/config/env');
const { User } = require('../dist/models/User');
const { chromium } = require('../../frontend/node_modules/@playwright/test');

const root = path.resolve(__dirname, '../..');
const backendPort = 5102, frontendPort = 5194;
const api = `http://127.0.0.1:${backendPort}/api`;
const email = `lightbridge-smoke-${randomUUID()}@example.invalid`;
const password = randomBytes(32).toString('base64url');
const report = { checks: [], responses: [] };
let stage = 'configuration', backend, vite, browser, registered = false;
function requireCheck(ok, name) {
  report.checks.push({ check: name, passed: !!ok });
  if (!ok) throw new Error('Check failed');
}
async function freePort(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => server.close(resolve));
}

async function main() {
  try {
    requireCheck(new URL(config.ai.chatUrl).protocol === 'https:' && !!config.ai.chatToken, 'remote_https_configured');
    stage = 'database';
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
    await Promise.all([freePort(backendPort), freePort(frontendPort)]);
    stage = 'backend_start';
    backend = spawn(process.execPath, ['dist/server.js'], {
      cwd: path.join(root, 'backend'), windowsHide: true, stdio: 'ignore',
      env: { ...process.env, PORT: String(backendPort), NODE_ENV: 'test', FRONTEND_URL: `http://127.0.0.1:${frontendPort}` },
    });
    backend.on('error', () => {});
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (backend.exitCode !== null) break;
      try { ready = (await fetch(`${api}/health`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    requireCheck(ready, 'production_express_started');
    const unauth = await fetch(`${api}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'en', messages: [{ role: 'user', content: 'Hello' }] }) });
    requireCheck(unauth.status === 401, 'anonymous_request_rejected');

    stage = 'temporary_registration';
    // Real registration and password hashing; cleanup targets this exact UUID email.
    registered = true;
    const registration = await fetch(`${api}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'LightBridge', lastName: 'Live Check', email, password }),
      signal: AbortSignal.timeout(20000),
    });
    requireCheck(registration.status === 201, 'temporary_account_registered');
    stage = 'frontend_start';
    process.chdir(path.join(root, 'frontend'));
    const { createServer } = await import(pathToFileURL(path.join(root, 'frontend/node_modules/vite/dist/node/index.js')).href);
    const react = (await import(pathToFileURL(path.join(root, 'frontend/node_modules/@vitejs/plugin-react/dist/index.js')).href)).default;
    vite = await createServer({
      root: path.join(root, 'frontend'), configFile: false, envFile: false,
      plugins: [react()], logLevel: 'silent',
      define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api'), 'import.meta.env.VITE_MEDIA_BASE_URL': JSON.stringify('') },
      server: { host: '127.0.0.1', port: frontendPort, strictPort: true,
        proxy: { '/api': { target: `http://127.0.0.1:${backendPort}`, changeOrigin: true } } },
    });
    await vite.listen();
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage();
    page.on('pageerror', error => {
      report.browserErrorNames = [...(report.browserErrorNames || []),
        ['TypeError', 'ReferenceError', 'SyntaxError', 'Error'].includes(error.name) ? error.name : 'OtherError'];
      // Known development-bootstrap failures only; never log raw error messages.
      if (error.message.includes('preamble')) report.reactPreambleFailure = true;
      if (error.message.includes('React is not defined')) report.reactImportFailure = true;
    });
    // No trace, HAR, video, screenshots or browser storage are persisted.
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    let directInferenceRequest = false;
    page.on('request', request => { if (request.url().includes(new URL(config.ai.chatUrl).hostname)) directInferenceRequest = true; });
    stage = 'browser_open_login';
    await page.goto(`http://127.0.0.1:${frontendPort}/login?redirect=%2Fchat`, { waitUntil: 'domcontentloaded' });
    stage = 'browser_fill_login';
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    stage = 'browser_sign_in';
    const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login'));
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    report.loginHttpStatus = (await loginResponse).status();
    requireCheck(report.loginHttpStatus === 200, 'browser_login_http');
    stage = 'browser_chat_route';
    await page.getByRole('heading', { name: 'LightBridge AI', exact: true }).waitFor();
    report.checks.push({ check: 'real_browser_login', passed: true });

    for (const [language, name] of [['en', 'English'], ['yo', 'Yoruba'], ['ha', 'Hausa'], ['ig', 'Igbo']]) {
      stage = `live_chat_${language}`;
      await page.getByRole('button', { name: 'New chat', exact: true }).click();
      await page.getByLabel('Reply language').selectOption(language);
      await page.getByLabel('Your message').fill(`Please write one short greeting in ${name}.`);
      const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/ai/chat') && response.request().method() === 'POST', { timeout: 155000 });
      await page.getByRole('button', { name: 'Send message' }).click();
      const response = await responsePromise;
      const body = await response.json();
      requireCheck(response.status() === 200 && body.success && body.data?.model === 'NCAIR1/N-ATLaS' && body.data?.language === language && typeof body.data?.reply === 'string', `live_http_${language}`);
      await page.getByRole('log').getByText(body.data.reply, { exact: true }).waitFor();
      report.responses.push({ language, model: body.data.model, responseCharacters: body.data.reply.length,
        containsWords: /\p{L}/u.test(body.data.reply), durationMs: body.data.processing_time_ms, rendered: true });
    }
    stage = 'live_follow_up';
    await page.getByLabel('Reply language').selectOption('en');
    await page.getByLabel('Your message').fill('Briefly explain in English what I asked you to do in my previous message.');
    const followupPromise = page.waitForResponse(response => response.url().endsWith('/api/ai/chat'), { timeout: 155000 });
    await page.getByRole('button', { name: 'Send message' }).click();
    const followup = await followupPromise;
    const sent = followup.request().postDataJSON();
    const received = await followup.json();
    requireCheck(sent.messages.length === 3 && followup.status() === 200 && !!received.data?.reply, 'live_follow_up_with_history');
    await page.getByRole('log').getByText(received.data.reply, { exact: true }).last().waitFor();
    report.responses.push({ language: 'en', followUp: true, responseCharacters: received.data.reply.length,
      containsWords: /\p{L}/u.test(received.data.reply), durationMs: received.data.processing_time_ms, rendered: true });
    requireCheck(!directInferenceRequest, 'browser_never_calls_tunnel');
    report.transportPassed = true;
    report.substantiveReplies = report.responses.every(response => response.containsWords);
    if (!report.substantiveReplies) process.exitCode = 1;
  } catch {
    report.failureStage = stage;
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (vite) await vite.close().catch(() => {});
    if (backend) backend.kill();
    if (registered && mongoose.connection.readyState === 1) {
      try {
        await User.deleteOne({ email, role: 'user', name: 'LightBridge Live Check' });
        requireCheck(await User.countDocuments({ email }) === 0, 'temporary_account_removed');
      } catch { report.cleanupFailed = true; process.exitCode = 1; }
    }
    await mongoose.disconnect().catch(() => {});
    fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
    fs.writeFileSync(path.join(root, '.cache/chat-live-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
}
main().catch(() => { console.error('Live chat verification could not complete; details redacted.'); process.exitCode = 1; });
