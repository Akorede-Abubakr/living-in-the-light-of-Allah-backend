export interface Segment {
  text: string; chapterKey: string; chapterTitle: string; section?: string;
  pageNumber?: number; readerPage?: number;
}

// PDF segments retain source page boundaries. Word documents have no stable
// extracted page numbers, so create sequential reading pages without overlap.
export function readingPages(segments: Segment[], format: string): Segment[] {
  if (format === 'pdf') return segments.map((segment, i) => ({ ...segment, readerPage: i + 1 }));
  const chapters: Segment[] = [];
  for (const segment of segments) {
    const previous = chapters[chapters.length - 1];
    if (previous?.chapterKey === segment.chapterKey) previous.text += '\n\n' + segment.text;
    else chapters.push({ ...segment, section: undefined });
  }
  return chunks(chapters, 2800, 0).map((segment, i) => ({ ...segment, readerPage: i + 1 }));
}

export function terms(text: string): string[] {
  return [...new Set(text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])].slice(0, 256);
}

export function chunks(segments: Segment[], size = 1200, overlap = 120): Segment[] {
  const result: Segment[] = [];
  for (const segment of segments) {
    const text = segment.text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim();
    for (let start = 0; start < text.length;) {
      let end = Math.min(start + size, text.length);
      if (end < text.length) {
        const boundary = text.lastIndexOf(' ', end);
        if (boundary > start + size / 2) end = boundary;
      }
      result.push({ ...segment, text: text.slice(start, end) });
      if (end === text.length) break;
      start = end - overlap;
    }
  }
  return result;
}

export function rankPassages<T extends { text: string; terms?: string[] | null; ordinal?: number | null }>(passages: T[], query: string): T[] {
  const words = terms(query);
  return passages.map(p => ({ p, score: words.reduce((n, word) => n + Number((p.terms || terms(p.text)).includes(word)), 0) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score || (a.p.ordinal || 0) - (b.p.ordinal || 0)).map(x => x.p);
}
