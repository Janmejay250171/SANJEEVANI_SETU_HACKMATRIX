import { z } from 'zod';
import {
  MoneyMinor,
  ClaimLineItem,
  BillDocument,
  StandardChargeCategory,
  BillReconciliationStatus,
  ClaimAssessmentState,
  ClaimReviewStatus,
  ClaimStatus
} from './claim.js';
import { PolicyDocument, RoomOrIcuLimit } from './policy.js';
import {
  PolicyVersionRecord,
  AmendmentScope,
  ClauseModification
} from './policyVersion.js';
import { ClaimFinancialRules, ClaimAdjudicationResult, ItemizedLedgerEntry } from './adjudication.js';

// ============================================================================
// Standard Charge Category Enum for Zod
// ============================================================================

export const StandardChargeCategoryZod = z.enum([
  'ROOM_RENT',
  'ICU_CHARGES',
  'NURSING',
  'SURGEON_CONSULTATION',
  'OT_CHARGES',
  'INVESTIGATIONS_DIAGNOSTICS',
  'MEDICINES_PHARMACY',
  'CONSUMABLES_NON_PAYABLES',
  'IMPLANT_PROSTHETICS',
  'AMBULANCE',
  'DAYCARE_PACKAGE',
  'MISCELLANEOUS'
]);

// ============================================================================
// Bill Upload & Extraction Contracts
// ============================================================================

export interface BillUploadResponse {
  billId: string;
  hospitalName: string;
  sourceDocumentRef: string | null;
  billDate: string | null;
  admissionDate: string | null;
  dischargeDate: string | null;
  originalBillTotalPaise: MoneyMinor;
  calculatedItemsTotalPaise: MoneyMinor;
  reconciliationDifferencePaise: MoneyMinor;
  reconciliationStatus: BillReconciliationStatus;
  lineItems: ClaimLineItem[];
  extractionWarnings: string[];
  isExtractionComplete: boolean;
}

// ============================================================================
// Create Claim Assessment Request Schema
// ============================================================================

export const CreateClaimRequestSchema = z.object({
  claimId: z.string().optional(),
  policyFamilyId: z.string().min(1, 'Policy family ID is required'),
  policyId: z.string().optional().nullable(),
  treatmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Treatment date must be in YYYY-MM-DD format'),
  bill: z.object({
    billId: z.string(),
    hospitalName: z.string(),
    sourceDocumentRef: z.string().optional().nullable(),
    contentHashSha256: z.string().optional().nullable(),
    billDate: z.string().nullable().optional(),
    admissionDate: z.string().nullable().optional(),
    dischargeDate: z.string().nullable().optional(),
    originalBillTotalPaise: z.number().int(),
    calculatedItemsTotalPaise: z.number().int(),
    reconciliationDifferencePaise: z.number().int(),
    reconciliationStatus: z.enum(['RECONCILED', 'DISCREPANCY', 'PENDING_REVIEW', 'ESTIMATED']),
    currency: z.literal('INR'),
    lineItems: z.array(z.any()),
    uploadedAt: z.string(),
    extractedAt: z.string()
  }),
  financialRules: z.object({
    sumInsuredPaise: z.number().int().optional().nullable(),
    previousSiUtilizedPaise: z.number().int().optional().nullable(),
    isPreviousUtilizationKnown: z.boolean().optional(),
    roomLimit: z.any().optional().nullable(),
    proportionateDeductionSupported: z.boolean().optional().nullable(),
    deductiblePaise: z.number().int().optional().nullable(),
    copayPercentage: z.number().min(0).max(100).optional().nullable(),
    nonNetworkCopayPercentage: z.number().min(0).max(100).optional().nullable(),
    sublimitsPaise: z.record(z.number().int()).optional().nullable(),
    networkStatus: z.enum(['verified', 'no_match', 'unverified']).optional(),
    roomCategory: z.string().optional() as any,
    stayDays: z.number().int().optional()
  }).optional(),
  clientRequestId: z.string().optional()
});

export type CreateClaimRequest = z.infer<typeof CreateClaimRequestSchema>;

// ============================================================================
// Update / Correct Bill Item Request Schema
// ============================================================================

