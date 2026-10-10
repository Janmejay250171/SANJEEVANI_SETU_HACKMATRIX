import mongoose, { Schema } from 'mongoose';
import {
  ClaimAssessmentState,
  BillDocument,
  ClaimLineItem,
  ClaimLedger,
  EvidenceReference,
  ClaimAdjustmentRecord,
  ItemAdjudicationStage
} from '../types/claim.js';

export interface ClaimAssessmentModelType extends Omit<ClaimAssessmentState, '_id'> {
  _id: string;
}

const ItemExtractionProvenanceSchema = new Schema(
  {
    sourceType: {
      type: String,
      enum: [
        'OCR_PDF_EXTRACTION',
        'CSV_IMPORT',
        'STRUCTURED_JSON_TEMPLATE',
        'MANUAL_ENTRY',
        'SYNTHETIC_BENCHMARK'
      ],
      required: true
    },
    pageNumber: { type: Number, default: null },
    lineNumber: { type: Number, default: null },
    boundingBox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    },
    rawExtractedText: { type: String, required: true },
    extractedTimestamp: { type: String, required: true },
    confidenceScore: { type: Number, required: true }
  },
  { _id: false }
);

const ClaimLineItemSchema = new Schema<ClaimLineItem>(
  {
    itemId: { type: String, required: true },
    originalDescription: { type: String, required: true },
    normalizedDescription: { type: String, default: null },
    category: {
      type: String,
      enum: [
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
      ],
      required: true
    },
    quantity: { type: Number, required: true, default: 1 },
    unitPricePaise: { type: Number, required: true },
    claimedAmountPaise: { type: Number, required: true },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    provenance: { type: ItemExtractionProvenanceSchema, required: true },
    classificationStatus: {
      type: String,
      enum: [
        'AUTOMATIC_EXACT',
        'AUTOMATIC_SEMANTIC',
        'HEURISTIC_RULE',
        'MANUAL_USER_OVERRIDE',
        'UNCLASSIFIED'
      ],
      required: true
    },
    reviewFlags: { type: [String], default: [] },
    isNonPayableByRegulation: { type: Boolean, default: false }
  },
  { _id: false }
);

const BillDocumentSchema = new Schema<BillDocument>(
  {
    billId: { type: String, required: true },
    hospitalName: { type: String, required: true },
    sourceDocumentRef: { type: String, default: null },
    contentHashSha256: { type: String, default: null },
    billDate: { type: String, default: null },
    admissionDate: { type: String, default: null },
    dischargeDate: { type: String, default: null },
    originalBillTotalPaise: { type: Number, required: true },
    calculatedItemsTotalPaise: { type: Number, required: true },
    reconciliationDifferencePaise: { type: Number, required: true },
    reconciliationStatus: {
      type: String,
      enum: ['RECONCILED', 'DISCREPANCY', 'PENDING_REVIEW', 'ESTIMATED'],
      required: true
    },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    lineItems: { type: [ClaimLineItemSchema], default: [] },
    uploadedAt: { type: String, required: true },
    extractedAt: { type: String, required: true }
  },
  { _id: false }
);

const EvidenceReferenceSchema = new Schema<EvidenceReference>(
  {
    evidenceId: { type: String, required: true },
    documentId: { type: String, required: true },
    versionId: { type: String, required: true },
    clauseId: { type: String, default: null },
    clauseTitle: { type: String, default: null },
    supportingExcerpt: { type: String, required: true },
    pageNumber: { type: Number, default: null },
    sectionReference: { type: String, default: null },
    evidenceType: {
      type: String,
      enum: [
        'CONTRACT_CLAUSE',
        'EXCLUSION_LIST',
        'SUBLIMIT_RULE',
        'STATUTORY_REGULATION',
        'NETWORK_AGREEMENT',
        'BILL_LINE_EVIDENCE'
      ],
      required: true
    },
    verificationStatus: {
      type: String,
      enum: ['VERIFIED_GROUND_TRUTH', 'AUTOMATICALLY_EXTRACTED', 'UNRESOLVED', 'DISPUTED'],
      required: true
    },
    confidenceScore: { type: Number, required: true }
  },
  { _id: false }
);

