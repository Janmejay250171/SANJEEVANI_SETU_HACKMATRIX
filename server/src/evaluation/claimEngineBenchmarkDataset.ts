import {
  MoneyMinor,
  rupeesToPaise,
  BillDocument,
  ClaimLineItem,
  StandardChargeCategory
} from '../types/claim.js';
import { ClaimAdjudicationRequest } from '../types/adjudication.js';
import { BillItemVerificationResult } from '../types/verification.js';
import { PolicyDocument } from '../types/policy.js';
import { PolicyVersionRecord } from '../types/policyVersion.js';

export interface ClaimBenchmarkFixture {
  fixtureId: string;
  name: string;
  description: string;
  scenarioNumber: number;
  request: ClaimAdjudicationRequest;
  expected: {
    totalClaimedPaise: MoneyMinor;
    excludedNonPayablePaise: MoneyMinor;
    proportionateDisallowancePaise: MoneyMinor;
    sublimitDisallowancePaise: MoneyMinor;
    appliedDeductiblePaise: MoneyMinor;
    appliedCopayPaise: MoneyMinor;
    sumInsuredCapDisallowancePaise: MoneyMinor;
    finalInsurerPayablePaise: MoneyMinor;
    totalPatientResponsibilityPaise: MoneyMinor;
    isMathematicallyBalanced: boolean;
    reviewRequired: boolean;
    expectedReviewReasonKeywords?: string[];
  };
}

function makeSyntheticProvenance(desc: string) {
  return {
    sourceType: 'SYNTHETIC_BENCHMARK' as const,
    rawExtractedText: desc,
    extractedTimestamp: '2026-10-10T12:00:00Z',
    confidenceScore: 1.0
  };
}

function makeBillItem(
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
    currency: 'INR',
    provenance: makeSyntheticProvenance(desc),
    classificationStatus: 'AUTOMATIC_EXACT',
    reviewFlags: isNonPayable ? ['IRDAI_NON_PAYABLE'] : [],
    isNonPayableByRegulation: isNonPayable
  };
}

function makeBillDoc(billId: string, items: ClaimLineItem[], statedTotalRupees?: number): BillDocument {
  const calcSum = items.reduce((s, it) => s + it.claimedAmountPaise, 0);
  const origTotal = statedTotalRupees !== undefined ? rupeesToPaise(statedTotalRupees) : calcSum;
  return {
    billId,
    hospitalName: 'Apollo Hospitals Bengaluru',
    billDate: '2025-06-15',
    admissionDate: '2025-06-12',
    dischargeDate: '2025-06-15',
    originalBillTotalPaise: origTotal,
    calculatedItemsTotalPaise: calcSum,
    reconciliationDifferencePaise: origTotal - calcSum,
    reconciliationStatus: origTotal === calcSum ? 'RECONCILED' : 'DISCREPANCY',
    currency: 'INR',
    lineItems: items,
    uploadedAt: '2026-10-10T12:00:00Z',
    extractedAt: '2026-10-10T12:00:00Z'
  };
}

function makeBasePolicyDoc(overrides: Partial<PolicyDocument> = {}): PolicyDocument {
  return {
    _id: 'pol_base_star_01',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    confirmedByUser: true,
    insurer: 'Star Health and Allied Insurance',
    insurerAliases: ['Star Health'],
    planName: 'Family Health Optima',
    policyType: 'individual',
    policyNumber: 'POL-STAR-9921',
    uin: 'SHAHLIP21023V022021',
    policyStartDate: '2025-01-01',
    policyEndDate: '2025-12-31',
    zone: 'Zone 1',
    networkType: 'all-network',
    cashlessAvailable: true,
    tpa: null,
    insuredPersons: [],
    sumInsured: 500000,
    roomLimit: { type: 'amount', value: 5000 },
    icuLimit: { type: 'none' },
    copay: 0,
    nonNetworkCopay: null,
    copayConditions: {},
    deductible: 0,
    proportionateDeduction: true,
    subLimits: { cataract: 40000 },
    restorationBenefit: true,
    cumulativeBonus: 0,
    ...overrides
  } as PolicyDocument;
}

