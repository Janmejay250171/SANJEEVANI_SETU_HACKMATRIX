import mongoose, { Schema, Document } from 'mongoose';
import { PolicyVersionRecord, ClauseModification } from '../types/policyVersion.js';

export interface PolicyVersionModelType extends Omit<PolicyVersionRecord, '_id'> {
  _id: string;
}

const ClauseModificationSchema = new Schema<ClauseModification>(
  {
    clauseId: { type: String, required: true },
    clauseTitle: { type: String, default: null },
    changeType: {
      type: String,
      enum: ['ADDED', 'MODIFIED', 'REPLACED', 'REVOKED'],
      required: true
    },
    targetPath: { type: String, default: null },
    previousClauseText: { type: String, default: null },
    newClauseText: { type: String, required: true },
    description: { type: String, required: true }
  },
  { _id: false }
);

const PolicyVersionSchema = new Schema<PolicyVersionModelType>(
  {
    _id: { type: String, required: true }, // versionId
    familyId: { type: String, required: true, index: true },
    versionId: { type: String, required: true, unique: true },
    versionNumber: { type: String, required: true },
    documentType: {
      type: String,
      enum: ['BASE_POLICY', 'ENDORSEMENT', 'AMENDMENT', 'RENEWAL', 'SCHEDULE_ATTACHMENT'],
      required: true
    },
    parentVersionId: { type: String, default: null, index: true },
    amendmentScope: {
      type: String,
      enum: [
        'SUPERSEDES_WHOLE',
        'MODIFIES_SPECIFIC_CLAUSES',
        'ADDS_BENEFIT',
        'RESTRICTS_COVERAGE',
        'RIDER',
        'UNSPECIFIED',
        null
      ],
      default: null
    },
    insurerId: { type: String, default: null },
    insurerName: { type: String, required: true },
    planName: { type: String, required: true },
    policyNumber: { type: String, default: null },
    uin: { type: String, default: null },
    documentId: { type: String, required: true },
    effectiveFrom: { type: String, default: null, index: true },
    effectiveTo: { type: String, default: null, index: true },
    issueDate: { type: String, default: null },
    uploadTimestamp: { type: String, required: true },
    extractedTimestamp: { type: String, required: true },
    contentHashSha256: { type: String, default: null },
    rawTextRef: { type: String, default: null },
    extractionStatus: {
      type: String,
      enum: ['EXTRACTED', 'PARTIAL', 'UNRESOLVED', 'VERIFIED'],
      required: true
    },
    clauseModifications: { type: [ClauseModificationSchema], default: [] },
    policyData: { type: Schema.Types.Mixed, required: true },
    unresolvedQuestions: { type: [String], default: [] }
  },
  {
    timestamps: true,
    _id: false
  }
);

// Composite index for rapid family + date range resolution
PolicyVersionSchema.index({ familyId: 1, effectiveFrom: 1, effectiveTo: 1 });

export const PolicyVersion = mongoose.model<PolicyVersionModelType>(
  'PolicyVersion',
  PolicyVersionSchema
);
