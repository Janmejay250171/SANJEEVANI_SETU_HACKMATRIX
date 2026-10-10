import pdfParse from 'pdf-parse';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PdfPageContent {
  pageNumber: number;
  text: string;
}

function toCleanBuffer(buffer: Buffer): Buffer {
  if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
    return buffer;
  }
  const cleanArrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return Buffer.from(cleanArrayBuffer);
}

function extractViaHelper(buffer: Buffer): { pages: PdfPageContent[]; fullText: string } | null {
  const tmpPath = path.join(os.tmpdir(), `pdf_extract_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);
  try {
    fs.writeFileSync(tmpPath, buffer);
    const helperPath = path.resolve(__dirname, '../utils/pdfExtractorHelper.cjs');
    const out = execFileSync('node', [helperPath, tmpPath], {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024
    });
    return JSON.parse(out);
  } catch (err: any) {
    return null;
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
  }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const cleanBuf = toCleanBuffer(buffer);
    const data = await pdfParse(cleanBuf);
    return data.text || '';
  } catch (error) {
    const fallback = extractViaHelper(buffer);
    if (fallback && fallback.fullText) {
      return fallback.fullText;
    }
    console.error('[PDF Service] Error parsing PDF text:', error);
    throw new Error('Failed to extract text from PDF file.');
  }
}

export async function extractPagesFromPdf(buffer: Buffer): Promise<PdfPageContent[]> {
  try {
    const cleanBuf = toCleanBuffer(buffer);
    const pages: PdfPageContent[] = [];
    const options = {
      pagerender: (pageData: any) => {
        return pageData.getTextContent().then((textContent: any) => {
          let lastY: number | undefined;
          let text = '';
          for (const item of (textContent.items || [])) {
            if (lastY === undefined || lastY === item.transform[5]) {
              text += (text.length > 0 && !text.endsWith(' ') ? ' ' : '') + item.str;
            } else {
              text += '\n' + item.str;
            }
            lastY = item.transform[5];
          }
          pages.push({
            pageNumber: pageData.pageIndex + 1,
            text
          });
          return text;
        });
      }
    };
    await pdfParse(cleanBuf, options);
    if (pages.length > 0) return pages;
  } catch (error: any) {
    // Attempt fallback via clean isolated helper
    const fallback = extractViaHelper(buffer);
    if (fallback && fallback.pages && fallback.pages.length > 0) {
      return fallback.pages;
    }
  }

  try {
    const plainText = await extractTextFromPdf(buffer);
    if (plainText) {
      return [{ pageNumber: 1, text: plainText }];
    }
  } catch {}

  return [];
}
