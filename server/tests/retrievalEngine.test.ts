import { describe, it, expect, beforeEach } from 'vitest';
import { clauseIndexingService } from '../src/services/clauseIndexingService.js';
import {
  hybridRetrievalService,
  HybridRetrievalService
} from '../src/services/hybridRetrievalService.js';
import { embeddingService } from '../src/services/embeddingService.js';
import { DEMO_POLICIES } from '../src/utils/demoData.js';
import { PolicyVersionRecord } from '../src/types/policyVersion.js';
import { PolicyDocument } from '../src/types/policy.js';
import { IndexedPolicyClause } from '../src/types/retrieval.js';

// ============================================================================
// Synthetic Test Fixtures
// ============================================================================

const createTestPolicyData = (): PolicyDocument => ({
  _id: 'doc_test_base_v1',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  confirmedByUser: true,
  insurer: 'Test Health Assurance Ltd',
  insurerAliases: ['Test Health'],
  planName: 'Test Comprehensive Shield',
  policyType: 'individual',
  policyNumber: 'TEST-2025-001',
  uin: 'TEST-HLT-2025-V1',
  policyStartDate: '2025-01-01',
  policyEndDate: '2025-12-31',
  zone: 'Zone A',
  networkType: 'all-network',
  cashlessAvailable: true,
  tpa: 'Test TPA',
  insuredPersons: [{ name: 'Test Person', age: 40, relation: 'Self' }],
  sumInsured: 500000,
  roomLimit: { type: 'amount', value: 5000 },
  icuLimit: { type: 'amount', value: 10000 },
  copay: 10,
  nonNetworkCopay: 20,
  copayConditions: {},
  deductible: 0,
  proportionateDeduction: true,
  roomCategoryRestriction: false,
  subLimits: { cataract: 40000 },
  restorationBenefit: true,
  cumulativeBonus: 25000,
  exclusions: ['Cosmetic surgery', 'Weight loss treatment', 'Dental'],
  hasOtherExclusions: true,
  waitingPeriods: { initial: '30 days', preExisting: '36 months' },
  preHospitalizationDays: 30,
  postHospitalizationDays: 60,
  daycareCovered: true,
  ambulanceLimit: 2000,
  preAuthHours: 48,
  claimIntimationHours: 24,
  sourceSnippets: {
    roomLimit: 'Room rent, boarding and nursing expenses up to Rs.5,000 per day',
    icuLimit: 'ICU charges up to Rs.10,000 per day',
    copay: 'A co-payment of 10% applies to each and every admissible claim',
    proportionateDeduction: 'Associated medical expenses shall be paid in proportion to eligible room rent',
    subLimits: 'Sub-limit for cataract surgery is capped at Rs.40,000 per eye',
    exclusions: 'Cosmetic surgery and weight loss treatments are permanently excluded'
  },
  confidence: { roomLimit: 'high', sumInsured: 'high' },
  rawTextRef: '/storage/test_policy.pdf'
});

const testBaseVersion: PolicyVersionRecord = {
  familyId: 'test_fam_01',
  versionId: 'test_ver_base_v1',
  versionNumber: '1.0',
  documentType: 'BASE_POLICY',
  parentVersionId: null,
  amendmentScope: null,
  insurerId: 'test_ins_01',
  insurerName: 'Test Health Assurance Ltd',
  planName: 'Test Comprehensive Shield',
  documentId: 'doc_test_base_v1',
  effectiveFrom: '2025-01-01',
  effectiveTo: '2025-12-31',
  uploadTimestamp: '2025-01-05T10:00:00.000Z',
  extractedTimestamp: '2025-01-05T10:05:00.000Z',
  extractionStatus: 'VERIFIED',
  clauseModifications: [],
  policyData: createTestPolicyData(),
  unresolvedQuestions: []
};

