import mongoose from 'mongoose';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Book } from '../models/Book';
import { Chapter } from '../models/Chapter';
import { Page } from '../models/Page';
import { BookConversation, BookIndex, BookPassage, BookSummary, BookTurn } from '../models/BookIntelligence';
import { AccessControlService } from './access.service';
import { AiError } from './ai.service';
import { chunks, rankPassages, readingPages, Segment, terms } from './book-text';
import { wordToPdf } from './reader-document.service';

async function replaceReaderPages(book: string, segments: Segment[], session: mongoose.ClientSession) {
  const chapters = [...new Map(segments.map(segment => [segment.chapterKey, segment.chapterTitle])).entries()]
    .map(([key, title], i) => ({ key, _id: new mongoose.Types.ObjectId(), book, title, order: i + 1 }));
  const chapterIds = new Map(chapters.map(chapter => [chapter.key, chapter._id]));
  const chapterPageCounts = new Map<string, number>();
  const pages = segments.map(segment => {
    const chapterPageNumber = (chapterPageCounts.get(segment.chapterKey) || 0) + 1;
    chapterPageCounts.set(segment.chapterKey, chapterPageNumber);
    return { book, chapter: chapterIds.get(segment.chapterKey), pageNumber: segment.readerPage,
      // The existing reader renders content as React text, which escapes HTML.
      chapterPageNumber, title: segment.section || '', content: segment.text.trim() || 'No extractable text on this source page.',
      wordCount: segment.text.trim() ? segment.text.trim().split(/\s+/).length : 0 };
  });
  await Page.deleteMany({ book }, { session });
  await Chapter.deleteMany({ book }, { session });
  await Chapter.insertMany(chapters.map(({ key, ...chapter }) => chapter), { session });
  for (let i = 0; i < pages.length; i += 100) await Page.insertMany(pages.slice(i, i + 100), { session });
  await Book.updateOne({ _id: book }, { $set: { pageCount: pages.length } }, { session });
}

export function objectId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new AiError(422, 'invalid_id', 'Invalid resource identifier.');
  return value;
}

export async function authorizeBook(userId: string, bookId: string) {
  objectId(bookId);
  if (!await Book.exists({ _id: bookId })) throw new AiError(404, 'book_not_found', 'Book not found.');
  const access = await AccessControlService.checkBookAccess(userId, bookId);
  // AI summaries can expose the entire work. Preview access is insufficient.
  if (!access.hasFullAccess || (!access.isAdmin && access.book.status !== 'published')) {
    throw new AiError(403, 'book_access_required', 'Full access to this published book is required to use its assistant.');
  }
  return access.book;
}

