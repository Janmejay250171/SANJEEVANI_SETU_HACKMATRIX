import { describe, it, expect } from 'vitest';
import {
  resolvePolicyApplicability,
  mergePolicyWithAmendments
} from '../src/services/policyVersionService.js';
import { PolicyVersionRecord } from '../src/types/policyVersion.js';
import { PolicyDocument } from '../src/types/policy.js';
import { PolicyVersionRecordZod } from '../src/schemas/claimSchema.js';

// ============================================================================
// Synthetic Test Fixtures
// (Clearly labeled synthetic test fixtures for algorithmic verification)
// ============================================================================

const createSyntheticBasePolicyData = (overrides?: Partial<PolicyDocument>): PolicyDocument => ({
  _id: 'syn_pol_doc_001',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  confirmedByUser: true,
  insurer: 'Synthetic Health Assurance Ltd',
  insurerAliases: ['Synthetic Health'],
  planName: 'Synthetic Comprehensive Health Shield',
  policyType: 'individual',
  policyNumber: 'SYN-2025-001',
  uin: 'SYN-HLT-2025-V1',
  policyStartDate: '2025-01-01',
  policyEndDate: '2025-12-31',
  zone: 'Tier 1',
  networkType: 'all-network',
  cashlessAvailable: true,
  tpa: 'Synthetic TPA Services',
  insuredPersons: [{ name: 'Test User', age: 35, relation: 'Self' }],
  sumInsured: 500000,
  roomLimit: { type: 'amount', value: 5000 },
  icuLimit: { type: 'amount', value: 10000 },
  copay: null, // Note: Unstated terms must remain null, never assumed to be 0
  nonNetworkCopay: null,
  copayConditions: {},
  deductible: null,
  proportionateDeduction: true,
  roomCategoryRestriction: false,
  subLimits: { cataract: 40000 },
  restorationBenefit: true,
  cumulativeBonus: 50000,
  exclusions: ['Cosmetic surgery', 'Weight loss treatment', 'Unproven procedures'],
  hasOtherExclusions: true,
  waitingPeriods: { initial: '30 days', preExisting: '36 months' },
  preHospitalizationDays: 30,
  postHospitalizationDays: 60,
  daycareCovered: true,
  ambulanceLimit: 2000,
  preAuthHours: 48,
  claimIntimationHours: 24,
  sourceSnippets: {
    roomLimit: 'Room rent is capped at ₹5,000 per day',
    cataract: 'Cataract surgery limited to ₹40,000 per eye'
  },
  confidence: { roomLimit: 'high', sumInsured: 'high' },
  rawTextRef: '/storage/synthetic_policy_v1.pdf',
  ...overrides
});

const syntheticBaseVersionV1: PolicyVersionRecord = {
  familyId: 'syn_fam_health_01',
  versionId: 'syn_ver_base_2025_v1',
  versionNumber: '1.0',
  documentType: 'BASE_POLICY',
  parentVersionId: null,
  amendmentScope: null,
  insurerId: 'syn_ins_01',
  insurerName: 'Synthetic Health Assurance Ltd',
  planName: 'Synthetic Comprehensive Health Shield',
  policyNumber: 'SYN-2025-001',
  uin: 'SYN-HLT-2025-V1',
  documentId: 'doc_synthetic_base_v1',
  effectiveFrom: '2025-01-01',
  effectiveTo: '2025-12-31',
  issueDate: '2024-12-15',
  uploadTimestamp: '2025-01-05T10:00:00.000Z',
  extractedTimestamp: '2025-01-05T10:05:00.000Z',
  contentHashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  rawTextRef: '/storage/synthetic_policy_v1.pdf',
  extractionStatus: 'VERIFIED',
  clauseModifications: [],
  policyData: createSyntheticBasePolicyData(),
  unresolvedQuestions: []
};

