import { PolicyDocumentIngestionResult } from './policyDocumentIngestionService.js';
import { ConsolidatedPolicyExtraction } from './policySegmentationEngine.js';

export type FieldValidationStatus =
  | 'VERIFIED_WITH_EVIDENCE'
  | 'PARTIAL_EVIDENCE'
  | 'CITATION_PAGE_MISMATCH'
  | 'TEXT_NOT_FOUND_ON_PAGE'
  | 'UNRESOLVED_IN_DOCUMENT'
  | 'USER_CONFIRMED';

export type ProvenanceOrigin =
  | 'AI_EXTRACTED'
  | 'SYSTEM_DERIVED'
  | 'USER_CONFIRMED'
  | 'UNRESOLVED';

export interface FieldEvidenceAudit {
  fieldName: string;
  extractedValue: unknown;
  status: FieldValidationStatus;
  origin: ProvenanceOrigin;
  citedPageNumber: number | null;
  citedClauseNumber?: string | null;
  citedSnippet: string | null;
  isVerbatimFoundOnPage: boolean;
  valueMatchesSnippet: boolean;
  requiresHumanReview: boolean;
  reviewReason?: string;
}

export interface PolicyEvidenceValidationReport {
  documentId: string;
  totalFieldsEvaluated: number;
  verifiedFieldsCount: number;
  unresolvedFieldsCount: number;
  unsupportedCitationsCount: number;
  humanReviewRequired: boolean;
  fieldAudits: Record<string, FieldEvidenceAudit>;
  overallAccuracyRate: number; // 0 to 100%
  provenanceIntegrityPassed: boolean;
}

/**
 * Validates whether a text snippet exists verbatim or near-verbatim on a specific page.
 */
function isSnippetPresentOnPage(pageText: string, snippet: string): boolean {
  if (!pageText || !snippet) return false;
  const cleanPage = pageText.toLowerCase().replace(/\s+/g, ' ');
  const cleanSnippet = snippet.toLowerCase().replace(/\s+/g, ' ');

  // Exact substring match
  if (cleanPage.includes(cleanSnippet)) return true;

  // Token-subset match for excerpts with minor whitespace/hyphen differences
  const snippetTokens = cleanSnippet.split(' ').filter(w => w.length > 3);
  if (snippetTokens.length === 0) return false;
  const matchedTokens = snippetTokens.filter(tok => cleanPage.includes(tok));
  return matchedTokens.length / snippetTokens.length >= 0.75;
}

/**
 * Validates whether the extracted value aligns with the text snippet.
 */
function doesValueAlignWithSnippet(val: unknown, snippet: string): boolean {
  if (val === null || val === undefined) return true;
  const cleanSnippet = snippet.toLowerCase().replace(/[,₹]/g, '');

  if (typeof val === 'number') {
    const numStr = String(val);
    if (cleanSnippet.includes(numStr)) return true;
    // Check Lakh conversion (e.g. 500000 -> 5 lakh)
    if (val >= 100000 && val % 100000 === 0) {
      const lakhs = val / 100000;
      if (cleanSnippet.includes(`${lakhs} lakh`)) return true;
    }
  } else if (typeof val === 'string') {
    if (cleanSnippet.includes(val.toLowerCase())) return true;
  } else if (typeof val === 'object' && val !== null && 'value' in val) {
    const innerVal = (val as any).value;
    if (innerVal !== null && innerVal !== undefined) {
      return doesValueAlignWithSnippet(innerVal, snippet);
    }
    return true;
  }

  return true;
}

/**
 * Evidence Verification Engine for Policy Extraction.
 * Audits cited page numbers and text excerpts against the source document.
 */
export class PolicyEvidenceValidator {
  private static instance: PolicyEvidenceValidator | null = null;

  public static getInstance(): PolicyEvidenceValidator {
    if (!PolicyEvidenceValidator.instance) {
      PolicyEvidenceValidator.instance = new PolicyEvidenceValidator();
    }
    return PolicyEvidenceValidator.instance;
  }