export const CLAIM_ENGINE_BENCHMARK_FIXTURES: ClaimBenchmarkFixture[] = [
  // 1. Fully supported item: Standard Appendectomy ₹50,000 -> 100% covered
  {
    fixtureId: 'fix_01_fully_supported',
    name: 'Fully Supported Item',
    description: 'Standard emergency appendectomy procedure charge fully admissible with zero copay and zero deductible.',
    scenarioNumber: 1,
    request: {
      requestId: 'req_01',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_01', [
        makeBillItem('item_01', 'Emergency Appendectomy Surgery', 'DAYCARE_PACKAGE', 1, 50000)
      ]),
      policyDocument: makeBasePolicyDoc({ copay: 0, deductible: 0 }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(50000),
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(50000),
      totalPatientResponsibilityPaise: 0,
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 2. Explicitly excluded item: Cosmetic Rhinoplasty ₹75,000 + Surgical Gloves ₹2,000 -> 100% excluded
  {
    fixtureId: 'fix_02_excluded_items',
    name: 'Explicitly Excluded Items',
    description: 'Aesthetic cosmetic procedure and statutory non-payable gloves 100% disallowed at item level.',
    scenarioNumber: 2,
    request: {
      requestId: 'req_02',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_02', [
        makeBillItem('item_02a', 'Aesthetic Rhinoplasty Cosmetic Reshaping', 'MISCELLANEOUS', 1, 75000),
        makeBillItem('item_02b', 'Disposable Surgical Gloves & PPE Kit', 'CONSUMABLES_NON_PAYABLES', 1, 2000, true)
      ]),
      verifiedItemEvidence: [
        {
          billItemId: 'item_02a',
          proposedInterpretation: 'Elective cosmetic procedure excluded under policy terms',
          outcome: 'excluded',
          supportingEvidence: [],
          adverseExclusionEvidence: [
            {
              clauseId: 'cl_excl_cosmetic',
              versionId: 'v1.0',
              documentId: 'doc1',
              heading: 'General Exclusions',
              section: 'Exclusion 4.1',
              exactExcerpt: 'Plastic surgery or cosmetic treatment is excluded.',
              pageNumber: 12,
              clauseType: 'exclusion',
              precedenceRole: 'CONTROLLING',
              precedenceReason: 'Contractual exclusion',
              retrievalScore: 0.95,
              citationVerified: true
            }
          ],
          conflictingEvidence: [],
          conditionalRequirements: [],
          missingFacts: [],
          reviewRequired: false,
          reviewReasons: [],
          confidence: { level: 'HIGH', explanation: 'Direct exclusion' },
          explanation: 'Excluded under cosmetic clause',
          citationIntegrityVerified: true,
          auditTrace: []
        }
      ],
      policyDocument: makeBasePolicyDoc(),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(77000),
      excludedNonPayablePaise: rupeesToPaise(77000),
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 0,
      totalPatientResponsibilityPaise: rupeesToPaise(77000),
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 3. Partially admissible item: Deluxe room ₹8,000/day for 3 days (₹24,000) with ₹5,000/day cap -> ₹9,000 excess disallowed
  {
    fixtureId: 'fix_03_partially_admissible_room',
    name: 'Partially Admissible Room Rent',
    description: 'Room rate exceeds daily contractual cap; daily excess deducted directly from room line item.',
    scenarioNumber: 3,
    request: {
      requestId: 'req_03',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_03', [
        makeBillItem('item_03', 'Deluxe Private AC Room Bed Charges', 'ROOM_RENT', 3, 8000)
      ]),
      policyDocument: makeBasePolicyDoc({
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeduction: false
      }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeductionSupported: false,
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(24000),
      excludedNonPayablePaise: rupeesToPaise(9000), // (8000 - 5000) * 3 = 9000
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(15000), // 5000 * 3 = 15000
      totalPatientResponsibilityPaise: rupeesToPaise(9000),
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 4. Missing evidence requiring review: Unknown billing item with insufficient evidence
  {
    fixtureId: 'fix_04_missing_evidence_review',
    name: 'Missing Evidence Requiring Review',
    description: 'Unclassified medical charge with insufficient evidence flagged for human review without guessing.',
    scenarioNumber: 4,
    request: {
      requestId: 'req_04',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_04', [
        makeBillItem('item_04', 'Specialized Bio-Impedance Sensor Rental', 'MISCELLANEOUS', 1, 25000)
      ]),
      verifiedItemEvidence: [
        {
          billItemId: 'item_04',
          proposedInterpretation: 'Unclassified equipment charge',
          outcome: 'insufficient_evidence',
          supportingEvidence: [],
          adverseExclusionEvidence: [],
          conflictingEvidence: [],
          conditionalRequirements: [],
          missingFacts: ['Clinical indication for sensor rental'],
          reviewRequired: true,
          reviewReasons: ['Insufficient policy evidence to confirm equipment coverage.'],
          confidence: { level: 'LOW', explanation: 'No matching policy clause' },
          explanation: 'No clause found for sensor rental',
          citationIntegrityVerified: true,
          auditTrace: []
        }
      ],
      policyDocument: makeBasePolicyDoc(),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(25000),
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(25000),
      totalPatientResponsibilityPaise: 0,
      isMathematicallyBalanced: true,
      reviewRequired: true,
      expectedReviewReasonKeywords: ['Insufficient policy evidence']
    }
  },

  // 5. Conflicting clauses requiring review: Ambiguous endorsement vs base clause
  {
    fixtureId: 'fix_05_conflicting_clauses_review',
    name: 'Conflicting Clauses Requiring Review',
    description: 'Charge governed by contradicting base and amendment clauses triggers mandatory human review.',
    scenarioNumber: 5,
    request: {
      requestId: 'req_05',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_05', [
        makeBillItem('item_05', 'Robotic Surgery System Overhead Fee', 'OT_CHARGES', 1, 40000)
      ]),
      verifiedItemEvidence: [
        {
          billItemId: 'item_05',
          proposedInterpretation: 'Contradictory robotic surgery terms',
          outcome: 'conflicting',
          supportingEvidence: [],
          adverseExclusionEvidence: [],
          conflictingEvidence: [],
          conditionalRequirements: [],
          missingFacts: [],
          reviewRequired: true,
          reviewReasons: ['Conflicting policy clauses govern robotic surgery overhead.'],
          confidence: { level: 'UNVERIFIED', explanation: 'Contractual contradiction' },
          explanation: 'Base excludes robotic overhead; endorsement claims partial inclusion without sublimit',
          citationIntegrityVerified: true,
          auditTrace: []
        }
      ],
      policyDocument: makeBasePolicyDoc(),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(40000),
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(40000),
      totalPatientResponsibilityPaise: 0,
      isMathematicallyBalanced: true,
      reviewRequired: true,
      expectedReviewReasonKeywords: ['Conflicting policy clauses']
    }
  },

  // 6. Deductible applied at correct contractual scope: Claim ₹60,000, Deductible ₹15,000 -> Insurer ₹45,000
  {
    fixtureId: 'fix_06_aggregate_deductible',
    name: 'Aggregate Deductible at Claim Level',
    description: 'Policy aggregate deductible applied once to admissible claim total.',
    scenarioNumber: 6,
    request: {
      requestId: 'req_06',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_06', [
        makeBillItem('item_06', 'General Laparoscopic Hernioplasty', 'DAYCARE_PACKAGE', 1, 60000)
      ]),
      policyDocument: makeBasePolicyDoc({ deductible: 15000, copay: 0 }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: rupeesToPaise(15000),
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(60000),
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: rupeesToPaise(15000),
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(45000),
      totalPatientResponsibilityPaise: rupeesToPaise(15000),
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 7. Co-payment applied to correct contractual base: Claim ₹1,00,000, Deductible ₹20,000, 10% copay on post-deductible ₹80,000
  {
    fixtureId: 'fix_07_copay_on_correct_base',
    name: 'Co-payment on Post-Deductible Base',
    description: '10% co-payment applied strictly on post-deductible admissible base (₹80,000 -> ₹8,000), not on gross bill.',
    scenarioNumber: 7,
    request: {
      requestId: 'req_07',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_07', [
        makeBillItem('item_07', 'Total Knee Replacement Surgery Charges', 'DAYCARE_PACKAGE', 1, 100000)
      ]),
      policyDocument: makeBasePolicyDoc({ deductible: 20000, copay: 10 }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: rupeesToPaise(20000),
        copayPercentage: 10,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(100000),
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: rupeesToPaise(20000),
      appliedCopayPaise: rupeesToPaise(8000), // 10% of (100000 - 20000) = 8000
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(72000),
      totalPatientResponsibilityPaise: rupeesToPaise(28000),
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 8. Room-rent limit without unsupported proportionate deduction: Room excess deducted, no proportionate deduction on OT/doctor
  {
    fixtureId: 'fix_08_room_limit_no_prop_deduction',
    name: 'Room Limit Without Proportionate Deduction',
    description: 'When policy excludes proportionate deductions, only the room rent excess is disallowed.',
    scenarioNumber: 8,
    request: {
      requestId: 'req_08',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_08', [
        makeBillItem('item_08a', 'Super Deluxe Room Rent', 'ROOM_RENT', 2, 9000), // Cap ₹5000, excess ₹4000*2 = ₹8000
        makeBillItem('item_08b', 'Senior Consultant Surgeon Fees', 'SURGEON_CONSULTATION', 1, 30000),
        makeBillItem('item_08c', 'Operation Theater Charges', 'OT_CHARGES', 1, 40000)
      ]),
      policyDocument: makeBasePolicyDoc({
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeduction: false
      }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeductionSupported: false,
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(88000), // 18000 + 30000 + 40000
      excludedNonPayablePaise: rupeesToPaise(8000), // (9000 - 5000) * 2 = 8000
      proportionateDisallowancePaise: 0, // Explicitly 0 because proportionateDeductionSupported is false
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(80000),
      totalPatientResponsibilityPaise: rupeesToPaise(8000),
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 9. Explicitly applicable proportionate deduction: Room ₹10,000 vs ₹5,000 cap (50% ratio) scales associated surgeon/OT fees
  {
    fixtureId: 'fix_09_explicit_proportionate_deduction',
    name: 'Explicitly Applicable Proportionate Deduction',
    description: 'When policy supports proportionate deductions, associated surgeon & OT charges scale down by allowed ratio (50%), while pharmacy remains intact.',
    scenarioNumber: 9,
    request: {
      requestId: 'req_09',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_09', [
        makeBillItem('item_09a', 'Executive Private Room', 'ROOM_RENT', 2, 10000), // 2 days @ 10,000 -> excess 5000*2 = 10,000
        makeBillItem('item_09b', 'Surgeon Consultation Fee', 'SURGEON_CONSULTATION', 1, 30000), // 50% disallowed = 15,000
        makeBillItem('item_09c', 'Operation Theater Charges', 'OT_CHARGES', 1, 20000), // 50% disallowed = 10,000
        makeBillItem('item_09d', 'Prescribed Inpatient Pharmacy', 'MEDICINES_PHARMACY', 1, 20000) // 0% disallowed (not associated)
      ]),
      policyDocument: makeBasePolicyDoc({
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeduction: true
      }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeductionSupported: true,
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(90000), // 20000 + 30000 + 20000 + 20000
      excludedNonPayablePaise: rupeesToPaise(10000), // Room excess (10000 - 5000) * 2 = 10,000
      proportionateDisallowancePaise: rupeesToPaise(25000), // 15000 (surgeon) + 10000 (OT) = 25000
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(55000), // 90000 - 10000 - 25000 = 55000
      totalPatientResponsibilityPaise: rupeesToPaise(35000), // 10000 + 25000 = 35000
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 10. Sublimit and overall sum-insured cap interaction: Cataract sublimit ₹40,000 on ₹65,000 bill
  {
    fixtureId: 'fix_10_sublimit_and_si_interaction',
    name: 'Procedure Sublimit and SI Interaction',
    description: 'Cataract surgery procedure charge capped at ₹40,000 sublimit; remaining ₹25,000 disallowed.',
    scenarioNumber: 10,
    request: {
      requestId: 'req_10',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_10', [
        makeBillItem('item_10', 'Cataract Phacoemulsification with Foldable IOL', 'DAYCARE_PACKAGE', 1, 65000)
      ]),
      policyDocument: makeBasePolicyDoc({
        subLimits: { cataract: 40000 }
      }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        sublimitsPaise: { cataract: rupeesToPaise(40000) },
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(65000),
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: rupeesToPaise(25000), // 65000 - 40000 = 25000
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(40000),
      totalPatientResponsibilityPaise: rupeesToPaise(25000),
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 11. Multiple bill items with aggregate deductible: 4 items totaling ₹80,000, aggregate deductible ₹15,000
  {
    fixtureId: 'fix_11_multiple_items_aggregate_deductible',
    name: 'Multiple Items with Aggregate Deductible',
    description: '4 itemized bill lines totaling ₹80,000 with a single aggregate deductible of ₹15,000 applied at claim level.',
    scenarioNumber: 11,
    request: {
      requestId: 'req_11',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_11', [
        makeBillItem('item_11a', 'Twin Sharing Bed Charges', 'ROOM_RENT', 2, 5000), // 10000
        makeBillItem('item_11b', 'Operation Theater Fee', 'OT_CHARGES', 1, 30000), // 30000
        makeBillItem('item_11c', 'Surgeon Professional Fee', 'SURGEON_CONSULTATION', 1, 20000), // 20000
        makeBillItem('item_11d', 'Inpatient Medicine Formulations', 'MEDICINES_PHARMACY', 1, 20000) // 20000
      ]),
      policyDocument: makeBasePolicyDoc({ deductible: 15000, copay: 0 }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: rupeesToPaise(15000),
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(80000),
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: rupeesToPaise(15000),
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(65000),
      totalPatientResponsibilityPaise: rupeesToPaise(15000),
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 12. Bill containing duplicate or inconsistent entries: Duplicate item ID and price mismatch
  {
    fixtureId: 'fix_12_inconsistent_bill_entries',
    name: 'Inconsistent Bill with Duplicate Item',
    description: 'Hospital invoice with duplicate item ID and stated gross discrepancy triggers reconciliation review.',
    scenarioNumber: 12,
    request: {
      requestId: 'req_12',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_12', [
        makeBillItem('item_dup_1', 'Diagnostic Blood Investigation', 'INVESTIGATIONS_DIAGNOSTICS', 1, 5000),
        makeBillItem('item_dup_1', 'Diagnostic Blood Investigation Repeated', 'INVESTIGATIONS_DIAGNOSTICS', 1, 5000)
      ], 15000), // Stated gross 15000 vs items sum 10000 -> 5000 discrepancy
      policyDocument: makeBasePolicyDoc(),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(10000),
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(10000),
      totalPatientResponsibilityPaise: 0,
      isMathematicallyBalanced: true,
      reviewRequired: true,
      expectedReviewReasonKeywords: ['DUPLICATE_ITEM_ID', 'GROSS_SUM_MISMATCH']
    }
  },

  // 13. Change in policy version: Room charge ₹6,000 under v1.0 (cap ₹3,000) -> excess ₹3,000
  {
    fixtureId: 'fix_13_policy_version_change',
    name: 'Policy Version Rule Capping',
    description: 'Adjudication under policy version v1.0 with ₹3,000 room cap cleanly disallows ₹3,000 excess.',
    scenarioNumber: 13,
    request: {
      requestId: 'req_13',
      treatmentDate: '2024-05-10',
      bill: makeBillDoc('bill_13', [
        makeBillItem('item_13', 'Standard Private Room', 'ROOM_RENT', 1, 6000)
      ]),
      policyVersion: {
        familyId: 'fam_star_optima',
        versionId: 'pol_v1.0_2024',
        versionNumber: '1.0',
        documentType: 'BASE_POLICY',
        insurerName: 'Star Health',
        planName: 'Family Optima',
        documentId: 'doc_v1.0',
        effectiveFrom: '2024-01-01',
        effectiveTo: '2024-12-31',
        uploadTimestamp: '2024-01-01T00:00:00Z',
        extractedTimestamp: '2024-01-01T00:00:00Z',
        extractionStatus: 'VERIFIED',
        clauseModifications: [],
        policyData: makeBasePolicyDoc({
          roomLimit: { type: 'amount', value: 3000 },
          proportionateDeduction: false
        }),
        unresolvedQuestions: []
      },
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        roomLimit: { type: 'amount', value: 3000 },
        proportionateDeductionSupported: false,
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(6000),
      excludedNonPayablePaise: rupeesToPaise(3000),
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(3000),
      totalPatientResponsibilityPaise: rupeesToPaise(3000),
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 14. Recalculation after item amount changes: Bill ₹40,000 recomputed after reduction from ₹50,000
  {
    fixtureId: 'fix_14_recalculation_after_amount_change',
    name: 'Recalculation After Amount Change',
    description: 'Deterministic assessment after an invoice item correction produces consistent new output.',
    scenarioNumber: 14,
    request: {
      requestId: 'req_14',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_14', [
        makeBillItem('item_14', 'Corrected Daycare Dialysis Package', 'DAYCARE_PACKAGE', 1, 40000)
      ]),
      policyDocument: makeBasePolicyDoc({ copay: 10 }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 10,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(40000),
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: rupeesToPaise(4000), // 10% of 40000
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(36000),
      totalPatientResponsibilityPaise: rupeesToPaise(4000),
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 15. Repeated assessment with identical inputs (Idempotence)
  {
    fixtureId: 'fix_15_idempotent_repeated_assessment',
    name: 'Idempotent Repeated Assessment',
    description: 'Re-evaluating identical claim inputs yields identical ledger and paise values.',
    scenarioNumber: 15,
    request: {
      requestId: 'req_15',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_15', [
        makeBillItem('item_15a', 'Daycare Chemotherapy Session', 'DAYCARE_PACKAGE', 1, 45000),
        makeBillItem('item_15b', 'Infusion Consumables', 'CONSUMABLES_NON_PAYABLES', 1, 3000, true)
      ]),
      policyDocument: makeBasePolicyDoc({ copay: 5, deductible: 5000 }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: rupeesToPaise(5000),
        copayPercentage: 5,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(48000), // 45000 + 3000
      excludedNonPayablePaise: rupeesToPaise(3000), // Consumables
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: rupeesToPaise(5000),
      appliedCopayPaise: rupeesToPaise(2000), // 5% of (45000 - 5000) = 5% of 40000 = 2000
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(38000), // 40000 - 2000 = 38000
      totalPatientResponsibilityPaise: rupeesToPaise(10000), // 3000 + 5000 + 2000 = 10000
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 16. Case that would expose double deduction: Excluded item must not have deductible or copay applied to it
  {
    fixtureId: 'fix_16_prevent_double_deduction',
    name: 'Prevent Double Deductions Invariant',
    description: 'Verification that an excluded item is removed first and never factored into deductible or copay bases.',
    scenarioNumber: 16,
    request: {
      requestId: 'req_16',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_16', [
        makeBillItem('item_16a', 'Admissible General Surgery', 'DAYCARE_PACKAGE', 1, 50000),
        makeBillItem('item_16b', 'IRDAI Non-Payable PPE Kit', 'CONSUMABLES_NON_PAYABLES', 1, 10000, true)
      ]),
      policyDocument: makeBasePolicyDoc({ deductible: 10000, copay: 20 }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: rupeesToPaise(10000),
        copayPercentage: 20,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(60000), // 50000 + 10000
      excludedNonPayablePaise: rupeesToPaise(10000),
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: rupeesToPaise(10000),
      appliedCopayPaise: rupeesToPaise(8000), // 20% of (50000 - 10000) = 8000 (NOT 20% of 60000!)
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(32000), // 40000 - 8000 = 32000
      totalPatientResponsibilityPaise: rupeesToPaise(28000), // 10000 (excl) + 10000 (ded) + 8000 (copay)
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 17. Missing previous sum-insured utilization: Flagged for review
  {
    fixtureId: 'fix_17_missing_si_utilization',
    name: 'Missing Sum-Insured Utilization',
    description: 'Unknown previous claims utilization triggers explicit review warning.',
    scenarioNumber: 17,
    request: {
      requestId: 'req_17',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_17', [
        makeBillItem('item_17', 'Acute Coronary Stenting Hospital Stay', 'DAYCARE_PACKAGE', 1, 200000)
      ]),
      policyDocument: makeBasePolicyDoc({ sumInsured: 300000 }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(300000),
        isPreviousUtilizationKnown: false, // Unknown prior claims
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(200000),
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: rupeesToPaise(200000),
      totalPatientResponsibilityPaise: 0,
      isMathematicallyBalanced: true,
      reviewRequired: true,
      expectedReviewReasonKeywords: ['Previous sum-insured utilization']
    }
  },

  // 18. Zero-value and invalid monetary inputs: Zero claimed or negative price caught in Stage A
  {
    fixtureId: 'fix_18_invalid_monetary_input',
    name: 'Invalid Monetary Input Handling',
    description: 'Item with negative unit price detected and flagged as a blocking reconciliation issue.',
    scenarioNumber: 18,
    request: {
      requestId: 'req_18',
      treatmentDate: '2025-06-12',
      bill: {
        ...makeBillDoc('bill_18', [
          {
            ...makeBillItem('item_18a', 'Valid Lab Pathology', 'INVESTIGATIONS_DIAGNOSTICS', 1, 2000),
            unitPricePaise: -200000,
            claimedAmountPaise: -200000
          }
        ]),
        originalBillTotalPaise: -200000
      },
      policyDocument: makeBasePolicyDoc(),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: -200000,
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 0,
      totalPatientResponsibilityPaise: -200000,
      isMathematicallyBalanced: false, // Negative amount fails balance
      reviewRequired: true,
      expectedReviewReasonKeywords: ['ZERO_OR_NEGATIVE_PRICE']
    }
  },

  // 19. Rounding at currency supported precision: 15% copay on odd paise amount (₹1,555.55 = 155555 paise)
  {
    fixtureId: 'fix_19_integer_paise_rounding',
    name: 'Integer Minor Unit Rounding',
    description: '15% copay on 155,555 paise (₹1,555.55) calculates 23,333 paise without float drift.',
    scenarioNumber: 19,
    request: {
      requestId: 'req_19',
      treatmentDate: '2025-06-12',
      bill: {
        ...makeBillDoc('bill_19', [
          {
            ...makeBillItem('item_19', 'Minor OPD Surgical Dressing', 'MISCELLANEOUS', 1, 1555.55),
            unitPricePaise: 155555,
            claimedAmountPaise: 155555
          }
        ]),
        originalBillTotalPaise: 155555
      },
      policyDocument: makeBasePolicyDoc({ copay: 15 }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        deductiblePaise: 0,
        copayPercentage: 15,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: 155555,
      excludedNonPayablePaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 23333, // Math.round(155555 * 15 / 100) = 23333.25 -> 23333
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 132222, // 155555 - 23333 = 132222
      totalPatientResponsibilityPaise: 23333,
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  },

  // 20. Existing cost-intelligence regression scenarios: Star Health policy room capping + proportionate deduction
  {
    fixtureId: 'fix_20_cost_intelligence_regression',
    name: 'Cost Intelligence Baseline Regression',
    description: 'Preserves Star Health baseline: Room Rent ₹9,500 vs ₹5,000 cap for 4 days, with proportionate deduction on surgeon fee.',
    scenarioNumber: 20,
    request: {
      requestId: 'req_20',
      treatmentDate: '2025-06-12',
      bill: makeBillDoc('bill_20', [
        makeBillItem('item_20a', 'Single Private Room Bed Charges', 'ROOM_RENT', 4, 9500), // 38000 -> excess (9500-5000)*4 = 18000
        makeBillItem('item_20b', 'Consulting Surgeon Fees', 'SURGEON_CONSULTATION', 1, 50000), // Prop deduction (4500/9500)*50000 = 23684
        makeBillItem('item_20c', 'Pharmacy Injections & Fluids', 'MEDICINES_PHARMACY', 1, 20000) // Intact
      ]),
      policyDocument: makeBasePolicyDoc({
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeduction: true
      }),
      financialRules: {
        sumInsuredPaise: rupeesToPaise(500000),
        roomLimit: { type: 'amount', value: 5000 },
        proportionateDeductionSupported: true,
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    },
    expected: {
      totalClaimedPaise: rupeesToPaise(108000), // 38000 + 50000 + 20000
      excludedNonPayablePaise: rupeesToPaise(18000), // (9500 - 5000) * 4 = 18000
      proportionateDisallowancePaise: 2368421, // Math.round(5000000 * 4500 / 9500) = 2368421 paise = ₹23,684.21
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 6631579, // 10800000 - 1800000 - 2368421 = 6631579 paise = ₹66,315.79
      totalPatientResponsibilityPaise: 4168421, // 1800000 + 2368421 = 4168421 paise
      isMathematicallyBalanced: true,
      reviewRequired: false
    }
  }
];
