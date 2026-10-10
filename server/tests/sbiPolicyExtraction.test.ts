import { describe, it, expect } from 'vitest';
import {
  normalizeIndianCurrency,
  normalizeExtractionPayload,
  normalizePartialPolicyUpdate
} from '../src/services/normalizerService.js';
import { DEMO_POLICIES } from '../src/utils/demoData.js';
import { getMissingTier1Fields } from '../src/schemas/policySchema.js';

describe('SBI General Insurance Policy Extraction & Source-of-Truth Semantic Safety', () => {
  // Mock AI extraction payload simulating the raw text extracted from SBI General Health Insurance Policy Retail PDF
  const rawSbiAiPayload = {
    insurer: 'SBI General Insurance Company Limited',
    planName: 'Health Insurance Policy - Retail',
    policyType: 'individual',
    policyNumber: null,
    uin: 'SBIPLIP11003V011011',
    policyStartDate: null,
    policyEndDate: null,
    zone: null,
    networkType: 'Network Hospitals maintained by Insurer/Administrator',
    cashlessAvailable: true,
    tpa: null,
    insuredPersons: [],

    // Schedule-dependent or not established in PDF
    sumInsured: null,
    roomLimit: '1% of Sum Insured per day',
    icuLimit: '2% of Sum Insured per day',
    copay: null,
    nonNetworkCopay: '10%',
    deductible: 'As specified in the Policy Schedule (Excess)',
    proportionateDeduction: null,
    roomCategoryRestriction: true,
    roomCategoryRestrictionNote: 'Higher room category may limit payable charges to the charges applicable to the entitled room category.',

    subLimits: {
      'Cataract': 'Up to 15% of Sum Insured, subject to maximum ₹25,000 per eye'
    },
    cataractRestriction: 'Up to 15% of Sum Insured, subject to maximum ₹25,000 per eye (First two years exclusion)',
    restorationBenefit: null, // Silent in document
    cumulativeBonus: null,

    exclusions: [
      'Cosmetic or aesthetic treatments',
      'Treatment for change of life/gender',
      'LASIK for refractive error',
      'Experimental and unproven treatment',
      'Treatment for obesity, weight reduction or weight management',
      'Genetic disorders and stem cell implantation',
      'Treatments in health hydro, spas and nature care clinics'
    ],
    hasOtherExclusions: true,
    waitingPeriods: {
      initial: '30 days',
      preExisting: '48 months',
      maternity: null,
      procedures: { 'Cataract': '2 years' }
    },
    preHospitalizationDays: 30,
    postHospitalizationDays: 60,
    daycareCovered: true,

    sourceSnippets: {
      roomLimit: 'Room, board and nursing expenses are covered up to 1% of Sum Insured per day',
      icuLimit: 'ICU expenses are covered up to 2% of Sum Insured per day',
      nonNetworkCopay: 'For all admissible claims in non-network hospitals, Insured shall bear 10% of the admissible claim',
      roomCategoryRestriction: 'Charges limited to entitled room category if higher category selected.'
    },
    confidence: {
      insurer: 'high',
      roomLimit: 'high',
      icuLimit: 'high',
      nonNetworkCopay: 'high'
    }
  };

  it('1. Sum Insured remains unknown / null and source is not_detected', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.sumInsured).toBeNull();
    expect(normalized.sourceStatuses?.sumInsured).toBe('not_detected');
  });

  it('2. Compulsory Deductible is NOT ₹0 and defaults to null with not_detected status', () => {
    // Zero-Value Safety Rule test: "schedule" / "excess" / missing must NEVER normalize to 0
    expect(normalizeIndianCurrency('As specified in Policy Schedule')).toBeNull();
    expect(normalizeIndianCurrency('Excess as per schedule')).toBeNull();
    expect(normalizeIndianCurrency('null')).toBeNull();

    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.deductible).not.toBe(0);
    expect(normalized.deductible).toBeNull();
    expect(normalized.sourceStatuses?.deductible).toBe('not_detected');
  });

  it('3. Non-network co-pay is 10% with document_stated status', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.nonNetworkCopay).toBe(10);
    expect(normalized.sourceStatuses?.nonNetworkCopay).toBe('document_stated');
  });

  it('4. Base co-pay remains unspecified / null with not_detected status', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.copay).toBeNull();
    expect(normalized.sourceStatuses?.copay).toBe('not_detected');
  });

  it('5. Room rent limit is 1% with document_stated status', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.roomLimit).toEqual({ type: 'percent', value: 1 });
    expect(normalized.sourceStatuses?.roomLimit).toBe('document_stated');
  });

  it('6. ICU limit is 2% with document_stated status', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.icuLimit).toEqual({ type: 'percent', value: 2 });
    expect(normalized.sourceStatuses?.icuLimit).toBe('document_stated');
  });

  it('7. Cataract is 15% SI capped at ₹25,000 per eye with document_stated status', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.cataractRestriction).toContain('Up to 15% of Sum Insured, subject to maximum ₹25,000 per eye');
    expect(normalized.cataractRestriction).toContain('exclusion');
  });

  it('8. Initial waiting period is 30 days', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.waitingPeriods?.initial).toBe('30 days');
  });

  it('9. PED waiting period is 48 months', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.waitingPeriods?.preExisting).toBe('48 months');
  });

  it('10. Pre-hospitalization is 30 days and post-hospitalization is 60 days', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.preHospitalizationDays).toBe(30);
    expect(normalized.postHospitalizationDays).toBe(60);
  });

  it('11. Restoration benefit is not incorrectly marked "Not included" / false', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.restorationBenefit).toBeNull();
    expect(normalized.sourceStatuses?.restorationBenefit).toBe('not_detected');
  });

  it('12. Insured persons are not inferred (remains empty array / not_detected)', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.insuredPersons).toEqual([]);
    expect(normalized.sourceStatuses?.insuredPersons).toBe('not_detected');
  });

  it('13. Policy period is not inferred as annual', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.policyStartDate).toBeNull();
    expect(normalized.policyEndDate).toBeNull();
    expect(normalized.sourceStatuses?.policyPeriod).toBe('not_detected');
  });

  it('14. Room-category restriction is not incorrectly labelled generic proportionate deduction', () => {
    const normalized = normalizeExtractionPayload(rawSbiAiPayload);
    expect(normalized.roomCategoryRestriction).toBe(true);
    expect(normalized.roomCategoryRestrictionNote).toBe(
      'Higher room category may limit payable charges to the charges applicable to the entitled room category.'
    );
    expect(normalized.sourceStatuses?.roomCategoryRestriction).toBe('document_stated');
    // Generic proportionate deduction must remain null / not_specified
    expect(normalized.proportionateDeduction).toBeNull();
    expect(normalized.sourceStatuses?.proportionateDeduction).toBe('not_detected');
  });

  it('15. Zero-value safety rule: missing numeric values do NOT default to 0', () => {
    const emptyPayload = {
      deductible: undefined,
      copay: undefined,
      sumInsured: undefined,
      ambulanceLimit: undefined,
      cumulativeBonus: undefined
    };
    const normalized = normalizeExtractionPayload(emptyPayload);
    expect(normalized.deductible).toBeNull();
    expect(normalized.copay).toBeNull();
    expect(normalized.sumInsured).toBeNull();
    expect(normalized.ambulanceLimit).toBeNull();
    expect(normalized.cumulativeBonus).toBeNull();
  });

  it('16. SBI Demo policy adheres to exact source-of-truth rules', () => {
    const demos = DEMO_POLICIES;
    const sbiDemo = demos.find((d) => d.id === 'pol_demo_sbi' || d.key === 'sbi-general');
    expect(sbiDemo).toBeDefined();

    const data = sbiDemo!.data;
    expect(data.sumInsured).toBeNull();
    expect(data.deductible).toBeNull();
    expect(data.copay).toBeNull();
    expect(data.nonNetworkCopay).toBe(10);
    expect(data.roomLimit).toEqual({ type: 'percent', value: 1 });
    expect(data.icuLimit).toEqual({ type: 'percent', value: 2 });
    expect(data.roomCategoryRestriction).toBe(true);
    expect(data.proportionateDeduction).toBeNull();
    expect(data.restorationBenefit).toBeNull();
    expect(data.insuredPersons).toEqual([]);
    expect(data.policyStartDate).toBeNull();
    expect(data.policyEndDate).toBeNull();

    // Source statuses
    expect(data.sourceStatuses?.sumInsured).toBe('not_detected');
    expect(data.sourceStatuses?.deductible).toBe('not_detected');
    expect(data.sourceStatuses?.copay).toBe('not_detected');
    expect(data.sourceStatuses?.nonNetworkCopay).toBe('document_stated');
    expect(data.sourceStatuses?.roomLimit).toBe('document_stated');
    expect(data.sourceStatuses?.icuLimit).toBe('document_stated');
    expect(data.sourceStatuses?.roomCategoryRestriction).toBe('document_stated');
  });

  it('17. Missing Tier 1 fields triggers safety block when compulsory fields are missing', () => {
    const sbiDemo = DEMO_POLICIES.find((d) => d.key === 'sbi-general')!.data;
    // Missing sumInsured, copay, deductible
    const missing = getMissingTier1Fields(sbiDemo);
    expect(missing).toContain('sumInsured');
    expect(missing).toContain('copay');
    expect(missing).toContain('deductible');
    // But roomCategoryRestriction satisfies proportionateDeduction so it's not marked missing
    expect(missing).not.toContain('proportionateDeduction');
  });
});
