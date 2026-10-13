import express, { ErrorRequestHandler, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { protect, AuthRequest } from '../middlewares/auth';
import { AiError, AiSettings } from '../services/ai.service';
import { chat, validateChat } from '../services/chat.service';

export function createChatRouter(settings: AiSettings) {
  const router = Router();
  const active = new Set<string>();
  const limiter = rateLimit({
    windowMs: settings.rateLimitWindowMs, limit: settings.rateLimitMax,
    standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => String(req.user!._id),
    handler: (_req, res) => res.status(429).json({ success: false, error: { code: 'rate_limited' }, message: 'You have reached the chat limit. Please try again later.' }),
  });
  router.post('/', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Request-ID', randomUUID());
    next();
  }, protect, limiter, (req, _res, next) => {
    next(req.is('application/json') ? undefined : new AiError(415, 'json_required', 'Send a JSON chat request.'));
  }, express.json({ limit: '128kb' }), async (req: AuthRequest, res, next) => {
    const id = String(req.user!._id);
    let admitted = false;
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnect);
    try {
      const input = validateChat(req.body);
      if (active.has(id) || active.size >= settings.maxConcurrent) throw new AiError(429, 'service_busy', 'LightBridge AI is busy. Please retry shortly.', 5);
      active.add(id); admitted = true;
      const data = await chat(settings, input, controller.signal);
      if (!res.destroyed) res.json({ success: true, data });
    } catch (error) {
      if (!res.destroyed) next(error);
    } finally {
      if (admitted) active.delete(id);
      res.off('close', disconnect);
    }
  });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const safe = error instanceof AiError ? error : new AiError(error.type === 'entity.too.large' ? 413 : 400, 'invalid_chat', 'The chat request could not be read.');
    if (safe.retryAfter) res.set('Retry-After', String(safe.retryAfter));
    res.status(safe.status).json({ success: false, error: { code: safe.code }, message: safe.message });
  };
  router.use(errors);
  return router;
}
