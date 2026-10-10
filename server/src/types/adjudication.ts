import {
  MoneyMinor,
  ClaimLineItem,
  BillDocument,
  StandardChargeCategory,
  DeductionScope,
  ClaimAdjustmentRecord,
  ItemAdjudicationStage,
  ClaimLedger,
  ClaimAssessmentState,
  ClaimReviewStatus,
  ClaimStatus
} from './claim.js';
import { PolicyDocument, RoomOrIcuLimit } from './policy.js';
import { PolicyVersionRecord, PolicyApplicabilityResult } from './policyVersion.js';
import { BillItemVerificationResult, EvidenceOutcome, VerifiedClauseCitation } from './verification.js';
import { NetworkStatus, RoomCategory } from './hospital.js';

// ============================================================================
// Calculation Trace & Audit Records
// ============================================================================

export type TraceOperationType =
  | 'BILL_INPUT_VALIDATION'
  | 'STATUTORY_EXCLUSION_CHECK'
  | 'CONTRACTUAL_EXCLUSION_CHECK'
  | 'ROOM_RENT_CAP_EVALUATION'
  | 'ITEM_SUBLIMIT_EVALUATION'
  | 'PROPORTIONATE_DEDUCTION_EVALUATION'
  | 'AGGREGATE_DEDUCTIBLE_APPLICATION'
  | 'COPAYMENT_APPLICATION'
  | 'SUM_INSURED_CAP_ENFORCEMENT'
  | 'MATHEMATICAL_BALANCE_AUDIT';

export interface CalculationTraceStep {
  /** Sequential operation index (1-based) */
  stepNumber: number;

  /** Operation category */
  operation: TraceOperationType;

  /** Target item ID or 'CLAIM_LEVEL' */
  target: string;

  /** Policy rule or clause identifier cited */
  ruleOrClauseId?: string | null;

  /** Input monetary base in integer paise */
  inputBasePaise: MoneyMinor;

  /** Human-readable formula applied */
  formulaApplied: string;

  /** Adjustment / deduction calculated in integer paise */
  adjustmentAmountPaise: MoneyMinor;

  /** Output monetary amount in integer paise */
  outputAmountPaise: MoneyMinor;

  /** Rounding rule used (strictly integer minor unit rounding) */
  roundingRule: 'INTEGER_PAISE_ROUND_NEAREST';

  /** Reason or contractual condition triggering this operation */
  justification: string;

  /** Policy excerpt or evidence excerpt supporting this operation */
  sourceEvidenceExcerpt?: string | null;

  /** Flag if this operation relied on any assumption or triggered review */
  reviewFlagTriggered?: string | null;
}

export interface CalculationTrace {
  /** Unique trace session identifier */
  traceId: string;

  /** Assessment timestamp */
  timestamp: string;

  /** Ordered sequence of calculation trace steps */
  steps: CalculationTraceStep[];

  /** Total elapsed calculation time in microseconds */
  executionTimeUs: number;

  /** Invariant verification result */
  invariantsVerified: boolean;
}

// ============================================================================
// Itemized Ledger Entry (Detailed Line Item Output)
// ============================================================================

export interface ItemizedLedgerEntry {
  /** Stable bill item identifier */
  itemId: string;

  /** Original item description from hospital bill */
  originalDescription: string;

  /** Standardized charge category */
  category: StandardChargeCategory;

  /** Billed quantity */
  quantity: number;

  /** Unit price in integer paise */
  unitPricePaise: MoneyMinor;

  /** Original claimed amount in integer paise */
  claimedAmountPaise: MoneyMinor;

  /** Evidence verification outcome from Prompt 4 */
  evidenceStatus: EvidenceOutcome;

  /** Applicable policy version ID */
  policyVersionId?: string | null;

  /** Controlling policy clause ID cited */
  controllingClauseId?: string | null;

  /** Controlling policy clause excerpt */
  controllingClauseExcerpt?: string | null;

  /** Item-specific excluded / non-payable amount in integer paise */
  excludedNonPayablePaise: MoneyMinor;

  /** Admissible amount before proportionate & claim adjustments */
  admissibleBeforeClaimAdjustmentsPaise: MoneyMinor;

  /** Item-specific sublimit deduction in integer paise */
  sublimitDisallowancePaise: MoneyMinor;

  /** Room rent proportionate deduction allocated to this item in integer paise */
  proportionateDisallowancePaise: MoneyMinor;

  /** Allocated claim-level deductible share in integer paise */
  allocatedDeductiblePaise: MoneyMinor;

  /** Allocated claim-level co-pay share in integer paise */
  allocatedCopayPaise: MoneyMinor;

  /** Allocated sum-insured cap excess in integer paise */
  allocatedSumInsuredExcessPaise: MoneyMinor;

  /** Potentially insurer-payable amount for this item in integer paise */
  insurerPayablePaise: MoneyMinor;

  /** Estimated patient responsibility (out-of-pocket) for this item in integer paise */
  patientResponsibilityPaise: MoneyMinor;

  /** Deductions specifically applied to this item */
  adjustments: ClaimAdjustmentRecord[];

