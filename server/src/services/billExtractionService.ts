import crypto from 'crypto';
import {
  MoneyMinor,
  rupeesToPaise,
  paiseToRupees,
  ClaimLineItem,
  BillDocument,
  StandardChargeCategory,
  ItemExtractionProvenance,
  ClassificationStatus,
  BillReconciliationStatus
} from '../types/claim.js';
import { BillUploadResponse } from '../types/claimApi.js';
import { extractPagesFromPdf, PdfPageContent } from './pdfService.js';

// ============================================================================
// Category Detection Keywords
// ============================================================================

interface CategoryRule {
  category: StandardChargeCategory;
  keywords: string[];
  isNonPayable?: boolean;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'CONSUMABLES_NON_PAYABLES',
    keywords: [
      'glove', 'gloves', 'ppe', 'sanitizer', 'mask', 'masks', 'syringe', 'disposable',
      'admission fee', 'registration fee', 'admin fee', 'administrative', 'record maintenance',
      'file charge', 'biomedical waste', 'cotton', 'gauze', 'thermometer'
    ],
    isNonPayable: true
  },
  {
    category: 'ROOM_RENT',
    keywords: ['room rent', 'bed charge', 'room charge', 'deluxe room', 'suite', 'general ward', 'twin sharing', 'boarding']
  },
  {
    category: 'ICU_CHARGES',
    keywords: ['icu', 'intensive care', 'ccu', 'nicu', 'picu', 'critical care']
  },
  {
    category: 'SURGEON_CONSULTATION',
    keywords: ['surgeon fee', 'doctor fee', 'consultation', 'consultant', 'anesthetist', 'physician fee', 'specialist visit', 'rounds']
  },
  {
    category: 'OT_CHARGES',
    keywords: ['operation theater', 'ot charge', 'ot fee', 'theater fee', 'anesthesia equipment', 'c-arm', 'laparoscopy charge']
  },
  {
    category: 'NURSING',
    keywords: ['nursing charge', 'nursing fee', 'nursing care', 'rno charges']
  },
  {
    category: 'INVESTIGATIONS_DIAGNOSTICS',
    keywords: ['x-ray', 'ct scan', 'mri', 'ultrasound', 'usg', 'pathology', 'blood test', 'lab', 'cbc', 'biopsy', 'ecg', 'echo', 'diagnostic']
  },
  {
    category: 'MEDICINES_PHARMACY',
    keywords: ['pharmacy', 'medicine', 'tablet', 'injection', 'iv fluid', 'saline', 'capsule', 'drug', 'antibiotic', 'infusion', 'syrup']
  },
  {
    category: 'IMPLANT_PROSTHETICS',
    keywords: ['stent', 'mesh', 'pacemaker', 'implant', 'prosthesis', 'prosthetic', 'graft', 'screw', 'orthopedic plate']
  },
  {
    category: 'AMBULANCE',
    keywords: ['ambulance', 'emergency transport', 'patient transit']
  },
  {
    category: 'DAYCARE_PACKAGE',
    keywords: ['daycare', 'chemotherapy', 'dialysis', 'radiotherapy', 'package procedure', 'cataract surgery', 'hernioplasty', 'appendectomy']
  }
];

