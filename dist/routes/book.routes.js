"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const book_controller_1 = require("../controllers/book.controller");
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const router = (0, express_1.Router)();
router.get('/', book_controller_1.BookController.getBooks);
router.get('/featured', book_controller_1.BookController.getFeaturedBooks);
router.get('/popular', book_controller_1.BookController.getPopularBooks);
router.get('/new-releases', book_controller_1.BookController.getNewReleases);
router.get('/slug/:slug', auth_1.optionalAuth, book_controller_1.BookController.getBookBySlug);
router.get('/:id', auth_1.optionalAuth, book_controller_1.BookController.getBookById);
// Admin Routes
router.post('/', auth_1.protect, auth_1.adminOnly, upload_1.upload.single('coverImage'), book_controller_1.BookController.createBook);
router.patch('/:id', auth_1.protect, auth_1.adminOnly, upload_1.upload.single('coverImage'), book_controller_1.BookController.updateBook);
router.patch('/:id/status', auth_1.protect, auth_1.adminOnly, book_controller_1.BookController.toggleStatus);
router.delete('/:id', auth_1.protect, auth_1.adminOnly, book_controller_1.BookController.deleteBook);
exports.default = router;
