import { PolicyDocument } from './policy.js';
import { PolicyVersionRecord } from './policyVersion.js';

/**
 * ============================================================================
 * Safe Financial Minor Currency Units (Paise)
 * ============================================================================
 * In Indian Rupee (INR) health claims, 1 INR = 100 paise.
 * All internal authoritative financial calculation, comparison, sublimit checks,
 * and ledgers MUST use integer paise (MoneyMinor) to eliminate IEEE 754
 * binary floating-point rounding errors.
 */

/** Integer amount in minor currency units (paise for INR). 1 INR = 100 paise. */
export type MoneyMinor = number;

/**
 * Converts a rupee decimal amount (e.g. 1500.50) safely to integer paise (150050).
 */
export function rupeesToPaise(rupees: number | null | undefined): MoneyMinor {
  if (rupees === null || rupees === undefined || isNaN(rupees)) {
    return 0;
  }
  return Math.round(rupees * 100);
}

/**
 * Converts integer paise back to standard rupee decimal number.
 */
export function paiseToRupees(paise: MoneyMinor): number {
  if (!Number.isFinite(paise)) return 0;
  return paise / 100;
}

/**
 * Formats integer paise as formatted Indian Rupee string (e.g., "₹1,500.50").
 */
export function formatPaise(paise: MoneyMinor, includeSymbol: boolean = true): string {
  const rupees = paiseToRupees(paise);
  const formatted = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return includeSymbol ? `₹${formatted}` : formatted;
}

/**
 * Safe integer multiplication with rounding for ratios/percentages in minor units.
 * e.g., applying a 10% copay on 500000 paise -> safeMultiplyRatio(500000, 10, 100) = 50000 paise.
 */
export function safeMultiplyRatio(
  amountPaise: MoneyMinor,
  numerator: number,
  denominator: number
): MoneyMinor {
  if (denominator === 0 || amountPaise === 0 || numerator === 0) return 0;
  return Math.round((amountPaise * numerator) / denominator);
}

// ============================================================================
// Standard Charge Categories (Aligned with IRDAI Master Guidelines)
// ============================================================================

export type StandardChargeCategory =
  | 'ROOM_RENT'                    // Room boarding and nursing charges
  | 'ICU_CHARGES'                 // Intensive care unit charges
  | 'NURSING'                     // General/special nursing care
  | 'SURGEON_CONSULTATION'        // Surgeon, anesthetist, doctor consultation fees
  | 'OT_CHARGES'                  // Operation theater, anesthesia equipment
  | 'INVESTIGATIONS_DIAGNOSTICS'  // Pathology, radiology, MRI, CT, blood tests
  | 'MEDICINES_PHARMACY'          // Formulations, IV fluids, prescribed drugs
  | 'CONSUMABLES_NON_PAYABLES'    // Gloves, PPE, sanitizers, administrative fees (IRDAI Non-Payable)
  | 'IMPLANT_PROSTHETICS'         // Stents, pacemakers, orthopedic implants
  | 'AMBULANCE'                   // Emergency patient road/air transport
  | 'DAYCARE_PACKAGE'             // Daycare package procedures (e.g. Chemotherapy, Dialysis)
  | 'MISCELLANEOUS';              // Unclassified or administrative hospital charges

// ============================================================================
// Bill Item and Itemized Ingestion
// ============================================================================

export type ClassificationStatus =
  | 'AUTOMATIC_EXACT'
  | 'AUTOMATIC_SEMANTIC'
  | 'HEURISTIC_RULE'
  | 'MANUAL_USER_OVERRIDE'
  | 'UNCLASSIFIED';

export type ProvenanceSource =
  | 'OCR_PDF_EXTRACTION'
  | 'CSV_IMPORT'
  | 'STRUCTURED_JSON_TEMPLATE'
  | 'MANUAL_ENTRY'
  | 'SYNTHETIC_BENCHMARK';

