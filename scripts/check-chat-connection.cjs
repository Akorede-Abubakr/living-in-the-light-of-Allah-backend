// Explicit live check. Never prints URLs, tokens, raw errors or generated text.
const axios = require('axios');
const { config } = require('../dist/config/env');
const { chat } = require('../dist/services/chat.service');
const { AiError } = require('../dist/services/ai.service');

async function main() {
  let url;
  try {
    url = new URL(config.ai.chatUrl.replace(/\/$/, '') + '/health/chat');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !config.ai.chatToken) throw new Error();
  } catch { throw new AiError(503, 'ai_not_configured', 'Invalid configuration'); }
  const response = await axios.get(url.toString(), {
    headers: { Authorization: `Bearer ${config.ai.chatToken}` },
    signal: AbortSignal.timeout(20000), maxRedirects: 0, proxy: false,
    maxContentLength: 65536, responseType: 'text', validateStatus: () => true,
  });
  let health;
  try { health = typeof response.data === 'string' ? JSON.parse(response.data) : response.data; } catch { health = null; }
  const ready = response.status === 200 && health?.status === 'ready' && health?.model === 'NCAIR1/N-ATLaS';
  console.log(JSON.stringify({ check: 'live_health', httpStatus: response.status, modelReady: ready }));
  if (!ready) { process.exitCode = 1; return; }
  if (process.argv.includes('--infer')) {
    const result = await chat(config.ai, { language: 'en', messages: [
      { role: 'user', content: 'Hello. Please reply with one short greeting in English.' },
    ] }, new AbortController().signal);
    console.log(JSON.stringify({ check: 'live_inference', model: result.model, language: result.language,
      responseCharacters: result.reply.length, containsWords: /\p{L}/u.test(result.reply),
      ellipsisOnly: /^\s*(\.{3}|…)\s*$/.test(result.reply), durationMs: result.processing_time_ms }));
    if (!/\p{L}/u.test(result.reply)) process.exitCode = 1;
  }
}
main().catch(error => {
  // Never print Axios objects: they contain the Authorization header and URL.
  const code = error instanceof AiError ? error.code :
    ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ERR_CANCELED', 'ETIMEDOUT', 'EAI_AGAIN', 'EPERM'].includes(error?.code) ? error.code : 'connection_failed';
  console.error(JSON.stringify({ check: 'live_connection', code }));
  process.exitCode = 1;
});
