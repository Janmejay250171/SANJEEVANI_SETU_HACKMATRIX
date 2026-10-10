import { describe, it, expect, beforeEach } from 'vitest';
import { evidenceVerificationService, EvidenceVerificationService } from '../src/services/evidenceVerificationService.js';
import { clauseIndexingService } from '../src/services/clauseIndexingService.js';
import { hybridRetrievalService } from '../src/services/hybridRetrievalService.js';
import { PolicyVersionRecord } from '../src/types/policyVersion.js';
import { PolicyDocument } from '../src/types/policy.js';
import { BillItemVerificationContext } from '../src/types/verification.js';
import { MultiChannelRetrievalResult, CandidateClauseMatch } from '../src/types/retrieval.js';

// ============================================================================
// Synthetic Test Policy Fixtures
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
  insuredPersons: [{ name: 'Test User', age: 35, relation: 'Self' }],
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
  cumulativeBonus: 50000,
  exclusions: [
    'Cosmetic surgery',
    'Weight loss treatment',
    'Dental treatment (except due to accidental injury)',
    'Unproven procedures'
  ],
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
    exclusions: 'Elective cosmetic surgery, dental treatment (except due to accidental injury), and weight loss treatments are permanently excluded'
  },
  confidence: { roomLimit: 'high', sumInsured: 'high' },
  rawTextRef: '/storage/test_policy_v1.pdf'
});