const syntheticAmendmentV1_1: PolicyVersionRecord = {
  familyId: 'syn_fam_health_01',
  versionId: 'syn_ver_amend_2025_v1.1',
  versionNumber: '1.1',
  documentType: 'AMENDMENT',
  parentVersionId: 'syn_ver_base_2025_v1',
  amendmentScope: 'MODIFIES_SPECIFIC_CLAUSES',
  insurerId: 'syn_ins_01',
  insurerName: 'Synthetic Health Assurance Ltd',
  planName: 'Synthetic Comprehensive Health Shield - Endorsement A',
  policyNumber: 'SYN-2025-001-END1',
  uin: 'SYN-HLT-2025-V1-E1',
  documentId: 'doc_synthetic_amend_v1.1',
  effectiveFrom: '2025-07-01', // Effective midway through policy year
  effectiveTo: '2025-12-31',
  issueDate: '2025-06-20',
  uploadTimestamp: '2025-06-25T14:30:00.000Z',
  extractedTimestamp: '2025-06-25T14:35:00.000Z',
  contentHashSha256: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
  rawTextRef: '/storage/synthetic_amendment_v1_1.pdf',
  extractionStatus: 'VERIFIED',
  clauseModifications: [
    {
      clauseId: 'cl_amend_room_01',
      clauseTitle: 'Room Rent Revision Endorsement',
      changeType: 'MODIFIED',
      targetPath: 'roomLimit.value',
      previousClauseText: 'Room rent is capped at ₹5,000 per day',
      newClauseText: '7500',
      description: 'Increases room rent daily limit from ₹5,000 to ₹7,500'
    },
    {
      clauseId: 'cl_amend_sublimit_cataract',
      clauseTitle: 'Cataract Sublimit Revision',
      changeType: 'MODIFIED',
      targetPath: 'subLimits.cataract',
      newClauseText: '50000',
      description: 'Increases cataract sublimit from ₹40,000 to ₹50,000 per eye'
    }
  ],
  policyData: createSyntheticBasePolicyData({
    roomLimit: { type: 'amount', value: 7500 },
    subLimits: { cataract: 50000 }
  }),
  unresolvedQuestions: []
};

// ============================================================================
// Test Suites
// ============================================================================

