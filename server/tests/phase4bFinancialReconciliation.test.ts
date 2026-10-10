import { describe, it, expect } from 'vitest';
import { claimAdjudicationService } from '../src/services/claimAdjudicationService.js';
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaise,
  BillDocument,
  ClaimLineItem,
  StandardChargeCategory
} from '../src/types/claim.js';
import { PolicyDocument } from '../types/policy.js';
import { PolicyVersionRecord } from '../types/policyVersion.js';
import { ClaimAdjudicationRequest } from '../src/types/adjudication.js';
import { BillItemVerificationResult } from '../src/types/verification.js';

// Helper to construct a standard mock policy
function createMockPolicy(overrides: Partial<PolicyDocument> = {}): PolicyDocument {
  return {
    _id: 'pol_star_fho_01',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    confirmedByUser: true,
    insurer: 'Star Health and Allied Insurance Co Ltd',
    insurerAliases: ['Star Health'],
    planName: 'Family Health Optima Insurance Plan',
    policyType: 'individual',
    policyNumber: 'STAR-POL-2024-8891',
    uin: 'SHAHLIP21023V022021',
    policyStartDate: '2024-01-01',
    policyEndDate: '2024-12-31',
    zone: 'Tier 1',
    networkType: 'all-network',
    cashlessAvailable: true,
    tpa: null,
    insuredPersons: [],
    sumInsured: 500000,
    roomLimit: { type: 'amount', value: 5000 },
    icuLimit: { type: 'none' },
    copay: 0,
    nonNetworkCopay: 20,
    copayConditions: {},
    deductible: 0,
    proportionateDeduction: true,
    subLimits: { cataract: 35000 },
    restorationBenefit: true,
    cumulativeBonus: 0,
    ...overrides
  } as PolicyDocument;
}

// Helper to construct a standard bill document
function createBill(billId: string, items: ClaimLineItem[]): BillDocument {
  const totalPaise = items.reduce((sum, it) => sum + it.claimedAmountPaise, 0);
  return {
    billId,
    hospitalName: 'Apollo Speciality Hospitals',
    hospitalId: 'hosp_apollo_01',
    patientName: 'Adversarial Test Patient',
    invoiceNumber: `INV-${billId.toUpperCase()}`,
    admissionDate: '2024-06-10',
    dischargeDate: '2024-06-14',
    currency: 'INR',
    originalBillTotalPaise: totalPaise,
    netPayablePaise: totalPaise,
    lineItems: items,
    extractionProvenance: {
      sourceType: 'STRUCTURED_JSON_TEMPLATE',
      rawExtractedText: `Invoice ${billId}`,
      extractedTimestamp: new Date().toISOString(),
      confidenceScore: 0.98
    }
  };
}

// Helper to create a single line item
function createItem(
  itemId: string,
  desc: string,
  category: StandardChargeCategory,
  quantity: number,
  unitPriceRupees: number,
  isNonPayable: boolean = false
): ClaimLineItem {
  const unitPricePaise = rupeesToPaise(unitPriceRupees);
  const claimedAmountPaise = quantity * unitPricePaise;
  return {
    itemId,
    originalDescription: desc,
    category,
    quantity,
    unitPricePaise,
    claimedAmountPaise,
    isNonPayableByRegulation: isNonPayable,
    provenance: {
      sourceType: 'OCR_PDF_EXTRACTION',
      rawExtractedText: desc,
      extractedTimestamp: '2024-06-14T10:00:00Z',
      confidenceScore: 0.95
    }
  };
}