export interface ItemExtractionProvenance {
  sourceType: ProvenanceSource;
  pageNumber?: number | null;
  lineNumber?: number | null;
  boundingBox?: { x: number; y: number; width: number; height: number } | null;
  rawExtractedText: string;
  extractedTimestamp: string;
  confidenceScore: number; // 0.0 to 1.0
}

/**
 * Itemized Hospital Bill Line Item.
 * Represents a single charge in an itemized hospital invoice.
 */
export interface ClaimLineItem {
  /** Stable item identifier within the bill (e.g., 'item_01', 'item_ot_03') */
  itemId: string;

  /** Original verbatim description from hospital invoice */
  originalDescription: string;

  /** Standardized clinical/billing term, if resolved */
  normalizedDescription?: string | null;

  /** Assigned standard category */
  category: StandardChargeCategory;

  /** Billed quantity (default 1) */
  quantity: number;

  /** Unit price in integer paise */
  unitPricePaise: MoneyMinor;

  /** Total claimed amount for this line in integer paise (quantity * unitPricePaise) */
  claimedAmountPaise: MoneyMinor;

  /** Currency code (strictly 'INR' for Indian domestic policies) */
  currency: 'INR';

  /** Extraction and document source location */
  provenance: ItemExtractionProvenance;

  /** Classification status and categorization confidence */
  classificationStatus: ClassificationStatus;

  /** Review flags flagged during validation (e.g., non-payable consumable, rate above GIPSA) */
  reviewFlags: string[];

  /** True if this item matches standard non-payable schedule items (gloves, admission fees, etc.) */
  isNonPayableByRegulation: boolean;
}

// ============================================================================
// Bill Document & Reconciliation
// ============================================================================

export type BillReconciliationStatus =
  | 'RECONCILED'         // Sum of line items exactly matches originalBillTotal
  | 'DISCREPANCY'        // Sum of line items does not equal originalBillTotal
  | 'PENDING_REVIEW'     // Line items incomplete or missing
  | 'ESTIMATED';         // Synthetic or macro-only bill estimation

export interface BillDocument {
  /** Stable unique identifier for the bill (e.g., 'bill_hosp_apollo_99182') */
  billId: string;

  /** Hospital or provider name */
  hospitalName: string;

  /** Source document reference (e.g., PDF filename or storage key) */
  sourceDocumentRef?: string | null;

  /** SHA-256 hash of the source invoice file */
  contentHashSha256?: string | null;

  /** Official bill issue date (ISO 8601 YYYY-MM-DD) */
  billDate: string | null;

  /** Patient admission date (ISO 8601 YYYY-MM-DD) */
  admissionDate: string | null;

  /** Patient discharge date (ISO 8601 YYYY-MM-DD) */
  dischargeDate: string | null;

  /** Original stated bill gross total in integer paise */
  originalBillTotalPaise: MoneyMinor;

  /** Calculated sum of itemized line items in integer paise */
  calculatedItemsTotalPaise: MoneyMinor;

  /** Discrepancy between stated gross total and sum of items in integer paise */
  reconciliationDifferencePaise: MoneyMinor;

  /** Bill reconciliation status */
  reconciliationStatus: BillReconciliationStatus;

  /** Currency (strictly 'INR') */
  currency: 'INR';

  /** Array of itemized line items */
  lineItems: ClaimLineItem[];

  /** Upload and extraction audit timestamps */
  uploadedAt: string;
  extractedAt: string;
}

// ============================================================================
// Evidence Reference & Provenance
// ============================================================================

export type EvidenceType =
  | 'CONTRACT_CLAUSE'       // Verbatim policy clause from base contract or endorsement
  | 'EXCLUSION_LIST'        // Standard policy exclusion or IRDAI Annexure 1
  | 'SUBLIMIT_RULE'         // Specific disease/procedure cap
  | 'STATUTORY_REGULATION'  // IRDAI Master Circular guideline
  | 'NETWORK_AGREEMENT'     // Hospital cashless tariff card / GIPSA PPN schedule
  | 'BILL_LINE_EVIDENCE';   // Invoice item description

