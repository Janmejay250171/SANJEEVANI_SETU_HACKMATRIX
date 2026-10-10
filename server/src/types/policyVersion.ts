import { PolicyDocument } from './policy.js';

export type PolicyDocumentType =
  | 'BASE_POLICY'
  | 'ENDORSEMENT'
  | 'AMENDMENT'
  | 'RENEWAL'
  | 'SCHEDULE_ATTACHMENT';

export type AmendmentScope =
  | 'SUPERSEDES_WHOLE'
  | 'MODIFIES_SPECIFIC_CLAUSES'
  | 'ADDS_BENEFIT'
  | 'RESTRICTS_COVERAGE'
  | 'RIDER'
  | 'UNSPECIFIED';

export type ClauseChangeType = 'ADDED' | 'MODIFIED' | 'REPLACED' | 'REVOKED';

export interface ClauseModification {
  clauseId: string;
  clauseTitle?: string;
  changeType: ClauseChangeType;
  targetPath?: string; // e.g., 'roomLimit.value' or 'copay'
  previousClauseText?: string | null;
  newClauseText: string;
  description: string;
}

export type ExtractionStatus = 'EXTRACTED' | 'PARTIAL' | 'UNRESOLVED' | 'VERIFIED';

/**
 * Historical and Versioned Policy Record.
 * Represents an individual contractual document in a policy family lineage.
 */
export interface PolicyVersionRecord {
  /** Stable family identifier linking base policy and all subsequent endorsements/renewals */
  familyId: string;

  /** Unique version record identifier (e.g., 'pol_star_fam1_v1.0') */
  versionId: string;

  /** Display version number (e.g., '1.0', '1.1') */
  versionNumber: string;

  /** Document type: Base contract, Endorsement, Amendment, Renewal */
  documentType: PolicyDocumentType;

  /** Immediate predecessor version ID if in an amendment lineage */
  parentVersionId?: string | null;

  /** Relationship scope to parent policy */
  amendmentScope?: AmendmentScope | null;

  /** Insurer and product identifiers when available */
  insurerId?: string | null;
  insurerName: string;
  planName: string;
  policyNumber?: string | null;
  uin?: string | null;

  /** Document identifiers */
  documentId: string;

  /** Contractual effective dates (Must NOT be confused with upload/extraction timestamps) */
  effectiveFrom: string | null; // ISO 8601 YYYY-MM-DD
  effectiveTo: string | null;   // ISO 8601 YYYY-MM-DD

  /** Document official issue date if stated */
  issueDate?: string | null;    // ISO 8601 YYYY-MM-DD

  /** Audit timestamps */
  uploadTimestamp: string;      // ISO 8601
  extractedTimestamp: string;   // ISO 8601

  /** Cryptographic content hash of the source document for tamper detection */
  contentHashSha256?: string | null;

  /** Reference to original document on storage/filesystem */
  rawTextRef?: string | null;

  /** Status of extraction and provenance */
  extractionStatus: ExtractionStatus;

  /** Specific clause deltas introduced by this version or amendment */
  clauseModifications: ClauseModification[];

  /** Structured policy terms (reusing existing PolicyDocument structure) */
  policyData: PolicyDocument;

  /** Version-selection status and unresolved questions recorded during audit */
  unresolvedQuestions: string[];
}

export type ApplicabilityStatus =
  | 'resolved'
  | 'ambiguous'
  | 'missing_policy'
  | 'missing_treatment_date'
  | 'conflicting_versions'
  | 'out_of_coverage_period'
  | 'review_required';

export interface ApplicabilityCandidateCheck {
  versionId: string;
  documentType: PolicyDocumentType;
  effectivePeriod: string;
  status: 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED' | 'UNDETERMINED';
  reason: string;
}

/**
 * Deterministic policy applicability evaluation outcome.
 */
export interface PolicyApplicabilityResult {
  /** High-level resolution status */
  status: ApplicabilityStatus;

  /** Query treatment date evaluated */
  treatmentDate: string | null;

  /** Policy family ID evaluated */
  familyId: string;

  /** Selected base policy version (if determinable) */
  selectedBaseVersion: PolicyVersionRecord | null;

  /** All valid, active endorsements/amendments in effect on the treatment date */
  applicableAmendments: PolicyVersionRecord[];

  /** Consolidated policy rules after applying amendments in contractual precedence */
  mergedPolicySnapshot: PolicyDocument | null;

  /** Full audit trail of candidate versions evaluated, accepted, or rejected */
  candidateChecks: ApplicabilityCandidateCheck[];

  /** Flag indicating whether human review is mandatory before adjudication */
  reviewRequired: boolean;

  /** Specific reasons triggering review */
  reviewReasons: string[];

  /** Human-readable audit narrative */
  explanation: string;
}
