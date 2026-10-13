import express, { Router, RequestHandler, ErrorRequestHandler } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { protect, adminOnly, AuthRequest } from '../middlewares/auth';
import { AiError, AiSettings } from '../services/ai.service';
import { authorizeBook, currentIndex, indexBook, objectId, retrieve, sourceReference } from '../services/book-index.service';
import { beginTurn, ownedConversation, publicTurn, stepTurn } from '../services/book-chat.service';
import { BookConversation, BookIndex, BookPassage, BookTurn } from '../models/BookIntelligence';
import { chatLanguages } from '../services/chat.service';

export function createBookAiRouter(settings: AiSettings) {
  const router = Router();
  const wrap = (fn: (req: AuthRequest, res: express.Response) => Promise<any>): RequestHandler => (req, res, next) => { Promise.resolve(fn(req as AuthRequest, res)).catch(next); };
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, protect);
  router.use(rateLimit({ windowMs: 15 * 60000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => String(req.user!._id), message: { success: false, message: 'Too many book assistant requests. Retry later.' } }));
  router.use(express.json({ limit: '16kb' }));
  const steps = rateLimit({ windowMs: 15 * 60000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => String(req.user!._id), message: { success: false, message: 'Generation limit reached. Your summary progress is saved; resume later.' } });
  // Busboy emits partsLimit on reaching the limit, including the final part.
  // Keep it above one; files/fields and .single still enforce one document only.
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 0, parts: 2 } }).single('document');
  let indexing = false, activeSteps = 0;
  const admitIndex: RequestHandler = (_req, res, next) => {
    if (indexing) return next(new AiError(429, 'index_busy', 'Another document is being indexed. Retry later.'));
    indexing = true;
    // Keep admission until parsing/indexing has finished, even on disconnect.
    res.locals.releaseIndex = () => { indexing = false; };
    next();
  };
  router.post('/:bookId/index', adminOnly, admitIndex, (req, res, next) => {
    upload(req, res, error => { if (error) res.locals.releaseIndex(); next(error); });
  }, wrap(async (req, res) => {
    try { res.json({ success: true, data: await indexBook(req.params.bookId, req.file) }); }
    finally { res.locals.releaseIndex(); }
  }));
  router.get('/:bookId/index-status', adminOnly, wrap(async (req, res) => {
    objectId(req.params.bookId);
    const index = await BookIndex.findOne({ book: req.params.bookId })
      .select('status lastError filename passageCount chapters startedAt completedAt updatedAt').lean();
    res.json({ success: true, data: index || { status: 'pending', lastError: '', passageCount: 0, chapters: [] } });
  }));

  router.get('/:bookId/context', wrap(async (req, res) => {
    const book = await authorizeBook(String(req.user!._id), req.params.bookId);
    const index = await currentIndex(req.params.bookId);
    res.json({ success: true, data: { title: book.title, sourceLanguage: book.language, version: index.version,
      source: index.source, passageCount: index.passageCount, chapters: index.chapters } });
  }));
  router.get('/:bookId/passages', wrap(async (req, res) => {
    const book = await authorizeBook(String(req.user!._id), req.params.bookId);
    const index = await currentIndex(req.params.bookId);
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const chapter = typeof req.query.chapterKey === 'string' ? req.query.chapterKey : '';
    if (query.length > 1500 || chapter.length > 100) throw new AiError(422, 'invalid_search', 'Search is too long.');
    const page = req.query.page ? Number(req.query.page) : undefined;
    if (page !== undefined && (!Number.isInteger(page) || page < 1)) throw new AiError(422, 'invalid_page', 'Invalid page number.');
    const found = query || page ? await retrieve(req.params.bookId, index.version!, query, chapter, page) :
      await BookPassage.find({ book: book._id, version: index.version, ...(chapter ? { chapterKey: chapter } : {}) }).sort({ ordinal: 1 }).limit(3).lean();
    res.json({ success: true, data: found.map(p => sourceReference(p, book.title)), inferenceUsed: false });
  }));
  router.get('/:bookId/sources/:sourceId', wrap(async (req, res) => {
    const book = await authorizeBook(String(req.user!._id), req.params.bookId);
    const passage = await BookPassage.findOne({ _id: objectId(req.params.sourceId), book: book._id }).lean();
    if (!passage) throw new AiError(404, 'source_not_found', 'Source not found.');
    res.json({ success: true, data: sourceReference(passage, book.title) });
  }));
  router.get('/:bookId/conversations', wrap(async (req, res) => {
    await authorizeBook(String(req.user!._id), req.params.bookId);
    res.json({ success: true, data: await BookConversation.find({ user: req.user!._id, book: req.params.bookId })
      .select('_id title chapterKey inputLanguage responseLanguage updatedAt').sort({ updatedAt: -1 }).limit(50).lean() });
  }));
  router.post('/:bookId/conversations', wrap(async (req, res) => {
    const book = await authorizeBook(String(req.user!._id), req.params.bookId);
    const index = await currentIndex(req.params.bookId);
    if (await BookConversation.countDocuments({ user: req.user!._id, book: book._id }) >= 50) throw new AiError(409, 'conversation_limit', 'Delete an old conversation before creating another.');
    const conversation = await BookConversation.create({ user: req.user!._id, book: book._id, indexVersion: index.version, title: book.title });
    res.status(201).json({ success: true, data: conversation });
  }));
  const own = async (req: AuthRequest, fresh = true) => {
    const result = await ownedConversation(String(req.user!._id), req.params.conversationId, fresh);
    if (String(result.conversation.book) !== req.params.bookId) throw new AiError(404, 'conversation_not_found', 'Conversation not found.');
    return result;
  };
  router.get('/:bookId/conversations/:conversationId', wrap(async (req, res) => {
    const { conversation } = await own(req, false);
    const turns = await BookTurn.find({ conversation: conversation._id }).sort({ createdAt: 1 }).limit(200).lean();
    res.json({ success: true, data: { conversation, turns: turns.map(publicTurn) } });
  }));
  router.patch('/:bookId/conversations/:conversationId', wrap(async (req, res) => {
    const { conversation, index } = await own(req);
    const { inputLanguage, responseLanguage, chapterKey } = req.body || {};
    if (!Object.hasOwn(chatLanguages, inputLanguage) || !Object.hasOwn(chatLanguages, responseLanguage) ||
      typeof chapterKey !== 'string' || (chapterKey && !index.chapters.some(c => c.key === chapterKey))) throw new AiError(422, 'invalid_preferences', 'Invalid conversation preferences.');
    conversation.set({ inputLanguage, responseLanguage, chapterKey }); await conversation.save();
    res.json({ success: true });
  }));
  router.delete('/:bookId/conversations/:conversationId', wrap(async (req, res) => {
    const { conversation } = await own(req, false);
    if (conversation.leaseUntil && conversation.leaseUntil > new Date()) throw new AiError(409, 'conversation_busy', 'Wait for the current request before deleting.');
    await BookConversation.deleteOne({ _id: conversation._id, user: req.user!._id });
    await BookTurn.deleteMany({ conversation: conversation._id });
    res.json({ success: true });
  }));
  router.post('/:bookId/conversations/:conversationId/turns', wrap(async (req, res) => {
    await own(req);
    res.status(201).json({ success: true, data: await beginTurn(String(req.user!._id), req.params.conversationId, req.body) });
  }));
  router.post('/:bookId/conversations/:conversationId/turns/:turnId/step', steps, wrap(async (req, res) => {
    if (activeSteps >= settings.maxConcurrent) throw new AiError(429, 'service_busy', 'The assistant is busy. Retry shortly.');
    activeSteps++;
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnect);
    try {
      const result = await stepTurn(String(req.user!._id), req.params.conversationId, req.params.turnId, settings, controller.signal, req.params.bookId);
      if (!res.destroyed) res.json({ success: true, data: result });
    } finally { activeSteps--; res.off('close', disconnect); }
  }));
  router.get('/:bookId/conversations/:conversationId/turns/:turnId/sources', wrap(async (req, res) => {
    await own(req, false);
    const turn = await BookTurn.findOne({ _id: objectId(req.params.turnId), conversation: req.params.conversationId }).lean();
    if (!turn) throw new AiError(404, 'turn_not_found', 'Question not found.');
    const offset = Math.max(0, Math.min(5000, Number(req.query.offset) || 0));
    res.json({ success: true, data: turn.sources.slice(offset, offset + 40), total: turn.sources.length });
  }));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent || res.destroyed) return;
    const safe = error instanceof AiError ? error : error instanceof multer.MulterError ?
      error.code === 'LIMIT_FILE_SIZE' ? new AiError(413, 'document_too_large', 'This manuscript exceeds the 50 MB upload limit.') :
      new AiError(400, 'invalid_document_upload', 'Upload one PDF, DOCX or DOC file using the manuscript picker.') :
      error.type === 'entity.too.large' ? new AiError(413, 'request_too_large', 'The request is too large.') :
      error.code === 11000 ? new AiError(409, 'request_conflict', 'This request already exists. Reload the conversation.') :
      new AiError(500, 'book_ai_failed', 'The book assistant request could not be completed. Retry later.');
    res.status(safe.status).json({ success: false, error: { code: safe.code }, message: safe.message });
  };
  router.use(errors);
  return router;
}
