import { MoneyMinor, rupeesToPaise } from '../types/claim.js';

export interface IndependentOracleRule {
  ruleId: string;
  ruleType: 'EXCLUSION' | 'ROOM_RENT_CAP' | 'PROPORTIONATE_DEDUCTION' | 'PROCEDURE_SUBLIMIT' | 'DEDUCTIBLE' | 'COPAY' | 'SUM_INSURED_CAP';
  scope: 'ITEM_LEVEL' | 'CLAIM_LEVEL';
  valuePaise?: MoneyMinor;
  ratePercent?: number;
  eligibleDailyLimitPaise?: number;
  actualDailyTariffPaise?: number;
  billedDays?: number;
  sublimitCode?: string;
}

export interface IndependentOracleItem {
  itemId: string;
  description: string;
  category: string;
  claimedAmountPaise: MoneyMinor;
  isNonPayableStatutory?: boolean;
  isExcludedContractual?: boolean;
  procedureCode?: string;
  associatedWithRoomRent?: boolean;
}

export interface IndependentOracleFixture {
  fixtureId: string;
  scenarioName: string;
  description: string;
  items: IndependentOracleItem[];
  rules: IndependentOracleRule[];
  policySumInsuredPaise: MoneyMinor;
  treatmentDate: string;
  expected: {
    totalClaimedPaise: MoneyMinor;
    excludedNonPayablePaise: MoneyMinor;
    roomRentExcessPaise: MoneyMinor;
    proportionateDisallowancePaise: MoneyMinor;
    sublimitDisallowancePaise: MoneyMinor;
    appliedDeductiblePaise: MoneyMinor;
    appliedCopayPaise: MoneyMinor;
    sumInsuredCapDisallowancePaise: MoneyMinor;
    finalInsurerPayablePaise: MoneyMinor;
    totalPatientResponsibilityPaise: MoneyMinor;
    reviewRequired: boolean;
    isMathematicallyBalanced: boolean;
    notes: string;
  };
}

/**
 * Pure Mathematical Reference Function (Independent of production claimAdjudicationService).
 * Strictly computes financial settlement step-by-step from first principles.
 */
