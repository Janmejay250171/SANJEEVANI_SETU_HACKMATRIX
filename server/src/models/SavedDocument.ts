import mongoose, { Schema, Document } from 'mongoose';

export type DocumentCategory = 'policy' | 'bill' | 'bill_image' | 'amendment' | 'supporting_document';
export type AnalysisStatus = 'processed' | 'pending' | 'failed';
export type RetentionStatus = 'active' | 'deleted';

export interface ISavedDocument extends Omit<Document, '_id'> {
  _id: string; // doc_...
  documentId: string;
  userId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadTimestamp: string;
  storagePath: string; // Relative to storage root
  contentHashSha256: string;
  category: DocumentCategory;
  analysisStatus: AnalysisStatus;
  relatedEntityId?: string; // Links to Policy _id or Claim claimId
  analysisSnapshot?: any; // Preserved immutable historical analysis snapshot
  modelVersion?: string;
  retentionStatus: RetentionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SavedDocumentSchema = new Schema<ISavedDocument>(
  {
    _id: { type: String, required: true },
    documentId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    originalFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadTimestamp: { type: String, required: true },
    storagePath: { type: String, required: true },
    contentHashSha256: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ['policy', 'bill', 'bill_image', 'amendment', 'supporting_document'],
      required: true,
      index: true
    },
    analysisStatus: {
      type: String,
      enum: ['processed', 'pending', 'failed'],
      default: 'processed'
    },
    relatedEntityId: { type: String, default: null, index: true },
    analysisSnapshot: { type: Schema.Types.Mixed, default: null },
    modelVersion: { type: String, default: '1.0.0' },
    retentionStatus: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const SavedDocument = mongoose.model<ISavedDocument>('SavedDocument', SavedDocumentSchema);
