const { randomUUID } = require('node:crypto');

const languages = [
  ['en', 'What is one benefit of reading?'],
  ['yo', 'Kí ni àǹfààní kan tí kíkà ń fúnni?'],
  ['ha', 'Menene amfanin karatu guda ɗaya?'],
  ['ig', 'Gịnị bụ otu uru ịgụ akwụkwọ?'],
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required setting ${name}`);
  return value;
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(Number(process.env.NATLAS_TIMEOUT_MS || 340000)),
    headers: { ...(init.headers || {}), Accept: 'application/json' },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`Invalid JSON response (${response.status})`); }
  if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}`);
  return body;
}

async function main() {
  const baseURL = required('AI_SERVICE_URL');
  const serviceToken = required('AI_SERVICE_TOKEN');
  const rootURL = baseURL.replace(/\/+$/, '');
  const authHeaders = { Authorization: `Bearer ${serviceToken}`, 'Content-Type': 'application/json' };

  for (const [language, prompt] of languages) {
    const started = performance.now();
    const result = await fetchJson(`${rootURL}/chat`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ language, messages: [{ role: 'user', content: prompt }] }),
    });
    const reply = result.reply;
    if (result.model !== 'NCAIR1/N-ATLaS' || result.language !== language || typeof reply !== 'string' ||
        !reply.trim() || !Number.isFinite(result.processing_time_ms)) {
      throw new Error(`Real generation failed for ${language}`);
    }
    process.stdout.write(JSON.stringify({
      kind: 'generation', language, reply,
      response_ms: Math.round(performance.now() - started),
    }) + '\n');
  }

  const health = await fetchJson(`${rootURL}/health/chat`);
  if (health.status !== 'ready' || health.model !== 'NCAIR1/N-ATLaS') {
    throw new Error('Transformers model is not ready');
  }
  process.stdout.write(JSON.stringify({ kind: 'model_ready', model: health.model, status: health.status }) + '\n');

  const backend = required('LIGHTBRIDGE_URL').replace(/\/+$/, '');
  const token = required('LIGHTBRIDGE_USER_TOKEN');
  const bookId = required('BOOK_ID');
  const question = required('BOOK_SMOKE_QUESTION');
  const expected = required('BOOK_SMOKE_EXPECTED').trim().toLocaleLowerCase();
  const responseLanguage = process.env.BOOK_SMOKE_LANGUAGE || 'en';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const created = await fetchJson(`${backend}/api/ai/books/${encodeURIComponent(bookId)}/conversations`, {
    method: 'POST', headers, body: JSON.stringify({}),
  });
  const conversationId = created.data?._id || created.data?.id;
  if (!conversationId) throw new Error('Could not create an authorized book conversation');

  const prefix = `${backend}/api/ai/books/${encodeURIComponent(bookId)}/conversations/${encodeURIComponent(conversationId)}`;
  const started = await fetchJson(`${prefix}/turns`, {
    method: 'POST', headers,
    body: JSON.stringify({ requestId: randomUUID(), action: 'ask', question,
      inputLanguage: responseLanguage, responseLanguage, chapterKey: '' }),
  });
  let turn = started.data;
  for (let attempt = 0; attempt < 40 && turn?.status !== 'completed'; attempt++) {
    if (!turn?.id || turn.status === 'failed') throw new Error(`Book turn failed: ${turn?.errorCode || 'missing turn'}`);
    const step = await fetchJson(`${prefix}/turns/${encodeURIComponent(turn.id)}/step`, {
      method: 'POST', headers, body: JSON.stringify({}),
    });
    turn = step.data;
  }
  if (turn?.status !== 'completed' || !turn.answer?.trim() || !turn.sources?.length) {
    throw new Error('Book-grounded answer did not complete with server-selected citations');
  }
  if (!turn.answer.toLocaleLowerCase().includes(expected)) {
    throw new Error('Book-grounded answer did not contain the expected fact; review the retrieved sources and model output');
  }
  process.stdout.write(JSON.stringify({ kind: 'book_grounding', answer: turn.answer,
    citations: turn.sources.map(source => ({ chapterTitle: source.chapterTitle, pageNumber: source.pageNumber, readerPage: source.readerPage })) }) + '\n');
}

main().catch(error => {
  process.stderr.write(JSON.stringify({ smoke_passed: false, error: error.message }) + '\n');
  process.exitCode = 1;
});
