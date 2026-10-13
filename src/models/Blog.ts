import mongoose, { Document, Schema } from 'mongoose';

export interface IBlog extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  author: string;
  category: string;
  tags: string[];
  isPublished: boolean;
  readTimeMinutes: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const BlogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: [true, 'Blog title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    excerpt: {
      type: String,
      required: [true, 'Excerpt is required'],
      trim: true,
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
    },
    content: {
      type: String,
      required: [true, 'Blog content is required'],
    },
    coverImage: {
      type: String,
      default: '/images/hero-bg.jpg',
    },
    author: {
      type: String,
      default: 'Editorial Scholar',
      trim: true,
    },
    category: {
      type: String,
      default: 'Spiritual Reflections',
      trim: true,
    },
    tags: {
      type: [String],
      default: ['Wisdom', 'Philosophy'],
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    readTimeMinutes: {
      type: Number,
      default: 4,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate slug before validation if not provided
BlogSchema.pre<IBlog>('validate', function (next) {
  if (this.title && (!this.slug || this.isModified('title'))) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

export const Blog = mongoose.model<IBlog>('Blog', BlogSchema);
export default Blog;
