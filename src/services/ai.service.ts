import axios from 'axios';
import { config } from '../config/env';

export type AiSettings = typeof config.ai;
export type SpeechLanguage = 'yo' | 'en-NG' | 'ha' | 'ig';
export const speechModels = { yo: 'NCAIR1/Yoruba-ASR', 'en-NG': 'NCAIR1/NigerianAccentedEnglish', ha: 'NCAIR1/Hausa-ASR', ig: 'NCAIR1/Igbo-ASR' };
export const audioMimeTypes = new Set(['audio/webm', 'audio/ogg', 'application/ogg', 'audio/wav', 'audio/wave', 'audio/x-wav']);

export class AiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}

export function validateAudio(file: Express.Multer.File | undefined, language: unknown, maxBytes: number): SpeechLanguage {
  if (language !== 'yo' && language !== 'en-NG' && language !== 'ha' && language !== 'ig') {
    throw new AiError(422, 'unsupported_language', 'Select English, Yoruba, Hausa or Igbo.');
  }
  if (!file || !file.size) throw new AiError(400, 'empty_audio', 'Please provide a recording or audio file.');
  if (file.size > maxBytes) throw new AiError(413, 'audio_too_large', 'The recording exceeds the upload size limit.');
  const mime = file.mimetype.split(';')[0].trim().toLowerCase();
  const bytes = file.buffer;
  const wav = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE';
  const ogg = bytes.subarray(0, 4).toString() === 'OggS';
  const webm = bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && bytes.subarray(0, 4096).includes(Buffer.from('webm'));
  const matches = mime === 'audio/webm' ? webm : mime === 'audio/ogg' || mime === 'application/ogg' ? ogg : wav;
  if (!audioMimeTypes.has(mime) || !matches) {
    throw new AiError(415, 'unsupported_audio', 'Use a valid WebM, WAV or OGG audio recording.');
  }
  // FFmpeg in the existing Python service remains authoritative for decoding
  // and duration: container headers alone cannot validate a browser recording.
  return language;
}

const safeErrors: Record<string, [number, string]> = {
  empty_audio: [400, 'The recording is empty. Please record again.'],
  audio_too_large: [413, 'The recording exceeds the upload size limit.'],
  unsupported_audio: [415, 'Use a valid WebM, WAV or OGG audio recording.'],
  invalid_audio: [422, 'This recording could not be read. Please record again.'],
  audio_too_long: [422, 'The recording exceeds the duration limit. Please use a shorter recording.'],
  unsupported_language: [422, 'The selected language is currently unavailable.'],
  service_busy: [429, 'Speech to Text is busy. Please wait a moment and retry.'],
  model_access_denied: [503, 'The speech model is unavailable. Please try later or contact support.'],
  model_initialization_failed: [503, 'The speech model could not start. Please try later.'],
  decoder_unavailable: [503, 'Speech to Text is temporarily unavailable. Please try later.'],
  worker_unavailable: [503, 'Speech to Text is temporarily unavailable. Please retry.'],
  inference_failed: [503, 'Transcription failed. Please retry your recording.'],
  inference_timeout: [504, 'Transcription took too long. Please retry or use a shorter recording.'],
  decode_timeout: [504, 'Reading this recording took too long. Please use a shorter recording.'],
  upload_timeout: [504, 'The speech service timed out. Please retry.'],
};

export class AiService {
  constructor(private settings: AiSettings) {}

  assertConfigured(): URL {
    try {
      const url = new URL(this.settings.url.replace(/\/$/, '') + '/transcribe');
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || this.settings.token.length < 32) throw new Error();
      return url;
    } catch {
      throw new AiError(503, 'ai_not_configured', 'Speech to Text is not configured. Please contact support.');
    }
  }

  async transcribe(file: Express.Multer.File, language: SpeechLanguage, clientSignal: AbortSignal) {
    const url = this.assertConfigured();
    const timeout = AbortSignal.timeout(this.settings.timeoutMs);
    const signal = AbortSignal.any([timeout, clientSignal]);
    const form = new FormData();
    const mime = file.mimetype.split(';')[0].trim().toLowerCase();
    const extension = mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : 'wav';
    form.append('audio', new Blob([new Uint8Array(file.buffer)], { type: mime }), `recording.${extension}`);
    form.append('language', language);
    try {
      // Node fetch has a separate 300s headers timeout, shorter than a cold
      // model load. Use the existing HTTP adapter and our total AbortSignal
      // deadline for both response headers and body.
      const response = await axios.post<string>(url.toString(), form, {
        adapter: 'http', headers: { Authorization: `Bearer ${this.settings.token}` },
        signal, timeout: 0, maxRedirects: 0, proxy: false,
        maxContentLength: 65536, responseType: 'text',
        transformResponse: [(data: string) => data], validateStatus: () => true,
      });
      let result: any;
      try { result = JSON.parse(response.data); }
      catch { throw new AiError(502, 'invalid_ai_response', 'The speech service returned an invalid response.'); }
      if (response.status < 200 || response.status >= 300) {
        if (response.status === 401 || response.status === 403) {
          throw new AiError(503, 'ai_auth_failed', 'Speech to Text is not configured correctly. Please contact support.');
        }
        const code = typeof result?.error?.code === 'string' ? result.error.code : '';
        const known = Object.prototype.hasOwnProperty.call(safeErrors, code) ? safeErrors[code] : undefined;
        if (known) {
          const retry = Number(response.headers['retry-after']);
          throw new AiError(known[0], code, known[1], known[0] === 429 ? (Number.isInteger(retry) && retry > 0 && retry <= 900 ? retry : 5) : undefined);
        }
        throw new AiError(503, 'ai_unavailable', 'Speech to Text is temporarily unavailable. Please retry.');
      }
      if (typeof result?.transcript !== 'string' || result.language !== language || result.model !== speechModels[language] ||
          !Number.isFinite(result.processing_time_ms) || result.processing_time_ms < 0) {
        throw new AiError(502, 'invalid_ai_response', 'The speech service returned an invalid response.');
      }
      // Explicit allowlist: no arbitrary upstream metadata reaches the browser.
      return { transcript: result.transcript, language, model: result.model as string, processing_time_ms: result.processing_time_ms as number };
    } catch (error) {
      if (error instanceof AiError) throw error;
      if (timeout.aborted) throw new AiError(504, 'ai_timeout', 'Transcription took too long. Please retry or use a shorter recording.');
      if (clientSignal.aborted) throw new AiError(499, 'request_cancelled', 'The request was cancelled.');
      if (axios.isAxiosError(error) && error.code === 'ERR_BAD_RESPONSE') {
        throw new AiError(502, 'invalid_ai_response', 'The speech service returned an invalid response.');
      }
      throw new AiError(503, 'ai_unavailable', 'Speech to Text is temporarily unavailable. Please retry.');
    }
  }
}
