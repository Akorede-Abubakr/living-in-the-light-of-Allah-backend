import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:5173';
const ADMIN_URL = 'http://localhost:5174';

const runTests = async () => {
  console.log('====================================================');
  console.log('🧪 RUNNING FULL-STACK DIGITAL BOOKSTORE INTEGRATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, detail?: any) => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
      failed++;
    }
  };

  try {
    // Test 1: Health Check
    const healthRes = await axios.get(`${API_BASE}/health`);
    assert(healthRes.status === 200 && healthRes.data.status === 'ok', '1. Backend API Health Check');

    // Test 2: Categories
    const catRes = await axios.get(`${API_BASE}/categories`);
    assert(catRes.data.success && catRes.data.data.length > 0, `2. Categories retrieved (${catRes.data.data.length} categories)`);

    // Test 3: Books Catalog Search
    const booksRes = await axios.get(`${API_BASE}/books?q=Architecture`);
    assert(booksRes.data.success && booksRes.data.data.length > 0, `3. Books Search Query found '${booksRes.data.data[0]?.title}'`);
    const testBook = booksRes.data.data[0];

    // Test 4: Book Details
    const bookDetailRes = await axios.get(`${API_BASE}/books/${testBook._id}`);
    assert(bookDetailRes.data.success && bookDetailRes.data.data.chapters.length > 0, `4. Book Details & Chapters Outline (${bookDetailRes.data.data.chapters.length} chapters)`);

    // Test 5: Reader Metadata
    const readerMetaRes = await axios.get(`${API_BASE}/reader/${testBook._id}/meta`);
    assert(readerMetaRes.data.success && readerMetaRes.data.data.previewLimit > 0, `5. Reader Metadata (Preview Limit: ${readerMetaRes.data.data.previewLimit} pages, Total: ${readerMetaRes.data.data.totalPages} pages)`);
    const previewLimit = readerMetaRes.data.data.previewLimit;

    // Test 6: Access Allowed Preview Page (Page 1)
    const page1Res = await axios.get(`${API_BASE}/reader/${testBook._id}/page/1`);
    assert(page1Res.status === 200 && page1Res.data.data.page.pageNumber === 1, `6. Free Preview Access Page 1 allowed (${page1Res.data.data.page.wordCount} words)`);

    // Test 7: Strict Access Enforcement on Page Exceeding Preview Limit (Unauthenticated)
    const lockedPageNum = previewLimit + 1;
    try {
      await axios.get(`${API_BASE}/reader/${testBook._id}/page/${lockedPageNum}`);
      assert(false, '7. Backend Access Control should block page beyond preview limit');
    } catch (err: any) {
      const is403 = err.response?.status === 403;
      const isPreviewExceeded = err.response?.data?.previewExceeded === true;
      assert(is403 && isPreviewExceeded, `7. Access Control strictly enforced: HTTP 403 Forbidden beyond preview limit (p.${lockedPageNum})`);
    }

    // Test 8: Reader Authentication
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'reader@example.com',
      password: 'Reader@12345',
    });
    assert(loginRes.data.success && !!loginRes.data.token, `8. Customer Authentication successful (${loginRes.data.user.name})`);
    const readerToken = loginRes.data.token;
    const authHeaders = { Authorization: `Bearer ${readerToken}` };

    // Test 9: Save Reading Progress
    const progressRes = await axios.post(
      `${API_BASE}/progress`,
      { bookId: testBook._id, pageNumber: 3 },
      { headers: authHeaders }
    );
    assert(progressRes.data.success && progressRes.data.data.percentage > 0, `9. Cloud Reading Progress saved (${progressRes.data.data.percentage}% on p.3)`);

    // Test 10: Create Bookmark
    const bkmkRes = await axios.post(
      `${API_BASE}/bookmarks`,
      { bookId: testBook._id, pageNumber: 2, note: 'Enduring architectural insight.' },
      { headers: authHeaders }
    );
    assert(bkmkRes.data.success, '10. Page Bookmark created with personal note');

    // Test 11: My Library
    const libRes = await axios.get(`${API_BASE}/library`, { headers: authHeaders });
    assert(libRes.data.success && libRes.data.data.length > 0, `11. Customer Library contains ${libRes.data.data.length} purchased titles`);

    // Test 12: Paystack Payment Flow (Initialize & Verify Order for Book 3)
    const bookToBuy = (await axios.get(`${API_BASE}/books?q=Disciplined`)).data.data[0];
    const initOrderRes = await axios.post(
      `${API_BASE}/orders/initialize`,
      { bookIds: [bookToBuy._id], currency: 'USD' },
      { headers: authHeaders }
    );
    assert(initOrderRes.data.success && !!initOrderRes.data.data.reference, `12a. Paystack Payment Initialized (Ref: ${initOrderRes.data.data.reference})`);

    const verifyRes = await axios.post(
      `${API_BASE}/orders/verify`,
      { reference: initOrderRes.data.data.reference },
      { headers: authHeaders }
    );
    assert(verifyRes.data.success && verifyRes.data.data.order.accessGranted, `12b. Paystack Transaction Verified & Book Ownership Granted`);

    // Test 13: Full Access Granted to previously locked pages for purchased book
    const fullAccessPageRes = await axios.get(`${API_BASE}/reader/${bookToBuy._id}/page/5`, { headers: authHeaders });
    assert(fullAccessPageRes.status === 200 && fullAccessPageRes.data.data.access.hasFullAccess, `13. Full Access Mode unlocked for newly purchased volume (Page 5 loaded)`);

    // Test 14: Customer Review Submission
    const reviewRes = await axios.post(
      `${API_BASE}/reviews/book/${bookToBuy._id}`,
      { rating: 5, title: 'Incredible Clarity', comment: 'One of the finest treatises on focus and execution I have read.' },
      { headers: authHeaders }
    );
    assert(reviewRes.data.success, '14. Customer Verified Review published');

    // Test 15: Admin Authentication
    const adminLoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@muslimguardian.com',
      password: 'Admin@12345',
    });
    assert(adminLoginRes.data.success && adminLoginRes.data.user.role === 'admin', '15. Admin Authentication confirmed');
    const adminToken = adminLoginRes.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // Test 16: Admin Overview Analytics
    const overviewRes = await axios.get(`${API_BASE}/admin/overview`, { headers: adminHeaders });
    assert(overviewRes.data.success && overviewRes.data.data.stats.totalRevenue > 0, `16. Admin Analytics (Total Revenue: $${overviewRes.data.data.stats.totalRevenue}, Books: ${overviewRes.data.data.stats.totalBooks})`);

    // Test 17: Admin Content Editor Operations
    const newChapterRes = await axios.post(
      `${API_BASE}/chapters/book/${testBook._id}`,
      { title: 'Chapter 5: Epilogue and Continuations', description: 'Closing philosophical reflections.' },
      { headers: adminHeaders }
    );
    assert(newChapterRes.data.success, '17a. Admin Content Editor: Created Chapter');

    const newPageRes = await axios.post(
      `${API_BASE}/pages/chapter/${newChapterRes.data.data._id}`,
      { title: 'The Final Horizon', content: 'Herein lies the concluding synthesis of our journey...' },
      { headers: adminHeaders }
    );
    assert(newPageRes.data.success, '17b. Admin Content Editor: Created Manuscript Page');

    // Test 18: Admin Users & Reviews Moderation
    const adminUsersRes = await axios.get(`${API_BASE}/admin/users`, { headers: adminHeaders });
    assert(adminUsersRes.data.success && adminUsersRes.data.data.length > 0, `18. Admin Users list (${adminUsersRes.data.data.length} registered accounts)`);

    // Test 19: Frontend Port 5173 Serving
    const frontendRes = await axios.get(FRONTEND_URL);
    assert(frontendRes.status === 200 && (frontendRes.data.includes('Living in the light of Allah') || frontendRes.data.includes('root')), '19. Customer Frontend App serving on http://localhost:5173');

    // Test 20: Admin Port 5174 Serving
    const adminAppRes = await axios.get(ADMIN_URL);
    assert(adminAppRes.status === 200 && (adminAppRes.data.includes('Publisher Console') || adminAppRes.data.includes('root')), '20. Publisher Admin Portal serving on http://localhost:5174');

    console.log('\n====================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('Fatal Test Suite Error:', error?.response?.data || error.message);
    process.exit(1);
  }
};

runTests();