describe('Policy Version Records & Applicability Resolver', () => {
  describe('Zod Schema Validation', () => {
    it('validates a well-formed policy version record', () => {
      const parsed = PolicyVersionRecordZod.safeParse(syntheticBaseVersionV1);
      expect(parsed.success).toBe(true);
    });

    it('rejects version record with invalid date format', () => {
      const invalidVersion = {
        ...syntheticBaseVersionV1,
        effectiveFrom: '01/01/2025' // Non-ISO format
      };
      const parsed = PolicyVersionRecordZod.safeParse(invalidVersion);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Treatment Date Boundary Checks', () => {
    it('resolves base policy when treatment date falls exactly on effectiveFrom date', () => {
      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-01-01',
        versions: [syntheticBaseVersionV1]
      });

      expect(result.status).toBe('resolved');
      expect(result.selectedBaseVersion?.versionId).toBe('syn_ver_base_2025_v1');
      expect(result.applicableAmendments).toHaveLength(0);
      expect(result.reviewRequired).toBe(false);
    });

    it('resolves base policy when treatment date falls inside effective window', () => {
      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-04-15',
        versions: [syntheticBaseVersionV1]
      });

      expect(result.status).toBe('resolved');
      expect(result.selectedBaseVersion?.versionId).toBe('syn_ver_base_2025_v1');
      expect(result.applicableAmendments).toHaveLength(0);
    });

    it('rejects candidate when treatment date precedes effectiveFrom date', () => {
      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2024-12-31', // 1 day before policy started
        versions: [syntheticBaseVersionV1]
      });

      expect(result.status).toBe('out_of_coverage_period');
      expect(result.selectedBaseVersion).toBeNull();
      expect(result.reviewRequired).toBe(true);
      expect(result.candidateChecks[0].status).toBe('REJECTED');
      expect(result.candidateChecks[0].reason).toContain('precedes policy effective date');
    });

    it('rejects candidate when treatment date is after effectiveTo date', () => {
      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2026-01-01', // 1 day after expiry
        versions: [syntheticBaseVersionV1]
      });

      expect(result.status).toBe('out_of_coverage_period');
      expect(result.selectedBaseVersion).toBeNull();
      expect(result.reviewRequired).toBe(true);
      expect(result.candidateChecks[0].status).toBe('REJECTED');
      expect(result.candidateChecks[0].reason).toContain('after policy expiration date');
    });
  });

  describe('Missing Dates & Input Handling', () => {
    it('returns missing_treatment_date when treatment date is omitted', () => {
      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: null,
        versions: [syntheticBaseVersionV1]
      });

      expect(result.status).toBe('missing_treatment_date');
      expect(result.reviewRequired).toBe(true);
      expect(result.selectedBaseVersion).toBeNull();
    });

    it('returns missing_policy when versions array is empty', () => {
      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-05-10',
        versions: []
      });

      expect(result.status).toBe('missing_policy');
      expect(result.reviewRequired).toBe(true);
      expect(result.selectedBaseVersion).toBeNull();
    });

    it('marks policy ambiguous when base policy has missing contractual effectiveFrom date', () => {
      const undatedVersion: PolicyVersionRecord = {
        ...syntheticBaseVersionV1,
        effectiveFrom: null
      };

      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-05-10',
        versions: [undatedVersion]
      });

      expect(result.status).toBe('ambiguous');
      expect(result.reviewRequired).toBe(true);
      expect(result.selectedBaseVersion).toBeNull();
      expect(result.reviewReasons[0]).toContain('effectiveFrom date');
    });
  });

  describe('Amendments & Endorsements Applicability', () => {
    it('does NOT apply amendment when treatment date is before amendment effective date', () => {
      // Treatment on 2025-05-15 (Before amendment took effect on 2025-07-01)
      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-05-15',
        versions: [syntheticBaseVersionV1, syntheticAmendmentV1_1]
      });

      expect(result.status).toBe('resolved');
      expect(result.selectedBaseVersion?.versionId).toBe('syn_ver_base_2025_v1');
      expect(result.applicableAmendments).toHaveLength(0);
      // Merged snapshot should retain base room rent of 5000
      expect(result.mergedPolicySnapshot?.roomLimit?.value).toBe(5000);
      // Candidate checks must show amendment was rejected because treatment date preceded it
      const amendCheck = result.candidateChecks.find(
        (c) => c.versionId === 'syn_ver_amend_2025_v1.1'
      );
      expect(amendCheck?.status).toBe('REJECTED');
      expect(amendCheck?.reason).toContain('precedes amendment effective date');
    });

    it('APPLIES amendment when treatment date is on or after amendment effective date', () => {
      // Treatment on 2025-08-10 (After amendment took effect on 2025-07-01)
      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-08-10',
        versions: [syntheticBaseVersionV1, syntheticAmendmentV1_1]
      });

      expect(result.status).toBe('resolved');
      expect(result.selectedBaseVersion?.versionId).toBe('syn_ver_base_2025_v1');
      expect(result.applicableAmendments).toHaveLength(1);
      expect(result.applicableAmendments[0].versionId).toBe('syn_ver_amend_2025_v1.1');
      // Merged snapshot must have upgraded room limit (7500) and cataract sublimit (50000)
      expect(result.mergedPolicySnapshot?.roomLimit?.value).toBe(7500);
      expect(result.mergedPolicySnapshot?.subLimits?.cataract).toBe(50000);
    });

    it('flags review_required if an amendment has an unstated effective date', () => {
      const undatedAmendment: PolicyVersionRecord = {
        ...syntheticAmendmentV1_1,
        effectiveFrom: null
      };

      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-08-10',
        versions: [syntheticBaseVersionV1, undatedAmendment]
      });

      expect(result.reviewRequired).toBe(true);
      expect(result.status).toBe('review_required');
      expect(result.applicableAmendments).toHaveLength(0);
      const amendCheck = result.candidateChecks.find(
        (c) => c.versionId === undatedAmendment.versionId
      );
      expect(amendCheck?.status).toBe('UNDETERMINED');
    });

    it('rejects amendment that belongs to a different parent version', () => {
      const mismatchedAmendment: PolicyVersionRecord = {
        ...syntheticAmendmentV1_1,
        parentVersionId: 'other_unrelated_version_v99'
      };

      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-08-10',
        versions: [syntheticBaseVersionV1, mismatchedAmendment]
      });

      expect(result.status).toBe('resolved');
      expect(result.applicableAmendments).toHaveLength(0);
      const amendCheck = result.candidateChecks.find(
        (c) => c.versionId === mismatchedAmendment.versionId
      );
      expect(amendCheck?.status).toBe('REJECTED');
      expect(amendCheck?.reason).toContain('targets version');
    });
  });

  describe('Conflicting Base Versions', () => {
    it('returns conflicting_versions when two base versions claim active coverage without succession linkage', () => {
      const conflictingBaseV2: PolicyVersionRecord = {
        ...syntheticBaseVersionV1,
        versionId: 'syn_ver_base_2025_v2_conflict',
        parentVersionId: null // No succession link
      };

      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-06-15',
        versions: [syntheticBaseVersionV1, conflictingBaseV2]
      });

      expect(result.status).toBe('conflicting_versions');
      expect(result.reviewRequired).toBe(true);
      expect(result.selectedBaseVersion).toBeNull();
      expect(result.reviewReasons[0]).toContain('Conflicting base versions detected');
    });

    it('resolves correctly when a renewal explicitly links to and supersedes the parent version', () => {
      const renewalPolicy: PolicyVersionRecord = {
        ...syntheticBaseVersionV1,
        versionId: 'syn_ver_renewal_2025_v2',
        versionNumber: '2.0',
        documentType: 'RENEWAL',
        parentVersionId: 'syn_ver_base_2025_v1',
        effectiveFrom: '2025-01-01',
        effectiveTo: '2025-12-31'
      };

      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-06-15',
        versions: [syntheticBaseVersionV1, renewalPolicy]
      });

      expect(result.status).toBe('resolved');
      expect(result.selectedBaseVersion?.versionId).toBe('syn_ver_renewal_2025_v2');
      const oldCheck = result.candidateChecks.find(
        (c) => c.versionId === 'syn_ver_base_2025_v1'
      );
      expect(oldCheck?.status).toBe('SUPERSEDED');
    });
  });

  describe('Contractual Integrity & No Fabricated Terms', () => {
    it('preserves unstated policy terms as null rather than assuming zero copay or unlimited cover', () => {
      const result = resolvePolicyApplicability({
        familyId: 'syn_fam_health_01',
        treatmentDate: '2025-03-01',
        versions: [syntheticBaseVersionV1]
      });

      expect(result.mergedPolicySnapshot?.copay).toBeNull();
      expect(result.mergedPolicySnapshot?.deductible).toBeNull();
      expect(result.mergedPolicySnapshot?.sumInsured).toBe(500000);
    });

    it('preserves base version document separately from amendment modifications', () => {
      const merged = mergePolicyWithAmendments(syntheticBaseVersionV1, [syntheticAmendmentV1_1]);

      // Base policy record should remain completely untouched
      expect(syntheticBaseVersionV1.policyData.roomLimit?.value).toBe(5000);
      expect(syntheticBaseVersionV1.policyData.subLimits.cataract).toBe(40000);

      // Merged snapshot reflects the amendment changes
      expect(merged.roomLimit?.value).toBe(7500);
      expect(merged.subLimits.cataract).toBe(50000);
    });
  });
});