const testAmendmentVersion: PolicyVersionRecord = {
  familyId: 'test_fam_01',
  versionId: 'test_ver_amend_v1.1',
  versionNumber: '1.1',
  documentType: 'AMENDMENT',
  parentVersionId: 'test_ver_base_v1',
  amendmentScope: 'MODIFIES_SPECIFIC_CLAUSES',
  insurerId: 'test_ins_01',
  insurerName: 'Test Health Assurance Ltd',
  planName: 'Test Comprehensive Shield - Endorsement A',
  documentId: 'doc_test_amend_v1.1',
  effectiveFrom: '2025-07-01', // Effective July 1st
  effectiveTo: '2025-12-31',
  uploadTimestamp: '2025-06-25T14:30:00.000Z',
  extractedTimestamp: '2025-06-25T14:35:00.000Z',
  extractionStatus: 'VERIFIED',
  clauseModifications: [
    {
      clauseId: 'mod_room_7500',
      clauseTitle: 'Room Rent Revision Endorsement',
      changeType: 'MODIFIED',
      targetPath: 'roomLimit.value',
      newClauseText: '7500',
      description: 'Increases room rent daily limit from ₹5,000 to ₹7,500'
    }
  ],
  policyData: createTestPolicyData(),
  unresolvedQuestions: []
};