export class BillExtractionService {
  /**
   * Extracts itemized hospital bill line items from an uploaded PDF buffer or raw text.
   * Preserves exact provenance, performs regulatory non-payable checks, and audits reconciliation.
   */
  public async extractBillFromPdf(
    pdfBuffer: Buffer,
    filename: string = 'hospital_invoice.pdf'
  ): Promise<BillUploadResponse> {
    const contentHashSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const billId = `bill_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const extractionWarnings: string[] = [];

    let pages: PdfPageContent[] = [];
    try {
      pages = await extractPagesFromPdf(pdfBuffer);
    } catch (err: any) {
      extractionWarnings.push(`PDF parsing encountered an error: ${err.message || 'Unknown error'}`);
    }

    if (pages.length === 0 || pages.every(p => !p.text || p.text.trim().length === 0)) {
      // Scanned document or empty text
      return {
        billId,
        hospitalName: 'Hospital / Healthcare Provider',
        sourceDocumentRef: filename,
        billDate: null,
        admissionDate: null,
        dischargeDate: null,
        originalBillTotalPaise: 0,
        calculatedItemsTotalPaise: 0,
        reconciliationDifferencePaise: 0,
        reconciliationStatus: 'PENDING_REVIEW',
        lineItems: [],
        extractionWarnings: [
          'No machine-readable text was found in the PDF. The file may be a scanned document or image-only invoice. Please enter line items manually or provide a searchable digital invoice.'
        ],
        isExtractionComplete: false
      };
    }

    // Combine page texts and parse tabular lines
    const fullText = pages.map(p => p.text).join('\n');
    const hospitalName = this.detectHospitalName(fullText);
    const { billDate, admissionDate, dischargeDate } = this.detectDates(fullText);
    const statedGrossPaise = this.detectStatedGrossTotal(fullText);

    // Parse itemized lines
    const lineItems = this.parseLineItemsFromPages(pages, billId);

    if (lineItems.length === 0) {
      extractionWarnings.push(
        'Unable to automatically identify structured invoice line items from PDF layout. Human item entry/correction is required.'
      );
    }

    const calculatedItemsTotalPaise = lineItems.reduce((sum, item) => sum + item.claimedAmountPaise, 0);
    const originalBillTotalPaise = statedGrossPaise !== null ? statedGrossPaise : calculatedItemsTotalPaise;
    const reconciliationDifferencePaise = originalBillTotalPaise - calculatedItemsTotalPaise;

    let reconciliationStatus: BillReconciliationStatus = 'RECONCILED';
    if (lineItems.length === 0) {
      reconciliationStatus = 'PENDING_REVIEW';
    } else if (reconciliationDifferencePaise !== 0) {
      reconciliationStatus = 'DISCREPANCY';
      extractionWarnings.push(
        `Stated bill gross (₹${paiseToRupees(originalBillTotalPaise).toLocaleString('en-IN')}) differs from extracted items total (₹${paiseToRupees(calculatedItemsTotalPaise).toLocaleString('en-IN')}) by ₹${Math.abs(paiseToRupees(reconciliationDifferencePaise)).toLocaleString('en-IN')}. Please verify item entries.`
      );
    }

    return {
      billId,
      hospitalName,
      sourceDocumentRef: filename,
      billDate,
      admissionDate,
      dischargeDate,
      originalBillTotalPaise,
      calculatedItemsTotalPaise,
      reconciliationDifferencePaise,
      reconciliationStatus,
      lineItems,
      extractionWarnings,
      isExtractionComplete: lineItems.length > 0 && reconciliationDifferencePaise === 0
    };
  }

  /**
   * Ingests and reconciles a pre-structured or user-submitted BillDocument payload.
   */
  public ingestStructuredBill(bill: Partial<BillDocument>): BillDocument {
    const billId = bill.billId || `bill_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const rawItems = bill.lineItems || [];

    const lineItems: ClaimLineItem[] = rawItems.map((item, idx) => {
      const itemId = item.itemId || `item_${idx + 1}`;
      const quantity = Math.max(1, item.quantity || 1);
      const unitPricePaise = item.unitPricePaise !== undefined
        ? item.unitPricePaise
        : rupeesToPaise((item as any).unitPriceRupees || 0);
      const claimedAmountPaise = item.claimedAmountPaise !== undefined
        ? item.claimedAmountPaise
        : quantity * unitPricePaise;

      const category = item.category || this.classifyCategory(item.originalDescription);
      const isNonPayable = item.isNonPayableByRegulation !== undefined
        ? item.isNonPayableByRegulation
        : Boolean(
            category === 'CONSUMABLES_NON_PAYABLES' ||
            this.isStatutoryNonPayable(item.originalDescription)
          );

      return {
        itemId,
        originalDescription: item.originalDescription || `Item ${idx + 1}`,
        normalizedDescription: item.normalizedDescription || null,
        category,
        quantity,
        unitPricePaise,
        claimedAmountPaise,
        currency: 'INR' as const,
        provenance: item.provenance || {
          sourceType: 'STRUCTURED_JSON_TEMPLATE',
          rawExtractedText: item.originalDescription || `Item ${idx + 1}`,
          extractedTimestamp: new Date().toISOString(),
          confidenceScore: 1.0
        },
        classificationStatus: item.classificationStatus || 'AUTOMATIC_EXACT',
        reviewFlags: isNonPayable ? ['IRDAI_NON_PAYABLE'] : (item.reviewFlags || []),
        isNonPayableByRegulation: isNonPayable
      };
    });

    const calculatedItemsTotalPaise = lineItems.reduce((sum, it) => sum + it.claimedAmountPaise, 0);
    const originalBillTotalPaise = bill.originalBillTotalPaise !== undefined
      ? bill.originalBillTotalPaise
      : calculatedItemsTotalPaise;
    const reconciliationDifferencePaise = originalBillTotalPaise - calculatedItemsTotalPaise;

    const reconciliationStatus: BillReconciliationStatus =
      lineItems.length === 0
        ? 'PENDING_REVIEW'
        : reconciliationDifferencePaise === 0
          ? 'RECONCILED'
          : 'DISCREPANCY';

    return {
      billId,
      hospitalName: bill.hospitalName || 'Hospital / Healthcare Provider',
      sourceDocumentRef: bill.sourceDocumentRef || null,
      contentHashSha256: bill.contentHashSha256 || null,
      billDate: bill.billDate || new Date().toISOString().substring(0, 10),
      admissionDate: bill.admissionDate || null,
      dischargeDate: bill.dischargeDate || null,
      originalBillTotalPaise,
      calculatedItemsTotalPaise,
      reconciliationDifferencePaise,
      reconciliationStatus,
      currency: 'INR',
      lineItems,
      uploadedAt: bill.uploadedAt || new Date().toISOString(),
      extractedAt: new Date().toISOString()
    };
  }