export interface EvidenceReference {
  /** Unique evidence reference identifier */
  evidenceId: string;

  /** Document identifier where evidence resides */
  documentId: string;

  /** Specific version ID of policy/document containing the evidence */
  versionId: string;

  /** Clause identifier if applicable (e.g., 'cl_3.2_room_rent') */
  clauseId?: string | null;

  /** Clause or section title */
  clauseTitle?: string | null;

  /** Exact verbatim excerpt or quotation from contractual wording */
  supportingExcerpt: string;

  /** Page number in document where evidence was found */
  pageNumber?: number | null;

  /** Section or clause heading */
  sectionReference?: string | null;

  /** Category of evidence */
  evidenceType: EvidenceType;

  /** Verification status */
  verificationStatus: 'VERIFIED_GROUND_TRUTH' | 'AUTOMATICALLY_EXTRACTED' | 'UNRESOLVED' | 'DISPUTED';

  /** Confidence score (0.0 to 1.0) */
  confidenceScore: number;
}

// ============================================================================
// Ledger Data Structures & Deduction Scopes
// ============================================================================

/**
 * Explicit scopes preventing the same adjustment from being double-deducted
 * or applied across conflicting calculation hierarchies.
 */
export type DeductionScope =
  | 'ITEM_LEVEL_EXCLUSION'        // Non-payable item (gloves, admin charges)
  | 'ROOM_RENT_PROPORTIONATE'     // Disallowance on associated medical charges due to room capping
  | 'CATEGORY_SUBLIMIT'          // Procedure or category ceiling (e.g. Cataract ₹40k cap)
  | 'CLAIM_DEDUCTIBLE'           // Policy aggregate deductible applied to admissible total
  | 'CLAIM_COPAY'                // Co-payment percentage applied after deductible
  | 'SUM_INSURED_CAP';           // Final cap if approved amount exceeds remaining sum insured

export interface ClaimAdjustmentRecord {
  /** Stable identifier for this specific deduction record */
  adjustmentId: string;

  /** Target item ID (if item-level) or null (if claim-wide) */
  targetItemId?: string | null;

  /** Scope of adjustment */
  scope: DeductionScope;

  /** Human-readable explanation of deduction */
  description: string;

  /** Pre-adjustment base amount in integer paise */
  baseAmountPaise: MoneyMinor;

  /** Deduction amount in integer paise */
  deductionAmountPaise: MoneyMinor;

  /** Post-adjustment remaining admissible amount in integer paise */
  remainingAmountPaise: MoneyMinor;

  /** Associated evidence reference */
  evidence?: EvidenceReference | null;

  /** Specific policy clause ID cited */
  clauseReference?: string | null;

  /** Reason code for auditing */
  reasonCode: string;

  /** Audit explanation if deduction has uncertainty */
  uncertaintyReason?: string | null;

  /** Whether this deduction requires human review */
  reviewRequired: boolean;
}

/**
 * Itemized Adjudication Stage Record for each line item.
 * Strictly separates original claimed amount from deductions.
 */
export interface ItemAdjudicationStage {
  itemId: string;
  category: StandardChargeCategory;

  /** Step 0: Original claimed amount */
  originalClaimedPaise: MoneyMinor;

  /** Step 1: Direct non-payable or excluded deductions */
  excludedNonPayablePaise: MoneyMinor;

  /** Step 2: Post-exclusion admissible base */
  admissibleAfterExclusionPaise: MoneyMinor;

  /** Step 3: Room rent proportionate deduction (if applicable) */
  proportionateDisallowancePaise: MoneyMinor;

  /** Step 4: Category/Procedure sublimit deduction (if applicable) */
  sublimitDisallowancePaise: MoneyMinor;

