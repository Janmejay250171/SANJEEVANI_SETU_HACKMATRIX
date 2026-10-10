import { z } from 'zod';
import { ExtractedPolicyZod } from './policySchema.js';

// ============================================================================
// ISO Date String Validator (YYYY-MM-DD)
// ============================================================================

export const IsoDateStringZod = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD');

export const NullableIsoDateStringZod = IsoDateStringZod.nullable().optional();

// ============================================================================
// Policy Version Zod Schemas
// ============================================================================

export const PolicyDocumentTypeZod = z.enum([
  'BASE_POLICY',
  'ENDORSEMENT',
  'AMENDMENT',
  'RENEWAL',
  'SCHEDULE_ATTACHMENT'
]);

export const AmendmentScopeZod = z.enum([
  'SUPERSEDES_WHOLE',
  'MODIFIES_SPECIFIC_CLAUSES',
  'ADDS_BENEFIT',
  'RESTRICTS_COVERAGE',
  'RIDER',
  'UNSPECIFIED'
]);

export const ClauseChangeTypeZod = z.enum(['ADDED', 'MODIFIED', 'REPLACED', 'REVOKED']);

export const ClauseModificationZod = z.object({
  clauseId: z.string().min(1, 'Clause ID is required'),
  clauseTitle: z.string().optional(),
  changeType: ClauseChangeTypeZod,
  targetPath: z.string().optional(),
  previousClauseText: z.string().nullable().optional(),
  newClauseText: z.string().min(1, 'New clause text is required'),
  description: z.string().min(1, 'Description is required')
});

export const ExtractionStatusZod = z.enum(['EXTRACTED', 'PARTIAL', 'UNRESOLVED', 'VERIFIED']);

export const PolicyVersionRecordZod = z.object({
  familyId: z.string().min(1, 'Family ID is required'),
  versionId: z.string().min(1, 'Version ID is required'),
  versionNumber: z.string().min(1, 'Version number is required'),
  documentType: PolicyDocumentTypeZod,
  parentVersionId: z.string().nullable().optional(),
  amendmentScope: AmendmentScopeZod.nullable().optional(),
  insurerId: z.string().nullable().optional(),
  insurerName: z.string().min(1, 'Insurer name is required'),
  planName: z.string().min(1, 'Plan name is required'),
  policyNumber: z.string().nullable().optional(),
  uin: z.string().nullable().optional(),
  documentId: z.string().min(1, 'Document ID is required'),
  effectiveFrom: NullableIsoDateStringZod,
  effectiveTo: NullableIsoDateStringZod,
  issueDate: NullableIsoDateStringZod,
  uploadTimestamp: z.string().min(1, 'Upload timestamp is required'),
  extractedTimestamp: z.string().min(1, 'Extracted timestamp is required'),
  contentHashSha256: z.string().nullable().optional(),
  rawTextRef: z.string().nullable().optional(),
  extractionStatus: ExtractionStatusZod,
  clauseModifications: z.array(ClauseModificationZod).default([]),
  policyData: ExtractedPolicyZod.passthrough(),
  unresolvedQuestions: z.array(z.string()).default([])
});

// ============================================================================
// Claim & Bill Item Zod Schemas
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

export const ClassificationStatusZod = z.enum([
  'AUTOMATIC_EXACT',
  'AUTOMATIC_SEMANTIC',
  'HEURISTIC_RULE',
  'MANUAL_USER_OVERRIDE',
  'UNCLASSIFIED'
]);

export const ProvenanceSourceZod = z.enum([
  'OCR_PDF_EXTRACTION',
  'CSV_IMPORT',
  'STRUCTURED_JSON_TEMPLATE',
  'MANUAL_ENTRY',
  'SYNTHETIC_BENCHMARK'
]);

export const ItemExtractionProvenanceZod = z.object({
  sourceType: ProvenanceSourceZod,
  pageNumber: z.number().int().positive().nullable().optional(),
  lineNumber: z.number().int().positive().nullable().optional(),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    })
    .nullable()
    .optional(),
  rawExtractedText: z.string(),
  extractedTimestamp: z.string(),
  confidenceScore: z.number().min(0).max(1)
});

export const ClaimLineItemZod = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  originalDescription: z.string().min(1, 'Original description cannot be empty'),
  normalizedDescription: z.string().nullable().optional(),
  category: StandardChargeCategoryZod,
  quantity: z.number().positive('Quantity must be greater than zero').default(1),
  unitPricePaise: z.number().int().nonnegative('Unit price in paise must be non-negative integer'),
  claimedAmountPaise: z.number().int().nonnegative('Claimed amount in paise must be non-negative integer'),
  currency: z.literal('INR'),
  provenance: ItemExtractionProvenanceZod,
  classificationStatus: ClassificationStatusZod,
  reviewFlags: z.array(z.string()).default([]),
  isNonPayableByRegulation: z.boolean().default(false)
});

export const BillReconciliationStatusZod = z.enum([
  'RECONCILED',
  'DISCREPANCY',
  'PENDING_REVIEW',
  'ESTIMATED'
]);

export const BillDocumentZod = z.object({
  billId: z.string().min(1, 'Bill ID is required'),
  hospitalName: z.string().min(1, 'Hospital name is required'),
  sourceDocumentRef: z.string().nullable().optional(),
  contentHashSha256: z.string().nullable().optional(),
  billDate: NullableIsoDateStringZod,
  admissionDate: NullableIsoDateStringZod,
  dischargeDate: NullableIsoDateStringZod,
  originalBillTotalPaise: z.number().int().nonnegative('Original bill total must be non-negative'),
  calculatedItemsTotalPaise: z.number().int().nonnegative('Calculated items total must be non-negative'),
  reconciliationDifferencePaise: z.number().int(),
  reconciliationStatus: BillReconciliationStatusZod,
  currency: z.literal('INR'),
  lineItems: z.array(ClaimLineItemZod).default([]),
  uploadedAt: z.string(),
  extractedAt: z.string()
});

