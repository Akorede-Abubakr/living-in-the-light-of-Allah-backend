// Explicit manual test against running services and the real NCAIR checkpoint.
// Credentials are read from the environment; no token or transcript is logged.
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const [filePath, language = 'en-NG'] = process.argv.slice(2);
  if (!filePath || !['yo', 'en-NG'].includes(language)) throw new Error('Usage: node scripts/smoke-ai.cjs <audio.wav|webm|ogg> <yo|en-NG>');
  const mime = { '.wav': 'audio/wav', '.webm': 'audio/webm', '.ogg': 'audio/ogg' }[path.extname(filePath).toLowerCase()];
  if (!mime) throw new Error('Use a WAV, WebM or OGG recording.');
  if (fs.statSync(filePath).size > Number(process.env.AI_MAX_UPLOAD_BYTES || 10485760)) throw new Error('Audio exceeds the configured upload limit.');
  const base = (process.env.SPEECH_TEST_API_BASE_URL || 'http://127.0.0.1:5000/api').replace(/\/$/, '');
  let token = process.env.SPEECH_TEST_USER_TOKEN;
  if (!token) {
    if (!process.env.SPEECH_TEST_EMAIL || !process.env.SPEECH_TEST_PASSWORD) throw new Error('Set SPEECH_TEST_EMAIL and SPEECH_TEST_PASSWORD for an existing local account, or SPEECH_TEST_USER_TOKEN.');
    const response = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.SPEECH_TEST_EMAIL, password: process.env.SPEECH_TEST_PASSWORD }),
      signal: AbortSignal.timeout(10000),
    });
    const auth = await response.json();
    if (!response.ok || !auth.token) throw new Error(`Login failed (HTTP ${response.status}).`);
    token = auth.token;
  }
  const form = new FormData();
  form.append('audio', new Blob([fs.readFileSync(filePath)], { type: mime }), `recording${path.extname(filePath)}`);
  form.append('language', language);
  const response = await axios.post(`${base}/ai/transcribe`, form, {
    adapter: 'http', headers: { Authorization: `Bearer ${token}` },
    timeout: 0, maxRedirects: 0, proxy: false, maxContentLength: 65536,
    validateStatus: () => true,
    signal: AbortSignal.timeout(Number(process.env.AI_SERVICE_TIMEOUT_MS || 780000) + 30000),
  });
  const body = response.data;
  if (response.status < 200 || response.status >= 300) {
    const code = typeof body.error?.code === 'string' && /^[a-z_]+$/.test(body.error.code) ? body.error.code : 'unknown';
    throw new Error(`Transcription failed (HTTP ${response.status}, code ${code}).`);
  }
  const expected = language === 'yo' ? 'NCAIR1/Yoruba-ASR' : 'NCAIR1/NigerianAccentedEnglish';
  if (!body.success || body.data?.language !== language || body.data?.model !== expected || !body.data?.transcript?.trim()) throw new Error('Unexpected or empty transcription response.');
  console.log(`PASS: authenticated Express → FastAPI → ${expected}; transcript received (${body.data.transcript.length} characters, ${body.data.processing_time_ms} ms).`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
