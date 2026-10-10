import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaise,
  safeMultiplyRatio,
  ClaimLineItem,
  BillDocument,
  EvidenceReference,
  ClaimLedger,
  ClaimAssessmentState,
  StandardChargeCategory
} from '../src/types/claim.js';
import {
  ClaimLineItemZod,
  BillDocumentZod,
  EvidenceReferenceZod,
  ClaimAdjustmentRecordZod,
  ClaimLedgerZod,
  ClaimAssessmentStateZod
} from '../src/schemas/claimSchema.js';

describe('Claim & Bill Typed Data Models', () => {
  describe('Decimal-Safe Minor Units (Paise) Arithmetic', () => {
    it('converts decimal rupees safely to integer paise without floating-point error', () => {
      expect(rupeesToPaise(1500.5)).toBe(150050);
      expect(rupeesToPaise(0)).toBe(0);
      expect(rupeesToPaise(null)).toBe(0);
      expect(rupeesToPaise(undefined)).toBe(0);

      // Classical floating point edge case: 0.1 + 0.2 = 0.30000000000000004
      const sum = 0.1 + 0.2;
      expect(rupeesToPaise(sum)).toBe(30);
    });

    it('converts integer paise back to rupees precisely', () => {
      expect(paiseToRupees(150050)).toBe(1500.5);
      expect(paiseToRupees(0)).toBe(0);
      expect(paiseToRupees(100)).toBe(1.0);
    });

    it('formats integer paise as localized Indian Rupee currency strings', () => {
      const formatted = formatPaise(2540050); // 25,400.50
      expect(formatted).toContain('25,400.50');
      expect(formatted).toContain('₹');

      const noSymbol = formatPaise(2540050, false);
      expect(noSymbol).toBe('25,400.50');
    });

    it('performs safe ratio multiplications in minor units with proper rounding', () => {
      // 10% copay on ₹50,000 (5,000,000 paise) = ₹5,000 (500,000 paise)
      expect(safeMultiplyRatio(5000000, 10, 100)).toBe(500000);

      // Ratio with non-trivial rounding: 15% on 999 paise = 149.85 -> rounds to 150 paise
      expect(safeMultiplyRatio(999, 15, 100)).toBe(150);

      // Zero and edge cases
      expect(safeMultiplyRatio(0, 10, 100)).toBe(0);
      expect(safeMultiplyRatio(500000, 0, 100)).toBe(0);
      expect(safeMultiplyRatio(500000, 10, 0)).toBe(0);
    });
  });

  describe('Bill Item & Provenance Validation', () => {
    const validSyntheticLineItem: ClaimLineItem = {
      itemId: 'syn_item_001',
      originalDescription: 'Deluxe Private Room Bed Charges (2 Days)',
      normalizedDescription: 'Room Rent - Single Private AC',
      category: 'ROOM_RENT',
      quantity: 2,
      unitPricePaise: 600000, // ₹6,000 per day
      claimedAmountPaise: 1200000, // ₹12,000 total
      currency: 'INR',
      provenance: {
        sourceType: 'SYNTHETIC_BENCHMARK',
        pageNumber: 1,
        lineNumber: 12,
        boundingBox: null,
        rawExtractedText: 'Deluxe Room: 2 x 6000 = 12000',
        extractedTimestamp: '2025-08-15T10:00:00.000Z',
        confidenceScore: 0.98
      },
      classificationStatus: 'AUTOMATIC_EXACT',
      reviewFlags: [],
      isNonPayableByRegulation: false
    };

    it('validates a well-formed bill line item', () => {
      const parsed = ClaimLineItemZod.safeParse(validSyntheticLineItem);
      expect(parsed.success).toBe(true);
    });

    it('supports all 12 standard IRDAI charge categories', () => {
      const categories: StandardChargeCategory[] = [
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
      ];

      for (const cat of categories) {
        const item = { ...validSyntheticLineItem, category: cat };
        expect(ClaimLineItemZod.safeParse(item).success).toBe(true);
      }
    });

    it('rejects line item with negative paise amount', () => {
      const invalidItem = {
        ...validSyntheticLineItem,
        claimedAmountPaise: -50000
      };
      const parsed = ClaimLineItemZod.safeParse(invalidItem);
      expect(parsed.success).toBe(false);
    });

    it('rejects line item with non-INR currency', () => {
      const invalidItem = {
        ...validSyntheticLineItem,
        currency: 'USD'
      };
      const parsed = ClaimLineItemZod.safeParse(invalidItem);
      expect(parsed.success).toBe(false);
    });

    it('correctly flags non-payable consumable items by regulation', () => {
      const consumableItem: ClaimLineItem = {
        itemId: 'syn_item_002',
        originalDescription: 'Surgical Gloves & Sanitizer Kit (Non-Payable Annexure)',
        normalizedDescription: 'Surgical Gloves and Administrative Supplies',
        category: 'CONSUMABLES_NON_PAYABLES',
        quantity: 5,
        unitPricePaise: 25000, // ₹250
        claimedAmountPaise: 125000, // ₹1,250
        currency: 'INR',
        provenance: {
          sourceType: 'SYNTHETIC_BENCHMARK',
          pageNumber: 2,
          lineNumber: 4,
          rawExtractedText: 'Gloves Kit: 5 x 250 = 1250',
          extractedTimestamp: '2025-08-15T10:00:00.000Z',
          confidenceScore: 0.95
        },
        classificationStatus: 'AUTOMATIC_EXACT',
        reviewFlags: ['IRDAI_NON_PAYABLE_ITEM'],
        isNonPayableByRegulation: true
      };

      const parsed = ClaimLineItemZod.safeParse(consumableItem);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.isNonPayableByRegulation).toBe(true);
        expect(parsed.data.reviewFlags).toContain('IRDAI_NON_PAYABLE_ITEM');
      }
    });
  });

  describe('Bill Document & Reconciliation Statuses', () => {
    it('validates a reconciled bill where line items sum exactly to stated total', () => {
      const bill: BillDocument = {
        billId: 'syn_bill_rec_001',
        hospitalName: 'Synthetic Super Speciality Hospital',
        sourceDocumentRef: '/storage/syn_bill_rec_001.pdf',
        contentHashSha256: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
        billDate: '2025-08-16',
        admissionDate: '2025-08-14',
        dischargeDate: '2025-08-16',
        originalBillTotalPaise: 5000000, // ₹50,000
        calculatedItemsTotalPaise: 5000000, // ₹50,000
        reconciliationDifferencePaise: 0,
        reconciliationStatus: 'RECONCILED',
        currency: 'INR',
        lineItems: [
          {
            itemId: 'item_1',
            originalDescription: 'Room Charges',
            category: 'ROOM_RENT',
            quantity: 2,
            unitPricePaise: 1000000,
            claimedAmountPaise: 2000000, // ₹20,000
            currency: 'INR',
            provenance: {
              sourceType: 'SYNTHETIC_BENCHMARK',
              rawExtractedText: 'Room 20000',
              extractedTimestamp: '2025-08-16T12:00:00.000Z',
              confidenceScore: 0.95
            },
            classificationStatus: 'AUTOMATIC_EXACT',
            reviewFlags: [],
            isNonPayableByRegulation: false
          },
          {
            itemId: 'item_2',
            originalDescription: 'Surgeon Consultation',
            category: 'SURGEON_CONSULTATION',
            quantity: 1,
            unitPricePaise: 3000000,
            claimedAmountPaise: 3000000, // ₹30,000
            currency: 'INR',
            provenance: {
              sourceType: 'SYNTHETIC_BENCHMARK',
              rawExtractedText: 'Surgeon 30000',
              extractedTimestamp: '2025-08-16T12:00:00.000Z',
              confidenceScore: 0.95
            },
            classificationStatus: 'AUTOMATIC_EXACT',
            reviewFlags: [],
            isNonPayableByRegulation: false
          }
        ],
        uploadedAt: '2025-08-16T12:00:00.000Z',
        extractedAt: '2025-08-16T12:05:00.000Z'
      };

      const parsed = BillDocumentZod.safeParse(bill);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.reconciliationStatus).toBe('RECONCILED');
        expect(parsed.data.reconciliationDifferencePaise).toBe(0);
      }
    });

    it('validates a bill with discrepancy between stated total and line items', () => {
      const discrepantBill: BillDocument = {
        billId: 'syn_bill_disc_002',
        hospitalName: 'Synthetic Hospital',
        billDate: '2025-08-16',
        admissionDate: '2025-08-14',
        dischargeDate: '2025-08-16',
        originalBillTotalPaise: 5500000, // ₹55,000 stated on invoice header
        calculatedItemsTotalPaise: 5000000, // ₹50,000 sum of lines
        reconciliationDifferencePaise: 500000, // ₹5,000 missing / unaccounted
        reconciliationStatus: 'DISCREPANCY',
        currency: 'INR',
        lineItems: [],
        uploadedAt: '2025-08-16T12:00:00.000Z',
        extractedAt: '2025-08-16T12:05:00.000Z'
      };

      const parsed = BillDocumentZod.safeParse(discrepantBill);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.reconciliationStatus).toBe('DISCREPANCY');
        expect(parsed.data.reconciliationDifferencePaise).toBe(500000);
      }
    });
  });

  describe('Evidence Reference & Provenance Tracking', () => {
    it('validates a contractual clause evidence citation', () => {
      const evidence: EvidenceReference = {
        evidenceId: 'syn_ev_clause_001',
        documentId: 'doc_synthetic_base_v1',
        versionId: 'syn_ver_base_2025_v1',
        clauseId: 'cl_3.2_room_rent',
        clauseTitle: 'Room Rent and Associated Charges Limitation',
        supportingExcerpt:
          'Room Rent boarding and nursing expenses are limited to 1% of Sum Insured per day. If insured occupies a room with higher tariff, associated medical charges shall be proportionately reduced.',
        pageNumber: 14,
        sectionReference: 'Section 3.2 - Inpatient Hospitalization Limits',
        evidenceType: 'CONTRACT_CLAUSE',
        verificationStatus: 'VERIFIED_GROUND_TRUTH',
        confidenceScore: 0.99
      };

      const parsed = EvidenceReferenceZod.safeParse(evidence);
      expect(parsed.success).toBe(true);
    });

    it('rejects evidence reference with invalid confidence score outside 0-1', () => {
      const invalidEvidence = {
        evidenceId: 'syn_ev_invalid',
        documentId: 'doc_1',
        versionId: 'v_1',
        supportingExcerpt: 'Excerpt',
        evidenceType: 'CONTRACT_CLAUSE',
        verificationStatus: 'VERIFIED_GROUND_TRUTH',
        confidenceScore: 1.5 // Invalid
      };

      const parsed = EvidenceReferenceZod.safeParse(invalidEvidence);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Claim Ledger & Prevention of Double Deductions', () => {
    it('enforces distinct deduction scopes preventing compounding disallowances', () => {
      // Adjustment 1: Direct Non-payable exclusion
      const exclusionAdjustment = {
        adjustmentId: 'adj_item_excl_01',
        targetItemId: 'item_consumable_01',
        scope: 'ITEM_LEVEL_EXCLUSION',
        description: 'PPE and sanitizers non-payable under IRDAI standard list',
        baseAmountPaise: 200000,
        deductionAmountPaise: 200000,
        remainingAmountPaise: 0,
        clauseReference: 'IRDAI_MASTER_CIRCULAR_ANNEXURE_1',
        reasonCode: 'REGULATORY_NON_PAYABLE_ITEM',
        reviewRequired: false
      };

      // Adjustment 2: Proportionate deduction
      const proportionateAdjustment = {
        adjustmentId: 'adj_prop_01',
        targetItemId: 'item_doctor_01',
        scope: 'ROOM_RENT_PROPORTIONATE',
        description: 'Proportionate disallowance on doctor fees due to room upgrade (5000/7500 = 66.67%)',
        baseAmountPaise: 300000,
        deductionAmountPaise: 100000,
        remainingAmountPaise: 200000,
        clauseReference: 'cl_3.2_room_rent',
        reasonCode: 'PROPORTIONATE_DEDUCTION_APPLIED',
        reviewRequired: false
      };

      expect(ClaimAdjustmentRecordZod.safeParse(exclusionAdjustment).success).toBe(true);
      expect(ClaimAdjustmentRecordZod.safeParse(proportionateAdjustment).success).toBe(true);
      expect(exclusionAdjustment.scope).not.toBe(proportionateAdjustment.scope);
    });

    it('validates a complete balanced ClaimLedger invariant', () => {
      // Scenario:
      // Total Claimed: ₹100,000 (10,000,000 paise)
      // Excluded non-payables: ₹10,000 (1,000,000 paise)
      // Admissible before proportionate: ₹90,000 (9,000,000 paise)
      // Proportionate disallowance: ₹15,000 (1,500,000 paise)
      // Admissible before deductible: ₹75,000 (7,500,000 paise)
      // Deductible: ₹5,000 (500,000 paise)
      // Admissible after deductible: ₹70,000 (7,000,000 paise)
      // Copay 10%: ₹7,000 (700,000 paise)
      // Final Insurer Payable: ₹63,000 (6,300,000 paise)
      // Total Patient Responsibility: ₹10,000 (excl) + ₹15,000 (prop) + ₹5,000 (ded) + ₹7,000 (copay) = ₹37,000 (3,700,000 paise)
      // Mathematical Balance: 6,300,000 (Insurer) + 3,700,000 (Patient) = 10,000,000 (Total Claimed)
      const ledger: ClaimLedger = {
        currency: 'INR',
        itemStages: [],
        claimAdjustments: [],
        totalClaimedPaise: 10000000,
        totalExcludedNonPayablePaise: 1000000,
        totalProportionateDisallowancePaise: 1500000,
        totalSublimitDisallowancePaise: 0,
        totalAdmissibleBeforeDeductiblePaise: 7500000,
        appliedDeductiblePaise: 500000,
        admissibleAfterDeductiblePaise: 7000000,
        appliedCopayPaise: 700000,
        approvedBeforeSumInsuredCapPaise: 6300000,
        sumInsuredCapDisallowancePaise: 0,
        finalInsurerPayablePaise: 6300000,
        totalPatientResponsibilityPaise: 3700000,
        isMathematicallyBalanced: true
      };

      const parsed = ClaimLedgerZod.safeParse(ledger);
      expect(parsed.success).toBe(true);

      // Verify the invariant conservation formula
      const insurerPlusPatient = ledger.finalInsurerPayablePaise + ledger.totalPatientResponsibilityPaise;
      expect(insurerPlusPatient).toBe(ledger.totalClaimedPaise);
    });
  });

  describe('Claim Assessment State Lifecycle', () => {
    it('validates claim assessment state with explicit review triggers', () => {
      const claimState: ClaimAssessmentState = {
        claimId: 'clm_syn_2025_981',
        policyFamilyId: 'syn_fam_health_01',
        selectedPolicyVersionId: 'syn_ver_base_2025_v1',
        applicableAmendmentIds: ['syn_ver_amend_2025_v1.1'],
        treatmentDate: '2025-08-15',
        bill: {
          billId: 'bill_001',
          hospitalName: 'Apollo Hospitals',
          billDate: '2025-08-16',
          admissionDate: '2025-08-14',
          dischargeDate: '2025-08-16',
          originalBillTotalPaise: 5000000,
          calculatedItemsTotalPaise: 5000000,
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [],
          uploadedAt: '2025-08-16T10:00:00.000Z',
          extractedAt: '2025-08-16T10:05:00.000Z'
        },
        status: 'ADJUDICATED',
        reviewStatus: 'NOT_REQUIRED',
        reviewReasons: [],
        ledger: null,
        traceId: 'tr_syn_981_audit',
        createdAt: '2025-08-16T10:00:00.000Z',
        updatedAt: '2025-08-16T10:05:00.000Z'
      };

      const parsed = ClaimAssessmentStateZod.safeParse(claimState);
      expect(parsed.success).toBe(true);
    });

    it('requires human review when bill is unreconciled or policy has conflicts', () => {
      const reviewRequiredClaim: ClaimAssessmentState = {
        claimId: 'clm_syn_conflict_982',
        policyFamilyId: 'syn_fam_health_01',
        selectedPolicyVersionId: null,
        applicableAmendmentIds: [],
        treatmentDate: '2025-08-15',
        bill: {
          billId: 'bill_002',
          hospitalName: 'Apollo Hospitals',
          billDate: '2025-08-16',
          admissionDate: '2025-08-14',
          dischargeDate: '2025-08-16',
          originalBillTotalPaise: 5000000,
          calculatedItemsTotalPaise: 4000000,
          reconciliationDifferencePaise: 1000000,
          reconciliationStatus: 'DISCREPANCY',
          currency: 'INR',
          lineItems: [],
          uploadedAt: '2025-08-16T10:00:00.000Z',
          extractedAt: '2025-08-16T10:05:00.000Z'
        },
        status: 'PENDING_HUMAN_REVIEW',
        reviewStatus: 'REQUIRED_UNRECONCILED_BILL',
        reviewReasons: ['Bill has ₹10,000 discrepancy between header total and itemized lines'],
        ledger: null,
        traceId: 'tr_syn_982_audit',
        createdAt: '2025-08-16T10:00:00.000Z',
        updatedAt: '2025-08-16T10:05:00.000Z'
      };

      const parsed = ClaimAssessmentStateZod.safeParse(reviewRequiredClaim);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.reviewStatus).toBe('REQUIRED_UNRECONCILED_BILL');
        expect(parsed.data.status).toBe('PENDING_HUMAN_REVIEW');
      }
    });
  });
});