export const UpdateBillItemRequestSchema = z.object({
  originalDescription: z.string().min(1).optional(),
  category: StandardChargeCategoryZod.optional(),
  quantity: z.number().positive('Quantity must be greater than zero').optional(),
  unitPricePaise: z.number().nonnegative('Unit price cannot be negative').int().optional(),
  claimedAmountPaise: z.number().nonnegative('Claimed amount cannot be negative').int().optional(),
  isNonPayableByRegulation: z.boolean().optional(),
  correctionReason: z.string().min(1, 'Correction reason is mandatory for auditable provenance')
});

export type UpdateBillItemRequest = z.infer<typeof UpdateBillItemRequestSchema>;

// ============================================================================
// Register Policy Amendment Request Schema
// ============================================================================

export const RegisterAmendmentRequestSchema = z.object({
  amendmentId: z.string().min(1, 'Amendment ID is required'),
  versionNumber: z.string().min(1, 'Version number is required'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveFrom must be YYYY-MM-DD'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveTo must be YYYY-MM-DD').optional().nullable(),
  amendmentScope: z.enum([
    'SUPERSEDES_WHOLE',
    'MODIFIES_SPECIFIC_CLAUSES',
    'ADDS_BENEFIT',
    'RESTRICTS_COVERAGE',
    'RIDER',
    'UNSPECIFIED'
  ]).optional().nullable(),
  clauseModifications: z.array(z.object({
    clauseId: z.string(),
    clauseTitle: z.string().optional(),
    changeType: z.enum(['ADDED', 'MODIFIED', 'REPLACED', 'REVOKED']),
    targetPath: z.string().optional(),
    previousClauseText: z.string().optional().nullable(),
    newClauseText: z.string(),
    description: z.string()
  })),
  policyDataUpdates: z.record(z.any()).optional()
});

export type RegisterAmendmentRequest = z.infer<typeof RegisterAmendmentRequestSchema>;

// ============================================================================
// Reassess Claim Request Schema
// ============================================================================

export const ReassessClaimRequestSchema = z.object({
  treatmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Treatment date must be in YYYY-MM-DD format').optional(),
  policyVersionId: z.string().optional().nullable(),
  financialRules: z.any().optional(),
  reassessmentReason: z.string().min(1, 'Reassessment reason is required for audit provenance')
});

export type ReassessClaimRequest = z.infer<typeof ReassessClaimRequestSchema>;

// ============================================================================
// Assessment Comparison Result
// ============================================================================

export interface LineItemComparisonDiff {
  itemId: string;
  description: string;
  priorClaimedPaise: MoneyMinor;
  currentClaimedPaise: MoneyMinor;
  priorInsurerPayablePaise: MoneyMinor;
  currentInsurerPayablePaise: MoneyMinor;
  priorPatientResponsibilityPaise: MoneyMinor;
  currentPatientResponsibilityPaise: MoneyMinor;
  differenceSummary: string;
}

export interface AssessmentComparisonResult {
  claimId: string;
  priorAssessmentId: string;
  currentAssessmentId: string;
  comparedAt: string;
  treatmentDateChanged: boolean;
  priorTreatmentDate: string | null;
  currentTreatmentDate: string | null;
  policyVersionChanged: boolean;
  priorPolicyVersionId: string | null;
  currentPolicyVersionId: string | null;
  
  // Financial Deltas (Current - Prior)
  totalClaimedDeltaPaise: MoneyMinor;
  insurerPayableDeltaPaise: MoneyMinor;
  patientResponsibilityDeltaPaise: MoneyMinor;
  excludedNonPayableDeltaPaise: MoneyMinor;
  proportionateDisallowanceDeltaPaise: MoneyMinor;
  sublimitDisallowanceDeltaPaise: MoneyMinor;
  deductibleDeltaPaise: MoneyMinor;
  copayDeltaPaise: MoneyMinor;

  // Macro before/after
  priorSummary: {
    claimedPaise: MoneyMinor;
    insurerPayablePaise: MoneyMinor;
    patientResponsibilityPaise: MoneyMinor;
    reviewRequired: boolean;
  };
  currentSummary: {
    claimedPaise: MoneyMinor;
    insurerPayablePaise: MoneyMinor;
    patientResponsibilityPaise: MoneyMinor;
    reviewRequired: boolean;
  };

  // Line item level diffs
  lineItemDiffs: LineItemComparisonDiff[];

  // Review changes
  reviewStatusChanged: boolean;
  priorReviewStatus: ClaimReviewStatus;
  currentReviewStatus: ClaimReviewStatus;
  newReviewReasons: string[];
  resolvedReviewReasons: string[];

  // Audit explanation
  changeSummary: string;
}