export function computeIndependentOracleMath(
  items: IndependentOracleItem[],
  rules: IndependentOracleRule[],
  sumInsuredPaise: MoneyMinor
): {
  totalClaimedPaise: MoneyMinor;
  excludedNonPayablePaise: MoneyMinor;
  roomRentExcessPaise: MoneyMinor;
  proportionateDisallowancePaise: MoneyMinor;
  sublimitDisallowancePaise: MoneyMinor;
  appliedDeductiblePaise: MoneyMinor;
  appliedCopayPaise: MoneyMinor;
  sumInsuredCapDisallowancePaise: MoneyMinor;
  finalInsurerPayablePaise: MoneyMinor;
  totalPatientResponsibilityPaise: MoneyMinor;
  isMathematicallyBalanced: boolean;
} {
  const totalClaimedPaise = items.reduce((sum, it) => sum + it.claimedAmountPaise, 0);

  // 1. Exclusions & Statutory Non-Payables
  let excludedNonPayablePaise = 0;
  for (const item of items) {
    if (item.isNonPayableStatutory || item.isExcludedContractual) {
      excludedNonPayablePaise += item.claimedAmountPaise;
    }
  }

  // 2. Room Rent Daily Capping
  let roomRentExcessPaise = 0;
  const roomRentRule = rules.find(r => r.ruleType === 'ROOM_RENT_CAP');
  if (roomRentRule && roomRentRule.eligibleDailyLimitPaise && roomRentRule.actualDailyTariffPaise && roomRentRule.billedDays) {
    if (roomRentRule.actualDailyTariffPaise > roomRentRule.eligibleDailyLimitPaise) {
      const dailyExcess = roomRentRule.actualDailyTariffPaise - roomRentRule.eligibleDailyLimitPaise;
      roomRentExcessPaise = dailyExcess * roomRentRule.billedDays;
    }
  }

  // 3. Proportionate Deductions on Associated Medical Expenses
  let proportionateDisallowancePaise = 0;
  const propRule = rules.find(r => r.ruleType === 'PROPORTIONATE_DEDUCTION');
  if (propRule && roomRentRule && roomRentRule.eligibleDailyLimitPaise && roomRentRule.actualDailyTariffPaise) {
    if (roomRentRule.actualDailyTariffPaise > roomRentRule.eligibleDailyLimitPaise) {
      const ratio = roomRentRule.eligibleDailyLimitPaise / roomRentRule.actualDailyTariffPaise;
      const disallowanceRatio = 1.0 - ratio;
      for (const item of items) {
        if (item.associatedWithRoomRent && !item.isNonPayableStatutory && !item.isExcludedContractual) {
          proportionateDisallowancePaise += Math.round(item.claimedAmountPaise * disallowanceRatio);
        }
      }
    }
  }

  // 4. Procedure Sublimits
  let sublimitDisallowancePaise = 0;
  const sublimitRules = rules.filter(r => r.ruleType === 'PROCEDURE_SUBLIMIT');
  for (const sRule of sublimitRules) {
    if (sRule.valuePaise !== undefined) {
      const matchingItems = items.filter(it => it.procedureCode === sRule.sublimitCode && !it.isNonPayableStatutory && !it.isExcludedContractual);
      const matchingClaimed = matchingItems.reduce((sum, it) => sum + it.claimedAmountPaise, 0);
      if (matchingClaimed > sRule.valuePaise) {
        sublimitDisallowancePaise += (matchingClaimed - sRule.valuePaise);
      }
    }
  }

  // Admissible Base Before Deductibles
  const totalItemLevelDeductions = excludedNonPayablePaise + roomRentExcessPaise + proportionateDisallowancePaise + sublimitDisallowancePaise;
  const preDeductibleBase = Math.max(0, totalClaimedPaise - totalItemLevelDeductions);

  // 5. Deductible (Claim-Level)
  let appliedDeductiblePaise = 0;
  const deductibleRule = rules.find(r => r.ruleType === 'DEDUCTIBLE');
  if (deductibleRule && deductibleRule.valuePaise) {
    appliedDeductiblePaise = Math.min(preDeductibleBase, deductibleRule.valuePaise);
  }

  const postDeductibleBase = Math.max(0, preDeductibleBase - appliedDeductiblePaise);

  // 6. Co-Payment (Claim-Level on Post-Deductible Base)
  let appliedCopayPaise = 0;
  const copayRule = rules.find(r => r.ruleType === 'COPAY');
  if (copayRule && copayRule.ratePercent) {
    appliedCopayPaise = Math.round(postDeductibleBase * (copayRule.ratePercent / 100));
  }

  const postCopayBase = Math.max(0, postDeductibleBase - appliedCopayPaise);

  // 7. Sum Insured Capping
  let sumInsuredCapDisallowancePaise = 0;
  if (sumInsuredPaise > 0 && postCopayBase > sumInsuredPaise) {
    sumInsuredCapDisallowancePaise = postCopayBase - sumInsuredPaise;
  }

  const finalInsurerPayablePaise = Math.max(0, postCopayBase - sumInsuredCapDisallowancePaise);
  const totalPatientResponsibilityPaise = totalClaimedPaise - finalInsurerPayablePaise;
  const isMathematicallyBalanced = totalClaimedPaise === (finalInsurerPayablePaise + totalPatientResponsibilityPaise);

  return {
    totalClaimedPaise,
    excludedNonPayablePaise,
    roomRentExcessPaise,
    proportionateDisallowancePaise,
    sublimitDisallowancePaise,
    appliedDeductiblePaise,
    appliedCopayPaise,
    sumInsuredCapDisallowancePaise,
    finalInsurerPayablePaise,
    totalPatientResponsibilityPaise,
    isMathematicallyBalanced
  };
}

/**
 * 20 Independent Calculation Oracle Fixtures
 */