export async function readerStamp(book: string) {
  const [page, chapter, count] = await Promise.all([
    Page.findOne({ book }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
    Chapter.findOne({ book }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
    Page.countDocuments({ book }),
  ]);
  return createHash('sha256').update(JSON.stringify([page?.updatedAt, chapter?.updatedAt, count])).digest('hex');
}

export async function currentIndex(book: string) {
  const index = await BookIndex.findOne({ book }).lean();
  if (!index?.version) throw new AiError(409, 'book_not_indexed', 'This book has not been indexed. Ask an administrator to import or index its content.');
  if (index.source === 'reader' && index.sourceStamp !== await readerStamp(book)) {
    throw new AiError(409, 'book_index_stale', 'This book changed. An administrator must rebuild its index before using the assistant.');
  }
  return index;
}

export async function indexBook(book: string, file?: Express.Multer.File) {
  objectId(book);
  if (!await Book.exists({ _id: book })) throw new AiError(404, 'book_not_found', 'Book not found.');
  try { await BookIndex.updateOne({ book }, { $setOnInsert: { book } }, { upsert: true }); }
  catch (e: any) { if (e.code !== 11000) throw e; }
  const leaseId = randomUUID(), version = randomUUID();
  const acquired = await BookIndex.findOneAndUpdate({ book, $or: [{ leaseUntil: { $lte: new Date() } }, { leaseUntil: null }] },
    { $set: { leaseId, leaseUntil: new Date(Date.now() + 300000), status: 'processing', lastError: '', startedAt: new Date() } });
  if (!acquired) throw new AiError(409, 'index_busy', 'This book is already being indexed.');
  let fileId: mongoose.Types.ObjectId | undefined;
  let readerFileId: mongoose.Types.ObjectId | undefined;
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'privateBooks' });
  try {
    let segments: Segment[] = [], source = 'reader', sourceStamp = '';
    if (file) {
      source = path.extname(file.originalname).slice(1).toLowerCase();
      if (!['pdf', 'doc', 'docx'].includes(source)) throw new AiError(415, 'unsupported_document', 'Upload a PDF, DOCX or DOC document. Export Google Docs as DOCX.');
      const readerPdf = source === 'pdf' ? file.buffer : await wordToPdf(file.buffer, source);
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'guardian-book-'));
      try {
        const input = path.join(dir, 'input');
        await fs.writeFile(input, readerPdf, { mode: 0o600 });
        // ts-node-dev runs this service from src; production runs compiled JS.
        const worker = path.join(__dirname, 'document-worker' + path.extname(__filename));
        const runtimeArgs = worker.endsWith('.ts') ? ['-r', require.resolve('ts-node/register/transpile-only')] : [];
        const { stdout } = await promisify(execFile)(process.execPath,
          ['--max-old-space-size=256', ...runtimeArgs, worker, input, 'pdf'],
          { cwd: path.resolve(__dirname, '../..'), timeout: 45000, maxBuffer: 12 * 1024 * 1024, windowsHide: true });
        segments = JSON.parse(stdout.slice(stdout.indexOf('__BOOK_RESULT__') + 15));
      } catch (error: any) {
        const scanned = String(error.stderr).includes('no_extractable_text');
        throw new AiError(422, scanned ? 'ocr_required' : 'document_extraction_failed', scanned
          ? 'This document has no extractable text. Run OCR before uploading it.' : 'Document extraction failed or exceeded its limits. Use a smaller, unencrypted PDF/DOCX/DOC.');
      } finally { await fs.unlink(path.join(dir, 'input')).catch(() => {}); await fs.rmdir(dir); }
      const upload = bucket.openUploadStream('book.' + source, { metadata: { book, version } });
      fileId = upload.id;
      await new Promise<void>((resolve, reject) => { upload.on('error', reject); upload.on('finish', resolve); upload.end(file.buffer); });
      readerFileId = fileId;
      if (source !== 'pdf') {
        const rendered = bucket.openUploadStream('reader.pdf', { metadata: { book, version } });
        readerFileId = rendered.id;
        await new Promise<void>((resolve, reject) => { rendered.on('error', reject); rendered.on('finish', resolve); rendered.end(readerPdf); });
      }
    } else {
      sourceStamp = await readerStamp(book);
      let total = 0;
      for await (const page of Page.find({ book }).populate('chapter', 'title').sort({ pageNumber: 1 }).lean().cursor()) {
        total += page.content.length;
        if (total > 4_000_000) throw new AiError(413, 'book_too_large', 'Split this edition into smaller volumes before indexing.');
        const ch: any = page.chapter;
        segments.push({ text: page.content, chapterKey: String(ch?._id || 'document'), chapterTitle: ch?.title || 'Document',
          section: page.title, pageNumber: page.pageNumber, readerPage: page.pageNumber });
      }
      if (sourceStamp !== await readerStamp(book)) throw new AiError(409, 'book_changed', 'The book changed during indexing. Retry.');
    }
    if (file) segments = readingPages(segments, 'pdf');
    const passages = chunks(segments);
    if (!passages.length || passages.length > 5000) throw new AiError(422, 'invalid_book_content', 'The book must contain text and at most 5,000 searchable passages.');
    for (let i = 0; i < passages.length; i += 100) {
      await BookPassage.insertMany(passages.slice(i, i + 100).map((s, j) => ({ ...s, book, version, ordinal: i + j, terms: terms(s.text) })));
    }
    const chapters = [...new Map(passages.map(s => [s.chapterKey, { key: s.chapterKey, title: s.chapterTitle }])).values()];
    const update = { $set: {
      version, source, sourceStamp, fileId: file ? fileId : acquired.fileId,
      filename: file ? path.basename(file.originalname).slice(0, 200) : acquired.filename,
      readerFileId: file ? readerFileId : (acquired.readerFileId || (acquired.source === 'pdf' ? acquired.fileId : null)),
      passageCount: passages.length, chapters, status: 'ready', lastError: '', completedAt: new Date(), leaseUntil: new Date(0), leaseId: '',
    } };
    const publish = async (session?: mongoose.ClientSession) => {
      const index = await BookIndex.findOneAndUpdate({ book, leaseId }, update, { new: true, session }).lean();
      if (!index) throw new AiError(409, 'index_lease_lost', 'Indexing was interrupted. Retry.');
      if (file && session) await replaceReaderPages(book, segments, session);
      return index;
    };
    // Publish the reader pages and AI index together; failed imports keep the old edition.
    const session = file ? await mongoose.startSession() : undefined;
    let index;
    try { index = session ? await session.withTransaction(() => publish(session)) : await publish(); }
    finally { await session?.endSession(); }
    await BookPassage.deleteMany({ book, version: { $ne: version } }).catch(() => {});
    await BookSummary.deleteMany({ book, version: { $ne: version } }).catch(() => {});
    if (file && acquired.fileId && String(acquired.fileId) !== String(fileId || '')) {
      await bucket.delete(acquired.fileId).catch(() => {});
    }
    if (file && acquired.readerFileId && String(acquired.readerFileId) !== String(acquired.fileId || '')) {
      await bucket.delete(acquired.readerFileId).catch(() => {});
    }
    return index;
  } catch (error) {
    await BookPassage.deleteMany({ book, version });
    if (fileId) await bucket.delete(fileId).catch(() => {});
    if (readerFileId && String(readerFileId) !== String(fileId)) await bucket.delete(readerFileId).catch(() => {});
    const code = error instanceof AiError ? error.code : 'document_extraction_failed';
    await BookIndex.updateOne({ book, leaseId }, { $set: { status: 'failed', lastError: code, completedAt: new Date() } });
    throw error;
  } finally { await BookIndex.updateOne({ book, leaseId }, { $set: { leaseUntil: new Date(0), leaseId: '' } }); }
}

