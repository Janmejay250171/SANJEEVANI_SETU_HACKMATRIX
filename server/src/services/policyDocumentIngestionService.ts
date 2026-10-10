import crypto from 'crypto';
import { extractPagesFromPdf, extractTextFromPdf, PdfPageContent } from './pdfService.js';
import { PolicyDocumentType } from '../types/policyVersion.js';

export interface IngestedPageMetadata {
  pageNumber: number;
  text: string;
  charCount: number;
  wordCount: number;
  isImageOnlyOrScanned: boolean;
  isUnreadable: boolean;
  detectedHeadings: string[];
  detectedClauses: string[];
  tablesDetected: boolean;
}

export interface PolicyDocumentIngestionResult {
  documentId: string;
  originalFileName: string;
  fileSizeBytes: number;
  contentHashSha256: string;
  documentType: PolicyDocumentType;
  totalPages: number;
  readablePagesCount: number;
  unreadablePagesCount: number;
  scannedPagesCount: number;
  pages: IngestedPageMetadata[];
  fullText: string;
  detectedInsurerName?: string | null;
  detectedPlanName?: string | null;
  detectedPolicyNumber?: string | null;
  detectedUin?: string | null;
  detectedEffectivePeriod?: { from: string | null; to: string | null };
  isComplete: boolean;
  extractionWarnings: string[];
  isDuplicateUpload: boolean;
}

export interface IngestionValidationCheck {
  valid: boolean;
  error?: string;
}

// In-memory registry of seen content hashes for duplicate upload detection
const PROCESSED_DOCUMENT_HASHES = new Map<string, string>(); // hash -> documentId

/**
 * Validates file buffer, mime type, and integrity before parsing.
 */
export function validatePdfFileIntegrity(buffer: Buffer, originalName?: string): IngestionValidationCheck {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File buffer is empty or missing.' };
  }

  // 50 MB max limit for full-length 50-page policy PDFs
  const maxBytes = 50 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    return { valid: false, error: `File size exceeds 50MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB).` };
  }

  // PDF Magic Bytes: %PDF- (0x25 0x50 0x44 0x46)
  const isPdfHeader = buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46;

  if (!isPdfHeader) {
    return { valid: false, error: 'File header does not match valid PDF specification (%PDF-).' };
  }

  return { valid: true };
}

/**
 * Robust Multi-Page Policy Document Ingestion Service.
 * Preserves page boundaries, headings, clause references, and detects scanned/unreadable pages.
 */
export class PolicyDocumentIngestionService {
  private static instance: PolicyDocumentIngestionService | null = null;

  public static getInstance(): PolicyDocumentIngestionService {
    if (!PolicyDocumentIngestionService.instance) {
      PolicyDocumentIngestionService.instance = new PolicyDocumentIngestionService();
    }
    return PolicyDocumentIngestionService.instance;
  }

