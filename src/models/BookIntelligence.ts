import mongoose, { Schema } from 'mongoose';

// Publish a version only after every passage is durably written. Readers never
// see an incomplete index, and an unsuccessful reindex preserves the old one.
const IndexSchema = new Schema({
  book: { type: Schema.Types.ObjectId, ref: 'Book', unique: true, required: true },
  version: String, source: { type: String, enum: ['reader', 'pdf', 'docx', 'doc'] },
  sourceStamp: String, fileId: Schema.Types.ObjectId, filename: String,
  readerFileId: Schema.Types.ObjectId,
  passageCount: Number, chapters: [{ key: String, title: String }],
  status: { type: String, enum: ['pending', 'processing', 'ready', 'failed'], default: 'pending' },
  lastError: { type: String, default: '' }, startedAt: Date, completedAt: Date,
  leaseUntil: Date, leaseId: String,
}, { timestamps: true });
export const BookIndex = mongoose.model('BookIndex', IndexSchema);

const PassageSchema = new Schema({
  book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  version: { type: String, required: true }, ordinal: Number,
  chapterKey: String, chapterTitle: String, section: String,
  pageNumber: Number, readerPage: Number, text: { type: String, required: true },
  terms: [String],
});
PassageSchema.index({ book: 1, version: 1, ordinal: 1 }, { unique: true });
PassageSchema.index({ book: 1, version: 1, terms: 1 });
export const BookPassage = mongoose.model('BookPassage', PassageSchema);

const SummarySchema = new Schema({
  book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  version: { type: String, required: true },
  action: { type: String, enum: ['summarize_book', 'summarize_detailed', 'summarize_lessons', 'summarize_chapter'], required: true },
  chapterKey: { type: String, default: '' }, responseLanguage: { type: String, enum: ['en', 'yo', 'ha', 'ig'], required: true },
  answer: { type: String, required: true }, sources: { type: [Schema.Types.Mixed], default: [] },
  pipeline: String,
}, { timestamps: true });
SummarySchema.index({ book: 1, version: 1, action: 1, chapterKey: 1, responseLanguage: 1 }, { unique: true });
export const BookSummary = mongoose.model('BookSummary', SummarySchema);

const ConversationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  indexVersion: { type: String, required: true }, title: String,
  chapterKey: { type: String, default: '' },
  inputLanguage: { type: String, enum: ['en', 'yo', 'ha', 'ig'], default: 'en' },
  responseLanguage: { type: String, enum: ['en', 'yo', 'ha', 'ig'], default: 'en' },
  leaseUntil: Date, leaseId: String,
}, { timestamps: true });
ConversationSchema.index({ user: 1, book: 1, updatedAt: -1 });
export const BookConversation = mongoose.model('BookConversation', ConversationSchema);

const TurnSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, required: true },
  requestId: { type: String, required: true }, question: String, answer: String,
  action: { type: String, enum: ['ask', 'explain', 'translate', 'summarize_book', 'summarize_detailed', 'summarize_lessons', 'summarize_chapter'] },
  inputLanguage: String, responseLanguage: String, chapterKey: String,
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorCode: String, sources: { type: [Schema.Types.Mixed], default: [] },
  // Resumable hierarchy: one model call per step, durable intermediate results.
  job: Schema.Types.Mixed,
}, { timestamps: true });
TurnSchema.index({ conversation: 1, requestId: 1 }, { unique: true });
TurnSchema.index({ conversation: 1, createdAt: 1 });
export const BookTurn = mongoose.model('BookTurn', TurnSchema);