  /** Flag indicating whether this item requires manual human review */
  reviewRequired: boolean;

  /** Specific review reasons for this item */
  reviewReasons: string[];
}

// ============================================================================
// Input Bill Reconciliation Report
// ============================================================================

export interface BillReconciliationIssue {
  itemId?: string;
  issueType:
    | 'GROSS_SUM_MISMATCH'
    | 'QUANTITY_PRICE_MISMATCH'
    | 'DUPLICATE_ITEM_ID'
    | 'ZERO_OR_NEGATIVE_PRICE'
    | 'INVALID_CURRENCY'
    | 'MISSING_MANDATORY_FIELD';
  message: string;
  severity: 'WARNING' | 'BLOCKING';
}

export interface BillReconciliationReport {
  /** Original stated gross total from invoice header in integer paise */
  statedGrossTotalPaise: MoneyMinor;

  /** Calculated sum of item claimed amounts in integer paise */
  calculatedItemsSumPaise: MoneyMinor;

  /** Difference in integer paise (stated - calculated) */
  discrepancyPaise: MoneyMinor;

  /** Whether bill itemization is fully reconciled */
  isReconciled: boolean;

  /** Issues discovered during reconciliation */
  issues: BillReconciliationIssue[];
}

// ============================================================================
// Claim Adjudication Request & Response Contracts
// ============================================================================

export interface ClaimFinancialRules {
  /** Sum Insured in integer paise */
  sumInsuredPaise?: MoneyMinor | null;

  /** Cumulative previous sum insured utilized in this policy year in integer paise */
  previousSiUtilizedPaise?: MoneyMinor | null;

  /** Whether previous sum insured utilization is known */
  isPreviousUtilizationKnown?: boolean;

  /** Daily room rent limit rule */
  roomLimit?: RoomOrIcuLimit | null;

  /** Whether policy supports proportionate deductions on room excess */
  proportionateDeductionSupported?: boolean | null;

  /** Policy aggregate deductible in integer paise */
  deductiblePaise?: MoneyMinor | null;

  /** Base network co-payment percentage (0-100) */
  copayPercentage?: number | null;

  /** Non-network co-payment percentage (0-100) */
  nonNetworkCopayPercentage?: number | null;

  /** Procedure/category specific sublimits in integer paise (e.g. { cataract: 4000000 }) */
  sublimitsPaise?: Record<string, MoneyMinor> | null;

  /** Hospital network status */
  networkStatus?: NetworkStatus;

  /** Billed hospital room category (e.g., 'Single Private Room', 'General Ward') */
  roomCategory?: RoomCategory;

  /** Number of days patient stayed in hospital */
  stayDays?: number;
}

export interface ClaimAdjudicationRequest {
  /** Unique claim request ID */
  requestId: string;

  /** Itemized hospital bill */
  bill: BillDocument;

  /** Date of treatment / admission (YYYY-MM-DD) */
  treatmentDate: string;

  /** Applicable policy version record */
  policyVersion?: PolicyVersionRecord | null;

  /** Policy document (if direct document provided) */
  policyDocument?: PolicyDocument | null;

  /** Pre-verified bill line item evidence results from Prompt 4 */
  verifiedItemEvidence?: BillItemVerificationResult[];

  /** Applicable financial calculation rules (inferred from policy if omitted) */
  financialRules?: ClaimFinancialRules;

  /** Optional previous assessment ID if this is a recomputation */
  priorAssessmentId?: string | null;
}

export interface ClaimAdjudicationResult {
  /** Unique assessment identifier */
  assessmentId: string;

  /** Request ID */
  requestId: string;

  /** Treatment date */
  treatmentDate: string;

  /** Applicable policy version ID */
  policyVersionId: string | null;

  /** Applicable amendment IDs */
  amendmentIds: string[];

  /** Bill reconciliation report */
  billReconciliation: BillReconciliationReport;

  /** Structured line-by-line itemized ledger */
  itemizedLedger: ItemizedLedgerEntry[];

  /** Complete claim financial ledger */
  ledger: ClaimLedger;

  /** Explicit chronological adjustment ledger preventing double deductions */
  adjustmentLedger: ClaimAdjustmentRecord[];

  /** Complete explainable calculation trace */
  trace: CalculationTrace;

  /** Overall claim status */
  claimStatus: ClaimStatus;

  /** Review status */
  reviewStatus: ClaimReviewStatus;

  /** List of unresolved review reasons */
  reviewReasons: string[];

  /** Whether human manual review is required */
  reviewRequired: boolean;

  /** Invariant audit verification report */
  invariants: {
    isMathematicallyBalanced: boolean;
    hasNegativePayable: boolean;
    hasDoubleDeductions: boolean;
    reconciledToBillTotal: boolean;
    auditPassed: boolean;
  };

  /** Timestamp of assessment */
  adjudicatedAt: string;
}

// ============================================================================
// Assessment History Record for Safe Recomputation
// ============================================================================

export interface AssessmentHistoryRecord {
  assessmentId: string;
  priorAssessmentId?: string | null;
  timestamp: string;
  changeReason?: string;
  result: ClaimAdjudicationResult;
}