  /**
   * Computes SHA-256 cryptographic hash of buffer.
   */
  public computeSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Ingests, validates, and structurally indexes a policy PDF document.
   */
  public async ingestPolicyPdf(
    buffer: Buffer,
    originalFileName: string = 'policy_document.pdf',
    forcedDocumentType?: PolicyDocumentType
  ): Promise<PolicyDocumentIngestionResult> {
    const valCheck = validatePdfFileIntegrity(buffer, originalFileName);
    if (!valCheck.valid) {
      throw new Error(`PDF Ingestion Error: ${valCheck.error}`);
    }

    const contentHash = this.computeSha256(buffer);
    const isDuplicateUpload = PROCESSED_DOCUMENT_HASHES.has(contentHash);
    const documentId = isDuplicateUpload
      ? (PROCESSED_DOCUMENT_HASHES.get(contentHash) as string)
      : `DOC_${Date.now()}_${contentHash.substring(0, 8)}`;

    if (!isDuplicateUpload) {
      PROCESSED_DOCUMENT_HASHES.set(contentHash, documentId);
    }

    const extractionWarnings: string[] = [];
    let rawPages: PdfPageContent[] = [];

    try {
      rawPages = await extractPagesFromPdf(buffer);
    } catch (err: any) {
      extractionWarnings.push(`Page-level PDF extraction warning: ${err.message}. Retrying via plain text.`);
      const plain = await extractTextFromPdf(buffer);
      rawPages = [{ pageNumber: 1, text: plain }];
    }

    if (rawPages.length === 0) {
      extractionWarnings.push('No pages could be extracted from PDF. Document may be corrupt or encrypted.');
      return {
        documentId,
        originalFileName,
        fileSizeBytes: buffer.length,
        contentHashSha256: contentHash,
        documentType: forcedDocumentType || 'BASE_POLICY',
        totalPages: 0,
        readablePagesCount: 0,
        unreadablePagesCount: 0,
        scannedPagesCount: 0,
        pages: [],
        fullText: '',
        isComplete: false,
        extractionWarnings,
        isDuplicateUpload
      };
    }

    const processedPages: IngestedPageMetadata[] = [];
    let unreadableCount = 0;
    let scannedCount = 0;
    const fullTextParts: string[] = [];

    for (const page of rawPages) {
      const text = (page.text || '').trim();
      const charCount = text.length;
      const wordCount = text ? text.split(/\s+/).length : 0;

      // Scanned/Image-only page heuristic: < 30 chars on a page
      const isImageOnlyOrScanned = charCount < 30;
      const isUnreadable = charCount === 0;

      if (isUnreadable) unreadableCount++;
      if (isImageOnlyOrScanned && !isUnreadable) scannedCount++;

      // Detect headings (lines in ALL CAPS or starting with SECTION / CLAUSE / SCHEDULE / PART)
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const detectedHeadings: string[] = [];
      const detectedClauses: string[] = [];

      for (const line of lines) {
        if (/^(SECTION|CLAUSE|SCHEDULE|PART|ANNEXURE|TABLE)\s+[0-9A-Z.:-]+/i.test(line)) {
          detectedHeadings.push(line);
        } else if (/^[A-Z\s]{4,40}$/.test(line) && line.length > 5) {
          detectedHeadings.push(line);
        }

        // Clause identifiers: e.g. "Clause 2.2", "Clause S.1", "Excl 05", "Code-Wait01"
        const clauseMatches = line.match(/(?:Clause|Section|Code-Wait|Code-Excl|Excl)\s*[0-9A-Za-z.-]+/gi);
        if (clauseMatches) {
          for (const m of clauseMatches) {
            if (!detectedClauses.includes(m)) detectedClauses.push(m);
          }
        }
      }

      const tablesDetected = text.includes(' | ') || (text.includes('•') && text.includes('Rs.'));

      processedPages.push({
        pageNumber: page.pageNumber,
        text,
        charCount,
        wordCount,
        isImageOnlyOrScanned,
        isUnreadable,
        detectedHeadings,
        detectedClauses,
        tablesDetected
      });

      fullTextParts.push(`--- [PAGE ${page.pageNumber}] ---\n${text}`);
    }

    const fullText = fullTextParts.join('\n\n');

    // Detect Document Type (Base Policy vs Endorsement vs Amendment vs Schedule)
    let docType: PolicyDocumentType = forcedDocumentType || 'BASE_POLICY';
    if (!forcedDocumentType) {
      if (rawPages.length > 5 || /POLICY\s+WORDING|MASTER\s+POLICY/i.test(rawPages[0]?.text || '')) {
        docType = 'BASE_POLICY';
      } else if (/ENDORSEMENT\s+SCHEDULE|AMENDMENT\s+CERTIFICATE|POLICY\s+ENDORSEMENT/i.test(fullText)) {
        docType = 'ENDORSEMENT';
      } else if (/POLICY\s+SCHEDULE|CERTIFICATE\s+OF\s+INSURANCE/i.test(fullText) && rawPages.length <= 4) {
        docType = 'SCHEDULE_ATTACHMENT';
      } else {
        docType = 'BASE_POLICY';
      }
    }

    // Header extraction
    let detectedInsurer: string | null = null;
    let detectedPlan: string | null = null;
    let detectedPolicyNo: string | null = null;
    let detectedUinNo: string | null = null;
    let detectedEffFrom: string | null = null;
    let detectedEffTo: string | null = null;

    if (/STAR\s+HEALTH/i.test(fullText)) detectedInsurer = 'Star Health and Allied Insurance';
    else if (/HDFC\s+ERGO/i.test(fullText)) detectedInsurer = 'HDFC ERGO General Insurance';
    else if (/ADITYA\s+BIRLA/i.test(fullText)) detectedInsurer = 'Aditya Birla Health Insurance';
    else if (/ICICI\s+LOMBARD/i.test(fullText)) detectedInsurer = 'ICICI Lombard General Insurance';
    else if (/CARE\s+HEALTH|RELIGARE/i.test(fullText)) detectedInsurer = 'Care Health Insurance';
    else if (/AROGYA\s+BHARAT/i.test(fullText)) detectedInsurer = 'Arogya Bharat General Insurance Co. Ltd.';
    else {
      const generalInsurerMatch = fullText.match(/\b([A-Z][a-zA-Z\s]{2,40}?(?:General Insurance|Health Insurance|Assurance)\s*(?:Co\.|Company)?\s*(?:Ltd\.?|Limited)?)\b/i);
      if (generalInsurerMatch) detectedInsurer = generalInsurerMatch[1].trim();
    }

    const planMatch = fullText.match(/(?:FAMILY\s+HEALTH\s+OPTIMA|CORPORATE\s+GROUP\s+HEALTH\s+SHIELD|ACTIV\s+HEALTH|AROGYA\s+PREMIER|COMPREHENSIVE\s+SWASTHYA\s+RAKSHA\s+PLATINUM|SWASTHYA\s+RAKSHA\s+PLATINUM)[^,\n.]*/i);
    if (planMatch) detectedPlan = planMatch[0].trim();
    else {
      const generalPlanMatch = fullText.match(/(?:Product Name|Plan Name|Policy Name)[:.\s]*([A-Za-z0-9\s-]{4,50})/i);
      if (generalPlanMatch) detectedPlan = generalPlanMatch[1].trim();
    }

    const polMatch = fullText.match(/Policy\s*(?:Certificate\s*)?(?:Number|No)[:.\s]*([A-Z0-9\/-]{8,35})/i);
    if (polMatch) detectedPolicyNo = polMatch[1].trim();

    const uinMatch = fullText.match(/UIN[:.\s]*([A-Z0-9]{10,25})/i);
    if (uinMatch) detectedUinNo = uinMatch[1].trim();

    const dateRangeMatch = fullText.match(/(?:From|Effective\s*From|Contractual\s*Policy\s*Period[:.\s]*From)\s*[0-9:a-z\s]*([0-9]{4}-[0-9]{2}-[0-9]{2}).*?(?:to|Expiry|until)\s*[0-9:a-z\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    if (dateRangeMatch) {
      detectedEffFrom = dateRangeMatch[1];
      detectedEffTo = dateRangeMatch[2];
    }

    return {
      documentId,
      originalFileName,
      fileSizeBytes: buffer.length,
      contentHashSha256: contentHash,
      documentType: docType,
      totalPages: processedPages.length,
      readablePagesCount: processedPages.length - unreadableCount,
      unreadablePagesCount: unreadableCount,
      scannedPagesCount: scannedCount,
      pages: processedPages,
      fullText,
      detectedInsurerName: detectedInsurer,
      detectedPlanName: detectedPlan,
      detectedPolicyNumber: detectedPolicyNo,
      detectedUin: detectedUinNo,
      detectedEffectivePeriod: { from: detectedEffFrom, to: detectedEffTo },
      isComplete: unreadableCount === 0,
      extractionWarnings,
      isDuplicateUpload
    };
  }
}

export const policyDocumentIngestionService = PolicyDocumentIngestionService.getInstance();