const baseVersionV1: PolicyVersionRecord = {
  familyId: 'fam_test_01',
  versionId: 'ver_test_base_v1',
  versionNumber: '1.0',
  documentType: 'BASE_POLICY',
  parentVersionId: null,
  amendmentScope: null,
  insurerId: 'ins_test_01',
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

const amendmentVersionV1_1: PolicyVersionRecord = {
  familyId: 'fam_test_01',
  versionId: 'ver_test_amend_v1.1',
  versionNumber: '1.1',
  documentType: 'AMENDMENT',
  parentVersionId: 'ver_test_base_v1',
  amendmentScope: 'MODIFIES_SPECIFIC_CLAUSES',
  insurerId: 'ins_test_01',
  insurerName: 'Test Health Assurance Ltd',
  planName: 'Test Comprehensive Shield - Endorsement A',
  documentId: 'doc_test_amend_v1.1',
  effectiveFrom: '2025-07-01',
  effectiveTo: '2025-12-31',
  uploadTimestamp: '2025-06-25T14:30:00.000Z',
  extractedTimestamp: '2025-06-25T14:35:00.000Z',
  extractionStatus: 'VERIFIED',
  clauseModifications: [
    {
      clauseId: 'cl_amend_room_01',
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

describe('EvidenceVerificationService (FIN-01 Policy Evidence Adjudication)', () => {
  let fullCorpus: any[];

  beforeEach(() => {
    const baseClauses = clauseIndexingService.indexPolicyVersion(baseVersionV1);
    const amendClauses = clauseIndexingService.indexPolicyVersion(amendmentVersionV1_1);
    fullCorpus = [...baseClauses, ...amendClauses];
  });

  // ==========================================================================
  // 1. Evidence Outcomes
  // ==========================================================================
  describe('Explicit Evidence Outcomes', () => {
    it('verifies statutory exclusion for IRDAI Annexure 1 consumables', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-04-10',
          billItemDescription: 'Disposable Surgical Gloves and Antiseptic Hand Sanitizer',
          category: 'CONSUMABLES_NON_PAYABLES'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_statutory_gloves',
        originalDescription: 'Disposable Surgical Gloves and Antiseptic Hand Sanitizer',
        category: 'CONSUMABLES_NON_PAYABLES',
        claimedAmountPaise: 125000,
        treatmentDate: '2025-04-10',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('excluded');
      expect(result.reviewRequired).toBe(false);
      expect(result.adverseExclusionEvidence.length).toBeGreaterThan(0);
      expect(result.adverseExclusionEvidence[0].precedenceRole).toBe('CONTROLLING');
      expect(result.adverseExclusionEvidence[0].heading).toContain('IRDAI Master Circular');
    });

    it('verifies permanent contractual exclusion for elective cosmetic rhinoplasty', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-04-10',
          billItemDescription: 'Aesthetic Rhinoplasty and Facial Cosmetic Reshaping',
          category: 'SURGEON_CONSULTATION'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_cosmetic_rhinoplasty',
        originalDescription: 'Aesthetic Rhinoplasty and Facial Cosmetic Reshaping',
        category: 'SURGEON_CONSULTATION',
        claimedAmountPaise: 7500000,
        clinicalDiagnosis: 'Elective aesthetic facial enhancement',
        treatmentDate: '2025-04-10',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('excluded');
      expect(result.reviewRequired).toBe(false);
      expect(result.adverseExclusionEvidence[0].precedenceRole).toBe('CONTROLLING');
      expect(result.adverseExclusionEvidence[0].heading).toContain('Cosmetic surgery');
    });

    it('verifies conditional outcome for room rent within daily limit', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-04-10',
          billItemDescription: 'Single Standard AC Room Bed Charges (2 Days)',
          category: 'ROOM_RENT'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_room_standard',
        originalDescription: 'Single Standard AC Room Bed Charges (2 Days)',
        category: 'ROOM_RENT',
        claimedAmountPaise: 1000000,
        billedRoomTariffPaise: 500000, // ₹5,000/day (within cap)
        treatmentDate: '2025-04-10',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('conditional');
      expect(result.reviewRequired).toBe(false);
      expect(result.conditionalRequirements.length).toBeGreaterThan(0);
      expect(result.conditionalRequirements[0]).toContain('Room rent daily cap');
    });

    it('verifies conditional outcome with proportionate deduction for room rent exceeding cap', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-04-10',
          billItemDescription: 'Deluxe Suite Room Rent (3 Days)',
          category: 'ROOM_RENT'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_room_deluxe',
        originalDescription: 'Deluxe Suite Room Rent (3 Days)',
        category: 'ROOM_RENT',
        claimedAmountPaise: 2400000,
        billedRoomTariffPaise: 800000, // ₹8,000/day (exceeds ₹5,000 cap)
        treatmentDate: '2025-04-10',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('conditional');
      expect(result.reviewRequired).toBe(false);
      expect(result.conditionalRequirements.some((c) => c.includes('proportionate deduction'))).toBe(true);
    });

    it('verifies insufficient_evidence and triggers review for unrelated non-medical rental items', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-04-10',
          billItemDescription: 'Space Telemetry and Obscure Equipment Rental XYZ-99',
          category: 'MISCELLANEOUS'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_unrelated_rental',
        originalDescription: 'Space Telemetry and Obscure Equipment Rental XYZ-99',
        category: 'MISCELLANEOUS',
        claimedAmountPaise: 500000,
        treatmentDate: '2025-04-10',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('insufficient_evidence');
      expect(result.reviewRequired).toBe(true);
      expect(result.confidence.level).toBe('LOW');
    });
  });

  // ==========================================================================
  // 2. Exclusions & Exceptions
  // ==========================================================================
  describe('Exclusion Detection and Exception Restoration', () => {
    it('restores dental coverage when accidental trauma exception is verified', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-04-10',
          billItemDescription: 'Emergency Inpatient Dental Fracture Surgery and Maxillofacial Repair',
          category: 'SURGEON_CONSULTATION'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_dental_accident',
        originalDescription: 'Emergency Inpatient Dental Fracture Surgery and Maxillofacial Repair',
        category: 'SURGEON_CONSULTATION',
        claimedAmountPaise: 4500000,
        clinicalDiagnosis: 'Road traffic accident trauma with fractured jaw',
        treatmentDate: '2025-04-10',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('supported');
      expect(result.reviewRequired).toBe(false);
      const dentalExcl = result.adverseExclusionEvidence.find((e) => e.heading.includes('Dental'));
      expect(dentalExcl?.precedenceRole).toBe('EXCEPTION_APPLIED');
      expect(dentalExcl?.precedenceReason).toContain('Dental coverage restored');
    });

    it('triggers conditional review when dental exception facts are missing', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-04-10',
          billItemDescription: 'Root Canal Therapy and Tooth Extraction',
          category: 'SURGEON_CONSULTATION'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_dental_missing_facts',
        originalDescription: 'Root Canal Therapy and Tooth Extraction',
        category: 'SURGEON_CONSULTATION',
        claimedAmountPaise: 2500000,
        clinicalDiagnosis: null, // missing facts
        treatmentDate: '2025-04-10',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('conditional');
      expect(result.reviewRequired).toBe(true);
      expect(result.missingFacts.length).toBeGreaterThan(0);
      expect(result.missingFacts[0]).toContain('Clinical diagnosis / trauma documentation required');
    });

    it('restores cosmetic coverage for reconstructive surgery following severe burns', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-04-10',
          billItemDescription: 'Cosmetic Skin Grafting and Facial Plastic Reconstruction',
          category: 'SURGEON_CONSULTATION'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_cosmetic_burn_reconstruction',
        originalDescription: 'Cosmetic Skin Grafting and Facial Plastic Reconstruction',
        category: 'SURGEON_CONSULTATION',
        claimedAmountPaise: 6500000,
        clinicalDiagnosis: 'Third degree flame burns requiring facial reconstruction',
        treatmentDate: '2025-04-10',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('supported');
      expect(result.reviewRequired).toBe(false);
      const cosmeticExcl = result.adverseExclusionEvidence.find((e) => e.heading.includes('Cosmetic'));
      expect(cosmeticExcl?.precedenceRole).toBe('EXCEPTION_APPLIED');
      expect(cosmeticExcl?.precedenceReason).toContain('Cosmetic reconstructive surgery covered');
    });
  });

  // ==========================================================================
  // 3. Conflicting Policy Evidence & Amendment Supersession
  // ==========================================================================
  describe('Conflict Resolution and Amendment Precedence', () => {
    it('applies amendment endorsement when treatment date succeeds effective date', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-08-15', // Post July 1, 2025 amendment
          billItemDescription: 'Private Room Bed Boarding Charges (July 2025 Endorsement)',
          category: 'ROOM_RENT'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_post_amendment_room',
        originalDescription: 'Private Room Bed Boarding Charges (July 2025 Endorsement)',
        category: 'ROOM_RENT',
        claimedAmountPaise: 1500000,
        billedRoomTariffPaise: 750000, // ₹7,500/day
        treatmentDate: '2025-08-15',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('conditional');
      expect(result.reviewRequired).toBe(false);

      // Amendment clause should be controlling, base clause superseded
      const controllingClause = result.supportingEvidence.find((c) => c.precedenceRole === 'CONTROLLING');
      expect(controllingClause?.versionId).toBe('ver_test_amend_v1.1');

      const supersededClause = result.conflictingEvidence.find((c) => c.precedenceRole === 'SUPERSEDED');
      expect(supersededClause?.versionId).toBe('ver_test_base_v1');
    });

    it('preserves base policy clause when treatment date precedes amendment effective date', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-05-15', // Pre July 1, 2025 amendment
          billItemDescription: 'Private Room Bed Boarding Charges (May 2025 Admission)',
          category: 'ROOM_RENT'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_pre_amendment_room',
        originalDescription: 'Private Room Bed Boarding Charges (May 2025 Admission)',
        category: 'ROOM_RENT',
        claimedAmountPaise: 1000000,
        billedRoomTariffPaise: 500000, // ₹5,000/day
        treatmentDate: '2025-05-15',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('conditional');
      expect(result.reviewRequired).toBe(false);

      const controllingClause = result.supportingEvidence.find((c) => c.precedenceRole === 'CONTROLLING');
      expect(controllingClause?.versionId).toBe('ver_test_base_v1');
    });

    it('subordinates general surgical limits to specific disease sublimit', async () => {
      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-05-15',
          billItemDescription: 'Cataract Surgery with Foldable Intraocular Lens (IOL)',
          category: 'SURGEON_CONSULTATION'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_cataract_sublimit',
        originalDescription: 'Cataract Surgery with Foldable Intraocular Lens (IOL)',
        category: 'SURGEON_CONSULTATION',
        claimedAmountPaise: 4500000,
        clinicalDiagnosis: 'Senile Cataract Left Eye',
        treatmentDate: '2025-05-15',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('conditional');
      const sublimitClause = result.supportingEvidence.find((c) => c.heading.includes('Sub-Limit: cataract'));
      expect(sublimitClause?.precedenceRole).toBe('CONTROLLING');
      expect(sublimitClause?.precedenceReason).toContain('overrides general inpatient limits');
    });
  });

  // ==========================================================================
  // 4. Citation Integrity & Anti-Hallucination Guardrails
  // ==========================================================================
  describe('Citation Integrity and Guardrails', () => {
    it('fails verification and requires review when candidate citation has corrupt source excerpt', async () => {
      const mockRetrieval: MultiChannelRetrievalResult = {
        query: { billItemDescription: 'General Consultation', familyId: 'fam_test_01' },
        retrievalMethod: 'KEYWORD_BM25',
        supportiveClauses: [
          {
            clause: {
              clauseId: 'cl_corrupted_citation',
              familyId: 'fam_test_01',
              versionId: 'ver_test_base_v1',
              documentId: 'doc_test_base_v1',
              heading: 'General Inpatient Coverage',
              section: '1.1',
              exactExcerpt: '', // Corrupted / empty excerpt
              pageNumber: 1,
              clauseType: 'coverage',
              originalText: '',
              normalizedText: '',
              applicableCategories: ['SURGEON_CONSULTATION'],
              linkedClauseIds: [],
              effectiveFrom: '2025-01-01',
              effectiveTo: '2025-12-31',
              isSegmentationUncertain: false
            },
            retrievalMethod: 'KEYWORD_BM25',
            rank: 1,
            score: 2.5,
            applicabilityStatus: 'resolved',
            applicabilityReason: 'Matched lexical query.',
            evidenceCategory: 'PRIMARY_SUPPORT',
            requiresVerification: false
          }
        ],
        exclusionClauses: [],
        limitClauses: [],
        conflictingClauses: [],
        verification: { status: 'verified', requiresHumanReview: false, caveats: [] },
        auditNotes: [],
        latencyMs: 5
      };

      const context: BillItemVerificationContext = {
        billItemId: 'item_corrupt_excerpt',
        originalDescription: 'General Consultation',
        category: 'SURGEON_CONSULTATION',
        claimedAmountPaise: 150000,
        treatmentDate: '2025-05-15',
        familyId: 'fam_test_01',
        retrievedEvidence: mockRetrieval
      };

      const result = await evidenceVerificationService.verifyBillItemEvidence(context);

      expect(result.outcome).toBe('review_required');
      expect(result.citationIntegrityVerified).toBe(false);
      expect(result.reviewRequired).toBe(true);
      expect(result.reviewReasons[0]).toContain('Citation integrity check failed');
    });

    it('gracefully executes deterministic verification when AI provider is unavailable', async () => {
      // Instantiating with null key ensures safe fallback mode
      const safeService = new EvidenceVerificationService(null);

      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-04-10',
          billItemDescription: 'Disposable Surgical Gloves and Antiseptic Hand Sanitizer',
          category: 'CONSUMABLES_NON_PAYABLES'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_fallback_gloves',
        originalDescription: 'Disposable Surgical Gloves and Antiseptic Hand Sanitizer',
        category: 'CONSUMABLES_NON_PAYABLES',
        claimedAmountPaise: 125000,
        treatmentDate: '2025-04-10',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await safeService.verifyWithAiGuardrails(context);

      expect(result.outcome).toBe('excluded');
      expect(result.reviewRequired).toBe(false);
      expect(result.adverseExclusionEvidence.length).toBeGreaterThan(0);
    });

    it('intercepts hallucinated clause citations returned by AI and triggers mandatory review', async () => {
      const mockService = new EvidenceVerificationService(null);
      (mockService as any).genAI = {
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              text: () =>
                JSON.stringify({
                  outcome: 'supported',
                  citedClauseId: 'hallucinated_clause_invented_by_llm_999',
                  explanation: 'Covered under invented policy clause.'
                })
            }
          })
        })
      };

      const retrieval = await hybridRetrievalService.matchBillItem(
        {
          familyId: 'fam_test_01',
          treatmentDate: '2025-04-10',
          billItemDescription: 'Single Standard AC Room Bed Charges (2 Days)',
          category: 'ROOM_RENT'
        },
        fullCorpus
      );

      const context: BillItemVerificationContext = {
        billItemId: 'item_hallucination_test',
        originalDescription: 'Single Standard AC Room Bed Charges (2 Days)',
        category: 'ROOM_RENT',
        claimedAmountPaise: 1000000,
        treatmentDate: '2025-04-10',
        familyId: 'fam_test_01',
        retrievedEvidence: retrieval
      };

      const result = await mockService.verifyWithAiGuardrails(context);

      expect(result.citationIntegrityVerified).toBe(false);
      expect(result.reviewRequired).toBe(true);
      expect(result.reviewReasons.some((r) => r.includes('AI hallucinated invalid clause ID'))).toBe(true);
    });
  });
});
