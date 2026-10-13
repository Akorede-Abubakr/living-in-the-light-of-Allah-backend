// Isolated PDF rendering: never send the full manuscript to a preview reader.
import fs from 'node:fs/promises';
import path from 'node:path';

async function render() {
  const [input, output, requested] = process.argv.slice(2);
  const pdfjs = await new Function('return import("pdfjs-dist/legacy/build/pdf.mjs")')();
  const assets = path.dirname(require.resolve('pdfjs-dist/package.json'));
  // PDF.js validates a literal trailing '/' even for local Windows paths.
  const assetDirectory = (name: string) => path.join(assets, name).split(path.sep).join('/') + '/';
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await fs.readFile(input)), isEvalSupported: false,
    standardFontDataUrl: assetDirectory('standard_fonts'),
    cMapUrl: assetDirectory('cmaps'), cMapPacked: true,
    wasmUrl: assetDirectory('wasm'),
    useSystemFonts: false, verbosity: 0,
  }).promise;
  try {
    const page = await pdf.getPage(Number(requested));
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1600 / base.width, Math.sqrt(4_000_000 / (base.width * base.height)));
    const viewport = page.getViewport({ scale });
    const { createCanvas } = require('@napi-rs/canvas');
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: 'white' }).promise;
    await fs.writeFile(output, canvas.toBuffer('image/png'), { mode: 0o600 });
  } finally { await pdf.destroy(); }
}
render().catch(error => { process.stderr.write(`${error.name}: ${error.message}\n${error.stack || ''}`); process.exitCode = 1; });
