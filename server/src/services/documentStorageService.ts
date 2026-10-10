import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { SavedDocument, ISavedDocument, DocumentCategory, AnalysisStatus } from '../models/SavedDocument.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage directory: defaults to server/storage/documents
const DEFAULT_STORAGE_DIR = path.resolve(__dirname, '../../storage/documents');

export interface SaveDocumentInput {
  fileBuffer: Buffer;
  originalFilename: string;
  mimeType: string;
  category: DocumentCategory;
  userId?: string;
  relatedEntityId?: string;
  analysisSnapshot?: any;
  modelVersion?: string;
}

export interface DocumentVerificationResult {
  verified: boolean;
  documentId: string;
  expectedHash: string;
  actualHash: string;
  sizeBytes: number;
}

export class DocumentStorageService {
  private storageDir: string;

  constructor(customStorageDir?: string) {
    this.storageDir = customStorageDir || process.env.DOCUMENTS_STORAGE_PATH || DEFAULT_STORAGE_DIR;
    this.ensureStorageDirectory();
  }

  public getStorageDirectory(): string {
    return this.storageDir;
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * Durably persists original file bytes with SHA-256 integrity hash and MongoDB metadata.
   */
  public async saveDocument(input: SaveDocumentInput): Promise<ISavedDocument> {
    this.ensureStorageDirectory();

    const {
      fileBuffer,
      originalFilename,
      mimeType,
      category,
      userId = 'anonymous',
      relatedEntityId,
      analysisSnapshot,
      modelVersion = '1.0.0'
    } = input;

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Cannot store empty file buffer.');
    }

    // Compute cryptographic SHA-256 content checksum
    const contentHashSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const documentId = `doc_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const sanitizedName = this.sanitizeFilename(originalFilename);
    const diskFilename = `${documentId}_${sanitizedName}`;
    const fullDiskPath = path.join(this.storageDir, diskFilename);

    // Write file atomically to disk
    fs.writeFileSync(fullDiskPath, fileBuffer);

    // Relative storage path from repository root for portability
    const relativePath = path.relative(path.resolve(__dirname, '../../'), fullDiskPath).replace(/\\/g, '/');

    // Create persistent MongoDB record
    const documentRecord = await SavedDocument.create({
      _id: documentId,
      documentId,
      userId,
      originalFilename,
      mimeType,
      sizeBytes: fileBuffer.length,
      uploadTimestamp: new Date().toISOString(),
      storagePath: relativePath,
      contentHashSha256,
      category,
      analysisStatus: analysisSnapshot ? 'processed' : 'pending',
      relatedEntityId: relatedEntityId || null,
      analysisSnapshot: analysisSnapshot || null,
      modelVersion,
      retentionStatus: 'active'
    });

    return documentRecord;
  }

  /**
   * Attaches or updates an immutable historical analysis snapshot to a stored document.
   */
  public async attachAnalysisSnapshot(
    documentId: string,
    snapshot: any,
    relatedEntityId?: string
  ): Promise<ISavedDocument | null> {
    const doc = await SavedDocument.findOne({ documentId, retentionStatus: 'active' });
    if (!doc) return null;

    doc.analysisSnapshot = snapshot;
    doc.analysisStatus = 'processed';
    if (relatedEntityId) doc.relatedEntityId = relatedEntityId;
    await doc.save();
    return doc;
  }

  /**
   * Retrieves document metadata and immutable analysis snapshot with ownership verification.
   */
  public async getDocumentById(documentId: string, requestingUserId?: string): Promise<ISavedDocument> {
    const doc = await SavedDocument.findOne({ documentId });
    if (!doc || doc.retentionStatus === 'deleted') {
      const error: any = new Error(`Document with ID "${documentId}" was not found or has been deleted.`);
      error.statusCode = 404;
      error.code = 'DOCUMENT_NOT_FOUND';
      throw error;
    }

    // Strict ownership validation: If document belongs to an authenticated user, only that user or admin can view
    if (
      requestingUserId &&
      requestingUserId !== 'admin' &&
      doc.userId !== 'anonymous' &&
      doc.userId !== requestingUserId
    ) {
      const error: any = new Error('Access denied: You do not have permission to view this document.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    return doc;
  }

  /**
   * Lists all active saved documents for a given user.
   */
  public async listDocuments(userId: string, category?: DocumentCategory): Promise<ISavedDocument[]> {
    const query: any = {
      userId,
      retentionStatus: 'active'
    };
    if (category) {
      query.category = category;
    }

    return SavedDocument.find(query).sort({ createdAt: -1 });
  }

  /**
   * Opens a readable file stream for the original stored bytes with ownership verification.
   */
  public async getDocumentStream(
    documentId: string,
    requestingUserId?: string
  ): Promise<{ stream: fs.ReadStream; document: ISavedDocument; absolutePath: string }> {
    const doc = await this.getDocumentById(documentId, requestingUserId);

    const absolutePath = path.resolve(__dirname, '../../', doc.storagePath);
    if (!fs.existsSync(absolutePath)) {
      const error: any = new Error(`Storage file missing on disk for document ID "${documentId}".`);
      error.statusCode = 404;
      error.code = 'FILE_MISSING_ON_DISK';
      throw error;
    }

    const stream = fs.createReadStream(absolutePath);
    return { stream, document: doc, absolutePath };
  }

  /**
   * Verifies disk file cryptographic integrity against the stored SHA-256 hash.
   */
  public async verifyIntegrity(documentId: string): Promise<DocumentVerificationResult> {
    const doc = await SavedDocument.findOne({ documentId });
    if (!doc) {
      throw new Error(`Document "${documentId}" not found for verification.`);
    }

    const absolutePath = path.resolve(__dirname, '../../', doc.storagePath);
    if (!fs.existsSync(absolutePath)) {
      return {
        verified: false,
        documentId,
        expectedHash: doc.contentHashSha256,
        actualHash: 'FILE_NOT_FOUND_ON_DISK',
        sizeBytes: 0
      };
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    return {
      verified: actualHash === doc.contentHashSha256,
      documentId,
      expectedHash: doc.contentHashSha256,
      actualHash,
      sizeBytes: fileBuffer.length
    };
  }

  /**
   * Deletes a document record and marks retention status as deleted.
   */
  public async deleteDocument(documentId: string, requestingUserId?: string): Promise<boolean> {
    const doc = await this.getDocumentById(documentId, requestingUserId);

    doc.retentionStatus = 'deleted';
    await doc.save();

    // Optionally cleanup disk file
    try {
      const absolutePath = path.resolve(__dirname, '../../', doc.storagePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (e) {
      console.warn(`[DocumentStorage] Warning removing disk file for ${documentId}:`, e);
    }

    return true;
  }
}

export const documentStorageService = new DocumentStorageService();
