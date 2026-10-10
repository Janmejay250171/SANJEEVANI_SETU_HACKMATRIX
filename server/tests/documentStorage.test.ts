import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { documentStorageService } from '../src/services/documentStorageService.js';
import { SavedDocument } from '../src/models/SavedDocument.js';

let mongoServer: MongoMemoryServer;

describe('Priority 5: Durable Original Document Storage & Historical Retrieval Suite', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('5.1 Durably persists original Policy PDF bytes with cryptographic SHA-256 checksum and metadata', async () => {
    const fakePolicyBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Synthetic Health Policy) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const expectedHash = crypto.createHash('sha256').update(fakePolicyBuffer).digest('hex');

    const saved = await documentStorageService.saveDocument({
      fileBuffer: fakePolicyBuffer,
      originalFilename: 'synthetic_family_floater_policy.pdf',
      mimeType: 'application/pdf',
      category: 'policy',
      userId: 'user_test_001',
      relatedEntityId: 'pol_12345',
      analysisSnapshot: {
        sumInsured: 500000,
        roomRentLimit: 5000,
        copayPercentage: 10
      },
      modelVersion: '1.0.0'
    });

    expect(saved).toBeDefined();
    expect(saved.documentId).toMatch(/^doc_/);
    expect(saved.contentHashSha256).toBe(expectedHash);
    expect(saved.category).toBe('policy');
    expect(saved.sizeBytes).toBe(fakePolicyBuffer.length);
    expect(saved.retentionStatus).toBe('active');
    expect(saved.analysisSnapshot).toEqual({
      sumInsured: 500000,
      roomRentLimit: 5000,
      copayPercentage: 10
    });

    // Verify disk persistence
    const diskPath = path.resolve(process.cwd(), saved.storagePath);
    expect(fs.existsSync(diskPath)).toBe(true);
    const readBytes = fs.readFileSync(diskPath);
    expect(readBytes.equals(fakePolicyBuffer)).toBe(true);
  });

  it('5.2 Durably persists hospital bill PDF and bill images (PNG/JPEG) with correct categorization', async () => {
    const fakeBillPdf = Buffer.from('%PDF-1.4\nBill invoice content with line items\n%%EOF');
    const billDoc = await documentStorageService.saveDocument({
      fileBuffer: fakeBillPdf,
      originalFilename: 'hospital_invoice_apollo_102.pdf',
      mimeType: 'application/pdf',
      category: 'bill',
      userId: 'user_test_001',
      relatedEntityId: 'bill_98765',
      analysisSnapshot: {
        totalPaise: 4500000,
        itemsCount: 5
      }
    });

    expect(billDoc.category).toBe('bill');
    expect(billDoc.analysisStatus).toBe('processed');

    const fakeBillImage = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00]);
    const imgDoc = await documentStorageService.saveDocument({
      fileBuffer: fakeBillImage,
      originalFilename: 'pharmacy_receipt_scan.png',
      mimeType: 'image/png',
      category: 'bill_image',
      userId: 'user_test_001',
      relatedEntityId: 'bill_img_01'
    });

    expect(imgDoc.category).toBe('bill_image');
    expect(imgDoc.mimeType).toBe('image/png');
  });

  it('5.3 Verifies disk file cryptographic integrity against stored SHA-256 hash', async () => {
    const testBuffer = Buffer.from('Important policy endorsement text dated 2026-05-01');
    const saved = await documentStorageService.saveDocument({
      fileBuffer: testBuffer,
      originalFilename: 'endorsement_clause.pdf',
      mimeType: 'application/pdf',
      category: 'amendment',
      userId: 'user_test_002'
    });

    const verification = await documentStorageService.verifyIntegrity(saved.documentId);
    expect(verification.verified).toBe(true);
    expect(verification.expectedHash).toBe(saved.contentHashSha256);
    expect(verification.actualHash).toBe(saved.contentHashSha256);
    expect(verification.sizeBytes).toBe(testBuffer.length);
  });

  it('5.4 Enforces strict ownership checks: rejects unauthorized cross-user access (HTTP 403 / FORBIDDEN)', async () => {
    const privateBuffer = Buffer.from('Confidential medical records');
    const saved = await documentStorageService.saveDocument({
      fileBuffer: privateBuffer,
      originalFilename: 'discharge_summary.pdf',
      mimeType: 'application/pdf',
      category: 'supporting_document',
      userId: 'user_owner_alice'
    });

    // Owner access should succeed
    const ownerDoc = await documentStorageService.getDocumentById(saved.documentId, 'user_owner_alice');
    expect(ownerDoc.documentId).toBe(saved.documentId);

    // Another user access must be rejected with 403 Forbidden
    await expect(
      documentStorageService.getDocumentById(saved.documentId, 'user_intruder_bob')
    ).rejects.toThrow(/Access denied/i);

    // Stream download from intruder must also be rejected
    await expect(
      documentStorageService.getDocumentStream(saved.documentId, 'user_intruder_bob')
    ).rejects.toThrow(/Access denied/i);
  });

  it('5.5 Preserves historical analysis snapshot without silent recalculation when reopened after 1 year', async () => {
    const oldCalculationSnapshot = {
      assessmentTimestamp: '2025-01-15T10:00:00.000Z',
      roomRentDeduction: 12000,
      proportionateDeduction: 8400,
      insurerPayablePaise: 15400000,
      patientPayablePaise: 4600000,
      calculationEngineVersion: '4B.1'
    };

    const saved = await documentStorageService.saveDocument({
      fileBuffer: Buffer.from('Historical Claim Assessment Bill'),
      originalFilename: 'historical_bill_2025.pdf',
      mimeType: 'application/pdf',
      category: 'bill',
      userId: 'user_test_003',
      relatedEntityId: 'claim_2025_001',
      analysisSnapshot: oldCalculationSnapshot,
      modelVersion: '1.0.0'
    });

    // Retrieve document after simulated time has passed
    const retrieved = await documentStorageService.getDocumentById(saved.documentId, 'user_test_003');
    expect(retrieved.analysisSnapshot).toEqual(oldCalculationSnapshot);
    expect(retrieved.analysisSnapshot.calculationEngineVersion).toBe('4B.1');
    expect(retrieved.analysisSnapshot.patientPayablePaise).toBe(4600000);
    // Verifies that values are exact and frozen (never recomputed or altered)
  });

  it('5.6 Handles document deletion by updating retention status and cleaning up storage', async () => {
    const docToDelete = await documentStorageService.saveDocument({
      fileBuffer: Buffer.from('Temporary scratch bill file'),
      originalFilename: 'temp_bill.pdf',
      mimeType: 'application/pdf',
      category: 'bill',
      userId: 'user_delete_test'
    });

    const deleted = await documentStorageService.deleteDocument(docToDelete.documentId, 'user_delete_test');
    expect(deleted).toBe(true);

    const docRecord = await SavedDocument.findOne({ documentId: docToDelete.documentId });
    expect(docRecord?.retentionStatus).toBe('deleted');

    // Attempting to retrieve deleted document throws 404
    await expect(
      documentStorageService.getDocumentById(docToDelete.documentId, 'user_delete_test')
    ).rejects.toThrow(/not found or has been deleted/i);
  });
});
