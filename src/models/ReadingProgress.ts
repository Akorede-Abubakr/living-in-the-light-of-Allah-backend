import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IReadingProgress extends Document {
  user: mongoose.Types.ObjectId;
  book: mongoose.Types.ObjectId;
  currentChapter?: mongoose.Types.ObjectId;
  currentPage: number;
  totalPages: number;
  percentage: number;
  lastReadAt: Date;
  isFinished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReadingProgressSchema: Schema<IReadingProgress> = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    book: {
      type: Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
      index: true,
    },
    currentChapter: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
    },
    currentPage: {
      type: Number,
      required: true,
      default: 1,
    },
    totalPages: {
      type: Number,
      required: true,
      default: 1,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
    isFinished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index for user + book reading progress
ReadingProgressSchema.index({ user: 1, book: 1 }, { unique: true });

export const ReadingProgress: Model<IReadingProgress> = mongoose.model<IReadingProgress>(
  'ReadingProgress',
  ReadingProgressSchema
);
