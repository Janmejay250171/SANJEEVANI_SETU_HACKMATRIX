import { StandardChargeCategory } from './claim.js';
import { ClauseType, CandidateClauseMatch, MultiChannelRetrievalResult } from './retrieval.js';

// ============================================================================
// Verification Outcomes & Precedence Roles
// ============================================================================

export type EvidenceOutcome =
  | 'supported'
  | 'excluded'
  | 'conditional'
  | 'ambiguous'
  | 'conflicting'
  | 'insufficient_evidence'
  | 'review_required';

export type PrecedenceRole =
  | 'CONTROLLING'          // The primary authoritative clause governing this item
  | 'SECONDARY'            // Supplementary general clause subservient to a specific rule
  | 'SUPERSEDED'           // Historical base clause overridden by an active amendment
  | 'UNRESOLVED'           // Clause in conflict where precedence cannot be deterministically proved
  | 'EXCEPTION_APPLIED'    // Exception restoring coverage over a general exclusion
  | 'NOT_APPLICABLE';      // Clause retrieved but inapplicable to this specific clinical charge

export type VerificationConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';

/**
 * Verified clause citation referencing genuine source document evidence.
 */
export interface VerifiedClauseCitation {
  /** Stable clause ID from index */
  clauseId: string;

  /** Associated policy version */
  versionId: string;

  /** Associated document ID */
  documentId: string;

  /** Clause heading or title */
  heading: string;

  /** Section heading / numbering */
  section: string;

  /** Verbatim excerpt from policy contract */
  exactExcerpt: string;

  /** Page number in source document (1-indexed) */
  pageNumber: number | null;

  /** Clause type (coverage, exclusion, limit, etc.) */
  clauseType: ClauseType;

  /** Precedence role in the adjudication decision */
  precedenceRole: PrecedenceRole;

  /** Reason why this clause holds this precedence role */
  precedenceReason: string;

  /** Raw retrieval score from Prompt 3 retrieval */
  retrievalScore: number;

  /** Whether source citation was strictly verified against indexed documents */
  citationVerified: boolean;

  /** Effective from date (YYYY-MM-DD) */
  effectiveFrom?: string | null;

  /** Effective to date (YYYY-MM-DD) */
  effectiveTo?: string | null;
}

// ============================================================================
// Verification Context & Result Structures
// ============================================================================

export interface BillItemVerificationContext {
  /** Unique bill line item ID */
  billItemId: string;

  /** Original verbatim description from invoice */
  originalDescription: string;

  /** Normalized clinical or billing description, if available */
  normalizedDescription?: string | null;

  /** Assigned standard category */
  category: StandardChargeCategory;

  /** Claimed amount in minor units (paise) */
  claimedAmountPaise: number;

  /** Clinical diagnosis or reason for admission (e.g. 'Accidental injury', 'Cataract') */
  clinicalDiagnosis?: string | null;

  /** Room tariff per day billed (for room capping evaluation) */
  billedRoomTariffPaise?: number | null;

  /** Hospital admission or treatment date (YYYY-MM-DD) */
  treatmentDate: string;

  /** Policy family identifier */
  familyId: string;

  /** Pre-retrieved evidence from Prompt 3 */
  retrievedEvidence: MultiChannelRetrievalResult;
}

export interface BillItemVerificationResult {
  /** Target bill item ID */
  billItemId: string;

  /** Proposed interpretation of the bill item under policy terms */
  proposedInterpretation: string;

  /** High-level evidence verification outcome */
  outcome: EvidenceOutcome;

  /** Controlling or supporting clauses */
  supportingEvidence: VerifiedClauseCitation[];

  /** Adverse exclusion clauses (contractual or statutory) */
  adverseExclusionEvidence: VerifiedClauseCitation[];

  /** Conflicting or superseded clauses across versions */
  conflictingEvidence: VerifiedClauseCitation[];

  /** Active conditions or limitations (e.g. room rent daily limit, sublimit cap) */
  conditionalRequirements: string[];

  /** Crucial missing facts required to confirm coverage or exceptions */
  missingFacts: string[];

  /** Whether manual human review is required before adjudication */
  reviewRequired: boolean;

  /** Specific auditable reasons triggering review */
  reviewReasons: string[];

  /** Confidence assessment */
  confidence: {
    level: VerificationConfidence;
    explanation: string;
    calibratedScore?: number | null;
  };

  /** Evidence-grounded audit narrative */
  explanation: string;

  /** True if all citations were strictly verified against indexed source evidence */
  citationIntegrityVerified: boolean;

  /** Audit log of candidate checks and precedence decisions */
  auditTrace: string[];
}