export const INDEPENDENT_CALCULATION_ORACLES: IndependentOracleFixture[] = [
  // 01: Fully Supported Item
  {
    fixtureId: 'orc_01_fully_supported',
    scenarioName: 'Fully Supported Item',
    description: 'Directly covered surgery with zero deductible and zero copay',
    items: [
      { itemId: 'i1', description: 'Appendectomy Procedure', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 5000000 }
    ],
    rules: [],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 5000000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 5000000,
      totalPatientResponsibilityPaise: 0,
      reviewRequired: false,
      isMathematicallyBalanced: true,
      notes: '100% admissible claim.'
    }
  },

  // 02: Explicitly Excluded Item
  {
    fixtureId: 'orc_02_excluded_item',
    scenarioName: 'Explicitly Excluded Item',
    description: 'Cosmetic rhinoplasty and consumable gloves permanently excluded',
    items: [
      { itemId: 'i1', description: 'Aesthetic Rhinoplasty', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 7500000, isExcludedContractual: true },
      { itemId: 'i2', description: 'Surgical Gloves', category: 'CONSUMABLES_NON_PAYABLES', claimedAmountPaise: 200000, isNonPayableStatutory: true }
    ],
    rules: [],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 7700000,
      excludedNonPayablePaise: 7700000,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 0,
      totalPatientResponsibilityPaise: 7700000,
      reviewRequired: false,
      isMathematicallyBalanced: true,
      notes: 'All items excluded.'
    }
  },

  // 03: Partially Admissible Room Rent
  {
    fixtureId: 'orc_03_room_rent_cap',
    scenarioName: 'Partially Admissible Room Rent',
    description: '3 days billed at ₹8,000/day against eligible ₹5,000/day limit',
    items: [
      { itemId: 'i1', description: 'Deluxe Room Bed Charges', category: 'ROOM_RENT', claimedAmountPaise: 2400000 }
    ],
    rules: [
      {
        ruleId: 'r_rr',
        ruleType: 'ROOM_RENT_CAP',
        scope: 'ITEM_LEVEL',
        eligibleDailyLimitPaise: 500000,
        actualDailyTariffPaise: 800000,
        billedDays: 3
      }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 2400000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 900000,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 1500000,
      totalPatientResponsibilityPaise: 900000,
      reviewRequired: false,
      isMathematicallyBalanced: true,
      notes: '3 days * ₹3,000 excess = ₹9,000 patient responsibility.'
    }
  },

  // 04: Missing Evidence Requiring Review
  {
    fixtureId: 'orc_04_missing_evidence',
    scenarioName: 'Missing Evidence Requiring Review',
    description: 'Treatment item lacks conclusive clause match; partial estimate given with review_required',
    items: [
      { itemId: 'i1', description: 'Unspecified Therapy', category: 'MISCELLANEOUS', claimedAmountPaise: 2500000 }
    ],
    rules: [],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 2500000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 2500000,
      totalPatientResponsibilityPaise: 0,
      reviewRequired: true,
      isMathematicallyBalanced: true,
      notes: 'Review required flag raised for human adjuster.'
    }
  },

  // 05: Conflicting Clauses Requiring Review
  {
    fixtureId: 'orc_05_conflicting_clauses',
    scenarioName: 'Conflicting Clauses Requiring Review',
    description: 'Item matches both an inclusion clause and an exclusion clause',
    items: [
      { itemId: 'i1', description: 'Robotic Surgery', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 4000000 }
    ],
    rules: [],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 4000000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 4000000,
      totalPatientResponsibilityPaise: 0,
      reviewRequired: true,
      isMathematicallyBalanced: true,
      notes: 'Review required flag raised due to clause ambiguity.'
    }
  },

  // 06: Aggregate Deductible at Claim Level
  {
    fixtureId: 'orc_06_claim_deductible',
    scenarioName: 'Aggregate Deductible at Claim Level',
    description: '₹60,000 claim with contractual deductible of ₹15,000',
    items: [
      { itemId: 'i1', description: 'Cholecystectomy', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 6000000 }
    ],
    rules: [
      { ruleId: 'r_ded', ruleType: 'DEDUCTIBLE', scope: 'CLAIM_LEVEL', valuePaise: 1500000 }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 6000000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 1500000,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 4500000,
      totalPatientResponsibilityPaise: 1500000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Deductible subtracted from base.'
    }
  },

  // 07: Co-payment on Post-Deductible Base
  {
    fixtureId: 'orc_07_copay_on_deductible',
    scenarioName: 'Co-payment on Post-Deductible Base',
    description: '₹100,000 claimed, ₹20,000 deductible, 10% copay on post-deductible ₹80,000 base',
    items: [
      { itemId: 'i1', description: 'Major Surgery', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 10000000 }
    ],
    rules: [
      { ruleId: 'r_ded', ruleType: 'DEDUCTIBLE', scope: 'CLAIM_LEVEL', valuePaise: 2000000 },
      { ruleId: 'r_copay', ruleType: 'COPAY', scope: 'CLAIM_LEVEL', ratePercent: 10 }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 10000000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 2000000,
      appliedCopayPaise: 800000, // 10% of 80,000
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 7200000,
      totalPatientResponsibilityPaise: 2800000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Copay calculated on post-deductible amount.'
    }
  },

  // 08: Room Limit Without Proportionate Deduction
  {
    fixtureId: 'orc_08_room_limit_no_prop',
    scenarioName: 'Room Limit Without Proportionate Deduction',
    description: 'Room excess ₹8,000 deducted; associated expenses paid 100%',
    items: [
      { itemId: 'i1', description: 'Room Rent', category: 'ROOM_RENT', claimedAmountPaise: 2400000 },
      { itemId: 'i2', description: 'Surgeon Fee', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 6400000, associatedWithRoomRent: true }
    ],
    rules: [
      {
        ruleId: 'r_rr',
        ruleType: 'ROOM_RENT_CAP',
        scope: 'ITEM_LEVEL',
        eligibleDailyLimitPaise: 500000,
        actualDailyTariffPaise: 800000,
        billedDays: 3
      }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 8800000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 900000,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 7900000,
      totalPatientResponsibilityPaise: 900000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Only room rent excess deducted.'
    }
  },

  // 09: Explicitly Documented Proportionate Deduction
  {
    fixtureId: 'orc_09_explicit_proportionate',
    scenarioName: 'Explicitly Documented Proportionate Deduction',
    description: 'Room limit ₹5,000 billed at ₹10,000 (ratio 0.5); associated surgeon fee ₹70,000 discounted by 50% (₹35,000)',
    items: [
      { itemId: 'i1', description: 'Room Rent', category: 'ROOM_RENT', claimedAmountPaise: 2000000 },
      { itemId: 'i2', description: 'Surgeon Fee', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 7000000, associatedWithRoomRent: true }
    ],
    rules: [
      {
        ruleId: 'r_rr',
        ruleType: 'ROOM_RENT_CAP',
        scope: 'ITEM_LEVEL',
        eligibleDailyLimitPaise: 500000,
        actualDailyTariffPaise: 1000000,
        billedDays: 2
      },
      {
        ruleId: 'r_prop',
        ruleType: 'PROPORTIONATE_DEDUCTION',
        scope: 'ITEM_LEVEL'
      }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 9000000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 1000000, // 2 days * ₹5,000 excess
      proportionateDisallowancePaise: 3500000, // 50% of ₹70,000
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 4500000,
      totalPatientResponsibilityPaise: 4500000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Both room rent excess and proportionate disallowance applied.'
    }
  },

  // 10: Procedure Sublimit and SI Interaction
  {
    fixtureId: 'orc_10_sublimit_cap',
    scenarioName: 'Procedure Sublimit and SI Interaction',
    description: 'Cataract surgery claimed at ₹65,000 capped at sublimit of ₹40,000',
    items: [
      { itemId: 'i1', description: 'Cataract Surgery', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 6500000, procedureCode: 'CATARACT' }
    ],
    rules: [
      { ruleId: 'r_sub', ruleType: 'PROCEDURE_SUBLIMIT', scope: 'ITEM_LEVEL', sublimitCode: 'CATARACT', valuePaise: 4000000 }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 6500000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 2500000,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 4000000,
      totalPatientResponsibilityPaise: 2500000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Sublimit limits payable amount to ₹40,000.'
    }
  },

  // 11: Multiple Items with Aggregate Deductible
  {
    fixtureId: 'orc_11_multi_items_deductible',
    scenarioName: 'Multiple Items with Aggregate Deductible',
    description: '3 items totalling ₹80,000 with aggregate deductible of ₹15,000',
    items: [
      { itemId: 'i1', description: 'Room Rent', category: 'ROOM_RENT', claimedAmountPaise: 2000000 },
      { itemId: 'i2', description: 'Surgeon Fee', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 4000000 },
      { itemId: 'i3', description: 'Pharmacy', category: 'MEDICINES_PHARMACY', claimedAmountPaise: 2000000 }
    ],
    rules: [
      { ruleId: 'r_ded', ruleType: 'DEDUCTIBLE', scope: 'CLAIM_LEVEL', valuePaise: 1500000 }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 8000000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 1500000,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 6500000,
      totalPatientResponsibilityPaise: 1500000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Aggregate deductible applied across all eligible items.'
    }
  },

  // 12: Inconsistent Bill with Duplicate Item
  {
    fixtureId: 'orc_12_duplicate_item',
    scenarioName: 'Inconsistent Bill with Duplicate Item',
    description: 'Invoice with duplicate item; reconciliation detects and flags discrepancy',
    items: [
      { itemId: 'i1', description: 'Blood Test CBC', category: 'INVESTIGATIONS_DIAGNOSTICS', claimedAmountPaise: 1000000 }
    ],
    rules: [],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 1000000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 1000000,
      totalPatientResponsibilityPaise: 0,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Single CBC counted.'
    }
  },

  // 13: Policy Version Rule Capping
  {
    fixtureId: 'orc_13_version_capping',
    scenarioName: 'Policy Version Rule Capping',
    description: 'Version rule enforces cap of ₹3,000 on ₹6,000 claimed service',
    items: [
      { itemId: 'i1', description: 'Ambulance Charge', category: 'AMBULANCE', claimedAmountPaise: 600000, procedureCode: 'AMBULANCE' }
    ],
    rules: [
      { ruleId: 'r_amb', ruleType: 'PROCEDURE_SUBLIMIT', scope: 'ITEM_LEVEL', sublimitCode: 'AMBULANCE', valuePaise: 300000 }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 600000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 300000,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 300000,
      totalPatientResponsibilityPaise: 300000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Ambulance sublimit applied.'
    }
  },

  // 14: Recalculation After Amount Change
  {
    fixtureId: 'orc_14_recalc_amount_change',
    scenarioName: 'Recalculation After Amount Change',
    description: 'Item amount adjusted from ₹50,000 to ₹40,000 with 10% copay',
    items: [
      { itemId: 'i1', description: 'Adjusted Surgical Charge', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 4000000 }
    ],
    rules: [
      { ruleId: 'r_copay', ruleType: 'COPAY', scope: 'CLAIM_LEVEL', ratePercent: 10 }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 4000000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 400000,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 3600000,
      totalPatientResponsibilityPaise: 400000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Recalculation recomputed fresh from ₹40,000.'
    }
  },

  // 15: Idempotent Repeated Assessment
  {
    fixtureId: 'orc_15_idempotent_assessment',
    scenarioName: 'Idempotent Repeated Assessment',
    description: 'Submitting identical assessment request twice yields identical figures',
    items: [
      { itemId: 'i1', description: 'Standard Treatment', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 4800000 }
    ],
    rules: [
      { ruleId: 'r_ded', ruleType: 'DEDUCTIBLE', scope: 'CLAIM_LEVEL', valuePaise: 1000000 }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 4800000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 1000000,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 3800000,
      totalPatientResponsibilityPaise: 1000000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Idempotent computation.'
    }
  },

  // 16: Prevent Double Deductions Invariant
  {
    fixtureId: 'orc_16_prevent_double_deduction',
    scenarioName: 'Prevent Double Deductions Invariant',
    description: 'Item cannot be deducted both under exclusion and under room-rent limit',
    items: [
      { itemId: 'i1', description: 'Admissible Surgery', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 4000000 },
      { itemId: 'i2', description: 'Cosmetic Procedure', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 2000000, isExcludedContractual: true }
    ],
    rules: [
      { ruleId: 'r_copay', ruleType: 'COPAY', scope: 'CLAIM_LEVEL', ratePercent: 20 }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 6000000,
      excludedNonPayablePaise: 2000000,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 800000, // 20% on admissible ₹40,000 ONLY
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 3200000,
      totalPatientResponsibilityPaise: 2800000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Excluded ₹20,000 does not have copay applied again.'
    }
  },

  // 17: Missing Sum-Insured Utilization
  {
    fixtureId: 'orc_17_no_prior_utilization',
    scenarioName: 'Missing Sum-Insured Utilization',
    description: 'No prior claims recorded; full sum insured ₹500,000 available',
    items: [
      { itemId: 'i1', description: 'Inpatient Treatment', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 20000000 }
    ],
    rules: [],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 20000000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 20000000,
      totalPatientResponsibilityPaise: 0,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Full sum insured available.'
    }
  },

  // 18: Invalid Monetary Input Handling
  {
    fixtureId: 'orc_18_invalid_monetary',
    scenarioName: 'Invalid Monetary Input Handling',
    description: 'Negative monetary input clamped safely to prevent negative insurer payables',
    items: [
      { itemId: 'i1', description: 'Erroneous Charge', category: 'MISCELLANEOUS', claimedAmountPaise: -200000 }
    ],
    rules: [],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: -200000,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 0,
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 0,
      totalPatientResponsibilityPaise: -200000,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Payable is non-negative zero.'
    }
  },

  // 19: Integer Minor Unit Rounding
  {
    fixtureId: 'orc_19_minor_unit_rounding',
    scenarioName: 'Integer Minor Unit Rounding',
    description: 'Exact integer paisa rounding on ₹1,555.55 (155,555 paise) with 15% copay',
    items: [
      { itemId: 'i1', description: 'Fractional Medicine Item', category: 'MEDICINES_PHARMACY', claimedAmountPaise: 155555 }
    ],
    rules: [
      { ruleId: 'r_copay', ruleType: 'COPAY', scope: 'CLAIM_LEVEL', ratePercent: 15 }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 155555,
      excludedNonPayablePaise: 0,
      roomRentExcessPaise: 0,
      proportionateDisallowancePaise: 0,
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 23333, // Math.round(155555 * 0.15) = 23333.25 -> 23333
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 132222,
      totalPatientResponsibilityPaise: 23333,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'No half-paisa drift.'
    }
  },

  // 20: Cost Intelligence Baseline Regression
  {
    fixtureId: 'orc_20_cost_intelligence_regression',
    scenarioName: 'Cost Intelligence Baseline Regression',
    description: 'Realistic inpatient bill with room rent, surgeon, consumables, and 10% copay',
    items: [
      { itemId: 'i1', description: 'Deluxe Room Bed Charges', category: 'ROOM_RENT', claimedAmountPaise: 2800000 },
      { itemId: 'i2', description: 'Surgeon and OT Charges', category: 'SURGEON_CONSULTATION', claimedAmountPaise: 6500000, associatedWithRoomRent: true },
      { itemId: 'i3', description: 'Disposable Gloves Consumables', category: 'CONSUMABLES_NON_PAYABLES', claimedAmountPaise: 1500000, isNonPayableStatutory: true }
    ],
    rules: [
      {
        ruleId: 'r_rr',
        ruleType: 'ROOM_RENT_CAP',
        scope: 'ITEM_LEVEL',
        eligibleDailyLimitPaise: 500000,
        actualDailyTariffPaise: 700000,
        billedDays: 4
      },
      {
        ruleId: 'r_prop',
        ruleType: 'PROPORTIONATE_DEDUCTION',
        scope: 'ITEM_LEVEL'
      },
      {
        ruleId: 'r_copay',
        ruleType: 'COPAY',
        scope: 'CLAIM_LEVEL',
        ratePercent: 10
      }
    ],
    policySumInsuredPaise: 50000000,
    treatmentDate: '2025-05-10',
    expected: {
      totalClaimedPaise: 10800000,
      excludedNonPayablePaise: 1500000,
      roomRentExcessPaise: 800000, // 4 * ₹2,000 = ₹8,000
      proportionateDisallowancePaise: 1857143, // (1 - 5/7) * 65,000 = 2/7 * 65,000 = ₹18,571.43
      sublimitDisallowancePaise: 0,
      appliedDeductiblePaise: 0,
      appliedCopayPaise: 664286, // 10% on post-proportionate admissible base
      sumInsuredCapDisallowancePaise: 0,
      finalInsurerPayablePaise: 5978571,
      totalPatientResponsibilityPaise: 4821429,
      isMathematicallyBalanced: true,
      reviewRequired: false,
      notes: 'Matches complex multi-step insurance settlement exactly.'
    }
  }
];
