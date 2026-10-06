import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPage extends Document {
  book: mongoose.Types.ObjectId;
  chapter: mongoose.Types.ObjectId;
  pageNumber: number; // Global sequential page in the book (1, 2, 3...)
  chapterPageNumber: number; // Page index inside current chapter (1, 2...)
  title?: string;
  content: string; // Rich reading text
  wordCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PageSchema: Schema<IPage> = new Schema(
  {
    book: {
      type: Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book ID is required'],
      index: true,
    },
    chapter: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      required: [true, 'Chapter ID is required'],
      index: true,
    },
    pageNumber: {
      type: Number,
      required: [true, 'Page number is required'],
      min: 1,
    },
    chapterPageNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Page content is required'],
    },
    wordCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness of pageNumber per book
PageSchema.index({ book: 1, pageNumber: 1 }, { unique: true });
PageSchema.index({ chapter: 1, chapterPageNumber: 1 });

export const Page: Model<IPage> = mongoose.model<IPage>('Page', PageSchema);
