import { AiError, AiSettings } from './ai.service';

export const CHAT_MODEL = 'NCAIR1/N-ATLaS';
export type ChatLanguage = 'en' | 'yo' | 'ha' | 'ig';
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatInput { language: ChatLanguage; messages: ChatMessage[] }
export const chatLanguages: Record<ChatLanguage, string> = { en: 'English', yo: 'Yoruba', ha: 'Hausa', ig: 'Igbo' };
export function validateChat(body: any): ChatInput {
  const invalid = () => new AiError(422, 'invalid_chat', 'Send a language and alternating user/assistant messages ending with your message. Limit history to 21 messages and 24,000 characters.');
  if (!body || Object.keys(body).sort().join(',') !== 'language,messages' ||
      !['en', 'yo', 'ha', 'ig'].includes(body.language) || !Array.isArray(body.messages) ||
      !body.messages.length || body.messages.length > 21 || body.messages.length % 2 !== 1) throw invalid();
  let characters = 0;
  for (const [index, message] of body.messages.entries()) {
    if (!message || Object.keys(message).sort().join(',') !== 'content,role' ||
        message.role !== (index % 2 ? 'assistant' : 'user') || typeof message.content !== 'string' ||
        !message.content.trim() || [...message.content].length > 8000) throw invalid();
    characters += [...message.content].length;
  }
  if (characters > 24000) throw invalid();
  return { language: body.language, messages: body.messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })) };
}

export async function chat(settings: AiSettings, input: ChatInput, clientSignal: AbortSignal) {
  let chatURL: URL;
  try {
    const url = new URL(settings.chatUrl);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash ||
        !['', '/'].includes(url.pathname) ||
        !settings.chatToken.trim() || /[\r\n]/.test(settings.chatToken)) throw new Error();
    chatURL = new URL('/chat', url.origin);
  } catch {
    throw new AiError(503, 'ai_not_configured', 'LightBridge AI is not configured. Please contact support.');
  }
  const timeout = AbortSignal.timeout(settings.chatTimeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(chatURL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.chatToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
      redirect: 'manual',
      signal: AbortSignal.any([timeout, clientSignal]),
    });
    if (response.status === 401 || response.status === 403) {
      throw new AiError(503, 'ai_auth_failed', 'LightBridge AI could not authenticate with the inference service. Please contact support.');
    }
    if (response.status === 429) throw new AiError(429, 'service_busy', 'LightBridge AI is busy. Please retry shortly.', 5);
    if ([408, 504, 524].includes(response.status)) throw new AiError(504, 'ai_timeout', 'The response took too long. Please retry.');
    if (response.status === 422) throw new AiError(422, 'context_too_long', 'The conversation could not be processed. Shorten your message or start a new chat.');
    if (!response.ok) throw new AiError(503, 'ai_connection_unavailable', 'The AI service connection is unavailable. Please try again later.');

    let result: any;
    try { result = await response.json(); }
    catch { throw new AiError(502, 'invalid_ai_response', 'The AI service returned an invalid response.'); }
    const reply = result?.reply;
    if (result?.model !== CHAT_MODEL || result?.language !== input.language || typeof reply !== 'string' ||
        !reply.trim() || [...reply].length > 8000 || !Number.isFinite(result?.processing_time_ms) ||
        result.processing_time_ms < 0) {
      throw new AiError(502, 'invalid_ai_response', 'The AI service returned an invalid response.');
    }
    return { reply, language: input.language, model: CHAT_MODEL, processing_time_ms: Math.round(performance.now() - started) };
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (timeout.aborted) throw new AiError(504, 'ai_timeout', 'The response took too long. Please retry.');
    if (clientSignal.aborted) throw new AiError(499, 'request_cancelled', 'The request was cancelled.');
    throw new AiError(503, 'ai_connection_unavailable', 'Could not reach LightBridge AI. Please try again later.');
  }
}
