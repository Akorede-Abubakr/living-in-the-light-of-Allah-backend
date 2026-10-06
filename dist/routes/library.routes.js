"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const library_controller_1 = require("../controllers/library.controller");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.protect, library_controller_1.LibraryController.getMyLibrary);
router.get('/check/:bookId', auth_1.optionalAuth, library_controller_1.LibraryController.checkOwnership);
exports.default = router;
