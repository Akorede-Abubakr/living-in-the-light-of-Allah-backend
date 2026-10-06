"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Book = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const BookSchema = new mongoose_1.Schema({
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
        type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
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
exports.Book = mongoose_1.default.model('Book', BookSchema);
