import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IChapter extends Document {
  book: mongoose.Types.ObjectId;
  title: string;
  order: number;
  description?: string;
  pageCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChapterSchema: Schema<IChapter> = new Schema(
  {
    book: {
      type: Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Chapter title is required'],
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 1,
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ChapterSchema.virtual('pages', {
  ref: 'Page',
  localField: '_id',
  foreignField: 'chapter',
  options: { sort: { pageNumber: 1 } },
});

// Index for fast chapter ordering per book
ChapterSchema.index({ book: 1, order: 1 });

export const Chapter: Model<IChapter> = mongoose.model<IChapter>('Chapter', ChapterSchema);
