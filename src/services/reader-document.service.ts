import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { AiError } from './ai.service';

const execute = promisify(execFile);
let activeRenders = 0;

export async function wordToPdf(buffer: Buffer, format: string): Promise<Buffer> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'guardian-layout-'));
  try {
    const input = path.join(directory, `manuscript.${format}`);
    await fs.writeFile(input, buffer, { mode: 0o600 });
    const executable = process.env.LIBREOFFICE_BIN || (process.platform === 'win32'
      ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe' : 'libreoffice');
    await execute(executable, [
      `-env:UserInstallation=${pathToFileURL(path.join(directory, 'profile')).href}`,
      '--headless', '--convert-to', 'pdf:writer_pdf_Export', '--outdir', directory, input,
    ], { timeout: 90000, windowsHide: true, maxBuffer: 1024 * 1024 });
    const result = await fs.readFile(path.join(directory, 'manuscript.pdf'));
    if (result.length > 50 * 1024 * 1024 || !result.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error();
    return result;
  } catch {
    throw new AiError(422, 'original_layout_required', 'Original page layout needs a PDF. Export this document as PDF from Word and upload it, or configure LibreOffice on the backend.');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

export async function renderStoredPage(fileId: mongoose.Types.ObjectId, page: number): Promise<Buffer> {
  if (activeRenders >= 2) throw new AiError(503, 'reader_busy', 'The reader is busy. Please retry this page.');
  activeRenders++;
  let directory: string | undefined;
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'guardian-page-'));
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'privateBooks' });
    const buffers: Buffer[] = [];
    let size = 0;
    for await (const chunk of bucket.openDownloadStream(fileId)) {
      size += chunk.length;
      if (size > 50 * 1024 * 1024) throw new Error('document_too_large');
      buffers.push(chunk);
    }
    const input = path.join(directory, 'document.pdf'), output = path.join(directory, 'page.png');
    await fs.writeFile(input, Buffer.concat(buffers), { mode: 0o600 });
    const worker = path.join(__dirname, 'reader-render-worker' + path.extname(__filename));
    const runtime = worker.endsWith('.ts') ? ['-r', require.resolve('ts-node/register/transpile-only')] : [];
    await execute(process.execPath, ['--max-old-space-size=384', ...runtime, worker, input, output, String(page)],
      { cwd: path.resolve(__dirname, '../..'), timeout: 45000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return await fs.readFile(output);
  } finally {
    activeRenders--;
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  }
}
