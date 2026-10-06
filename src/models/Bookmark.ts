import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBookmark extends Document {
  user: mongoose.Types.ObjectId;
  book: mongoose.Types.ObjectId;
  chapter?: mongoose.Types.ObjectId;
  pageNumber: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookmarkSchema: Schema<IBookmark> = new Schema(
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
    chapter: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
    },
    pageNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
  },
  {
    timestamps: true,
  }
);

BookmarkSchema.index({ user: 1, book: 1, pageNumber: 1 }, { unique: true });

export const Bookmark: Model<IBookmark> = mongoose.model<IBookmark>('Bookmark', BookmarkSchema);
