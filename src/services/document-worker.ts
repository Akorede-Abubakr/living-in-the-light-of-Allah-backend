// Runs in an isolated, time-limited child process, never in the HTTP event loop.
import fs from 'node:fs/promises';
import { Parser } from 'htmlparser2';
import { Segment } from './book-text';

const MAX_TEXT = 4_000_000;
export async function extractDocument(buffer: Buffer, format: string): Promise<Segment[]> {
  const segments: Segment[] = [];
  let total = 0;
  const add = (s: Segment) => {
    total += s.text.length;
    if (total > MAX_TEXT || segments.length >= 10000) throw new Error('document_too_large');
    if (s.text.trim()) segments.push(s);
  };
  if (format === 'pdf') {
    if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('invalid_document');
    const pdfjs = await new Function('return import("pdfjs-dist/legacy/build/pdf.mjs")')();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false,
      useSystemFonts: false, disableFontFace: true, isImageDecoderSupported: false,
      useWasm: false, maxImageSize: 0, verbosity: 0 }).promise;
    try {
      if (pdf.numPages > 2000) throw new Error('document_too_large');
      const headings = new Map<number, string>();
      for (const entry of await pdf.getOutline() || []) {
        try {
          const dest = typeof entry.dest === 'string' ? await pdf.getDestination(entry.dest) : entry.dest;
          const page = typeof dest?.[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]);
          headings.set(page + 1, entry.title);
        } catch { /* Missing outline destinations do not invent chapters. */ }
      }
      let chapterKey = 'document', chapterTitle = 'Document';
      for (let i = 1; i <= pdf.numPages; i++) {
        if (headings.has(i)) { chapterKey = `pdf-${i}`; chapterTitle = headings.get(i)!; }
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((x: any) => (x.str || '') + (x.hasEOL ? '\n' : ' ')).join('');
        if (text.trim()) add({ text, chapterKey, chapterTitle, pageNumber: i });
        else segments.push({ text: '', chapterKey, chapterTitle, pageNumber: i });
        page.cleanup();
      }
    } finally { await pdf.destroy(); }
  } else if (format === 'docx') {
    if (buffer.readUInt16LE(0) !== 0x4b50) throw new Error('invalid_document');
    const mammoth = require('mammoth');
    const html = await mammoth.convertToHtml({ buffer }, { externalFileAccess: false,
      includeEmbeddedStyleMap: false, convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })) });
    let text = '', heading = false, level = '', chapterKey = 'document', chapterTitle = 'Document', section = '', n = 0;
    const flush = () => {
      if (text.trim()) {
        if (heading) {
          if (level === 'h1' || level === 'h2') { chapterKey = `docx-${++n}`; chapterTitle = text.trim(); section = ''; }
          else section = text.trim();
        }
        add({ text: text.trim(), chapterKey, chapterTitle, section });
      }
      text = '';
    };
    new Parser({
      onopentag(name) { if (/^h[1-6]$/.test(name)) { flush(); heading = true; level = name; } },
      ontext(value) { text += value; if (text.length > MAX_TEXT) throw new Error('document_too_large'); },
      onclosetag(name) { if (/^(p|h[1-6]|li|tr)$/.test(name)) { flush(); heading = false; } else if (name === 'td') text += '\t'; },
    }, { decodeEntities: true }).end(html.value);
    flush();
  } else if (format === 'doc') {
    if (!buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))) throw new Error('invalid_document');
    const WordExtractor = require('word-extractor');
    const doc = await new WordExtractor().extract(buffer);
    add({ text: doc.getBody(), chapterKey: 'document', chapterTitle: 'Document' });
  } else throw new Error('unsupported_document');
  if (!segments.some(segment => segment.text.trim())) throw new Error('no_extractable_text');
  return segments;
}

if (require.main === module) {
  fs.readFile(process.argv[2]).then(buffer => extractDocument(buffer, process.argv[3]))
    .then(segments => process.stdout.write('__BOOK_RESULT__' + JSON.stringify(segments)))
    .catch(error => { process.stderr.write(['document_too_large', 'no_extractable_text'].includes(error.message) ? error.message : 'invalid_document'); process.exitCode = 1; });
}