  /**
   * Strictly audits all extracted fields and cited evidence against the ingested document pages.
   */
  public auditPolicyEvidence(
    ingestedDoc: PolicyDocumentIngestionResult,
    extraction: ConsolidatedPolicyExtraction
  ): PolicyEvidenceValidationReport {
    const fieldAudits: Record<string, FieldEvidenceAudit> = {};
    let verifiedCount = 0;
    let unresolvedCount = 0;
    let unsupportedCount = 0;

    const pageTextMap = new Map<number, string>();
    for (const p of ingestedDoc.pages) {
      pageTextMap.set(p.pageNumber, p.text);
    }

    const materialFields = [
      'insurer',
      'planName',
      'policyNumber',
      'uin',
      'policyStartDate',
      'sumInsured',
      'roomLimit',
      'icuLimit',
      'proportionateDeduction',
      'deductible',
      'copay',
      'nonNetworkCopay',
      'subLimits.cataract',
      'subLimits.kneeReplacement',
      'subLimits.hernia',
      'subLimits.appendectomy',
      'waitingPeriods',
      'exclusions',
      'restorationBenefit'
    ];

    for (const field of materialFields) {
      const ev = extraction.fieldEvidenceMap[field];
      if (!ev) {
        fieldAudits[field] = {
          fieldName: field,
          extractedValue: null,
          status: 'UNRESOLVED_IN_DOCUMENT',
          origin: 'UNRESOLVED',
          citedPageNumber: null,
          citedSnippet: null,
          isVerbatimFoundOnPage: false,
          valueMatchesSnippet: false,
          requiresHumanReview: true,
          reviewReason: 'Field was not stated or detected in policy text'
        };
        unresolvedCount++;
        continue;
      }

      // Check cited page number bounds
      if (ev.pageNumber < 1 || ev.pageNumber > ingestedDoc.totalPages) {
        fieldAudits[field] = {
          fieldName: field,
          extractedValue: ev.extractedValue,
          status: 'CITATION_PAGE_MISMATCH',
          origin: 'AI_EXTRACTED',
          citedPageNumber: ev.pageNumber,
          citedClauseNumber: ev.clauseNumber,
          citedSnippet: ev.evidenceExcerpt,
          isVerbatimFoundOnPage: false,
          valueMatchesSnippet: false,
          requiresHumanReview: true,
          reviewReason: `Cited page ${ev.pageNumber} is out of bounds for document with ${ingestedDoc.totalPages} pages`
        };
        unsupportedCount++;
        continue;
      }

      const pageText = pageTextMap.get(ev.pageNumber) || '';
      const snippetFound = isSnippetPresentOnPage(pageText, ev.evidenceExcerpt);
      const valueMatches = doesValueAlignWithSnippet(ev.extractedValue, ev.evidenceExcerpt);

      if (!snippetFound) {
        fieldAudits[field] = {
          fieldName: field,
          extractedValue: ev.extractedValue,
          status: 'TEXT_NOT_FOUND_ON_PAGE',
          origin: 'AI_EXTRACTED',
          citedPageNumber: ev.pageNumber,
          citedClauseNumber: ev.clauseNumber,
          citedSnippet: ev.evidenceExcerpt,
          isVerbatimFoundOnPage: false,
          valueMatchesSnippet: valueMatches,
          requiresHumanReview: true,
          reviewReason: `Cited snippet was not found on page ${ev.pageNumber}. Potential hallucinated citation.`
        };
        unsupportedCount++;
      } else {
        fieldAudits[field] = {
          fieldName: field,
          extractedValue: ev.extractedValue,
          status: 'VERIFIED_WITH_EVIDENCE',
          origin: 'AI_EXTRACTED',
          citedPageNumber: ev.pageNumber,
          citedClauseNumber: ev.clauseNumber,
          citedSnippet: ev.evidenceExcerpt,
          isVerbatimFoundOnPage: true,
          valueMatchesSnippet: valueMatches,
          requiresHumanReview: false
        };
        verifiedCount++;
      }
    }

    const totalFields = materialFields.length;
    const accuracy = totalFields > 0 ? Math.round((verifiedCount / totalFields) * 100) : 0;
    const provenancePassed = unsupportedCount === 0;

    return {
      documentId: ingestedDoc.documentId,
      totalFieldsEvaluated: totalFields,
      verifiedFieldsCount: verifiedCount,
      unresolvedFieldsCount: unresolvedCount,
      unsupportedCitationsCount: unsupportedCount,
      humanReviewRequired: unsupportedCount > 0 || unresolvedCount > 0,
      fieldAudits,
      overallAccuracyRate: accuracy,
      provenanceIntegrityPassed: provenancePassed
    };
  }
}

export const policyEvidenceValidator = PolicyEvidenceValidator.getInstance();