export async function deleteBookIntelligence(book: string) {
  const index = await BookIndex.findOne({ book }).select('fileId readerFileId').lean();
  if (index?.fileId) {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'privateBooks' });
    await bucket.delete(index.fileId).catch(() => {});
    if (index.readerFileId && String(index.readerFileId) !== String(index.fileId)) await bucket.delete(index.readerFileId).catch(() => {});
  }
  const conversations = await BookConversation.find({ book }).select('_id').lean();
  await Promise.all([
    BookPassage.deleteMany({ book }),
    BookSummary.deleteMany({ book }),
    BookIndex.deleteOne({ book }),
    BookTurn.deleteMany({ conversation: { $in: conversations.map(c => c._id) } }),
    BookConversation.deleteMany({ book }),
  ]);
}

export function sourceReference(p: any, title: string) {
  return { id: String(p._id), bookTitle: title, chapterKey: p.chapterKey, chapterTitle: p.chapterTitle,
    section: p.section || '', pageNumber: p.pageNumber || null, readerPage: p.readerPage || null,
    excerpt: p.text, href: p.readerPage ? `/read/${p.book}?page=${p.readerPage}` : null };
}

export async function retrieve(book: string, version: string, query: string, chapterKey = '', readerPage?: number) {
  const scope: any = { book, version, ...(chapterKey ? { chapterKey } : {}) };
  if (readerPage) scope.readerPage = readerPage;
  const words = terms(query);
  const matches = await BookPassage.find({ ...scope, ...(words.length && !readerPage ? { terms: { $in: words } } : {}) })
    .sort({ ordinal: 1 }).limit(1000).lean();
  return (readerPage ? matches : rankPassages(matches, query)).slice(0, 3);
}
