import pdfParse from 'pdf-parse';

export interface PdfPageContent {
  pageNumber: number;
  text: string;
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('[PDF Service] Error parsing PDF text:', error);
    throw new Error('Failed to extract text from PDF file.');
  }
}

export async function extractPagesFromPdf(buffer: Buffer): Promise<PdfPageContent[]> {
  try {
    const pages: PdfPageContent[] = [];
    const options = {
      pagerender: (pageData: any) => {
        return pageData.getTextContent().then((textContent: any) => {
          const text = (textContent.items || []).map((s: any) => s.str).join(' ');
          pages.push({
            pageNumber: pageData.pageIndex + 1,
            text
          });
          return text;
        });
      }
    };
    await pdfParse(buffer, options);
    if (pages.length > 0) return pages;
  } catch (error) {
    // Graceful fallback for synthetic or low-fidelity PDF fixtures
  }

  try {
    const plainText = await extractTextFromPdf(buffer);
    if (plainText) {
      return [{ pageNumber: 1, text: plainText }];
    }
  } catch {}

  return [];
}