// ============================================================================
// Evidence Reference & Ledger Zod Schemas
// ============================================================================

export const EvidenceTypeZod = z.enum([
  'CONTRACT_CLAUSE',
  'EXCLUSION_LIST',
  'SUBLIMIT_RULE',
  'STATUTORY_REGULATION',
  'NETWORK_AGREEMENT',
  'BILL_LINE_EVIDENCE'
]);

export const EvidenceReferenceZod = z.object({
  evidenceId: z.string().min(1, 'Evidence ID is required'),
  documentId: z.string().min(1, 'Document ID is required'),
  versionId: z.string().min(1, 'Version ID is required'),
  clauseId: z.string().nullable().optional(),
  clauseTitle: z.string().nullable().optional(),
  supportingExcerpt: z.string().min(1, 'Supporting excerpt is required'),
  pageNumber: z.number().int().positive().nullable().optional(),
  sectionReference: z.string().nullable().optional(),
  evidenceType: EvidenceTypeZod,
  verificationStatus: z.enum([
    'VERIFIED_GROUND_TRUTH',
    'AUTOMATICALLY_EXTRACTED',
    'UNRESOLVED',
    'DISPUTED'
  ]),
  confidenceScore: z.number().min(0).max(1)
});

export const DeductionScopeZod = z.enum([
  'ITEM_LEVEL_EXCLUSION',
  'ROOM_RENT_PROPORTIONATE',
  'CATEGORY_SUBLIMIT',
  'CLAIM_DEDUCTIBLE',
  'COPAY',
  'SUM_INSURED_CAP'
]);

export const ClaimAdjustmentRecordZod = z.object({
  adjustmentId: z.string().min(1, 'Adjustment ID is required'),
  targetItemId: z.string().nullable().optional(),
  scope: DeductionScopeZod,
  description: z.string().min(1, 'Description is required'),
  baseAmountPaise: z.number().int().nonnegative(),
  deductionAmountPaise: z.number().int().nonnegative(),
  remainingAmountPaise: z.number().int().nonnegative(),
  evidence: EvidenceReferenceZod.nullable().optional(),
  clauseReference: z.string().nullable().optional(),
  reasonCode: z.string().min(1, 'Reason code is required'),
  uncertaintyReason: z.string().nullable().optional(),
  reviewRequired: z.boolean().default(false)
});

export const ItemAdjudicationStageZod = z.object({
  itemId: z.string().min(1),
  category: StandardChargeCategoryZod,
  originalClaimedPaise: z.number().int().nonnegative(),
  excludedNonPayablePaise: z.number().int().nonnegative(),
  admissibleAfterExclusionPaise: z.number().int().nonnegative(),
  proportionateDisallowancePaise: z.number().int().nonnegative(),
  sublimitDisallowancePaise: z.number().int().nonnegative(),
  finalItemApprovedPaise: z.number().int().nonnegative(),
  adjustments: z.array(ClaimAdjustmentRecordZod).default([]),
  evidenceReferences: z.array(EvidenceReferenceZod).default([])
});

export const ClaimLedgerZod = z.object({
  currency: z.literal('INR'),
  itemStages: z.array(ItemAdjudicationStageZod).default([]),
  claimAdjustments: z.array(ClaimAdjustmentRecordZod).default([]),
  totalClaimedPaise: z.number().int().nonnegative(),
  totalExcludedNonPayablePaise: z.number().int().nonnegative(),
  totalProportionateDisallowancePaise: z.number().int().nonnegative(),
  totalSublimitDisallowancePaise: z.number().int().nonnegative(),
  totalAdmissibleBeforeDeductiblePaise: z.number().int().nonnegative(),
  appliedDeductiblePaise: z.number().int().nonnegative(),
  admissibleAfterDeductiblePaise: z.number().int().nonnegative(),
  appliedCopayPaise: z.number().int().nonnegative(),
  approvedBeforeSumInsuredCapPaise: z.number().int().nonnegative(),
  sumInsuredCapDisallowancePaise: z.number().int().nonnegative(),
  finalInsurerPayablePaise: z.number().int().nonnegative(),
  totalPatientResponsibilityPaise: z.number().int().nonnegative(),
  isMathematicallyBalanced: z.boolean()
});

export const ClaimStatusZod = z.enum([
  'DRAFT',
  'DOCUMENTS_INGESTED',
  'POLICY_RESOLVED',
  'ADJUDICATED',
  'PENDING_HUMAN_REVIEW',
  'SETTLED',
  'DISPUTED'
]);

export const ClaimReviewStatusZod = z.enum([
  'NOT_REQUIRED',
  'REQUIRED_AMBIGUOUS_POLICY',
  'REQUIRED_CONFLICTING_VERSIONS',
  'REQUIRED_UNRECONCILED_BILL',
  'REQUIRED_HIGH_VALUE_DISALLOWANCE',
  'MANUALLY_REVIEWED',
  'APPROVED'
]);

export const ClaimAssessmentStateZod = z.object({
  claimId: z.string().min(1, 'Claim ID is required'),
  policyFamilyId: z.string().min(1, 'Policy family ID is required'),
  selectedPolicyVersionId: z.string().nullable(),
  applicableAmendmentIds: z.array(z.string()).default([]),
  treatmentDate: NullableIsoDateStringZod,
  bill: BillDocumentZod,
  status: ClaimStatusZod,
  reviewStatus: ClaimReviewStatusZod,
  reviewReasons: z.array(z.string()).default([]),
  ledger: ClaimLedgerZod.nullable(),
  traceId: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string()
});