const ClaimAdjustmentRecordSchema = new Schema<ClaimAdjustmentRecord>(
  {
    adjustmentId: { type: String, required: true },
    targetItemId: { type: String, default: null },
    scope: {
      type: String,
      enum: [
        'ITEM_LEVEL_EXCLUSION',
        'ROOM_RENT_PROPORTIONATE',
        'CATEGORY_SUBLIMIT',
        'CLAIM_DEDUCTIBLE',
        'COPAY',
        'SUM_INSURED_CAP'
      ],
      required: true
    },
    description: { type: String, required: true },
    baseAmountPaise: { type: Number, required: true },
    deductionAmountPaise: { type: Number, required: true },
    remainingAmountPaise: { type: Number, required: true },
    evidence: { type: EvidenceReferenceSchema, default: null },
    clauseReference: { type: String, default: null },
    reasonCode: { type: String, required: true },
    uncertaintyReason: { type: String, default: null },
    reviewRequired: { type: Boolean, default: false }
  },
  { _id: false }
);

const ItemAdjudicationStageSchema = new Schema<ItemAdjudicationStage>(
  {
    itemId: { type: String, required: true },
    category: { type: String, required: true },
    originalClaimedPaise: { type: Number, required: true },
    excludedNonPayablePaise: { type: Number, required: true },
    admissibleAfterExclusionPaise: { type: Number, required: true },
    proportionateDisallowancePaise: { type: Number, required: true },
    sublimitDisallowancePaise: { type: Number, required: true },
    finalItemApprovedPaise: { type: Number, required: true },
    adjustments: { type: [ClaimAdjustmentRecordSchema], default: [] },
    evidenceReferences: { type: [EvidenceReferenceSchema], default: [] }
  },
  { _id: false }
);

const ClaimLedgerSchema = new Schema<ClaimLedger>(
  {
    currency: { type: String, enum: ['INR'], default: 'INR' },
    itemStages: { type: [ItemAdjudicationStageSchema], default: [] },
    claimAdjustments: { type: [ClaimAdjustmentRecordSchema], default: [] },
    totalClaimedPaise: { type: Number, required: true },
    totalExcludedNonPayablePaise: { type: Number, required: true },
    totalProportionateDisallowancePaise: { type: Number, required: true },
    totalSublimitDisallowancePaise: { type: Number, required: true },
    totalAdmissibleBeforeDeductiblePaise: { type: Number, required: true },
    appliedDeductiblePaise: { type: Number, required: true },
    admissibleAfterDeductiblePaise: { type: Number, required: true },
    appliedCopayPaise: { type: Number, required: true },
    approvedBeforeSumInsuredCapPaise: { type: Number, required: true },
    sumInsuredCapDisallowancePaise: { type: Number, required: true },
    finalInsurerPayablePaise: { type: Number, required: true },
    totalPatientResponsibilityPaise: { type: Number, required: true },
    isMathematicallyBalanced: { type: Boolean, required: true }
  },
  { _id: false }
);

const ClaimAssessmentSchema = new Schema<ClaimAssessmentModelType>(
  {
    _id: { type: String, required: true }, // claimId
    claimId: { type: String, required: true, unique: true },
    policyFamilyId: { type: String, required: true, index: true },
    selectedPolicyVersionId: { type: String, default: null, index: true },
    applicableAmendmentIds: { type: [String], default: [] },
    treatmentDate: { type: String, default: null, index: true },
    bill: { type: BillDocumentSchema, required: true },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'DOCUMENTS_INGESTED',
        'POLICY_RESOLVED',
        'ADJUDICATED',
        'PENDING_HUMAN_REVIEW',
        'SETTLED',
        'DISPUTED'
      ],
      required: true,
      default: 'DRAFT'
    },
    reviewStatus: {
      type: String,
      enum: [
        'NOT_REQUIRED',
        'REQUIRED_AMBIGUOUS_POLICY',
        'REQUIRED_CONFLICTING_VERSIONS',
        'REQUIRED_UNRECONCILED_BILL',
        'REQUIRED_HIGH_VALUE_DISALLOWANCE',
        'MANUALLY_REVIEWED',
        'APPROVED'
      ],
      required: true,
      default: 'NOT_REQUIRED'
    },
    reviewReasons: { type: [String], default: [] },
    ledger: { type: ClaimLedgerSchema, default: null },
    traceId: { type: String, required: true }
  },
  {
    timestamps: true,
    _id: false
  }
);

ClaimAssessmentSchema.index({ policyFamilyId: 1, treatmentDate: 1 });

export const ClaimAssessment = mongoose.model<ClaimAssessmentModelType>(
  'ClaimAssessment',
  ClaimAssessmentSchema
);