describe('Phase 4B: Financial Reconciliation & Adversarial Testing Suite', () => {
  // ==========================================================================
  // Test 1: Multiple simultaneous deductions
  // ==========================================================================
  it('1. Multiple simultaneous deductions: hand-calculated multi-factor reconciliation', () => {
    // Total Claimed: ₹1,70,000 (17,000,000 paise)
    const items = [
      createItem('item_room', 'Deluxe AC Room Rent', 'ROOM_RENT', 4, 9000), // ₹36,000 (claimed ₹9k vs ₹5k limit)
      createItem('item_surg', 'Lead Surgeon Operative Fee', 'SURGEON_CONSULTATION', 1, 50000), // ₹50,000
      createItem('item_ot', 'Modular OT Facility Charges', 'OT_CHARGES', 1, 30000), // ₹30,000
      createItem('item_cataract', 'Cataract Daycare Surgery', 'DAYCARE_PACKAGE', 1, 45000), // ₹45,000 (limit ₹35k)
      createItem('item_ppe', 'Disposable PPE Kit and Gloves', 'CONSUMABLES_NON_PAYABLES', 1, 4000, true), // ₹4,000 (100% excluded)
      createItem('item_meds', 'Inpatient Antibiotic Medication', 'MEDICINES_PHARMACY', 1, 5000) // ₹5,000 (unscaled)
    ];
    const bill = createBill('bill_p4b_multi_01', items);
    const policy = createMockPolicy({
      roomLimit: { type: 'amount', value: 5000 },
      proportionateDeduction: true,
      subLimits: { cataract: 35000 },
      deductible: 15000,
      copay: 10
    });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_p4b_01',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeductionSupported: true,
        sublimitsPaise: { cataract: rupeesToPaise(35000) },
        deductiblePaise: rupeesToPaise(15000),
        copayPercentage: 10,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // Hand-Calculated Ground Truth Oracles:
    // 1. Total Claimed: ₹170,000 (17,000,000 paise)
    expect(result.ledger.totalClaimedPaise).toBe(17000000);

    // 2. Excluded: PPE ₹4,000 (400,000) + Room excess (9,000 - 5,000)*4 = ₹16,000 (1,600,000) = ₹20,000 (2,000,000 paise)
    expect(result.ledger.totalExcludedNonPayablePaise).toBe(2000000);

    // 3. Sublimit: Cataract 45,000 - 35,000 = ₹10,000 (1,000,000 paise)
    expect(result.ledger.totalSublimitDisallowancePaise).toBe(1000000);

    // 4. Proportionate Deduction:
    // Scale ratio: (9,000 - 5,000) / 9,000 = 4/9 = 44.4444...%
    // Surgeon fee: 50,000 * 4/9 = Math.round(200,000 / 9) = 2,222,222 paise
    // OT charges: 30,000 * 4/9 = Math.round(120,000 / 9) = 1,333,333 paise
    // Cataract (Daycare Package): 35,000 * 4/9 = Math.round(140,000 / 9) = 1,555,556 paise
    // Total proportionate deduction = 2,222,222 + 1,333,333 + 1,555,556 = 5,111,111 paise (₹51,111.11)
    expect(result.ledger.totalProportionateDisallowancePaise).toBe(5111111);

    // 5. Admissible before deductible:
    // Room (20,000) + Surgeon (27,778) + OT (16,667) + Cataract (19,444) + Meds (5,000) = 8,888,889 paise
    expect(result.ledger.totalAdmissibleBeforeDeductiblePaise).toBe(8888889);

    // 6. Deductible: ₹15,000 (1,500,000 paise)
    expect(result.ledger.appliedDeductiblePaise).toBe(1500000);
    // Remainder after deductible = 8,888,889 - 1,500,000 = 7,388,889 paise
    expect(result.ledger.admissibleAfterDeductiblePaise).toBe(7388889);

    // 7. Copay: 10% on post-deductible remainder = Math.round(7,388,889 * 10 / 100) = 738,889 paise (₹7,388.89)
    expect(result.ledger.appliedCopayPaise).toBe(738889);

    // 8. Approved Insurer Share = 7,388,889 - 738,889 = 6,650,000 paise (₹66,500.00)
    expect(result.ledger.finalInsurerPayablePaise).toBe(6650000);

    // 9. Total Patient Share = 17,000,000 - 6,650,000 = 10,350,000 paise (₹103,500.00)
    expect(result.ledger.totalPatientResponsibilityPaise).toBe(10350000);

    // Invariant verification
    expect(result.invariants.isMathematicallyBalanced).toBe(true);
    expect(result.ledger.finalInsurerPayablePaise + result.ledger.totalPatientResponsibilityPaise).toBe(result.ledger.totalClaimedPaise);
    expect(result.invariants.hasDoubleDeductions).toBe(false);
  });

  // ==========================================================================
  // Test 2: Room-rent excess with proportionate disallowance
  // ==========================================================================
  it('2. Room-rent excess with proportionate disallowance: verifies non-double deduction and exempt categories', () => {
    // 2 days room rent @ ₹10,000 vs ₹5,000 cap = 50% scale
    const items = [
      createItem('item_room', 'Room Rent General ICU Stepdown', 'ROOM_RENT', 2, 10000), // ₹20,000
      createItem('item_surg', 'Doctor Consultation', 'SURGEON_CONSULTATION', 1, 30000), // ₹30,000 -> 50% = ₹15,000
      createItem('item_diag', 'MRI Imaging Diagnostics', 'INVESTIGATIONS_DIAGNOSTICS', 1, 10000) // ₹10,000 -> exempt
    ];
    const bill = createBill('bill_p4b_room_02', items);
    const policy = createMockPolicy({
      roomLimit: { type: 'amount', value: 5000 },
      proportionateDeduction: true
    });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_p4b_02',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeductionSupported: true,
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // Room excess = (10,000 - 5,000) * 2 = ₹10,000 (1,000,000 paise)
    expect(result.ledger.totalExcludedNonPayablePaise).toBe(1000000);
    // Proportionate ratio: (10,000 - 5,000) / 10,000 = 50%
    // Surgeon fee disallowance = 30,000 * 50% = ₹15,000 (1,500,000 paise)
    expect(result.ledger.totalProportionateDisallowancePaise).toBe(1500000);

    // Diagnostics is exempt from proportionate deduction
    const diagEntry = result.itemizedLedger.find(i => i.category === 'INVESTIGATIONS_DIAGNOSTICS');
    expect(diagEntry?.proportionateDisallowancePaise).toBe(0);
    expect(diagEntry?.insurerPayablePaise).toBe(1000000); // ₹10,000 100% admissible

    // Insurer: 10,000 (room) + 15,000 (surgeon) + 10,000 (diag) = ₹35,000 (3,500,000 paise)
    expect(result.ledger.finalInsurerPayablePaise).toBe(3500000);
    // Patient: 60,000 - 35,000 = ₹25,000 (2,500,000 paise)
    expect(result.ledger.totalPatientResponsibilityPaise).toBe(2500000);
    expect(result.invariants.isMathematicallyBalanced).toBe(true);
  });

  // ==========================================================================
  // Test 3: Procedure sub-limit combined with co-payment
  // ==========================================================================
  it('3. Procedure sub-limit combined with co-payment: co-payment applies strictly to post-sublimit base', () => {
    // Billed Cataract: ₹70,000 (Sub-limit cap: ₹40,000)
    const items = [
      createItem('item_cataract', 'Cataract Surgery Phacoemulsification', 'DAYCARE_PACKAGE', 1, 70000)
    ];
    const bill = createBill('bill_p4b_sub_copay_03', items);
    const policy = createMockPolicy({
      subLimits: { cataract: 40000 },
      copay: 15,
      deductible: 0
    });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_p4b_03',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        sublimitsPaise: { cataract: rupeesToPaise(40000) },
        copayPercentage: 15,
        deductiblePaise: 0,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // 1. Sublimit deduction = 70,000 - 40,000 = ₹30,000 (3,000,000 paise)
    expect(result.ledger.totalSublimitDisallowancePaise).toBe(3000000);
    // 2. Admissible after sublimit = ₹40,000 (4,000,000 paise)
    expect(result.ledger.totalAdmissibleBeforeDeductiblePaise).toBe(4000000);
    // 3. Co-payment: 15% on post-sublimit admissible ₹40,000 = ₹6,000 (600,000 paise)
    expect(result.ledger.appliedCopayPaise).toBe(600000);
    // 4. Approved Insurer Share = 40,000 - 6,000 = ₹34,000 (3,400,000 paise)
    expect(result.ledger.finalInsurerPayablePaise).toBe(3400000);
    // 5. Patient Payable = 30,000 (sublimit excess) + 6,000 (copay) = ₹36,000 (3,600,000 paise)
    expect(result.ledger.totalPatientResponsibilityPaise).toBe(3600000);

    // Verifies that copay did NOT apply on the uncapped 70k (which would be 10,500)
    expect(result.ledger.appliedCopayPaise).not.toBe(1050000);
    expect(result.invariants.isMathematicallyBalanced).toBe(true);
  });

  // ==========================================================================
  // Test 4: Deductible ordering and double-deduction prevention
  // ==========================================================================
  it('4. Deductible ordering and double-deduction prevention: deductible applies to admissible charges, not exclusions', () => {
    const items = [
      createItem('item_ppe', 'Surgical Face Shields & Gloves', 'CONSUMABLES_NON_PAYABLES', 1, 20000, true), // ₹20,000 (excluded)
      createItem('item_proc', 'General Inpatient Surgery Procedure', 'DAYCARE_PACKAGE', 1, 100000) // ₹100,000
    ];
    const bill = createBill('bill_p4b_ded_ord_04', items);
    const policy = createMockPolicy({
      deductible: 25000,
      copay: 20
    });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_p4b_04',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: rupeesToPaise(25000),
        copayPercentage: 20,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // 1. Excluded: PPE ₹20,000 (2,000,000 paise)
    expect(result.ledger.totalExcludedNonPayablePaise).toBe(2000000);
    // 2. Admissible before deductible = ₹100,000 (10,000,000 paise)
    expect(result.ledger.totalAdmissibleBeforeDeductiblePaise).toBe(10000000);
    // 3. Deductible applied = ₹25,000 (2,500,000 paise)
    expect(result.ledger.appliedDeductiblePaise).toBe(2500000);
    // 4. Post-deductible remainder = 100,000 - 25,000 = ₹75,000 (7,500,000 paise)
    expect(result.ledger.admissibleAfterDeductiblePaise).toBe(7500000);
    // 5. Co-payment: 20% on 75,000 = ₹15,000 (1,500,000 paise)
    expect(result.ledger.appliedCopayPaise).toBe(1500000);
    // 6. Approved Insurer Share = 75,000 - 15,000 = ₹60,000 (6,000,000 paise)
    expect(result.ledger.finalInsurerPayablePaise).toBe(6000000);
    // 7. Patient Share = 20,000 (excluded) + 25,000 (deductible) + 15,000 (copay) = ₹60,000 (6,000,000 paise)
    expect(result.ledger.totalPatientResponsibilityPaise).toBe(6000000);

    // Double deduction checks:
    const dedRecords = result.adjustmentLedger.filter(a => a.scope === 'CLAIM_DEDUCTIBLE');
    expect(dedRecords.length).toBe(1);
    const copayRecords = result.adjustmentLedger.filter(a => a.scope === 'CLAIM_COPAY');
    expect(copayRecords.length).toBe(1);

    expect(result.invariants.isMathematicallyBalanced).toBe(true);
    expect(result.invariants.hasDoubleDeductions).toBe(false);
  });

  // ==========================================================================
  // Test 5: Excluded and unclassified bill items
  // ==========================================================================
  it('5. Excluded and unclassified bill items: preserves all items, isolates unclassified into review pool', () => {
    const items = [
      createItem('item_approved', 'Specialist Consultation Fee', 'SURGEON_CONSULTATION', 1, 20000),
      createItem('item_excluded', 'Administrative Documentation Kit', 'CONSUMABLES_NON_PAYABLES', 1, 5000, true),
      {
        ...createItem('item_unclass', 'Unclassified Ancillary Surcharge', 'MISCELLANEOUS', 1, 10000),
        classificationStatus: 'UNCLASSIFIED' as const
      }
    ];
    // Total Claimed: 20k + 5k + 10k = ₹35,000 (3,500,000 paise)
    const bill = createBill('bill_p4b_unclass_05', items);
    const policy = createMockPolicy({ copay: 0, deductible: 0 });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_p4b_05',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // All items preserved in ledger
    expect(result.itemizedLedger.length).toBe(3);

    const approvedItem = result.itemizedLedger.find(i => i.itemId === 'item_approved');
    expect(approvedItem?.status).toBe('DETERMINED');
    expect(approvedItem?.insurerPayablePaise).toBe(2000000);

    const excludedItem = result.itemizedLedger.find(i => i.itemId === 'item_excluded');
    expect(excludedItem?.status).toBe('DETERMINED');
    expect(excludedItem?.excludedNonPayablePaise).toBe(500000);

    const unclassItem = result.itemizedLedger.find(i => i.itemId === 'item_unclass');
    expect(unclassItem?.status).toBe('REQUIRES_REVIEW');
    expect(unclassItem?.reviewRequired).toBe(true);

    expect(result.reviewRequired).toBe(true);
    expect(result.accountingSummary?.unresolvedAmount).toBeGreaterThanOrEqual(10000);
    expect(result.invariants.isMathematicallyBalanced).toBe(true);
  });

  // ==========================================================================
  // Test 6: Missing or contradictory policy evidence
  // ==========================================================================
  it('6. Missing or contradictory policy evidence: flags conflicting clauses and halts deterministic resolution', () => {
    const items = [
      createItem('item_conflict', 'Experimental Robotic Surgery Procedure', 'SURGEON_CONSULTATION', 1, 80000)
    ];
    const bill = createBill('bill_p4b_conflict_06', items);
    const policy = createMockPolicy({ copay: 0, deductible: 0 });

    const verifiedEvidence: BillItemVerificationResult[] = [
      {
        billItemId: 'item_conflict',
        proposedInterpretation: 'Robotic Surgery Entitlement vs General Unproven Exclusion',
        outcome: 'conflicting',
        supportingEvidence: [
          {
            clauseId: 'cl_modern_treatment',
            versionId: 'v1.0',
            documentId: 'doc_base',
            heading: 'Modern Treatment Methods',
            section: 'Clause 3.2',
            exactExcerpt: 'Robotic surgery covered up to ₹1,00,000.',
            pageNumber: 14,
            clauseType: 'coverage',
            precedenceRole: 'CONTROLLING',
            precedenceReason: 'IRDAI Modern Treatment Schedule',
            retrievalScore: 0.95,
            citationVerified: true
          }
        ],
        adverseExclusionEvidence: [
          {
            clauseId: 'cl_unproven_excl',
            versionId: 'v1.0',
            documentId: 'doc_base',
            heading: 'General Exclusions',
            section: 'Clause 4.12',
            exactExcerpt: 'Unproven, novel, or robotic systems are excluded from payment.',
            pageNumber: 26,
            clauseType: 'exclusion',
            precedenceRole: 'CONTROLLING',
            precedenceReason: 'Contractual Exclusion',
            retrievalScore: 0.92,
            citationVerified: true
          }
        ],
        conflictingEvidence: [],
        conditionalRequirements: [],
        missingFacts: [],
        reviewRequired: true,
        reviewReasons: ['Conflicting contractual clauses detected for robotic surgery.'],
        confidence: { level: 'MEDIUM', explanation: 'Direct conflict between coverage and exclusion clauses' },
        explanation: 'Contradictory policy evidence'
      }
    ];

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_p4b_06',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      verifiedItemEvidence: verifiedEvidence,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // Contradictory evidence MUST trigger review
    expect(result.reviewRequired).toBe(true);
    expect(result.claimStatus).toBe('PENDING_HUMAN_REVIEW');
    expect(result.reviewStatus).toBe('REQUIRED_CONFLICTING_VERSIONS');
    const conflictEntry = result.itemizedLedger[0];
    expect(conflictEntry.status).toBe('REQUIRES_REVIEW');
    expect(conflictEntry.reviewReasons.some(r => r.includes('Conflicting'))).toBe(true);
  });

  // ==========================================================================
  // Test 7: Endorsements effective before versus after the treatment date
  // ==========================================================================
  it('7. Endorsements effective before versus after treatment date: temporal resolution chooses correct policy terms', () => {
    // Base policy: Cataract limit ₹40,000 (effective 2024-01-01)
    const basePolicyData = createMockPolicy({ subLimits: { cataract: 40000 } });
    const baseVersion: PolicyVersionRecord = {
      familyId: 'star_fho_lineage',
      versionId: 'ver_star_base_2024',
      versionNumber: '1.0',
      documentType: 'BASE_POLICY',
      parentVersionId: null,
      amendmentScope: null,
      insurerName: 'Star Health',
      planName: 'Family Health Optima',
      documentId: 'doc_base_pdf',
      effectiveFrom: '2024-01-01',
      effectiveTo: '2024-12-31',
      uploadTimestamp: '2024-01-01T00:00:00.000Z',
      extractedTimestamp: '2024-01-01T00:00:00.000Z',
      policyData: basePolicyData,
      clauseModifications: []
    };

    // Endorsement amendment: enhances Cataract limit to ₹50,000 effective 2024-09-01
    const endorsementVersion: PolicyVersionRecord = {
      familyId: 'star_fho_lineage',
      versionId: 'ver_star_endorse_2024',
      versionNumber: '1.1',
      documentType: 'AMENDMENT',
      parentVersionId: 'ver_star_base_2024',
      amendmentScope: 'MODIFIES_SPECIFIC_CLAUSES',
      insurerName: 'Star Health',
      planName: 'Family Health Optima',
      documentId: 'doc_endorsement_pdf',
      effectiveFrom: '2024-09-01',
      effectiveTo: '2024-12-31',
      uploadTimestamp: '2024-09-01T00:00:00.000Z',
      extractedTimestamp: '2024-09-01T00:00:00.000Z',
      policyData: {
        ...basePolicyData,
        subLimits: { cataract: 50000 }
      },
      clauseModifications: [
        {
          clauseId: 'mod_cataract_cap',
          changeType: 'MODIFIED',
          targetPath: 'subLimits.cataract',
          newClauseText: 'Cataract sub-limit enhanced to ₹50,000 per eye.',
          description: 'Endorsement amendment enhancing cataract limit'
        }
      ]
    };

    const bill = createBill('bill_p4b_temporal_07', [
      createItem('item_cataract', 'Cataract Surgery Procedure', 'DAYCARE_PACKAGE', 1, 60000)
    ]);

    // Case A: Treatment date BEFORE endorsement (2024-05-15) -> Base sublimit ₹40,000 applies
    const requestBefore: ClaimAdjudicationRequest = {
      requestId: 'req_temp_before',
      treatmentDate: '2024-05-15',
      bill,
      policyFamilyId: 'star_fho_lineage',
      policyVersions: [baseVersion, endorsementVersion],
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    };
    const resultBefore = claimAdjudicationService.adjudicateClaim(requestBefore);
    // Insurer: ₹40,000 (4,000,000 paise); Patient: ₹20,000 (2,000,000 paise)
    expect(resultBefore.ledger.finalInsurerPayablePaise).toBe(4000000);
    expect(resultBefore.ledger.totalSublimitDisallowancePaise).toBe(2000000);

    // Case B: Treatment date AFTER endorsement (2024-10-15) -> Enhanced sublimit ₹50,000 applies
    const requestAfter: ClaimAdjudicationRequest = {
      requestId: 'req_temp_after',
      treatmentDate: '2024-10-15',
      bill,
      policyFamilyId: 'star_fho_lineage',
      policyVersions: [baseVersion, endorsementVersion],
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    };
    const resultAfter = claimAdjudicationService.adjudicateClaim(requestAfter);
    // Insurer: ₹50,000 (5,000,000 paise); Patient: ₹10,000 (1,000,000 paise)
    expect(resultAfter.ledger.finalInsurerPayablePaise).toBe(5000000);
    expect(resultAfter.ledger.totalSublimitDisallowancePaise).toBe(1000000);
  });

  // ==========================================================================
  // Test 8: Financial reconciliation, including unresolved amounts
  // ==========================================================================
  it('8. Financial reconciliation, including unresolved amounts: strictly verifies mathematical conservation', () => {
    const items = [
      createItem('item_clean', 'Routine Doctor Consultation', 'SURGEON_CONSULTATION', 1, 50000), // ₹50,000 (verified)
      {
        ...createItem('item_review', 'Unclassified Ancillary Pharmacy Fee', 'MISCELLANEOUS', 1, 30000), // ₹30,000 (unresolved)
        classificationStatus: 'UNCLASSIFIED' as const
      }
    ];
    // Total Claimed: ₹80,000 (8,000,000 paise)
    const bill = createBill('bill_p4b_reconciliation_08', items);
    const policy = createMockPolicy({ copay: 0, deductible: 0 });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_p4b_08',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // 1. Accounting Summary Existence & Correctness
    expect(result.accountingSummary).toBeDefined();
    expect(result.accountingSummary?.totalClaimed).toBe(80000);
    expect(result.accountingSummary?.totalInsurerPayable).toBe(80000);
    expect(result.accountingSummary?.totalPatientPayable).toBe(0);
    expect(result.accountingSummary?.unresolvedAmount).toBe(30000);
    expect(result.accountingSummary?.isBalanced).toBe(true);

    // 2. Strict Conservation Law
    // Total Claimed === Insurer Share + Patient Share
    const sumShares = result.ledger.finalInsurerPayablePaise + result.ledger.totalPatientResponsibilityPaise;
    expect(sumShares).toBe(result.ledger.totalClaimedPaise);
    expect(result.invariants.isMathematicallyBalanced).toBe(true);

    // 3. Line-item sum matches claim totals
    const sumItemInsurer = result.itemizedLedger.reduce((sum, it) => sum + it.insurerPayablePaise, 0);
    const sumItemPatient = result.itemizedLedger.reduce((sum, it) => sum + it.patientResponsibilityPaise, 0);
    expect(sumItemInsurer).toBe(result.ledger.finalInsurerPayablePaise);
    expect(sumItemPatient).toBe(result.ledger.totalPatientResponsibilityPaise);
  });
});
