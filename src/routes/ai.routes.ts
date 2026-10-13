import { Router, ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { config } from '../config/env';
import { createChatRouter } from './chat.routes';
import { createBookAiRouter } from './book-ai.routes';
import { protect, AuthRequest } from '../middlewares/auth';
import { AiError, AiService, AiSettings, audioMimeTypes, validateAudio } from '../services/ai.service';

export function createAiRouter(settings: AiSettings = config.ai) {
  const router = Router();
  router.use('/books', createBookAiRouter(settings));
  router.use('/chat', createChatRouter(settings));
  const service = new AiService(settings);
  const activeUsers = new Set<string>();
  const limiter = rateLimit({
    windowMs: settings.rateLimitWindowMs, limit: settings.rateLimitMax,
    standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => String(req.user!._id),
    handler: (_req, res) => res.status(429).json({ success: false, error: { code: 'rate_limited' }, message: 'You have reached the transcription limit. Please try again later.' }),
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: settings.maxUploadBytes, files: 1, fields: 1, fieldSize: 32, fieldNameSize: 30, parts: 3 },
    fileFilter: (_req, file, callback) => {
      if (!audioMimeTypes.has(file.mimetype.split(';')[0].trim().toLowerCase())) {
        return callback(new AiError(415, 'unsupported_audio', 'Use WebM, WAV or OGG audio.'));
      }
      callback(null, true);
    },
  }).single('audio');

  const admit: RequestHandler = (req: AuthRequest, res, next) => {
    try { service.assertConfigured(); } catch (error) { return next(error); }
    if (!req.is('multipart/form-data')) return next(new AiError(415, 'multipart_required', 'Upload an audio file and a language.'));
    const id = String(req.user!._id);
    if (activeUsers.has(id) || activeUsers.size >= settings.maxConcurrent) {
      return next(new AiError(429, 'service_busy', 'Speech to Text is busy. Please wait a moment and retry.', 5));
    }
    activeUsers.add(id);
    const requestLimit = settings.maxUploadBytes + 65536;
    let bytes = 0;
    const rejectUpload = (error: AiError) => {
      if (res.headersSent || res.destroyed) return;
      req.unpipe();
      req.pause();
      res.setHeader('Connection', 'close');
      // Let HTTP's Connection: close flush the error response before closing.
      // Destroying the request on finish can reset a socket with unread bytes.
      next(error);
    };
    const onData = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > requestLimit) rejectUpload(new AiError(413, 'audio_too_large', 'The upload exceeds the size limit.'));
    };
    const timer = setTimeout(() => rejectUpload(new AiError(408, 'upload_timeout', 'The upload timed out. Please retry.')), settings.uploadTimeoutMs);
    const uploaded = () => { clearTimeout(timer); req.off('data', onData); };
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      uploaded(); activeUsers.delete(id);
    };
    req.on('data', onData);
    req.once('end', uploaded);
    req.once('aborted', release);
    res.once('finish', release);
    res.once('close', release);
    if (Number(req.headers['content-length']) > requestLimit) {
      rejectUpload(new AiError(413, 'audio_too_large', 'The upload exceeds the size limit.'));
    } else next();
  };

  router.post('/transcribe', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.locals.requestId = randomUUID();
    res.set('X-Request-ID', res.locals.requestId);
    next();
  }, protect, limiter, admit, (req, res, next) => {
    upload(req, res, error => { if (!res.headersSent) next(error); });
  }, async (req, res, next) => {
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnected);
    try {
      if (!req.body || Object.keys(req.body).length !== 1 || !Object.prototype.hasOwnProperty.call(req.body, 'language')) {
        throw new AiError(422, 'invalid_fields', 'Provide one audio file and one language.');
      }
      const language = validateAudio(req.file, req.body.language, settings.maxUploadBytes);
      const data = await service.transcribe(req.file!, language, controller.signal);
      if (!res.destroyed) res.json({ success: true, data });
    } catch (error) {
      if (!res.destroyed && !res.headersSent) next(error);
    } finally {
      res.off('close', disconnected);
    }
  });

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent || res.destroyed) return;
    let safe = error instanceof AiError ? error : new AiError(400, 'invalid_upload', 'The upload could not be read. Please retry with one audio file.');
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      safe = new AiError(413, 'audio_too_large', 'The recording exceeds the upload size limit.');
    }
    if (safe.retryAfter) res.set('Retry-After', String(safe.retryAfter));
    if (safe.status >= 500) console.warn('[Speech to Text]', { requestId: res.locals.requestId, code: safe.code });
    res.status(safe.status).json({ success: false, error: { code: safe.code }, message: safe.message, request_id: res.locals.requestId });
  };
  router.use(handleError);
  return router;
}

export default createAiRouter();
