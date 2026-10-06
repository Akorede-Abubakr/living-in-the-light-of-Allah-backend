"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryController = void 0;
const Category_1 = require("../models/Category");
const Book_1 = require("../models/Book");
class CategoryController {
    static async getCategories(req, res) {
        const categories = await Category_1.Category.find().sort({ order: 1, name: 1 });
        // Calculate actual book counts dynamically
        const categoriesWithCount = await Promise.all(categories.map(async (cat) => {
            const count = await Book_1.Book.countDocuments({ category: cat._id, status: 'published' });
            return {
                ...cat.toObject(),
                bookCount: count,
            };
        }));
        res.status(200).json({
            success: true,
            data: categoriesWithCount,
        });
    }
    static async getCategoryBySlug(req, res) {
        const { slug } = req.params;
        const category = await Category_1.Category.findOne({ slug });
        if (!category) {
            res.status(404).json({ success: false, message: 'Category not found' });
            return;
        }
        const books = await Book_1.Book.find({ category: category._id, status: 'published' })
            .populate('category', 'name slug')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: {
                category,
                books,
            },
        });
    }
    static async createCategory(req, res) {
        const { name, description, icon, isFeatured, order } = req.body;
        if (!name) {
            res.status(400).json({ success: false, message: 'Category name is required' });
            return;
        }
        const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        const existing = await Category_1.Category.findOne({ $or: [{ name }, { slug }] });
        if (existing) {
            res.status(400).json({ success: false, message: 'Category name or slug already exists' });
            return;
        }
        const category = await Category_1.Category.create({
            name,
            slug,
            description,
            icon: icon || 'BookOpen',
            isFeatured: !!isFeatured,
            order: order || 0,
        });
        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category,
        });
    }
    static async updateCategory(req, res) {
        const { id } = req.params;
        const { name, description, icon, isFeatured, order } = req.body;
        const updates = {};
        if (name) {
            updates.name = name;
            updates.slug = name
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');
        }
        if (description !== undefined)
            updates.description = description;
        if (icon !== undefined)
            updates.icon = icon;
        if (isFeatured !== undefined)
            updates.isFeatured = isFeatured;
        if (order !== undefined)
            updates.order = order;
        const category = await Category_1.Category.findByIdAndUpdate(id, updates, { new: true });
        if (!category) {
            res.status(404).json({ success: false, message: 'Category not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: category,
        });
    }
    static async deleteCategory(req, res) {
        const { id } = req.params;
        const booksCount = await Book_1.Book.countDocuments({ category: id });
        if (booksCount > 0) {
            res.status(400).json({
                success: false,
                message: `Cannot delete category with ${booksCount} associated books. Please reassign or delete the books first.`,
            });
            return;
        }
        const category = await Category_1.Category.findByIdAndDelete(id);
        if (!category) {
            res.status(404).json({ success: false, message: 'Category not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Category deleted successfully',
        });
    }
}
exports.CategoryController = CategoryController;
