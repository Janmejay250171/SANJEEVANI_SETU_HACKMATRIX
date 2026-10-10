import { StandardChargeCategory } from './claim.js';
import { PolicyVersionRecord, ApplicabilityStatus } from './policyVersion.js';

// ============================================================================
// Clause Types & Index Representation
// ============================================================================

export type ClauseType =
  | 'coverage'
  | 'exclusion'
  | 'definition'
  | 'limit'
  | 'deductible'
  | 'co_payment'
  | 'condition'
  | 'exception'
  | 'procedure'
  | 'proportionate_deduction'
  | 'unknown';

/**
 * Authoritative representation of an indexed policy clause.
 * Preserves exact verbatim wording, source location, and version provenance.
 */
export interface IndexedPolicyClause {
  /** Stable unique clause identifier (e.g., 'cl_star_room_rent_01') */
  clauseId: string;

  /** Stable policy family identifier */
  familyId: string;

  /** Policy version identifier (e.g., 'syn_ver_base_2025_v1') */
  versionId: string;

  /** Associated document ID */
  documentId: string;

  /** Cryptographic SHA-256 hash of the source document */
  documentHash?: string | null;

  /** Clause heading or title (e.g., 'Section 1: Hospitalization & Room Rent') */
  heading: string;

  /** Section identifier or clause number (e.g., 'Section 1.1') */
  section: string;

  /** Exact verbatim source excerpt from the policy contract */
  exactExcerpt: string;

  /** Page number in source document (1-indexed), if identified */
  pageNumber: number | null;

  /** Source character or bounding location if available */
  sourceLocation?: string | null;

  /** Categorized contractual function of the clause */
  clauseType: ClauseType;

  /** Original raw text */
  originalText: string;

  /** Normalized text optimized for lexical & vector search */
  normalizedText: string;

  /** Associated charge categories this clause governs */
  applicableCategories: StandardChargeCategory[];

  /** Monetary or percentage limit stated in the clause */
  limitValue?: number | string | null;

  /** References or links to defined terms or parent clauses */
  linkedClauseIds: string[];

  /** Inherited contractual validity period from version record */
  effectiveFrom: string | null;
  effectiveTo: string | null;

  /** Whether segmentation was uncertain or heuristic */
  isSegmentationUncertain: boolean;

  /** Precomputed semantic embedding vector (if generated) */
  embedding?: number[] | null;
}

// ============================================================================
// Retrieval Queries & Baseline Results
// ============================================================================

export type RetrievalMethod = 'KEYWORD_BM25' | 'SEMANTIC_VECTOR' | 'HYBRID_RRF';

export interface ClauseRetrievalQuery {
  /** Verbatim bill line item description (e.g., 'Deluxe Room Bed Charges') */
  billItemDescription: string;

  /** Normalized clinical or billing description, if available */
  normalizedDescription?: string | null;

  /** Billed category, if identified */
  category?: StandardChargeCategory | null;

  /** Policy family identifier */
  familyId: string;

  /** Treatment date (YYYY-MM-DD) for date-based applicability filtering */
  treatmentDate?: string | null;

  /** Pre-resolved base version ID from Prompt 2 resolver */
  resolvedVersionId?: string | null;

  /** Applicable amendment IDs from Prompt 2 resolver */
  applicableAmendmentIds?: string[];

  /** Max candidate clauses to return per channel (default 5) */
  topK?: number;

  /** Whether to execute second-stage adverse/exclusion search (default true) */
  retrieveNegativeEvidence?: boolean;
}

export interface CandidateClauseMatch {
  /** Retrieved indexed clause */
  clause: IndexedPolicyClause;

  /** Retrieval method that found this clause */
  retrievalMethod: RetrievalMethod;

  /** Retrieval rank in the candidate list (1-indexed) */
  rank: number;

  /** Raw retrieval score (BM25 score, cosine similarity, or RRF score) */
  score: number;

  /** BM25 lexical score component (if hybrid) */
  bm25Score?: number;

  /** Vector semantic similarity component (if hybrid) */
  vectorScore?: number;

  /** Contractual applicability status on query treatment date */
  applicabilityStatus: ApplicabilityStatus;

  /** Why this candidate is applicable or rejected */
  applicabilityReason: string;

  /** Evidence category for adjudication */
  evidenceCategory: 'SUPPORTIVE' | 'ADVERSE_EXCLUSION' | 'CONDITIONAL_LIMIT' | 'CONFLICTING';

  /** Whether this evidence requires human verification */
  requiresVerification: boolean;
}

// ============================================================================
// Multi-Channel Evidence Result & Verification Contracts
// ============================================================================

export type VerificationStatus =
  | 'supported'
  | 'excluded'
  | 'conditional'
  | 'ambiguous'
  | 'conflicting'
  | 'insufficient_evidence'
  | 'review_required';

export interface EvidenceVerificationDecision {
  /** High-level verification status */
  status: VerificationStatus;

  /** Top supportive clause citation */
  primarySupportiveClause?: CandidateClauseMatch | null;

  /** Top adverse exclusion citation */
  primaryExclusionClause?: CandidateClauseMatch | null;

  /** Top conditional cap/limit citation */
  primaryLimitClause?: CandidateClauseMatch | null;

  /** Conflicting amendment or opposing clause citations */
  conflictingClauses: CandidateClauseMatch[];

  /** Flag indicating whether manual human review is required */
  manualReviewRequired: boolean;

  /** Specific reasons triggering review */
  reviewReasons: string[];

  /** Summary narrative explaining the verification outcome */
  verificationSummary: string;
}

export interface MultiChannelRetrievalResult {
  /** Original query evaluated */
  query: ClauseRetrievalQuery;

  /** Retrieval method used */
  retrievalMethod: RetrievalMethod;

  /** Supportive clauses found (coverage, benefits) */
  supportiveClauses: CandidateClauseMatch[];

  /** Adverse exclusion clauses found (unconditionally excluded, non-payable items) */
  exclusionClauses: CandidateClauseMatch[];

  /** Conditional limit clauses (room rent caps, ICU caps, copay, sublimits) */
  limitClauses: CandidateClauseMatch[];

  /** Conflicting or superseded clauses across versions */
  conflictingClauses: CandidateClauseMatch[];

  /** Consolidated verification contract decision */
  verification: EvidenceVerificationDecision;

  /** Candidate evaluation audit trace */
  auditNotes: string[];

  /** Retrieval execution latency in milliseconds */
  latencyMs: number;
}