  // ==========================================================================
  // Internal Heuristic Extractors
  // ==========================================================================

  private parseLineItemsFromPages(pages: PdfPageContent[], billId: string): ClaimLineItem[] {
    const items: ClaimLineItem[] = [];
    let itemIndex = 1;

    for (const page of pages) {
      const lines = page.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        // Match typical invoice table row:
        // e.g. "Single Deluxe Room Bed Charges 3 5000 15000" or "Surgeon Fee 35000.00"
        const rowMatch = this.extractTableRow(line);
        if (rowMatch) {
          const category = this.classifyCategory(rowMatch.description);
          const isNonPayable = this.isStatutoryNonPayable(rowMatch.description) || category === 'CONSUMABLES_NON_PAYABLES';

          items.push({
            itemId: `item_${billId.substring(5, 11)}_${itemIndex++}`,
            originalDescription: rowMatch.description,
            normalizedDescription: null,
            category,
            quantity: rowMatch.quantity,
            unitPricePaise: rowMatch.unitPricePaise,
            claimedAmountPaise: rowMatch.claimedAmountPaise,
            currency: 'INR',
            provenance: {
              sourceType: 'OCR_PDF_EXTRACTION',
              pageNumber: page.pageNumber,
              lineNumber: lineNum + 1,
              rawExtractedText: line,
              extractedTimestamp: new Date().toISOString(),
              confidenceScore: 0.90
            },
            classificationStatus: 'AUTOMATIC_EXACT',
            reviewFlags: isNonPayable ? ['IRDAI_NON_PAYABLE'] : [],
            isNonPayableByRegulation: isNonPayable
          });
        }
      }
    }