describe('Hybrid Retrieval & Policy Clause Matching Engine', () => {
  let indexedCorpus: IndexedPolicyClause[];

  beforeEach(() => {
    // Ensure offline deterministic vectorizer is used for tests
    embeddingService.setAllowRemote(false);

    const baseClauses = clauseIndexingService.indexPolicyVersion(testBaseVersion);
    const amendClauses = clauseIndexingService.indexPolicyVersion(testAmendmentVersion);
    indexedCorpus = [...baseClauses, ...amendClauses];
  });

  describe('1. Exact Keyword Retrieval (BM25)', () => {
    it('retrieves room rent limit clause on exact verbatim phrasing', () => {
      const matches = hybridRetrievalService.retrieveLexical(
        'Room rent, boarding and nursing expenses up to Rs.5,000 per day',
        indexedCorpus,
        5
      );

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].clause.clauseId).toBe('test_ver_base_v1_cl_room_rent');
      expect(matches[0].retrievalMethod).toBe('KEYWORD_BM25');
      expect(matches[0].score).toBeGreaterThan(0);
    });

    it('retrieves ICU clause on exact ICU keyword query', () => {
      const matches = hybridRetrievalService.retrieveLexical('ICU charges per day', indexedCorpus, 5);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].clause.clauseId).toBe('test_ver_base_v1_cl_icu_limit');
    });
  });

  describe('2. Paraphrase & Morphological Matching (Semantic Vector)', () => {
    it('retrieves ICU clause when wording differs completely from verbatim terms', async () => {
      // Query does not contain "ICU" or "charges", but medical synonyms for intensive care
      const matches = await hybridRetrievalService.retrieveSemantic(
        'Critical care monitoring unit per-day stay tariff',
        indexedCorpus,
        5
      );

      expect(matches.length).toBeGreaterThan(0);
      const topClause = matches[0].clause;
      expect(topClause.clauseId).toBe('test_ver_base_v1_cl_icu_limit');
      expect(matches[0].retrievalMethod).toBe('SEMANTIC_VECTOR');
      expect(matches[0].vectorScore).toBeGreaterThan(0.2);
    });

    it('matches cataract sublimit when query uses clinical phrasing phacoemulsification', async () => {
      const matches = await hybridRetrievalService.retrieveSemantic(
        'phacoemulsification lens surgery eye procedure',
        indexedCorpus,
        5
      );

      expect(matches.length).toBeGreaterThan(0);
      const matchedSublimit = matches.find((m) => m.clause.clauseId.includes('sublimit'));
      expect(matchedSublimit).toBeDefined();
    });
  });

  describe('3. Hybrid Reciprocal Rank Fusion (RRF) & Deduplication', () => {
    it('fuses lexical and semantic candidates without duplicating clause IDs', async () => {
      const fused = await hybridRetrievalService.retrieveHybrid(
        'Hospital single bed boarding tariff ₹5000',
        indexedCorpus,
        5
      );

      expect(fused.length).toBeGreaterThan(0);
      expect(fused[0].retrievalMethod).toBe('HYBRID_RRF');

      // Verify no duplicate clause IDs
      const clauseIds = fused.map((m) => m.clause.clauseId);
      const uniqueIds = new Set(clauseIds);
      expect(clauseIds.length).toBe(uniqueIds.size);
    });

    it('preserves component scores (bm25Score and vectorScore) in hybrid match', async () => {
      const fused = await hybridRetrievalService.retrieveHybrid('Room rent nursing', indexedCorpus, 5);

      expect(fused.length).toBeGreaterThan(0);
      expect(fused[0].bm25Score).toBeDefined();
      expect(fused[0].vectorScore).toBeDefined();
      expect(fused[0].score).toBeGreaterThan(0);
    });
  });

  describe('4. Deliberate Negative & Exclusion Evidence Retrieval', () => {
    it('retrieves statutory IRDAI Annexure 1 non-payable exclusion for surgical gloves', async () => {
      const result = await hybridRetrievalService.matchBillItem(
        {
          billItemDescription: 'Surgical examination gloves and hand sanitizer bottle',
          category: 'CONSUMABLES_NON_PAYABLES',
          familyId: 'test_fam_01',
          treatmentDate: '2025-04-10'
        },
        indexedCorpus
      );

      expect(result.exclusionClauses.length).toBeGreaterThan(0);
      expect(result.verification.status).toBe('excluded');
      expect(result.exclusionClauses[0].clause.clauseId).toContain('irdai_non_payable_consumables_01');
      expect(result.verification.verificationSummary).toContain('exclusion');
    });

    it('retrieves policy permanent exclusion for cosmetic rhinoplasty', async () => {
      const result = await hybridRetrievalService.matchBillItem(
        {
          billItemDescription: 'Cosmetic rhinoplasty and aesthetic nose surgery',
          category: 'SURGEON_CONSULTATION',
          familyId: 'test_fam_01',
          treatmentDate: '2025-04-10'
        },
        indexedCorpus
      );

      expect(result.exclusionClauses.length).toBeGreaterThan(0);
      expect(result.verification.status).toBe('excluded');
      expect(result.exclusionClauses[0].clause.clauseId).toContain('cl_excl');
    });
  });

  describe('5. Version Precedence & Treatment-Date Filtering', () => {
    it('rejects amendment clause when treatment date precedes amendment effective date', async () => {
      // Treatment date is 2025-05-15 (Amendment effectiveFrom is 2025-07-01)
      const result = await hybridRetrievalService.matchBillItem(
        {
          billItemDescription: 'Deluxe private room daily bed charge',
          category: 'ROOM_RENT',
          familyId: 'test_fam_01',
          treatmentDate: '2025-05-15'
        },
        indexedCorpus
      );

      // Top limit clause must be base version (5000), NOT amendment version (7500)
      expect(result.limitClauses.length).toBeGreaterThan(0);
      const topClause = result.limitClauses[0].clause;
      expect(topClause.versionId).toBe('test_ver_base_v1');
      expect(topClause.limitValue).toBe(5000);

      // Verify amendment clause was filtered out
      const hasAmendment = result.limitClauses.some((m) => m.clause.versionId === 'test_ver_amend_v1.1');
      expect(hasAmendment).toBe(false);
    });

    it('accepts amendment clause when treatment date is on or after amendment effective date', async () => {
      // Treatment date is 2025-08-15 (After amendment effective date 2025-07-01)
      const result = await hybridRetrievalService.matchBillItem(
        {
          billItemDescription: 'Deluxe private room daily bed charge',
          category: 'ROOM_RENT',
          familyId: 'test_fam_01',
          treatmentDate: '2025-08-15'
        },
        indexedCorpus
      );

      expect(result.limitClauses.length).toBeGreaterThan(0);
      const amendmentMatch = result.limitClauses.find(
        (m) => m.clause.versionId === 'test_ver_amend_v1.1'
      );
      expect(amendmentMatch).toBeDefined();
      expect(amendmentMatch?.clause.limitValue).toBe(7500);
    });
  });

  describe('6. Evidence Verification Contracts & Uncertainty Handling', () => {
    it('returns conditional status when item is subject to room capping or proportionate deduction', async () => {
      const result = await hybridRetrievalService.matchBillItem(
        {
          billItemDescription: 'Surgeon consultation fee for deluxe room inpatient',
          category: 'SURGEON_CONSULTATION',
          familyId: 'test_fam_01',
          treatmentDate: '2025-04-10'
        },
        indexedCorpus
      );

      expect(result.verification.status).toBe('conditional');
      expect(result.verification.primaryLimitClause).toBeDefined();
      expect(result.verification.manualReviewRequired).toBe(false);
    });

    it('returns insufficient_evidence when bill line has no matching terms in policy', async () => {
      const result = await hybridRetrievalService.matchBillItem(
        {
          billItemDescription: 'Unrelated obscure space telemetry rental fee XYZ-99',
          category: 'MISCELLANEOUS',
          familyId: 'test_fam_01',
          treatmentDate: '2025-04-10'
        },
        indexedCorpus
      );

      expect(result.verification.status).toBe('insufficient_evidence');
      expect(result.verification.manualReviewRequired).toBe(true);
      expect(result.verification.reviewReasons[0]).toContain('No matching policy clauses found');
    });
  });

  describe('7. Citation & Source Provenance Integrity', () => {
    it('preserves exact source excerpt and page number without hallucinating text', async () => {
      const result = await hybridRetrievalService.matchBillItem(
        {
          billItemDescription: 'Room rent and bed charges',
          category: 'ROOM_RENT',
          familyId: 'test_fam_01',
          treatmentDate: '2025-04-10'
        },
        indexedCorpus
      );

      expect(result.limitClauses.length).toBeGreaterThan(0);
      const topClause = result.limitClauses[0].clause;
      expect(topClause.exactExcerpt).toBe(testBaseVersion.policyData.sourceSnippets?.roomLimit);
      expect(topClause.pageNumber).toBe(1);
      expect(topClause.heading).toBe('Hospitalization & Room Rent Daily Eligibility Limit');
    });
  });

  describe('8. Deterministic Output with Fixed Inputs', () => {
    it('produces identical scores and rankings across repeated executions', async () => {
      const query = {
        billItemDescription: 'ICU critical care room charges per day',
        category: 'ICU_CHARGES' as const,
        familyId: 'test_fam_01',
        treatmentDate: '2025-04-10'
      };

      const run1 = await hybridRetrievalService.matchBillItem(query, indexedCorpus);
      const run2 = await hybridRetrievalService.matchBillItem(query, indexedCorpus);

      expect(run1.limitClauses.length).toBe(run2.limitClauses.length);
      expect(run1.limitClauses[0].clause.clauseId).toBe(run2.limitClauses[0].clause.clauseId);
      expect(run1.limitClauses[0].score).toBe(run2.limitClauses[0].score);
    });
  });

  describe('9. Real Policy Fixture Integration Test', () => {
    it('indexes and matches Knee Replacement sublimit from real DEMO_POLICIES Star Health fixture', async () => {
      const starDemo = DEMO_POLICIES.find((p) => p.id === 'pol_demo_star');
      expect(starDemo).toBeDefined();

      const starPolicyVersion: PolicyVersionRecord = {
        familyId: 'fam_star_optima',
        versionId: 'ver_star_optima_v1',
        versionNumber: '1.0',
        documentType: 'BASE_POLICY',
        insurerName: starDemo!.insurer,
        planName: starDemo!.planName,
        documentId: 'doc_star_optima_pdf',
        effectiveFrom: '2026-04-01',
        effectiveTo: '2027-03-31',
        uploadTimestamp: new Date().toISOString(),
        extractedTimestamp: new Date().toISOString(),
        extractionStatus: 'VERIFIED',
        clauseModifications: [],
        policyData: {
          _id: starDemo!.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          confirmedByUser: true,
          ...starDemo!.data
        } as PolicyDocument,
        unresolvedQuestions: []
      };

      const realCorpus = clauseIndexingService.indexPolicyVersion(starPolicyVersion);

      const result = await hybridRetrievalService.matchBillItem(
        {
          billItemDescription: 'Total Knee Replacement surgery implant and surgeon fees',
          normalizedDescription: 'Knee Replacement Surgery',
          category: 'SURGEON_CONSULTATION',
          familyId: 'fam_star_optima',
          treatmentDate: '2026-06-15'
        },
        realCorpus
      );

      expect(result.limitClauses.length).toBeGreaterThan(0);
      const kneeClause = result.limitClauses.find((m) =>
        m.clause.normalizedText.includes('knee replacement')
      );
      expect(kneeClause).toBeDefined();
      expect(kneeClause?.clause.limitValue).toBe(150000);
      expect(kneeClause?.clause.exactExcerpt).toContain('1,50,000');
    });
  });
});
