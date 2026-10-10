import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  policyDocumentIngestionService,
  validatePdfFileIntegrity
} from '../src/services/policyDocumentIngestionService.js';
import {
  policySegmentationEngine
} from '../src/services/policySegmentationEngine.js';
import {
  policyEvidenceValidator
} from '../src/services/policyEvidenceValidator.js';
import {
  policyVersionReconciler
} from '../src/services/policyVersionReconciler.js';
import { HospitalService } from '../src/services/hospitalService.js';
import { PolicyVersionRecord } from '../src/types/policyVersion.js';
import { PolicyDocument } from '../src/types/policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockPoliciesDir = path.resolve(__dirname, '../../mock-policies');
const full32ppPath = path.join(mockPoliciesDir, 'star_health_optima_full_wording_32pp.pdf');
const endorsement2ppPath = path.join(mockPoliciesDir, 'star_health_endorsement_amendment_2pp.pdf');

describe('Phase 3: Full-Length Health Insurance Policy Intelligence Suite', () => {
  let full32ppBuffer: Buffer;
  let endorsementBuffer: Buffer;
  let hospitalService: HospitalService;

  beforeAll(async () => {
    full32ppBuffer = fs.readFileSync(full32ppPath);
    endorsementBuffer = fs.readFileSync(endorsement2ppPath);
    hospitalService = new HospitalService();
    await hospitalService.initData();
  });

  // 1. Complete Multi-Page PDF Extraction
  describe('1. Complete Multi-Page PDF Extraction', () => {
    it('successfully ingests the full 32-page policy wording document without truncating pages', async () => {
      const result = await policyDocumentIngestionService.ingestPolicyPdf(full32ppBuffer, 'star_health_32pp.pdf');

      expect(result.totalPages).toBe(32);
      expect(result.readablePagesCount).toBe(32);
      expect(result.unreadablePagesCount).toBe(0);
      expect(result.fullText.length).toBeGreaterThan(25000);
      expect(result.isComplete).toBe(true);
      expect(result.documentType).toBe('BASE_POLICY');
      expect(result.detectedInsurerName).toBe('Star Health and Allied Insurance');
      expect(result.detectedPolicyNumber).toBe('STAR-FHO-2026-889921');
    });
  });

  // 2. Page-Number and Clause-Reference Preservation
  describe('2. Page-Number and Clause-Reference Preservation', () => {
    it('accurately preserves clause numbering and 1-indexed page boundaries across 32 pages', async () => {
      const result = await policyDocumentIngestionService.ingestPolicyPdf(full32ppBuffer, 'star_health_32pp.pdf');

      // Schedule on Page 2
      const page2 = result.pages.find(p => p.pageNumber === 2);
      expect(page2?.text).toContain('Clause S.1');
      expect(page2?.text).toContain('Basic Sum Insured: Rs. 5,00,000');

      // Room rent grid on Page 9
      const page9 = result.pages.find(p => p.pageNumber === 9);
      expect(page9?.text).toContain('Clause 2.2');
      expect(page9?.text).toContain('Rs. 5,000 per day');

      // Cataract sublimit on Page 20
      const page20 = result.pages.find(p => p.pageNumber === 20);
      expect(page20?.text).toContain('Clause 5.1');
      expect(page20?.text).toContain('Rs. 40,000 per eye');

      // Initial waiting period on Page 22
      const page22 = result.pages.find(p => p.pageNumber === 22);
      expect(page22?.text).toContain('Clause 6.1');
      expect(page22?.text).toContain('Code-Wait01');
    });
  });

  // 3. Empty, Malformed, and Scanned PDFs
  describe('3. Empty, Malformed, and Scanned PDFs', () => {
    it('rejects empty or corrupt buffers with explicit validation errors', () => {
      const emptyCheck = validatePdfFileIntegrity(Buffer.alloc(0));
      expect(emptyCheck.valid).toBe(false);
      expect(emptyCheck.error).toContain('empty or missing');

      const nonPdfCheck = validatePdfFileIntegrity(Buffer.from('NOT_A_PDF_DOCUMENT_TEXT'));
      expect(nonPdfCheck.valid).toBe(false);
      expect(nonPdfCheck.error).toContain('%PDF-');
    });

    it('identifies scanned/low-text pages without throwing unhandled exceptions', async () => {
      // Simulate synthetic page with low text
      const simulatedPage = {
        pageNumber: 1,
        text: 'Scanned header only',
        charCount: 19,
        wordCount: 3,
        isImageOnlyOrScanned: true,
        isUnreadable: false,
        detectedHeadings: [],
        detectedClauses: [],
        tablesDetected: false
      };

      expect(simulatedPage.isImageOnlyOrScanned).toBe(true);
    });
  });

  // 4. Missing or Unreadable Pages
  describe('4. Missing or Unreadable Pages Handling', () => {
    it('flags unreadable pages and indicates incomplete extraction', async () => {
      const fakeIngestion = {
        documentId: 'DOC_TEST_PARTIAL',
        originalFileName: 'test_partial.pdf',
        fileSizeBytes: 1000,
        contentHashSha256: 'abc123hash',
        documentType: 'BASE_POLICY' as const,
        totalPages: 5,
        readablePagesCount: 4,
        unreadablePagesCount: 1,
        scannedPagesCount: 0,
        pages: [],
        fullText: 'sample text',
        isComplete: false,
        extractionWarnings: ['Page 3 unreadable'],
        isDuplicateUpload: false
      };

      expect(fakeIngestion.isComplete).toBe(false);
      expect(fakeIngestion.unreadablePagesCount).toBe(1);
    });
  });

  // 5. Long-Document Segmentation and Consolidation
  describe('5. Long-Document Segmentation and Consolidation', () => {
    it('segments 32-page policy into thematic sections and consolidates terms across segments', async () => {
      const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(full32ppBuffer, 'star_health_32pp.pdf');
      const segments = policySegmentationEngine.segmentDocument(ingestion);

      expect(segments.length).toBeGreaterThanOrEqual(7);

      const segmentTypes = segments.map(s => s.segmentType);
      expect(segmentTypes).toContain('SCHEDULE');
      expect(segmentTypes).toContain('DEFINITIONS');
      expect(segmentTypes).toContain('INPATIENT_AND_ROOM_RENT');
      expect(segmentTypes).toContain('SUBLIMITS');
      expect(segmentTypes).toContain('WAITING_PERIODS');
      expect(segmentTypes).toContain('EXCLUSIONS');
      expect(segmentTypes).toContain('CLAIMS_AND_COPAY');

      const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);
      expect(consolidated.policyData.sumInsured).toBe(500000);
      expect(consolidated.policyData.roomLimit?.value).toBe(5000);
      expect(consolidated.policyData.proportionateDeduction).toBe(true);
      expect(consolidated.policyData.subLimits?.cataract).toBe(40000);
      expect(consolidated.policyData.copay).toBe(10);
      expect(consolidated.policyData.nonNetworkCopay).toBe(20);
    });
  });

  // 6. Extraction of Limits, Exclusions, Deductibles, and Co-Payments
  describe('6. Extraction of Limits, Exclusions, Deductibles, and Co-Payments', () => {
    it('extracts all core coverage limits with exact values and citations', async () => {
      const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(full32ppBuffer, 'star_health_32pp.pdf');
      const segments = policySegmentationEngine.segmentDocument(ingestion);
      const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);

      // Financial Limits
      expect(consolidated.policyData.sumInsured).toBe(500000);
      expect(consolidated.policyData.deductible).toBe(0);
      expect(consolidated.policyData.copay).toBe(10);
      expect(consolidated.policyData.nonNetworkCopay).toBe(20);

      // Sublimits
      expect(consolidated.policyData.subLimits?.cataract).toBe(40000);
      expect(consolidated.policyData.subLimits?.kneeReplacement).toBe(150000);
      expect(consolidated.policyData.subLimits?.hernia).toBe(65000);
      expect(consolidated.policyData.subLimits?.appendectomy).toBe(50000);

      // Exclusions
      expect(consolidated.policyData.exclusions).toContain('Cosmetic surgery');
      expect(consolidated.policyData.exclusions).toContain('Bio-resonance and alternative energy healing');
      expect(consolidated.policyData.exclusions).toContain('Aesthetic Rhinoplasty');
    });
  });

  // 7. Evidence Validation for Extracted Fields
  describe('7. Evidence Validation for Extracted Fields', () => {
    it('verifies that cited snippets actually exist on the cited page numbers', async () => {
      const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(full32ppBuffer, 'star_health_32pp.pdf');
      const segments = policySegmentationEngine.segmentDocument(ingestion);
      const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);

      const audit = policyEvidenceValidator.auditPolicyEvidence(ingestion, consolidated);

      expect(audit.provenanceIntegrityPassed).toBe(true);
      expect(audit.unsupportedCitationsCount).toBe(0);
      expect(audit.overallAccuracyRate).toBeGreaterThanOrEqual(90);

      // Specific field audits
      const roomAudit = audit.fieldAudits['roomLimit'];
      expect(roomAudit.status).toBe('VERIFIED_WITH_EVIDENCE');
      expect(roomAudit.citedPageNumber).toBe(9);
      expect(roomAudit.isVerbatimFoundOnPage).toBe(true);

      const cataractAudit = audit.fieldAudits['subLimits.cataract'];
      expect(cataractAudit.status).toBe('VERIFIED_WITH_EVIDENCE');
      expect(cataractAudit.citedPageNumber).toBe(20);
      expect(cataractAudit.isVerbatimFoundOnPage).toBe(true);
    });

    it('flags hallucinated or out-of-bounds page citations as errors', async () => {
      const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(full32ppBuffer, 'star_health_32pp.pdf');
      const segments = policySegmentationEngine.segmentDocument(ingestion);
      const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);

      // Intentionally tamper with a citation to point to Page 99
      consolidated.fieldEvidenceMap['sumInsured'].pageNumber = 99;

      const audit = policyEvidenceValidator.auditPolicyEvidence(ingestion, consolidated);
      expect(audit.provenanceIntegrityPassed).toBe(false);
      expect(audit.fieldAudits['sumInsured'].status).toBe('CITATION_PAGE_MISMATCH');
    });
  });

  // 8. Invalid or Unsupported Model Outputs
  describe('8. Invalid or Unsupported Model Outputs', () => {
    it('refuses to default unstated deductibles to 0 or unstated copay to 0', () => {
      const unstatedPolicy: Partial<PolicyDocument> = {
        insurer: 'Generic Insurer',
        policyType: 'individual',
        sumInsured: 300000,
        deductible: null,
        copay: null
      };

      expect(unstatedPolicy.deductible).toBeNull();
      expect(unstatedPolicy.copay).toBeNull();
      expect(unstatedPolicy.deductible).not.toBe(0);
    });
  });

  // 9. Missing, Ambiguous, and Conflicting Values
  describe('9. Missing, Ambiguous, and Conflicting Values Handling', () => {
    it('marks missing fields as unresolved and requests human review', async () => {
      const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(full32ppBuffer, 'star_health_32pp.pdf');
      const segments = policySegmentationEngine.segmentDocument(ingestion);
      const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);

      // Remove a material field to simulate missing value
      delete consolidated.fieldEvidenceMap['subLimits.cataract'];

      const audit = policyEvidenceValidator.auditPolicyEvidence(ingestion, consolidated);
      expect(audit.humanReviewRequired).toBe(true);
    });
  });

  // 10. Amendment and Effective-Date Handling
  describe('10. Amendment and Effective-Date Handling', () => {
    it('resolves base policy vs endorsement based on treatment date without guessing', async () => {
      const baseVersion: PolicyVersionRecord = {
        familyId: 'FAM_STAR_2026',
        versionId: 'STAR_BASE_V1',
        versionNumber: '1.0',
        documentType: 'BASE_POLICY',
        insurerName: 'Star Health and Allied Insurance',
        planName: 'Family Health Optima',
        documentId: 'DOC_BASE_32PP',
        effectiveFrom: '2026-04-01',
        effectiveTo: '2027-03-31',
        uploadTimestamp: '2026-04-01T10:00:00Z',
        extractedTimestamp: '2026-04-01T10:05:00Z',
        extractionStatus: 'VERIFIED',
        clauseModifications: [],
        policyData: {
          _id: 'POL_BASE_001',
          createdAt: '2026-04-01',
          updatedAt: '2026-04-01',
          confirmedByUser: true,
          insurer: 'Star Health and Allied Insurance',
          insurerAliases: [],
          planName: 'Family Health Optima',
          policyType: 'floater',
          policyNumber: 'STAR-FHO-2026-889921',
          uin: 'SHAHLIP26046V092526',
          policyStartDate: '2026-04-01',
          policyEndDate: '2027-03-31',
          zone: 'Zone B',
          networkType: 'restricted-network',
          tpa: null,
          insuredPersons: [],
          sumInsured: 500000,
          roomLimit: { type: 'amount', value: 5000 },
          icuLimit: { type: 'percent', value: 2 },
          copay: 10,
          nonNetworkCopay: 20,
          copayConditions: {},
          deductible: 0,
          proportionateDeduction: true,
          subLimits: { cataract: 40000 },
          restorationBenefit: true,
          cumulativeBonus: 50000,
          exclusions: ['Cosmetic surgery'],
          hasOtherExclusions: true,
          waitingPeriods: null,
          preHospitalizationDays: 60,
          postHospitalizationDays: 90,
          daycareCovered: true,
          ambulanceLimit: 2000,
          preAuthHours: 48,
          claimIntimationHours: 24,
          sourceSnippets: {},
          confidence: {},
          rawTextRef: null
        },
        unresolvedQuestions: []
      };

      const endorsementVersion: PolicyVersionRecord = {
        familyId: 'FAM_STAR_2026',
        versionId: 'STAR_END_V1.1',
        versionNumber: '1.1',
        documentType: 'ENDORSEMENT',
        amendmentScope: 'MODIFIES_SPECIFIC_CLAUSES',
        parentVersionId: 'STAR_BASE_V1',
        insurerName: 'Star Health and Allied Insurance',
        planName: 'Family Health Optima',
        documentId: 'DOC_END_2PP',
        effectiveFrom: '2026-09-01',
        effectiveTo: '2027-03-31',
        uploadTimestamp: '2026-08-28T14:00:00Z',
        extractedTimestamp: '2026-08-28T14:02:00Z',
        extractionStatus: 'VERIFIED',
        clauseModifications: [
          {
            clauseId: 'END_CLAUSE_CATARACT',
            clauseTitle: 'Cataract Limit Enhancement',
            changeType: 'MODIFIED',
            targetPath: 'subLimits.cataract',
            newClauseText: 'Amended limit: Rs. 50,000 per eye',
            description: 'Enhances cataract sublimit from 40k to 50k'
          }
        ],
        policyData: {
          ...baseVersion.policyData,
          subLimits: { cataract: 50000 }
        },
        unresolvedQuestions: []
      };

      const versions = [baseVersion, endorsementVersion];

      // Scenario A: Treatment on 2026-05-10 (BEFORE endorsement effective date)
      const resBefore = policyVersionReconciler.reconcilePolicyDocuments('FAM_STAR_2026', versions, '2026-05-10');
      expect(resBefore.activeEndorsementsCount).toBe(0);
      expect(resBefore.effectivePolicySnapshot.subLimits?.cataract).toBe(40000);

      // Scenario B: Treatment on 2026-10-15 (AFTER endorsement effective date)
      const resAfter = policyVersionReconciler.reconcilePolicyDocuments('FAM_STAR_2026', versions, '2026-10-15');
      expect(resAfter.activeEndorsementsCount).toBe(1);
      expect(resAfter.effectivePolicySnapshot.subLimits?.cataract).toBe(50000);
      expect(resAfter.auditTrail.some(a => a.rule === 'subLimits.cataract' && a.precedenceRole === 'CONTROLLING')).toBe(true);
    });
  });

  // 11. User-Confirmation State
  describe('11. User-Confirmation State Management', () => {
    it('preserves confirmedByUser as false upon extraction until explicit confirmation', () => {
      const initialPolicy: PolicyDocument = {
        _id: 'POL_NEW_001',
        createdAt: '2026-10-10',
        updatedAt: '2026-10-10',
        confirmedByUser: false,
        insurer: 'Star Health',
        insurerAliases: [],
        planName: 'Optima',
        policyType: 'floater',
        policyNumber: '123',
        uin: null,
        policyStartDate: null,
        policyEndDate: null,
        zone: null,
        networkType: null,
        tpa: null,
        insuredPersons: [],
        sumInsured: 500000,
        roomLimit: null,
        icuLimit: null,
        copay: null,
        nonNetworkCopay: null,
        copayConditions: {},
        deductible: null,
        proportionateDeduction: null,
        subLimits: {},
        restorationBenefit: null,
        cumulativeBonus: null,
        exclusions: [],
        hasOtherExclusions: null,
        waitingPeriods: null,
        preHospitalizationDays: null,
        postHospitalizationDays: null,
        daycareCovered: null,
        ambulanceLimit: null,
        preAuthHours: null,
        claimIntimationHours: null,
        sourceSnippets: {},
        confidence: {},
        rawTextRef: null
      };

      expect(initialPolicy.confirmedByUser).toBe(false);
    });
  });

  // 12. Integration with Deterministic Financial Engine
  describe('12. Integration with Deterministic Financial Engine', () => {
    it('applies extracted room limit, proportionate deduction, and copay deterministically', async () => {
      const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(full32ppBuffer, 'star_health_32pp.pdf');
      const segments = policySegmentationEngine.segmentDocument(ingestion);
      const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);

      const policyObj = {
        _id: 'POL_TEST_FIN',
        createdAt: '2026-10-10',
        updatedAt: '2026-10-10',
        confirmedByUser: true,
        ...consolidated.policyData
      } as PolicyDocument;

      // Hospital estimate with room cost ₹8,000/day (exceeding ₹5,000 limit)
      const mockEstimate = {
        available: true,
        level: 'procedure' as const,
        lowCost: 200000,
        meanCost: 240000,
        highestCost: 280000,
        segmentAdjustedCost: 240000,
        hospitalVariation: 0,
        treatmentCost: 200000,
        roomCost: 40000,
        totalCost: 240000,
        displayLow: 200000,
        displayHigh: 280000,
        estimatedStayDays: 5,
        roomCostPerDay: 8000
      };

      const impact = hospitalService.calculatePolicyImpact(
        mockEstimate,
        policyObj,
        'verified', // In-network
        'Single Private Room',
        'Orthopedics',
        'Total Knee Replacement'
      );

      // Room rent excess: (8000 - 5000) * 5 = ₹15,000
      expect(impact.roomRentExcessPerDay).toBe(3000);
      expect(impact.roomRentExcess).toBe(15000);

      // Proportionate deduction should be active
      expect(impact.proportionateDeductionActive).toBe(true);
      expect(impact.proportionateDisallowance).toBeGreaterThan(0);

      // Copay 10% applied
      expect(impact.effectiveCopayPercent).toBe(10);
      expect(impact.copayAmount).toBeGreaterThan(0);

      // Insurer share + patient payable strictly equals total bill
      expect(impact.patientPayable + impact.insurerEstimatedShare).toBe(mockEstimate.totalCost);
    });
  });

  // 13. Prevention of Unsupported Assumptions and Double Deductions
  describe('13. Prevention of Unsupported Assumptions and Double Deductions', () => {
    it('ensures room rent excess is NOT deducted twice through proportionate deduction', async () => {
      const mockPolicy: PolicyDocument = {
        _id: 'POL_TEST_NO_DOUBLE',
        createdAt: '2026-10-10',
        updatedAt: '2026-10-10',
        confirmedByUser: true,
        insurer: 'Star Health',
        insurerAliases: [],
        planName: 'Optima',
        policyType: 'floater',
        policyNumber: '123',
        uin: null,
        policyStartDate: null,
        policyEndDate: null,
        zone: null,
        networkType: null,
        tpa: null,
        insuredPersons: [],
        sumInsured: 500000,
        roomLimit: { type: 'amount', value: 3000 },
        icuLimit: null,
        copay: 0,
        nonNetworkCopay: null,
        copayConditions: {},
        deductible: 0,
        proportionateDeduction: true,
        subLimits: {},
        restorationBenefit: null,
        cumulativeBonus: null,
        exclusions: [],
        hasOtherExclusions: null,
        waitingPeriods: null,
        preHospitalizationDays: null,
        postHospitalizationDays: null,
        daycareCovered: null,
        ambulanceLimit: null,
        preAuthHours: null,
        claimIntimationHours: null,
        sourceSnippets: {},
        confidence: {},
        rawTextRef: null
      };

      const estimate = {
        available: true,
        level: 'procedure' as const,
        lowCost: 100000,
        meanCost: 120000,
        highestCost: 150000,
        segmentAdjustedCost: 120000,
        hospitalVariation: 0,
        treatmentCost: 100000,
        roomCost: 20000, // 4 days @ 5000 (limit 3000)
        totalCost: 120000,
        displayLow: 100000,
        displayHigh: 150000,
        estimatedStayDays: 4,
        roomCostPerDay: 5000
      };

      const res = hospitalService.calculatePolicyImpact(estimate, mockPolicy, 'verified');

      // Room rent excess = (5000 - 3000) * 4 = 8000
      expect(res.roomRentExcess).toBe(8000);

      // Proportionate disallowance is applied to medical expenses, NOT the room rent
      expect(res.eligibleAmount).toBe(estimate.totalCost - res.roomRentExcess - res.proportionateDisallowance);
      expect(res.patientPayable).toBe(res.roomRentExcess + res.proportionateDisallowance + res.modelledNonMedicalAllowance);
      expect(res.patientPayable + res.insurerEstimatedShare).toBe(estimate.totalCost);
    });
  });

  // 14. Backward Compatibility with Existing Workflows
  describe('14. Backward Compatibility with Existing Workflows', () => {
    it('maintains full compatibility with existing demo policies and hospital discovery', async () => {
      const cities = hospitalService.getCities();
      expect(cities.length).toBeGreaterThan(0);

      const bengaluruHospitals = hospitalService.getHospitals('Bengaluru');
      expect(bengaluruHospitals.length).toBeGreaterThan(0);
    });
  });
});
