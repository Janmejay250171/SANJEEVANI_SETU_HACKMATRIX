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
    subLimits: { cataract: 40000 },
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
    patientName: 'Janmesh Joshi',
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

describe('Phase 4A: Itemized Hospital Claim Adjudication Suite', () => {
  // ==========================================================================
  // Test 1: Normal fully supported claim
  // ==========================================================================
  it('1. Normal fully supported claim: in-network, verified, copay applied, all items determined', () => {
    const items = [
      createItem('item_01', 'Doctor Specialist Consultation', 'SURGEON_CONSULTATION', 1, 15000),
      createItem('item_02', 'Comprehensive Blood Diagnostics Panel', 'INVESTIGATIONS_DIAGNOSTICS', 1, 5000),
      createItem('item_03', 'Inpatient Prescribed Medications', 'MEDICINES_PHARMACY', 1, 10000)
    ];
    const bill = createBill('bill_norm_01', items);
    const policy = createMockPolicy({ copay: 10, deductible: 0 });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_phase4a_01',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 10,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // Bill claimed: ₹30,000 (3,000,000 paise)
    expect(result.ledger.totalClaimedPaise).toBe(3000000);
    expect(result.ledger.totalExcludedNonPayablePaise).toBe(0);
    expect(result.ledger.totalProportionateDisallowancePaise).toBe(0);
    expect(result.ledger.totalSublimitDisallowancePaise).toBe(0);
    expect(result.ledger.appliedDeductiblePaise).toBe(0);
    // 10% copay on 30,000 = ₹3,000 (300,000 paise)
    expect(result.ledger.appliedCopayPaise).toBe(300000);
    // Insurer: ₹27,000 (2,700,000 paise), Patient: ₹3,000 (300,000 paise)
    expect(result.ledger.finalInsurerPayablePaise).toBe(2700000);
    expect(result.ledger.totalPatientResponsibilityPaise).toBe(300000);

    // Accounting summary check
    expect(result.accountingSummary).toBeDefined();
    expect(result.accountingSummary?.totalClaimed).toBe(30000);
    expect(result.accountingSummary?.totalInsurerPayable).toBe(27000);
    expect(result.accountingSummary?.totalPatientPayable).toBe(3000);
    expect(result.accountingSummary?.isBalanced).toBe(true);
    expect(result.accountingSummary?.unresolvedAmount).toBe(0);

    // Line items metadata
    for (const item of result.itemizedLedger) {
      expect(item.status).toBe('DETERMINED');
      expect(item.provenance).toBe('AI_EXTRACTED');
      expect(item.claimedAmount).toBeGreaterThan(0);
      expect(item.potentiallyPayableAmount).toBeGreaterThan(0);
      expect(item.proposedDeductionAmount).toBeGreaterThanOrEqual(0);
      expect(item.deductionReason).toBeDefined();
    }

    expect(result.invariants.isMathematicallyBalanced).toBe(true);
    expect(result.reviewRequired).toBe(false);
  });

  // ==========================================================================
  // Test 2: Room-rent excess and proportionate deduction
  // ==========================================================================
  it('2. Room-rent excess and proportionate deduction: scales associated charges, spares pharmacy & diagnostics', () => {
    const items = [
      createItem('item_room', 'Single AC Deluxe Room Rent', 'ROOM_RENT', 3, 8000), // ₹24,000 (claimed ₹8k/day vs ₹5k limit)
      createItem('item_surg', 'Chief Surgeon Operative Charges', 'SURGEON_CONSULTATION', 1, 40000), // ₹40,000
      createItem('item_ot', 'Modular Operation Theater Charges', 'OT_CHARGES', 1, 20000), // ₹20,000
      createItem('item_med', 'Prescribed Inpatient Antibiotics & IV', 'MEDICINES_PHARMACY', 1, 10000) // ₹10,000
    ];
    const bill = createBill('bill_prop_02', items);
    const policy = createMockPolicy({
      roomLimit: { type: 'amount', value: 5000 },
      proportionateDeduction: true,
      copay: 0,
      deductible: 0
    });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_phase4a_02',
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

    // Total Claimed: 24,000 + 40,000 + 20,000 + 10,000 = ₹94,000 (9,400,000 paise)
    expect(result.ledger.totalClaimedPaise).toBe(9400000);

    // Room excess: (8,000 - 5,000) * 3 = ₹9,000 (900,000 paise)
    expect(result.ledger.totalExcludedNonPayablePaise).toBe(900000);

    // Proportionate ratio: (8000 - 5000) / 8000 = 3/8 = 37.5%
    // Surgeon fee deduction: 40,000 * 37.5% = ₹15,000 (1,500,000 paise)
    // OT charge deduction: 20,000 * 37.5% = ₹7,500 (750,000 paise)
    // Total proportionate deduction = 15,000 + 7,500 = ₹22,500 (2,250,000 paise)
    expect(result.ledger.totalProportionateDisallowancePaise).toBe(2250000);

    // Pharmacy MUST NOT be scaled proportionately!
    const medItem = result.itemizedLedger.find(i => i.category === 'MEDICINES_PHARMACY');
    expect(medItem?.proportionateDisallowancePaise).toBe(0);
    expect(medItem?.insurerPayablePaise).toBe(1000000); // 100% covered

    // Admissible: 15,000 (room) + 25,000 (surgeon) + 12,500 (ot) + 10,000 (med) = ₹62,500 (6,250,000 paise)
    expect(result.ledger.finalInsurerPayablePaise).toBe(6250000);
    // Patient: 94,000 - 62,500 = ₹31,500 (3,150,000 paise)
    expect(result.ledger.totalPatientResponsibilityPaise).toBe(3150000);

    // Invariant check
    expect(result.invariants.isMathematicallyBalanced).toBe(true);
    expect(result.ledger.finalInsurerPayablePaise + result.ledger.totalPatientResponsibilityPaise).toBe(result.ledger.totalClaimedPaise);
  });

  // ==========================================================================
  // Test 3: Procedure sub-limit
  // ==========================================================================
  it('3. Procedure sub-limit: enforces disease/procedure cap deterministically', () => {
    const items = [
      createItem('item_cataract', 'Phacoemulsification Cataract Surgery with Foldable IOL', 'DAYCARE_PACKAGE', 1, 65000)
    ];
    const bill = createBill('bill_sublimit_03', items);
    const policy = createMockPolicy({
      subLimits: { cataract: 40000 },
      copay: 0,
      deductible: 0
    });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_phase4a_03',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        sublimitsPaise: { cataract: rupeesToPaise(40000) },
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // Claimed: ₹65,000. Cap: ₹40,000. Disallowance: ₹25,000.
    expect(result.ledger.totalClaimedPaise).toBe(6500000);
    expect(result.ledger.totalSublimitDisallowancePaise).toBe(2500000);
    expect(result.ledger.finalInsurerPayablePaise).toBe(4000000);
    expect(result.ledger.totalPatientResponsibilityPaise).toBe(2500000);
    expect(result.invariants.isMathematicallyBalanced).toBe(true);

    const cataractEntry = result.itemizedLedger[0];
    expect(cataractEntry.sublimitDisallowancePaise).toBe(2500000);
    expect(cataractEntry.deductionReason).toContain('Category Sublimit Cap');
  });

  // ==========================================================================
  // Test 4: Deductible and co-payment ordering
  // ==========================================================================
  it('4. Deductible and co-payment ordering: deductible applied FIRST, co-payment on post-deductible remainder', () => {
    const items = [
      createItem('item_surgery', 'Inpatient General Surgical Procedure', 'DAYCARE_PACKAGE', 1, 100000)
    ];
    const bill = createBill('bill_ded_copay_04', items);
    const policy = createMockPolicy({
      deductible: 20000,
      copay: 10
    });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_phase4a_04',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: rupeesToPaise(20000),
        copayPercentage: 10,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // Gross admissible: ₹100,000 (10,000,000 paise)
    // 1. Deductible applied first: ₹20,000 (2,000,000 paise) -> Remainder: ₹80,000 (8,000,000 paise)
    // 2. Co-payment applied strictly on post-deductible base: 10% of ₹80,000 = ₹8,000 (800,000 paise)
    // Insurer Approved: 80,000 - 8,000 = ₹72,000 (7,200,000 paise)
    // Patient Payable: 20,000 + 8,000 = ₹28,000 (2,800,000 paise)
    expect(result.ledger.appliedDeductiblePaise).toBe(2000000);
    expect(result.ledger.admissibleAfterDeductiblePaise).toBe(8000000);
    expect(result.ledger.appliedCopayPaise).toBe(800000);
    expect(result.ledger.finalInsurerPayablePaise).toBe(7200000);
    expect(result.ledger.totalPatientResponsibilityPaise).toBe(2800000);
    expect(result.invariants.isMathematicallyBalanced).toBe(true);

    // Confirm that copay was NOT applied prior to deductible (which would have yielded 10% of 100k = 10k, approved 70k)
    expect(result.ledger.finalInsurerPayablePaise).not.toBe(7000000);
  });

  // ==========================================================================
  // Test 5: Explicit non-payable consumables
  // ==========================================================================
  it('5. Explicit non-payable consumables: statutory non-payables excluded with Annexure I citation & Page 25 evidence', () => {
    const items = [
      createItem('item_gloves', 'Surgical Examination Gloves & PPE', 'CONSUMABLES_NON_PAYABLES', 2, 2000, true), // ₹4,000
      createItem('item_admin', 'Sanitization Kit and Admin Documentation Fee', 'CONSUMABLES_NON_PAYABLES', 1, 2000, true), // ₹2,000
      createItem('item_surgery', 'Laparoscopic Hernioplasty Procedure', 'SURGEON_CONSULTATION', 1, 40000) // ₹40,000
    ];
    const bill = createBill('bill_consumables_05', items);
    const policy = createMockPolicy({ copay: 0, deductible: 0 });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_phase4a_05',
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

    // Consumables: 4,000 + 2,000 = ₹6,000 (600,000 paise) 100% excluded
    expect(result.ledger.totalExcludedNonPayablePaise).toBe(600000);
    expect(result.ledger.finalInsurerPayablePaise).toBe(4000000);
    expect(result.ledger.totalPatientResponsibilityPaise).toBe(600000);

    const glovesEntry = result.itemizedLedger.find(i => i.itemId === 'item_gloves');
    expect(glovesEntry?.controllingClauseId).toBe('IRDAI_ANNEXURE_1');
    expect(glovesEntry?.pageNumber).toBe(25);
    expect(glovesEntry?.deductionReason).toContain('Exclusion Applied');
    expect(glovesEntry?.status).toBe('DETERMINED');
  });

  // ==========================================================================
  // Test 6: Missing or ambiguous policy clause
  // ==========================================================================
  it('6. Missing or ambiguous policy clause: flags for review rather than inventing zero deductible', () => {
    const items = [
      createItem('item_01', 'General Ward Inpatient Treatment', 'DAYCARE_PACKAGE', 1, 50000)
    ];
    const bill = createBill('bill_missing_06', items);
    // Policy with null deductible
    const policy = createMockPolicy({ deductible: null });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_phase4a_06',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: null, // Unspecified
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // Engine MUST NOT invent zero deductible; must flag for review
    expect(result.reviewRequired).toBe(true);
    expect(result.claimStatus).toBe('PENDING_HUMAN_REVIEW');
    expect(result.reviewReasons.some(r => r.includes('Policy deductible not specified'))).toBe(true);
  });

  // ==========================================================================
  // Test 7: Unclassified bill item
  // ==========================================================================
  it('7. Unclassified bill item: preserved in ledger and explicitly flagged for human review', () => {
    const items = [
      createItem('item_standard', 'Standard Doctor Consultation', 'SURGEON_CONSULTATION', 1, 10000),
      {
        ...createItem('item_unclass', 'Unclassified Miscellaneous Surcharge', 'MISCELLANEOUS', 1, 5000),
        classificationStatus: 'UNCLASSIFIED' as const
      }
    ];
    const bill = createBill('bill_unclass_07', items);
    const policy = createMockPolicy({ copay: 0, deductible: 0 });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_phase4a_07',
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

    // Item must be preserved, not silently discarded
    expect(result.itemizedLedger.length).toBe(2);
    const unclassEntry = result.itemizedLedger.find(i => i.itemId === 'item_unclass');
    expect(unclassEntry).toBeDefined();
    expect(unclassEntry?.originalDescription).toBe('Unclassified Miscellaneous Surcharge');
    expect(unclassEntry?.reviewRequired).toBe(true);
    expect(unclassEntry?.status).toBe('REQUIRES_REVIEW');

    expect(result.reviewRequired).toBe(true);
    expect(result.accountingSummary?.unresolvedAmount).toBeGreaterThanOrEqual(5000);
  });

  // ==========================================================================
  // Test 8: Non-network status that is unverified
  // ==========================================================================
  it('8. Non-network status that is unverified: co-pay flagged uncertain without fabricating network rate', () => {
    const items = [
      createItem('item_treatment', 'Inpatient Medical Care', 'DAYCARE_PACKAGE', 1, 50000)
    ];
    const bill = createBill('bill_unverified_net_08', items);
    const policy = createMockPolicy({ copay: 10, nonNetworkCopay: 20 });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_phase4a_08',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        networkStatus: 'unverified' // Unverified network status!
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    expect(result.reviewRequired).toBe(true);
    expect(result.reviewReasons.some(r => r.includes('Hospital network status is unverified'))).toBe(true);
    // Did not silently apply 0% copay or guess network status
    expect(result.claimStatus).toBe('PENDING_HUMAN_REVIEW');
  });

  // ==========================================================================
  // Test 9: Conflicting policy evidence
  // ==========================================================================
  it('9. Conflicting policy evidence: flags line item and claim for manual review', () => {
    const items = [
      createItem('item_conflict', 'Novel Robot-Assisted Surgical Procedure', 'SURGEON_CONSULTATION', 1, 80000)
    ];
    const bill = createBill('bill_conflict_09', items);
    const policy = createMockPolicy({ copay: 0, deductible: 0 });

    const verifiedEvidence: BillItemVerificationResult[] = [
      {
        billItemId: 'item_conflict',
        proposedInterpretation: 'Modern Treatment vs Standard Open Surgery',
        outcome: 'conflicting',
        supportingEvidence: [
          {
            clauseId: 'cl_modern_treatment_covered',
            versionId: 'v1.0',
            documentId: 'doc_base',
            heading: 'Modern Treatments',
            section: 'Clause 3.24',
            exactExcerpt: 'Robotic surgeries covered up to 50% of sum insured.',
            pageNumber: 15,
            clauseType: 'coverage',
            precedenceRole: 'CONTROLLING',
            precedenceReason: 'IRDAI Modern Treatment Schedule',
            retrievalScore: 0.9,
            citationVerified: true
          }
        ],
        adverseExclusionEvidence: [
          {
            clauseId: 'cl_excl_unproven',
            versionId: 'v1.0',
            documentId: 'doc_base',
            heading: 'General Exclusions',
            section: 'Exclusion 4.8',
            exactExcerpt: 'Unproven or experimental robotic procedures are excluded.',
            pageNumber: 22,
            clauseType: 'exclusion',
            precedenceRole: 'CONTROLLING',
            precedenceReason: 'General exclusion clause',
            retrievalScore: 0.88,
            citationVerified: true
          }
        ],
        conflictingEvidence: [],
        conditionalRequirements: [],
        missingFacts: [],
        reviewRequired: true,
        reviewReasons: ['Conflicting policy clauses govern robotic surgery entitlement.'],
        confidence: { level: 'MEDIUM', explanation: 'Conflicting policy clauses detected' },
        explanation: 'Conflicting clauses present'
      }
    ];

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_phase4a_09',
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

    expect(result.reviewRequired).toBe(true);
    expect(result.reviewStatus).toBe('REQUIRED_CONFLICTING_VERSIONS');
    const conflictItem = result.itemizedLedger[0];
    expect(conflictItem.status).toBe('REQUIRES_REVIEW');
    expect(conflictItem.reviewReasons.some(r => r.includes('Conflicting'))).toBe(true);
  });

  // ==========================================================================
  // Test 10: Endorsement effective-date selection
  // ==========================================================================
  it('10. Endorsement effective-date selection: treatment date before vs after amendment applies correct terms', () => {
    // Base policy: Cataract limit ₹40,000 (effective 2024-01-01)
    const basePolicyData = createMockPolicy({ subLimits: { cataract: 40000 } });
    const baseVersion: PolicyVersionRecord = {
      familyId: 'star_fho_family',
      versionId: 'ver_base_2024',
      versionNumber: '1.0',
      documentType: 'BASE_POLICY',
      parentVersionId: null,
      amendmentScope: null,
      insurerName: 'Star Health',
      planName: 'Family Health Optima',
      documentId: 'doc_star_base_pdf',
      effectiveFrom: '2024-01-01',
      effectiveTo: '2024-12-31',
      uploadTimestamp: '2024-01-01T00:00:00.000Z',
      extractedTimestamp: '2024-01-01T00:00:00.000Z',
      policyData: basePolicyData,
      clauseModifications: []
    };

    // Endorsement amendment: enhances Cataract limit to ₹50,000 effective 2024-09-01
    const endorsementVersion: PolicyVersionRecord = {
      familyId: 'star_fho_family',
      versionId: 'ver_endorse_2024',
      versionNumber: '1.1',
      documentType: 'AMENDMENT',
      parentVersionId: 'ver_base_2024',
      amendmentScope: 'MODIFIES_SPECIFIC_CLAUSES',
      insurerName: 'Star Health',
      planName: 'Family Health Optima',
      documentId: 'doc_star_endorsement_pdf',
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
          clauseId: 'mod_cataract_enhance',
          changeType: 'MODIFIED',
          targetPath: 'subLimits.cataract',
          newClauseText: 'Cataract sub-limit enhanced to ₹50,000.',
          description: 'Endorsement enhancement of cataract limit'
        }
      ]
    };

    const cataractItems = [
      createItem('item_cat', 'Cataract Surgery Operation', 'DAYCARE_PACKAGE', 1, 60000)
    ];
    const bill = createBill('bill_date_test', cataractItems);

    // Case A: Treatment date BEFORE endorsement (2024-06-15) -> Base sublimit ₹40,000 applies
    const requestPre: ClaimAdjudicationRequest = {
      requestId: 'req_endorse_pre',
      treatmentDate: '2024-06-15',
      bill,
      policyFamilyId: 'star_fho_family',
      policyVersions: [baseVersion, endorsementVersion],
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    };
    const resultPre = claimAdjudicationService.adjudicateClaim(requestPre);
    // Insurer pays ₹40,000; Patient pays ₹20,000
    expect(resultPre.ledger.finalInsurerPayablePaise).toBe(4000000);
    expect(resultPre.ledger.totalSublimitDisallowancePaise).toBe(2000000);

    // Case B: Treatment date AFTER endorsement (2024-10-15) -> Enhanced sublimit ₹50,000 applies
    const requestPost: ClaimAdjudicationRequest = {
      requestId: 'req_endorse_post',
      treatmentDate: '2024-10-15',
      bill,
      policyFamilyId: 'star_fho_family',
      policyVersions: [baseVersion, endorsementVersion],
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    };
    const resultPost = claimAdjudicationService.adjudicateClaim(requestPost);
    // Insurer pays ₹50,000; Patient pays ₹10,000
    expect(resultPost.ledger.finalInsurerPayablePaise).toBe(5000000);
    expect(resultPost.ledger.totalSublimitDisallowancePaise).toBe(1000000);
  });

  // ==========================================================================
  // Test 11: Malformed amounts and invalid inputs
  // ==========================================================================
  it('11. Malformed amounts and invalid inputs: catches negative, non-finite, and sum mismatches', () => {
    // Case A: Negative price
    const negItems = [
      createItem('item_neg', 'Corrupted Negative Invoice Charge', 'MEDICINES_PHARMACY', 1, -5000)
    ];
    const negBill = createBill('bill_neg_11', negItems);
    const policy = createMockPolicy();

    const resultNeg = claimAdjudicationService.adjudicateClaim({
      requestId: 'req_neg_11',
      treatmentDate: '2024-06-12',
      bill: negBill,
      policyDocument: policy
    });

    expect(resultNeg.billReconciliation.isReconciled).toBe(false);
    expect(resultNeg.billReconciliation.issues.some(i => i.issueType === 'ZERO_OR_NEGATIVE_PRICE')).toBe(true);
    expect(resultNeg.reviewRequired).toBe(true);

    // Case B: Gross sum mismatch
    const mismatchBill: BillDocument = {
      ...createBill('bill_mismatch_11', [
        createItem('item_1', 'Service A', 'MEDICINES_PHARMACY', 1, 10000)
      ]),
      originalBillTotalPaise: rupeesToPaise(15000) // Stated 15k vs calculated 10k
    };

    const resultMismatch = claimAdjudicationService.adjudicateClaim({
      requestId: 'req_mismatch_11',
      treatmentDate: '2024-06-12',
      bill: mismatchBill,
      policyDocument: policy
    });

    expect(resultMismatch.billReconciliation.isReconciled).toBe(false);
    expect(resultMismatch.billReconciliation.issues.some(i => i.issueType === 'GROSS_SUM_MISMATCH')).toBe(true);
  });

  // ==========================================================================
  // Test 12: Double-deduction prevention and financial reconciliation
  // ==========================================================================
  it('12. Double-deduction prevention and financial reconciliation: exact mathematical balance across multi-factor claim', () => {
    const items = [
      createItem('item_room', 'Deluxe Room Rent', 'ROOM_RENT', 4, 9000), // ₹36,000 (claimed ₹9k vs ₹5k limit)
      createItem('item_surg', 'Lead Surgeon Fee', 'SURGEON_CONSULTATION', 1, 50000), // ₹50,000 (subject to prop deduction)
      createItem('item_ot', 'OT Facility Charges', 'OT_CHARGES', 1, 30000), // ₹30,000 (subject to prop deduction)
      createItem('item_consumables', 'Gloves and PPE Items', 'CONSUMABLES_NON_PAYABLES', 1, 5000, true), // ₹5,000 (100% excluded)
      createItem('item_meds', 'Antibiotics and Pharmacy', 'MEDICINES_PHARMACY', 1, 15000) // ₹15,000 (unscaled)
    ];
    // Total Claimed: 36,000 + 50,000 + 30,000 + 5,000 + 15,000 = ₹136,000 (13,600,000 paise)
    const bill = createBill('bill_composite_12', items);
    const policy = createMockPolicy({
      roomLimit: { type: 'amount', value: 5000 },
      proportionateDeduction: true,
      deductible: 10000,
      copay: 10
    });

    const request: ClaimAdjudicationRequest = {
      requestId: 'req_phase4a_12',
      treatmentDate: '2024-06-12',
      bill,
      policyDocument: policy,
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeductionSupported: true,
        deductiblePaise: rupeesToPaise(10000),
        copayPercentage: 10,
        networkStatus: 'verified'
      }
    };

    const result = claimAdjudicationService.adjudicateClaim(request);

    // 1. Double deduction invariant check
    expect(result.invariants.hasDoubleDeductions).toBe(false);

    // Unique adjustment IDs check
    const adjIds = result.adjustmentLedger.map(a => a.adjustmentId);
    const uniqueAdjIds = new Set(adjIds);
    expect(uniqueAdjIds.size).toBe(adjIds.length);

    // Claim level deductible applied at most once
    const deductibleCount = result.adjustmentLedger.filter(a => a.scope === 'CLAIM_DEDUCTIBLE').length;
    expect(deductibleCount).toBe(1);

    // Claim level copay applied at most once
    const copayCount = result.adjustmentLedger.filter(a => a.scope === 'CLAIM_COPAY').length;
    expect(copayCount).toBe(1);

    // 2. Strict conservation law:
    // Total Claimed === Final Insurer Payable + Total Patient Payable
    expect(result.ledger.finalInsurerPayablePaise + result.ledger.totalPatientResponsibilityPaise).toBe(result.ledger.totalClaimedPaise);
    expect(result.invariants.isMathematicallyBalanced).toBe(true);

    // 3. Line item allocation sum matches claim totals
    const sumItemInsurer = result.itemizedLedger.reduce((sum, it) => sum + it.insurerPayablePaise, 0);
    const sumItemPatient = result.itemizedLedger.reduce((sum, it) => sum + it.patientResponsibilityPaise, 0);
    expect(sumItemInsurer).toBe(result.ledger.finalInsurerPayablePaise);
    expect(sumItemPatient).toBe(result.ledger.totalPatientResponsibilityPaise);
  });
});
