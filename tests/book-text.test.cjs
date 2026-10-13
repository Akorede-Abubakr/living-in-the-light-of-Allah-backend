const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chunks, terms, rankPassages, readingPages } = require('../dist/services/book-text');
const { extractDocument } = require('../dist/services/document-worker');

test('Word reading pages preserve all text without repeated overlap', () => {
  const text = 'A patient reader learns. '.repeat(400);
  const pages = readingPages([{ text, chapterKey: 'one', chapterTitle: 'First' },
    { text: 'Next chapter.', chapterKey: 'two', chapterTitle: 'Second' }], 'docx');
  assert.ok(pages.length > 3);
  assert.equal(pages.filter(p => p.chapterKey === 'one').map(p => p.text).join(''), text.trim());
  assert.deepEqual(pages.map(p => p.readerPage), pages.map((_, i) => i + 1));
  assert.equal(pages.at(-1).chapterTitle, 'Second');
  assert.ok(pages.every(p => p.pageNumber === undefined));
});

test('PDF reading pages preserve blank pages and original source numbering', () => {
  const segments = ['First page', '', 'Third page'].map((text, i) => ({ text, chapterKey: 'one', chapterTitle: 'PDF', pageNumber: i + 1 }));
  const pages = readingPages(segments, 'pdf');
  assert.equal(pages.length, 3);
  assert.equal(pages[2].pageNumber, 3);
  assert.equal(pages[2].readerPage, 3);
  assert.equal(pages[1].text, '');
});

test('passages preserve source metadata and overlapping text', () => {
  const text = 'Reading with patience brings understanding. '.repeat(100);
  const parts = chunks([{ text, chapterKey: 'one', chapterTitle: 'Patience', pageNumber: 4 }]);
  assert.ok(parts.length > 1);
  assert.ok(parts.every(p => p.pageNumber === 4 && p.text.length <= 1200));
  assert.equal(parts[0].text.slice(-120), parts[1].text.slice(0, 120));
  assert.ok(parts.at(-1).text.endsWith('understanding.'));
});
test('Unicode search finds tonal language terms without another model', () => {
  const passages = [{ text: 'Kíkà ìwé ṣe pàtàkì.', ordinal: 2 }, { text: 'Other content', ordinal: 1 }];
  assert.equal(rankPassages(passages, 'kika iwe')[0], passages[0]);
  assert.equal(rankPassages(passages, 'unrelated').length, 0);
  assert.deepEqual(terms('ọmụmụ ỌMỤMỤ'), ['omumu']);
});
test('extract actual DOCX headings and paragraphs, never HTML', async () => {
  const JSZip = require('jszip');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/styles.xml', '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>');
  zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter One</w:t></w:r></w:p><w:p><w:r><w:t>Kíkà ìwé brings understanding.</w:t></w:r></w:p></w:body></w:document>');
  const result = await extractDocument(await zip.generateAsync({ type: 'nodebuffer' }), 'docx');
  assert.ok(result.some(p => p.text.includes('Kíkà ìwé')));
  assert.ok(result.every(p => p.chapterTitle === 'Chapter One' && p.pageNumber === undefined));
});
test('extract real PDF page text and retain its printed page index', async () => {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const stream = 'BT /F1 12 Tf 72 700 Td (Patience and reading.) Tj ET';
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let pdf = '%PDF-1.4\n', offsets = [0];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i+1} 0 obj\n${o}\nendobj\n`; });
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${start}\n%%EOF`;
  const result = await extractDocument(Buffer.from(pdf), 'pdf');
  assert.equal(result[0].pageNumber, 1);
  assert.match(result[0].text, /Patience and reading/);
});
test('mislabeled and invalid document bytes fail closed', async () => {
  for (const type of ['pdf', 'docx', 'doc']) await assert.rejects(extractDocument(Buffer.from('not a book'), type));
});
