import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBook extends Document {
  title: string;
  subtitle?: string;
  slug: string;
  author: string;
  authorBio?: string;
  description: string;
  coverImage: string;
  price: number;
  originalPrice?: number;
  currency: string;
  category: mongoose.Types.ObjectId;
  language: string;
  isbn?: string;
  publicationDate?: Date;
  pageCount: number;
  previewPages: number;
  previewPercentage: number;
  status: 'draft' | 'published' | 'archived';
  isFeatured: boolean;
  isPopular: boolean;
  isNewRelease: boolean;
  rating: number;
  reviewCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const BookSchema: Schema<IBook> = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
      index: true,
    },
    subtitle: {
      type: String,
      default: '',
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
      index: true,
    },
    authorBio: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    coverImage: {
      type: String,
      required: [true, 'Cover image is required'],
      default: '/uploads/covers/placeholder.jpg',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
      default: 0,
    },
    originalPrice: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    language: {
      type: String,
      default: 'English',
    },
    isbn: {
      type: String,
      default: '',
    },
    publicationDate: {
      type: Date,
      default: Date.now,
    },
    pageCount: {
      type: Number,
      default: 0,
    },
    previewPages: {
      type: Number,
      default: 5,
    },
    previewPercentage: {
      type: Number,
      default: 15,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
      index: true,
    },
    isNewRelease: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for chapters
BookSchema.virtual('chapters', {
  ref: 'Chapter',
  localField: '_id',
  foreignField: 'book',
});

// Virtual for reviews
BookSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'book',
});

// Text index for search
BookSchema.index({ title: 'text', author: 'text', description: 'text', tags: 'text' });

export const Book: Model<IBook> = mongoose.model<IBook>('Book', BookSchema);
