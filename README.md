# BrightMind — Digital Publishing & Bookstore Platform

A modern, full-stack digital book-selling, publishing, and reading platform inspired by the editorial elegance of [BrightMind Theme](https://brightmind-theme.framer.website/).

Built with **TypeScript** end-to-end, featuring a **Kindle / Amazon KDP-grade digital reader**, a **modular Paystack payment architecture**, a **dedicated Publisher Administration Portal**, and **robust backend access control**.

---

## 🏗️ Architecture & Project Structure

```
MUSLIM GUARDIAN/
├── backend/          # Node.js + Express + TypeScript + MongoDB (Port 5000)
│   ├── src/
│   │   ├── config/      # DB & Environment configs
│   │   ├── models/      # Mongoose schemas (User, Book, Chapter, Page, Order, Review, Bookmark, ReadingProgress)
│   │   ├── services/    # PaymentService (Paystack), StorageService, AccessControlService
│   │   ├── controllers/ # REST controllers for Bookstore, Reader, Auth, Orders, Admin
│   │   ├── routes/      # Clean modular Express routes
│   │   ├── middlewares/ # JWT auth, Admin guard, Multer file upload, Error handler
│   │   └── scripts/     # Realistic Database Seeder & End-to-End Test Suite
├── frontend/         # Customer Bookstore & Digital Reader (Port 5173)
│   ├── src/
│   │   ├── api/         # TanStack Query & Axios client
│   │   ├── context/     # AuthContext & reader preferences
│   │   ├── components/  # BookCard, BookGrid, ReaderHeader/Footer/Sidebar, PurchaseModal, SEO
│   │   └── pages/       # Home, Bookstore, BookDetails, Reader, Dashboard, Login, Register
└── admin/            # Dedicated Publisher Administration Dashboard (Port 5174)
    ├── src/
    │   ├── api/         # Admin API client
    │   ├── context/     # AdminAuthContext
    │   ├── components/  # Layout, Sidebar, Header, StatCard, Modals
    │   └── pages/       # Overview Analytics, Books, Manuscript Content Editor, Orders, Users, Reviews
```

---

## ⚡ Active Services & Ports

| Service | Port | Description |
| :--- | :--- | :--- |
| **Customer Frontend** | `http://localhost:5173` | Bookstore, Book details, Free preview reader, Digital library, Dashboard |
| **Publisher Admin** | `http://localhost:5174` | Dashboard analytics, Book manager, Manuscript Content Editor, Orders, Users |
| **Backend API** | `http://localhost:5000` | REST API (`/api/books`, `/api/reader`, `/api/orders`, `/api/admin`, etc.) |
| **MongoDB** | `mongodb://127.0.0.1:27017` | Local MongoDB Server |

---

## 🔑 Demo Accounts

| Role | Email | Password | Access |
| :--- | :--- | :--- | :--- |
| **Publisher Admin** | `admin@muslimguardian.com` | `Admin@12345` | Full admin console & bookstore access |
| **Customer Reader 1** | `reader@example.com` | `Reader@12345` | Owns 2 books, active reading progress |
| **Customer Reader 2** | `fatima@example.com` | `Reader@12345` | Owns 1 book, verified reviewer |

---

## ✨ Key Platform Features

### 1. Digital Bookstore & Discovery (`/books`)
- **Real Database Categories**: Categorical taxonomy fetched dynamically from MongoDB.
- **Search & Filtering**: Real-time debounce search, category chips, price range slider, and multi-option sorting.
- **Visual Depth Cards**: 3D book spine shadows, editorial typography, ratings, [Read Preview], and [Buy Now] triggers.

### 2. Amazon Kindle / KDP-Grade Digital Reader (`/read/:bookId`)
- **Structured Manuscript Hierarchy**: Books are organized cleanly into `Book → Chapters → Pages → Paragraphs`.
- **Reading Modes & Themes**:
  - ☀️ **Paper / Day**: Warm ivory background (`#FAF8F5`) with charcoal typography.
  - ☕ **Warm Sepia**: Almond cream background (`#F6EFE2`) with soft brown typography.
  - 🌙 **Obsidian Night**: Pitch dark background (`#121110`) with muted grey typography.
- **Customizable Typography**: Font size slider (14px–24px), Classic Serif vs Modern Sans, Column Width (Compact, Standard, Wide).
- **Navigation Controls**: Keyboard arrow navigation (Left/Right), bottom page scrubber, page counter, and Table of Contents drawer.
- **Bookmarks & Notes**: Add and manage bookmarks with personal quotes.
- **Reading Progress Sync**: Automatically saves current chapter and page to the cloud on page turns.

### 3. Strict Free Preview System & In-Reader Interruption
- **Backend-Enforced Limits**: Configurable per book via `previewPages` (e.g. 5 pages) or `previewPercentage`.
- **Security**: The backend API strictly returns `HTTP 403 Forbidden` if an unauthenticated user or non-purchaser attempts to request locked pages.
- **Integrated Interruption Experience**: Seamless in-reader interruption card inviting the reader to unlock the complete volume.

### 4. Modular Payment Architecture (`PaymentService`)
- Clean Paystack service abstraction with `initializePayment()`, `verifyPayment()`, and `handleWebhook()`.
- Built-in sandbox simulation for development + seamless production Paystack API integration via `PAYSTACK_SECRET_KEY`.
- Automatic order creation, transaction verification, and instant book ownership grant to the customer's library.

### 5. Dedicated Publisher Admin Portal (`http://localhost:5174`)
- **Executive Analytics**: Total revenue, order count, registered readers, sales trend chart, top-selling titles.
- **Book Catalog Management**: Create, edit metadata, upload cover images, configure preview limits, publish/draft/archive.
- **Manuscript Studio & Content Editor**: Praktical multi-column editor to create chapters, add pages, edit text, view word counts, and test directly in Reader mode.
- **Orders & Transactions**: Filter by status, search by Paystack reference, audit invoices.
- **User Management**: Search customers, view total spent and books owned, toggle account active/disabled.
- **Review Moderation**: Audit reader reviews and remove spam.

---

## 🚀 Running the Project

```bash
# Run these commands from the project root (parent of this backend folder).

# Run all integration tests
npm run --prefix backend test:e2e

# Start Backend server (port 5000)
npm run --prefix backend dev

# Start Frontend Bookstore (port 5173)
npm run --prefix frontend dev

# Start Publisher Admin (port 5174)
npm run --prefix admin dev

# Re-seed database with sample data
npm run --prefix backend seed
```


### Shared project commands

The shared scripts live in `backend/package.json`. From the project root:

```bash
npm --prefix backend run install:all
npm --prefix backend run build:all
npm --prefix backend run dev:backend
npm --prefix backend run dev:frontend
npm --prefix backend run dev:admin
```