    return items;
  }

  /**
   * Matches regex patterns for row data: Description ... Quantity ... UnitPrice ... TotalAmount
   */
  private extractTableRow(line: string): {
    description: string;
    quantity: number;
    unitPricePaise: MoneyMinor;
    claimedAmountPaise: MoneyMinor;
  } | null {
    // Exclude header rows or footer summaries
    const lower = line.toLowerCase();
    if (
      lower.includes('total amount') ||
      lower.includes('gross total') ||
      lower.includes('sub total') ||
      lower.includes('invoice no') ||
      lower.includes('patient name') ||
      lower.includes('date of admission') ||
      lower.includes('bill date') ||
      lower.startsWith('page ')
    ) {
      return null;
    }

    // Pattern 1: Description Qty UnitPrice Total
    // e.g. "Room Rent Private AC 3 5000 15000"
    const matchFull = line.match(/^([A-Za-z0-9\s\-_.,/&()]+?)\s+(\d+)\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+(?:\.\d{1,2})?)$/);
    if (matchFull) {
      const desc = matchFull[1].replace(/\s*(?:Rs\.?|INR)?\s*$/i, '').replace(/\.+$/, '').trim();
      const qty = parseInt(matchFull[2], 10);
      const unitRupees = parseFloat(matchFull[3].replace(/,/g, ''));
      const totalRupees = parseFloat(matchFull[4].replace(/,/g, ''));

      if (desc.length > 2 && qty > 0 && !isNaN(totalRupees) && totalRupees > 0) {
        return {
          description: desc,
          quantity: qty,
          unitPricePaise: rupeesToPaise(unitRupees),
          claimedAmountPaise: rupeesToPaise(totalRupees)
        };
      }
    }

    // Pattern 2: Description Amount
    // e.g. "Operation Theater Charges 40,000"
    const matchSimple = line.match(/^([A-Za-z0-9\s\-_.,/&()]+?)\s+([\d,]+(?:\.\d{1,2})?)$/);
    if (matchSimple) {
      const desc = matchSimple[1].replace(/\s*(?:Rs\.?|INR)?\s*$/i, '').replace(/\.+$/, '').trim();
      const amountRupees = parseFloat(matchSimple[2].replace(/,/g, ''));

      if (desc.length > 3 && !isNaN(amountRupees) && amountRupees > 0) {
        return {
          description: desc,
          quantity: 1,
          unitPricePaise: rupeesToPaise(amountRupees),
          claimedAmountPaise: rupeesToPaise(amountRupees)
        };
      }
    }

    return null;
  }

  private classifyCategory(desc: string): StandardChargeCategory {
    const text = desc.toLowerCase();
    const tokens = text.split(/[^a-z0-9]+/);
    for (const rule of CATEGORY_RULES) {
      for (const kw of rule.keywords) {
        if (kw.length <= 3) {
          if (tokens.includes(kw)) return rule.category;
        } else if (text.includes(kw)) {
          return rule.category;
        }
      }
    }
    return 'MISCELLANEOUS';
  }

  private isStatutoryNonPayable(desc: string): boolean {
    const text = desc.toLowerCase();
    const tokens = text.split(/[^a-z0-9]+/);
    const consumableRule = CATEGORY_RULES.find(r => r.category === 'CONSUMABLES_NON_PAYABLES');
    if (!consumableRule) return false;
    return consumableRule.keywords.some(kw => {
      if (kw.length <= 3) {
        return tokens.includes(kw);
      }
      return text.includes(kw);
    });
  }

  private detectHospitalName(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    // Hospital name is usually in first 5 lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (
        line.toLowerCase().includes('hospital') ||
        line.toLowerCase().includes('healthcare') ||
        line.toLowerCase().includes('medical center') ||
        line.toLowerCase().includes('clinic') ||
        line.toLowerCase().includes('nursing home')
      ) {
        return line;
      }
    }
    const match = text.match(/([A-Za-z0-9\s]{2,40}?(?:Hospitals?|Healthcare|Medical Center|Clinic|Nursing Home)[A-Za-z0-9\s]{0,25})/i);
    if (match && match[1]) {
      return match[1].trim().split('\n')[0].trim();
    }
    return 'Hospital / Healthcare Provider';
  }

  private detectDates(text: string): {
    billDate: string | null;
    admissionDate: string | null;
    dischargeDate: string | null;
  } {
    const dateRegex = /\b(\d{4}-\d{2}-\d{2}|\d{2}[-/.]\d{2}[-/.]\d{4})\b/g;
    const matches = text.match(dateRegex);

    const normalizeDate = (dStr: string): string => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
      const parts = dStr.split(/[-/.]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          // DD/MM/YYYY -> YYYY-MM-DD
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      return dStr;
    };

    let billDate: string | null = null;
    let admissionDate: string | null = null;
    let dischargeDate: string | null = null;

    if (matches && matches.length > 0) {
      billDate = normalizeDate(matches[0]);
      if (matches.length > 1) admissionDate = normalizeDate(matches[1]);
      if (matches.length > 2) dischargeDate = normalizeDate(matches[2]);
    }

    return { billDate, admissionDate, dischargeDate };
  }

  private detectStatedGrossTotal(text: string): MoneyMinor | null {
    const patterns = [
      /(?:total amount|gross total|net amount|bill total|total bill|grand total)\s*[:=-]?\s*₹?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /(?:amount payable|net payable)\s*[:=-]?\s*₹?\s*([\d,]+(?:\.\d{1,2})?)/i
    ];

    for (const pat of patterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0) {
          return rupeesToPaise(val);
        }
      }
    }

    return null;
  }
}

export const billExtractionService = new BillExtractionService();