  /** Step 5: Final item-level approved amount */
  finalItemApprovedPaise: MoneyMinor;

  /** Specific adjustments applied to this line item */
  adjustments: ClaimAdjustmentRecord[];

  /** Cited evidence references */
  evidenceReferences: EvidenceReference[];
}

/**
 * Complete Claim Audit Ledger.
 * Enforces the fundamental invariant:
 * Total Claimed = Total Insurer Payable + Total Patient Responsibility + Total Disallowed Uncovered
 */
export interface ClaimLedger {
  /** Currency */
  currency: 'INR';

  /** Itemized line-by-line adjudication stages */
  itemStages: ItemAdjudicationStage[];

  /** Claim-wide adjustments (deductibles, co-pays, sum-insured caps) */
  claimAdjustments: ClaimAdjustmentRecord[];

  // Macro Totals in Integer Paise:
  totalClaimedPaise: MoneyMinor;
  totalExcludedNonPayablePaise: MoneyMinor;
  totalProportionateDisallowancePaise: MoneyMinor;
  totalSublimitDisallowancePaise: MoneyMinor;
  
  /** Total admissible medical expenses before claim-level deductible & copay */
  totalAdmissibleBeforeDeductiblePaise: MoneyMinor;

  /** Claim-level deductible deducted from admissible expenses */
  appliedDeductiblePaise: MoneyMinor;

  /** Admissible amount remaining after deductible */
  admissibleAfterDeductiblePaise: MoneyMinor;

  /** Co-payment amount deducted */
  appliedCopayPaise: MoneyMinor;

  /** Approved amount before sum insured cap */
  approvedBeforeSumInsuredCapPaise: MoneyMinor;

  /** Sum insured cap disallowance (if approved exceeds available SI) */
  sumInsuredCapDisallowancePaise: MoneyMinor;

  /** Final amount payable by insurer */
  finalInsurerPayablePaise: MoneyMinor;

  /** Total amount payable by patient (Out-of-Pocket) */
  totalPatientResponsibilityPaise: MoneyMinor;

  /** Invariant check: Math validation flag */
  isMathematicallyBalanced: boolean;
}

// ============================================================================
// Claim Assessment State
// ============================================================================

export type ClaimStatus =
  | 'DRAFT'
  | 'DOCUMENTS_INGESTED'
  | 'POLICY_RESOLVED'
  | 'ADJUDICATED'
  | 'PENDING_HUMAN_REVIEW'
  | 'SETTLED'
  | 'DISPUTED';

export type ClaimReviewStatus =
  | 'NOT_REQUIRED'
  | 'REQUIRED_AMBIGUOUS_POLICY'
  | 'REQUIRED_CONFLICTING_VERSIONS'
  | 'REQUIRED_UNRECONCILED_BILL'
  | 'REQUIRED_HIGH_VALUE_DISALLOWANCE'
  | 'MANUALLY_REVIEWED'
  | 'APPROVED';

export interface ClaimAssessmentState {
  /** Unique claim identifier (e.g., 'clm_98218_2026') */
  claimId: string;

  /** Reference to policy family */
  policyFamilyId: string;

  /** Selected policy version ID */
  selectedPolicyVersionId: string | null;

  /** Applicable amendment IDs applied to this claim */
  applicableAmendmentIds: string[];

  /** Treatment date (ISO 8601 YYYY-MM-DD) */
  treatmentDate: string | null;

  /** Associated bill document */
  bill: BillDocument;

  /** Overall claim status */
  status: ClaimStatus;

  /** Human review status */
  reviewStatus: ClaimReviewStatus;

  /** List of explicit reasons triggering review */
  reviewReasons: string[];

  /** Complete calculation ledger (null if not yet adjudicated) */
  ledger: ClaimLedger | null;

  /** Audit trace identifier for tracking calculation provenance */
  traceId: string;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}
