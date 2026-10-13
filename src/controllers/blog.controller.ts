import { Request, Response } from 'express';
import { Blog } from '../models/Blog';

export class BlogController {
  // Public: Get published blogs with search, category filtering & pagination
  static async getPublishedBlogs(req: Request, res: Response): Promise<void> {
    try {
      const { search, category, page = 1, limit = 9 } = req.query;

      const query: any = { isPublished: true };

      if (category && category !== 'all') {
        query.category = category;
      }

      if (search) {
        query.$or = [
          { title: { $regex: String(search), $options: 'i' } },
          { excerpt: { $regex: String(search), $options: 'i' } },
          { content: { $regex: String(search), $options: 'i' } },
          { tags: { $in: [new RegExp(String(search), 'i')] } },
        ];
      }

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.max(1, Number(limit));
      const skip = (pageNum - 1) * limitNum;

      const [blogs, total] = await Promise.all([
        Blog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Blog.countDocuments(query),
      ]);

      // Collect all distinct categories for filter pills
      const categories = await Blog.distinct('category', { isPublished: true });

      res.status(200).json({
        success: true,
        data: blogs,
        categories,
        pagination: {
          page: pageNum,
          totalPages: Math.ceil(total / limitNum) || 1,
          total,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Error fetching blogs' });
    }
  }

  // Public: Get single blog by slug (or ID) & increment views
  static async getBlogBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      const blog = await Blog.findOneAndUpdate(
        { $or: [{ slug }, { _id: slug.match(/^[0-9a-fA-F]{24}$/) ? slug : null }] },
        { $inc: { views: 1 } },
        { new: true }
      );

      if (!blog) {
        res.status(404).json({ success: false, message: 'Blog article not found' });
        return;
      }

      // Recent related articles
      const related = await Blog.find({
        _id: { $ne: blog._id },
        isPublished: true,
        $or: [{ category: blog.category }, { tags: { $in: blog.tags } }],
      })
        .limit(3)
        .select('title slug excerpt coverImage readTimeMinutes createdAt');

      res.status(200).json({
        success: true,
        data: {
          blog,
          related,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Error fetching blog' });
    }
  }

  // Admin: Get all blogs (including drafts)
  static async getAllBlogsAdmin(req: Request, res: Response): Promise<void> {
    try {
      const blogs = await Blog.find().sort({ createdAt: -1 });

      const stats = {
        total: blogs.length,
        published: blogs.filter((b) => b.isPublished).length,
        drafts: blogs.filter((b) => !b.isPublished).length,
        totalViews: blogs.reduce((acc, b) => acc + (b.views || 0), 0),
      };

      res.status(200).json({
        success: true,
        data: blogs,
        stats,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Error fetching admin blogs' });
    }
  }

  // Admin: Create new blog post
  static async createBlog(req: Request, res: Response): Promise<void> {
    try {
      const { title, excerpt, content, coverImage, author, category, tags, isPublished, readTimeMinutes } = req.body;

      if (!title || !content || !excerpt) {
        res.status(400).json({ success: false, message: 'Title, excerpt, and content are required' });
        return;
      }

      // Generate base slug
      let slug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Ensure slug uniqueness
      const existing = await Blog.findOne({ slug });
      if (existing) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }

      // Calculate read time if not provided
      const wordCount = content.trim().split(/\s+/).length;
      const estimatedReadTime = readTimeMinutes || Math.max(1, Math.ceil(wordCount / 200));

      const blog = await Blog.create({
        title,
        slug,
        excerpt,
        content,
        coverImage: coverImage || '/images/hero-bg.jpg',
        author: author || (req as any).user?.name || 'Publisher Editorial',
        category: category || 'Spiritual Reflections',
        tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : [],
        isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
        readTimeMinutes: estimatedReadTime,
      });

      res.status(201).json({
        success: true,
        message: 'Blog article created successfully',
        data: blog,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to create blog' });
    }
  }

  // Admin: Update blog post
  static async updateBlog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      if (updateData.title && !updateData.slug) {
        updateData.slug = updateData.title
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      if (updateData.tags && typeof updateData.tags === 'string') {
        updateData.tags = updateData.tags.split(',').map((t: string) => t.trim());
      }

      const blog = await Blog.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

      if (!blog) {
        res.status(404).json({ success: false, message: 'Blog article not found' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Blog article updated successfully',
        data: blog,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to update blog' });
    }
  }

  // Admin: Delete blog post
  static async deleteBlog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const blog = await Blog.findByIdAndDelete(id);

      if (!blog) {
        res.status(404).json({ success: false, message: 'Blog article not found' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Blog article deleted successfully',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to delete blog' });
    }
  }
}
