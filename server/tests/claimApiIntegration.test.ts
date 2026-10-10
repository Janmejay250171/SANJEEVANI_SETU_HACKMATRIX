import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import app from '../src/index.js';
import { rupeesToPaise } from '../src/types/claim.js';

function createMockInvoicePdf(): Promise<Buffer> {
  const samplePath = path.resolve(__dirname, '../../mock-policies/sample_bill.pdf');
  if (fs.existsSync(samplePath)) {
    return Promise.resolve(fs.readFileSync(samplePath));
  }

  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(16).text('Apollo Hospitals Bengaluru', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text('Date: 2025-06-12');
    doc.text('Deluxe Room Bed Charges 3 5000 15000');
    doc.text('Surgeon Consultation Fee 1 20000 20000');
    doc.text('Disposable Surgical Gloves 2 1000 2000');
    doc.moveDown();
    doc.text('Gross Total: 37000');
    doc.end();
  });
}

describe('FIN-01 End-to-End Claim API Integration Suite (Prompt 6)', () => {
  let validPdfBuffer: Buffer;

  beforeAll(async () => {
    validPdfBuffer = await createMockInvoicePdf();
  });

  // ==========================================================================
  // 1. Bill Upload & Extraction Endpoints
  // ==========================================================================
  describe('Bill Ingestion & Extraction (POST /api/claims/bills/upload)', () => {
    it('Extracts bill line items and categorizes multiple charges from valid PDF invoice', async () => {
      const res = await request(app)
        .post('/api/claims/bills/upload')
        .attach('file', validPdfBuffer, 'apollo_invoice_991.pdf');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.billId).toBeDefined();
      expect(res.body.data.hospitalName).toContain('Apollo');
      expect(res.body.data.lineItems.length).toBeGreaterThanOrEqual(1);

      // Check category detection
      const items = res.body.data.lineItems;
      const roomItem = items.find((i: any) => i.category === 'ROOM_RENT' || i.originalDescription.includes('Room'));
      expect(roomItem).toBeDefined();
    });

    it('Rejects upload with unsupported media type (e.g. text/plain or png)', async () => {
      const res = await request(app)
        .post('/api/claims/bills/upload')
        .attach('file', Buffer.from('plain invoice text'), 'invoice.txt');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('Returns 400 if no file is attached under field "file"', async () => {
      const res = await request(app)
        .post('/api/claims/bills/upload');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_REQUIRED');
    });

    it('Detects extraction limitation gracefully if PDF has no parseable text', async () => {
      const emptyPdfBuffer = Buffer.from('%PDF-1.4 empty mock pdf content %%EOF', 'utf-8');
      const res = await request(app)
        .post('/api/claims/bills/upload')
        .attach('file', emptyPdfBuffer, 'scanned_empty.pdf');

      expect(res.status).toBe(200);
      expect(res.body.data.isExtractionComplete).toBe(false);
      expect(res.body.data.extractionWarnings.length).toBeGreaterThan(0);
      expect(res.body.data.reconciliationStatus).toBe('PENDING_REVIEW');
    });
  });

  // ==========================================================================
  // 2. End-to-End Claim Assessment (POST /api/claims/assess)
  // ==========================================================================
  describe('Claim Creation & Assessment (POST /api/claims/assess)', () => {
    let createdClaimId: string;

    it('Rejects claim creation if treatment date is missing or malformed', async () => {
      const res = await request(app)
        .post('/api/claims/assess')
        .send({
          policyFamilyId: 'fam_star_optima',
          treatmentDate: 'invalid-date',
          bill: {
            billId: 'bill_test_01',
            hospitalName: 'Apollo',
            originalBillTotalPaise: 5000000,
            calculatedItemsTotalPaise: 5000000,
            reconciliationDifferencePaise: 0,
            reconciliationStatus: 'RECONCILED',
            currency: 'INR',
            lineItems: [],
            uploadedAt: '2026-10-10T12:00:00Z',
            extractedAt: '2026-10-10T12:00:00Z'
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Successfully creates and adjudicates claim with supported, excluded, and room-rent items', async () => {
      const res = await request(app)
        .post('/api/claims/assess')
        .send({
          policyFamilyId: 'fam_star_optima',
          treatmentDate: '2025-06-12',
          bill: {
            billId: 'bill_full_01',
            hospitalName: 'Apollo Hospitals Bengaluru',
            originalBillTotalPaise: rupeesToPaise(92000), // 20000 + 40000 + 30000 + 2000
            calculatedItemsTotalPaise: rupeesToPaise(92000),
            reconciliationDifferencePaise: 0,
            reconciliationStatus: 'RECONCILED',
            currency: 'INR',
            lineItems: [
              {
                itemId: 'item_room_1',
                originalDescription: 'Single Private Deluxe AC Room',
                category: 'ROOM_RENT',
                quantity: 2,
                unitPricePaise: rupeesToPaise(10000), // ₹10,000/day vs ₹6,500/day cap in 2025
                claimedAmountPaise: rupeesToPaise(20000),
                currency: 'INR',
                isNonPayableByRegulation: false
              },
              {
                itemId: 'item_surg_1',
                originalDescription: 'Surgeon Consultation Fee',
                category: 'SURGEON_CONSULTATION',
                quantity: 1,
                unitPricePaise: rupeesToPaise(40000),
                claimedAmountPaise: rupeesToPaise(40000),
                currency: 'INR',
                isNonPayableByRegulation: false
              },
              {
                itemId: 'item_meds_1',
                originalDescription: 'Pharmacy Inpatient Medications',
                category: 'MEDICINES_PHARMACY',
                quantity: 1,
                unitPricePaise: rupeesToPaise(30000),
                claimedAmountPaise: rupeesToPaise(30000),
                currency: 'INR',
                isNonPayableByRegulation: false
              },
              {
                itemId: 'item_gloves_1',
                originalDescription: 'Disposable Gloves and PPE Kit',
                category: 'CONSUMABLES_NON_PAYABLES',
                quantity: 1,
                unitPricePaise: rupeesToPaise(2000),
                claimedAmountPaise: rupeesToPaise(2000),
                currency: 'INR',
                isNonPayableByRegulation: true
              }
            ],
            uploadedAt: '2026-10-10T12:00:00Z',
            extractedAt: '2026-10-10T12:00:00Z'
          },
          financialRules: {
            sumInsuredPaise: rupeesToPaise(500000),
            deductiblePaise: 0,
            copayPercentage: 0,
            networkStatus: 'verified'
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.claimId).toBeDefined();
      createdClaimId = res.body.data.claimId;

      const claim = res.body.data;
      expect(claim.policyFamilyId).toBe('fam_star_optima');
      expect(claim.ledger).toBeDefined();
      expect(claim.ledger.totalClaimedPaise).toBe(rupeesToPaise(92000));
      expect(claim.ledger.isMathematicallyBalanced).toBe(true);

      // Consumables must be disallowed
      expect(claim.ledger.totalExcludedNonPayablePaise).toBeGreaterThanOrEqual(rupeesToPaise(2000));
    });

    it('Returns idempotent response when clientRequestId is repeated', async () => {
      const clientRequestId = `req_idempotent_${Date.now()}`;
      const payload = {
        clientRequestId,
        policyFamilyId: 'fam_star_optima',
        treatmentDate: '2025-06-12',
        bill: {
          billId: 'bill_idem_01',
          hospitalName: 'Apollo',
          originalBillTotalPaise: rupeesToPaise(25000),
          calculatedItemsTotalPaise: rupeesToPaise(25000),
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [
            {
              itemId: 'item_dialysis',
              originalDescription: 'Daycare Dialysis Session',
              category: 'DAYCARE_PACKAGE',
              quantity: 1,
              unitPricePaise: rupeesToPaise(25000),
              claimedAmountPaise: rupeesToPaise(25000),
              currency: 'INR',
              isNonPayableByRegulation: false
            }
          ],
          uploadedAt: '2026-10-10T12:00:00Z',
          extractedAt: '2026-10-10T12:00:00Z'
        }
      };

      const res1 = await request(app).post('/api/claims/assess').send(payload);
      expect(res1.status).toBe(201);

      const res2 = await request(app).post('/api/claims/assess').send(payload);
      expect(res2.status).toBe(201);
      expect(res2.body.data.claimId).toBe(res1.body.data.claimId);
    });

    // ========================================================================
    // 3. Retrieval of Claim, Ledger & Calculation Trace
    // ========================================================================
    it('Retrieves complete claim record by ID (GET /api/claims/:claimId)', async () => {
      const res = await request(app).get(`/api/claims/${createdClaimId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.claimId).toBe(createdClaimId);
      expect(res.body.data.status).toBeDefined();
    });

    it('Retrieves structured itemized ledger and calculation trace (GET /api/claims/:claimId/ledger)', async () => {
      const res = await request(app).get(`/api/claims/${createdClaimId}/ledger`);
      expect(res.status).toBe(200);
      expect(res.body.data.claimId).toBe(createdClaimId);
      expect(res.body.data.ledger).toBeDefined();
      expect(res.body.data.itemizedLedger.length).toBe(4);
      expect(res.body.data.trace.steps.length).toBeGreaterThan(0);

      // Verify trace step fields
      const firstStep = res.body.data.trace.steps[0];
      expect(firstStep.operation).toBeDefined();
      expect(firstStep.formulaApplied).toBeDefined();
      expect(firstStep.roundingRule).toBe('INTEGER_PAISE_ROUND_NEAREST');
    });

    it('Retrieves policy version selection and evidence citations (GET /api/claims/:claimId/evidence)', async () => {
      const res = await request(app).get(`/api/claims/${createdClaimId}/evidence`);
      expect(res.status).toBe(200);
      expect(res.body.data.policyFamilyId).toBe('fam_star_optima');
      expect(res.body.data.treatmentDate).toBe('2025-06-12');
    });

    // ========================================================================
    // 4. Human Bill Item Correction & Reassessment
    // ========================================================================
    it('Updates a bill item and preserves original in provenance (PUT /api/claims/:claimId/items/:itemId)', async () => {
      const res = await request(app)
        .put(`/api/claims/${createdClaimId}/items/item_surg_1`)
        .send({
          quantity: 1,
          unitPricePaise: rupeesToPaise(35000), // Corrected from ₹40,000 to ₹35,000
          correctionReason: 'Hospital tariff adjustment for junior surgeon'
        });

      expect(res.status).toBe(200);
      const updatedItem = res.body.data.bill.lineItems.find((i: any) => i.itemId === 'item_surg_1');
      expect(updatedItem.claimedAmountPaise).toBe(rupeesToPaise(35000));
      expect(updatedItem.reviewFlags).toContain('USER_CORRECTED');
      expect(updatedItem.provenance.rawExtractedText).toContain('Hospital tariff adjustment');
    });

    it('Reassesses claim and generates before-and-after comparison (POST /api/claims/:claimId/reassess)', async () => {
      const res = await request(app)
        .post(`/api/claims/${createdClaimId}/reassess`)
        .send({
          reassessmentReason: 'Recomputing after surgeon charge correction'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.current).toBeDefined();
      expect(res.body.data.comparison).toBeDefined();

      const comp = res.body.data.comparison;
      expect(comp.claimId).toBe(createdClaimId);
      expect(comp.priorAssessmentId).toBeDefined();
      expect(comp.currentAssessmentId).toBeDefined();
      expect(comp.totalClaimedDeltaPaise).toBe(rupeesToPaise(-5000)); // Dropped by ₹5,000
      expect(comp.lineItemDiffs.length).toBeGreaterThan(0);
    });

    it('Compares assessment versions via GET /api/claims/:claimId/compare', async () => {
      const res = await request(app).get(`/api/claims/${createdClaimId}/compare`);
      expect(res.status).toBe(200);
      expect(res.body.data.claimId).toBe(createdClaimId);
      expect(res.body.data.totalClaimedDeltaPaise).toBe(rupeesToPaise(-5000));
    });

    // ========================================================================
    // 5. Policy Amendment Registration
    // ========================================================================
    it('Registers a policy amendment for policy family (POST /api/claims/:claimId/amendments)', async () => {
      const res = await request(app)
        .post(`/api/claims/${createdClaimId}/amendments`)
        .send({
          amendmentId: 'amend_room_rent_enhancement_2026',
          versionNumber: '2.0',
          effectiveFrom: '2026-01-01',
          effectiveTo: '2026-12-31',
          amendmentScope: 'MODIFIES_SPECIFIC_CLAUSES',
          clauseModifications: [
            {
              clauseId: 'cl_room_rent_enhanced',
              clauseTitle: 'Room Rent Enhanced to ₹8,000',
              changeType: 'MODIFIED',
              newClauseText: 'Room Rent daily limit increased to ₹8,000 per day',
              description: 'Annual benefit enhancement'
            }
          ],
          policyDataUpdates: {
            roomLimit: { type: 'amount', value: 8000 }
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.data.versionId).toBe('amend_room_rent_enhancement_2026');
      expect(res.body.data.documentType).toBe('AMENDMENT');
    });

    // ========================================================================
    // 6. Security, Isolation & Failure Handling
    // ========================================================================
    it('Returns 404 for nonexistent claim ID', async () => {
      const res = await request(app).get('/api/claims/clm_nonexistent_999');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CLAIM_NOT_FOUND');
    });

    it('Returns 404 when attempting to update a nonexistent item in an existing claim', async () => {
      const res = await request(app)
        .put(`/api/claims/${createdClaimId}/items/nonexistent_item_id`)
        .send({
          quantity: 1,
          unitPricePaise: 5000,
          correctionReason: 'Attempting invalid item update'
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ITEM_NOT_FOUND');
    });
  });
});
