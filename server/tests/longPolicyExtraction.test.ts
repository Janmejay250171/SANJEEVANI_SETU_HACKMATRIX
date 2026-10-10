import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { policyDocumentIngestionService, PolicyDocumentIngestionResult } from '../src/services/policyDocumentIngestionService.js';
import { policySegmentationEngine, ConsolidatedPolicyExtraction } from '../src/services/policySegmentationEngine.js';
import { policyEvidenceValidator, PolicyEvidenceValidationReport } from '../src/services/policyEvidenceValidator.js';
import { policyVersionReconciler } from '../src/services/policyVersionReconciler.js';
import { claimAdjudicationService } from '../src/services/claimAdjudicationService.js';
import { ItemizedBillInput } from '../src/types/adjudication.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GroundTruthManifest {
  documentMetadata: {
    documentId: string;
    fileName: string;
    totalPages: number;
    insurer: string;
    planName: string;
    policyNumber: string;
    uin: string;
    policyPeriod: { effectiveFrom: string; effectiveTo: string };
  };
  coreFinancialGroundTruth: {
    basicSumInsured: number;
    compulsoryDeductible: number;
    compulsoryDeductiblePage: number;
    networkCopayPercent: number;
    networkCopayPage: number;
    nonNetworkCopayPercent: number;
    nonNetworkCopayPage: number;
    roomRentLimit: { percentValue: number; dailyLimitRupees: number; pageNumber: number };
    icuLimit: { percentValue: number; dailyLimitRupees: number; pageNumber: number };
    proportionateDeduction: { active: boolean; pageNumber: number };
    subLimits: {
      cataract: { limitRupees: number; pageNumber: number };
      kneeReplacement: { limitRupees: number; pageNumber: number };
      hernia: { limitRupees: number; pageNumber: number };
      appendectomy: { limitRupees: number; pageNumber: number };
    };
    ambulanceAllowance: { roadAmbulanceRupees: number; pageNumber: number };
    restorationBenefit: { active: boolean; pageNumber: number };
  };
  waitingPeriodsGroundTruth: {
    initialWaitingDays: number;
    initialWaitingPage: number;
    preExistingDiseaseWaitingMonths: number;
    preExistingDiseasePage: number;
  };
  endorsementsGroundTruth: Array<{
    endorsementId: string;
    pageNumber: number;
    effectiveFrom: string;
    amendments: Array<{ target: string; originalValue: number; amendedValue: number; effectiveFrom: string }>;
  }>;
}

describe('Priority 1: Long-Policy Extraction Accuracy Verification (45-Page Synthetic Policy)', () => {
  let policyPdfBuffer: Buffer;
  let groundTruth: GroundTruthManifest;
  const pdfPath = path.resolve(__dirname, 'fixtures/policies/synthetic_comprehensive_health_policy_45_pages.pdf');
  const manifestPath = path.resolve(__dirname, 'fixtures/policies/synthetic_policy_ground_truth_manifest.json');

  beforeAll(() => {
    expect(fs.existsSync(pdfPath), `Synthetic 45-page fixture missing at ${pdfPath}`).toBe(true);
    expect(fs.existsSync(manifestPath), `Ground truth manifest missing at ${manifestPath}`).toBe(true);

    policyPdfBuffer = fs.readFileSync(pdfPath);
    groundTruth = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  });

  // 1. Document Integrity & Scale Verification
  it('1.1 Verifies that the synthetic fixture has 45 actual pages with realistic content density', async () => {
    const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(
      policyPdfBuffer,
      'synthetic_comprehensive_health_policy_45_pages.pdf'
    );

    expect(ingestion.totalPages).toBe(45);
    expect(ingestion.readablePagesCount).toBe(45);
    expect(ingestion.unreadablePagesCount).toBe(0);
    expect(ingestion.scannedPagesCount).toBe(0);
    expect(ingestion.fullText.length).toBeGreaterThan(35000); // Substantial content
    expect(ingestion.isComplete).toBe(true);
  });

  // 1.2 Multi-Run Determinism Verification (3 Independent Runs)
  it('1.2 Runs the production extraction pipeline across 3 independent runs and proves deterministic repeatability', async () => {
    const runs: ConsolidatedPolicyExtraction[] = [];
    const runReports: PolicyEvidenceValidationReport[] = [];

    for (let i = 0; i < 3; i++) {
      const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(
        policyPdfBuffer,
        `run_${i + 1}_45pp.pdf`
      );
      const segments = policySegmentationEngine.segmentDocument(ingestion);
      const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);
      const audit = policyEvidenceValidator.auditPolicyEvidence(ingestion, consolidated);

      runs.push(consolidated);
      runReports.push(audit);
    }

    // Compare Run 1, Run 2, Run 3
    const run1 = runs[0].policyData;
    const run2 = runs[1].policyData;
    const run3 = runs[2].policyData;

    expect(run1.insurer).toBe(run2.insurer);
    expect(run2.insurer).toBe(run3.insurer);

    expect(run1.sumInsured).toBe(run2.sumInsured);
    expect(run2.sumInsured).toBe(run3.sumInsured);

    expect(run1.deductible).toBe(run2.deductible);
    expect(run2.deductible).toBe(run3.deductible);

    expect(run1.roomLimit?.value).toBe(run2.roomLimit?.value);
    expect(run2.roomLimit?.value).toBe(run3.roomLimit?.value);

    expect(run1.icuLimit?.value).toBe(run2.icuLimit?.value);
    expect(run2.icuLimit?.value).toBe(run3.icuLimit?.value);

    expect(run1.subLimits).toEqual(run2.subLimits);
    expect(run2.subLimits).toEqual(run3.subLimits);

    expect(runReports[0].overallAccuracyRate).toBe(runReports[1].overallAccuracyRate);
    expect(runReports[1].overallAccuracyRate).toBe(runReports[2].overallAccuracyRate);
  });

  // 1.3 Ground-Truth Financial & Contractual Exact-Value Accuracy
  it('1.3 Evaluates all critical financial fields against ground truth with 100% exact-value accuracy', async () => {
    const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(
      policyPdfBuffer,
      'synthetic_45pp.pdf'
    );
    const segments = policySegmentationEngine.segmentDocument(ingestion);
    const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);
    const policy = consolidated.policyData;
    const gtFin = groundTruth.coreFinancialGroundTruth;

    // Header & Identification
    expect(policy.insurer).toBe(groundTruth.documentMetadata.insurer);
    expect(policy.planName).toBe(groundTruth.documentMetadata.planName);
    expect(policy.policyNumber).toBe(groundTruth.documentMetadata.policyNumber);
    expect(policy.uin).toBe(groundTruth.documentMetadata.uin);
    expect(policy.policyStartDate).toBe(groundTruth.documentMetadata.policyPeriod.effectiveFrom);
    expect(policy.policyEndDate).toBe(groundTruth.documentMetadata.policyPeriod.effectiveTo);

    // Sum Insured & Deductible
    expect(policy.sumInsured).toBe(gtFin.basicSumInsured);
    expect(policy.deductible).toBe(gtFin.compulsoryDeductible);

    // Room Rent & ICU limits
    expect(policy.roomLimit?.type).toBe('percent');
    expect(policy.roomLimit?.value).toBe(gtFin.roomRentLimit.percentValue);
    expect(policy.icuLimit?.type).toBe('percent');
    expect(policy.icuLimit?.value).toBe(gtFin.icuLimit.percentValue);

    // Explicit Daily Monetary Quantification & Contractual Calculations
    const roomDailyRupees = (policy.sumInsured * (policy.roomLimit?.value || 0)) / 100;
    expect(roomDailyRupees).toBe(gtFin.roomRentLimit.dailyLimitRupees); // 1% of 10L = 10,000 INR/day
    expect(roomDailyRupees).toBe(10000);

    const icuDailyRupees = (policy.sumInsured * (policy.icuLimit?.value || 0)) / 100;
    expect(icuDailyRupees).toBe(gtFin.icuLimit.dailyLimitRupees); // 2% of 10L = 20,000 INR/day
    expect(icuDailyRupees).toBe(20000);

    // Proportionate Deduction & Restoration
    expect(policy.proportionateDeduction).toBe(gtFin.proportionateDeduction.active);
    expect(policy.restorationBenefit).toBe(gtFin.restorationBenefit.active);

    // Sublimits
    expect(policy.subLimits?.cataract).toBe(gtFin.subLimits.cataract.limitRupees);
    expect(policy.subLimits?.kneeReplacement).toBe(gtFin.subLimits.kneeReplacement.limitRupees);
    expect(policy.subLimits?.hernia).toBe(gtFin.subLimits.hernia.limitRupees);
    expect(policy.subLimits?.appendectomy).toBe(gtFin.subLimits.appendectomy.limitRupees);

    // Co-payments
    expect(policy.copay).toBe(gtFin.networkCopayPercent);
    expect(policy.nonNetworkCopay).toBe(gtFin.nonNetworkCopayPercent);

    // Waiting Periods
    expect(policy.waitingPeriods?.initial).toBe('30 days');
    expect(policy.waitingPeriods?.preExisting).toBe('36 months');
  });

  // 1.4 Page-Reference and Verbatim Citation Accuracy
  it('1.4 Verifies that every extracted field cites an accurate page number and verbatim excerpt on that page', async () => {
    const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(
      policyPdfBuffer,
      'synthetic_45pp.pdf'
    );
    const segments = policySegmentationEngine.segmentDocument(ingestion);
    const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);
    const audit = policyEvidenceValidator.auditPolicyEvidence(ingestion, consolidated);

    // Audit summary metrics
    expect(audit.provenanceIntegrityPassed).toBe(true);
    expect(audit.unsupportedCitationsCount).toBe(0);
    expect(audit.overallAccuracyRate).toBeGreaterThanOrEqual(95);

    // Verify key page locations against ground truth
    const gtFin = groundTruth.coreFinancialGroundTruth;
    const evMap = consolidated.fieldEvidenceMap;

    expect(evMap['sumInsured'].pageNumber).toBe(2);
    expect(evMap['deductible'].pageNumber).toBe(gtFin.compulsoryDeductiblePage);
    expect(evMap['roomLimit'].pageNumber).toBe(gtFin.roomRentLimit.pageNumber);
    expect(evMap['icuLimit'].pageNumber).toBe(gtFin.icuLimit.pageNumber);
    expect(evMap['proportionateDeduction'].pageNumber).toBe(gtFin.proportionateDeduction.pageNumber);
    expect(evMap['subLimits.cataract'].pageNumber).toBe(gtFin.subLimits.cataract.pageNumber);
    expect(evMap['subLimits.kneeReplacement'].pageNumber).toBe(gtFin.subLimits.kneeReplacement.pageNumber);
    expect(evMap['subLimits.hernia'].pageNumber).toBe(gtFin.subLimits.hernia.pageNumber);
    expect(evMap['copay'].pageNumber).toBe(gtFin.networkCopayPage);
    expect(evMap['nonNetworkCopay'].pageNumber).toBe(gtFin.nonNetworkCopayPage);

    // Verbatim existence on cited pages
    for (const [fieldName, fa] of Object.entries(audit.fieldAudits)) {
      if (fa.status === 'VERIFIED_WITH_EVIDENCE') {
        expect(fa.isVerbatimFoundOnPage).toBe(true);
        expect(fa.citedPageNumber).toBeGreaterThanOrEqual(1);
        expect(fa.citedPageNumber).toBeLessThanOrEqual(45);
      }
    }
  });

  // 1.5 Endorsement Effective-Date Precedence & Amendment Resolution
  it('1.5 Correctly reconciles base policy vs endorsement rider based on treatment date without guessing', async () => {
    const endorsementRider = groundTruth.endorsementsGroundTruth[0];
    const amendmentDate = endorsementRider.effectiveFrom; // '2026-10-01'

    const baseVersion = {
      familyId: 'FAM_AB_2026',
      versionId: 'AB_BASE_V1',
      versionNumber: '1.0',
      documentType: 'BASE_POLICY' as const,
      insurerName: 'Arogya Bharat General Insurance Co. Ltd.',
      planName: 'Comprehensive Swasthya Raksha Platinum Plan',
      policyNumber: 'AB-SWAS-2026-994821',
      documentId: 'DOC_BASE_45PP',
      effectiveFrom: '2026-04-01',
      effectiveTo: '2027-03-31',
      uploadTimestamp: '2026-04-01T00:00:00Z',
      extractedTimestamp: '2026-04-01T00:00:00Z',
      extractionStatus: 'VERIFIED' as const,
      clauseModifications: [],
      policyData: {
        policyNumber: 'AB-SWAS-2026-994821',
        effectiveFrom: '2026-04-01',
        effectiveTo: '2027-03-31',
        subLimits: { cataract: 45000 },
        copay: 0,
        nonNetworkCopay: 20
      } as any,
      unresolvedQuestions: []
    };

    const endorsementVersion = {
      familyId: 'FAM_AB_2026',
      versionId: endorsementRider.endorsementId,
      versionNumber: '1.1',
      documentType: 'ENDORSEMENT' as const,
      parentVersionId: 'AB_BASE_V1',
      insurerName: 'Arogya Bharat General Insurance Co. Ltd.',
      planName: 'Comprehensive Swasthya Raksha Platinum Plan',
      documentId: 'DOC_END_45PP',
      effectiveFrom: amendmentDate,
      effectiveTo: '2027-03-31',
      uploadTimestamp: '2026-09-25T00:00:00Z',
      extractedTimestamp: '2026-09-25T00:00:00Z',
      extractionStatus: 'VERIFIED' as const,
      clauseModifications: [
        {
          clauseId: 'END_CATARACT_ENHANCE',
          clauseTitle: 'Cataract Sublimit Enhancement',
          changeType: 'MODIFIED' as const,
          targetPath: 'subLimits.cataract',
          newClauseText: 'Amended limit: Rs. 60,000 per eye',
          description: 'Enhances cataract sublimit from 45k to 60k'
        },
        {
          clauseId: 'END_NON_NETWORK_COPAY',
          clauseTitle: 'Non-Network Co-payment Waiver',
          changeType: 'MODIFIED' as const,
          targetPath: 'nonNetworkCopay',
          newClauseText: 'Non-network co-payment waived to 0%',
          description: 'Waives non-network copay to 0%'
        }
      ],
      policyData: {
        ...baseVersion.policyData,
        subLimits: { cataract: 60000 },
        nonNetworkCopay: 0
      } as any,
      unresolvedQuestions: []
    };

    const versions = [baseVersion, endorsementVersion];

    // Before amendment date (e.g. 2026-08-15) -> Cataract sublimit should be Rs. 45,000, non-network copay 20%
    const resBefore = policyVersionReconciler.reconcilePolicyDocuments('FAM_AB_2026', versions, '2026-08-15');
    expect(resBefore.activeEndorsementsCount).toBe(0);
    expect(resBefore.effectivePolicySnapshot.subLimits?.cataract).toBe(45000);
    expect(resBefore.effectivePolicySnapshot.nonNetworkCopay).toBe(20);

    // On or after amendment date (e.g. 2026-10-15) -> Cataract sublimit enhanced to Rs. 60,000, non-network copay waived to 0%
    const resAfter = policyVersionReconciler.reconcilePolicyDocuments('FAM_AB_2026', versions, '2026-10-15');
    expect(resAfter.activeEndorsementsCount).toBe(1);
    expect(resAfter.effectivePolicySnapshot.subLimits?.cataract).toBe(60000);
    expect(resAfter.effectivePolicySnapshot.nonNetworkCopay).toBe(0);
    expect(resAfter.auditTrail.some(a => a.rule === 'subLimits.cataract' && a.precedenceRole === 'CONTROLLING')).toBe(true);
  });

  // 1.6 Full Itemized Claim Adjudication Integration with 45-Page Extracted Policy
  it('1.6 Integrates extracted policy terms with deterministic adjudication engine without double deductions', async () => {
    const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(
      policyPdfBuffer,
      'synthetic_45pp.pdf'
    );
    const segments = policySegmentationEngine.segmentDocument(ingestion);
    const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);
    const extractedPolicy = consolidated.policyData as any;

    // Line items for Hernia Surgery at Non-Network Hospital:
    // Room stay: 2 days @ 15,000 = 30,000 (3,000,000 paise)
    // OT Charges: 30,000 (3,000,000 paise)
    // Surgeon Consultation: 20,000 (2,000,000 paise)
    // Medicines: 15,000 (1,500,000 paise)
    // Disposable PPE & Gloves: 3,000 (300,000 paise) - IRDAI non-payable
    const totalPaise = (30000 + 30000 + 20000 + 15000 + 3000) * 100; // 9,800,000 paise

    const bill = {
      billId: 'bill_synth_45pp_01',
      hospitalName: 'Apex City Hospital (Non-Network)',
      hospitalId: 'hosp_apex_01',
      patientName: 'Aditya Verma',
      invoiceNumber: 'INV-APEX-2026-091',
      admissionDate: '2026-05-10',
      dischargeDate: '2026-05-12',
      currency: 'INR',
      originalBillTotalPaise: totalPaise,
      netPayablePaise: totalPaise,
      lineItems: [
        {
          itemId: 'item_1',
          originalDescription: 'Deluxe Room Stay (2 days)',
          category: 'ROOM_RENT' as const,
          quantity: 2,
          unitPricePaise: 1500000,
          claimedAmountPaise: 3000000,
          isNonPayableByRegulation: false
        },
        {
          itemId: 'item_2',
          originalDescription: 'Surgeon & OT Charges',
          category: 'OT_CHARGES' as const,
          quantity: 1,
          unitPricePaise: 3000000,
          claimedAmountPaise: 3000000,
          isNonPayableByRegulation: false
        },
        {
          itemId: 'item_3',
          originalDescription: 'Doctor Consultation',
          category: 'SURGEON_CONSULTATION' as const,
          quantity: 1,
          unitPricePaise: 2000000,
          claimedAmountPaise: 2000000,
          isNonPayableByRegulation: false
        },
        {
          itemId: 'item_4',
          originalDescription: 'Inpatient Medicines & Infusions',
          category: 'MEDICINES_PHARMACY' as const,
          quantity: 1,
          unitPricePaise: 1500000,
          claimedAmountPaise: 1500000,
          isNonPayableByRegulation: false
        },
        {
          itemId: 'item_5',
          originalDescription: 'Disposable PPE & Gloves',
          category: 'CONSUMABLES_NON_PAYABLES' as const,
          quantity: 1,
          unitPricePaise: 300000,
          claimedAmountPaise: 300000,
          isNonPayableByRegulation: true
        }
      ]
    };

    const adjudication = claimAdjudicationService.adjudicateClaim({
      requestId: 'req_synth_45pp_01',
      treatmentDate: '2026-05-10',
      bill: bill as any,
      policyDocument: extractedPolicy,
      financialRules: {
        sumInsuredPaise: (extractedPolicy.sumInsured || 1000000) * 100,
        roomLimit: extractedPolicy.roomLimit,
        icuLimit: extractedPolicy.icuLimit,
        proportionateDeductionSupported: extractedPolicy.proportionateDeduction,
        deductiblePaise: (extractedPolicy.deductible || 25000) * 100,
        copayPercentage: extractedPolicy.copay || 0,
        nonNetworkCopayPercentage: extractedPolicy.nonNetworkCopay || 20,
        networkStatus: 'no_match',
        roomCategory: 'Deluxe Room',
        stayDays: 2
      }
    });

    // Invariant: Total Bill Accounting Balance
    expect(adjudication.invariants.auditPassed).toBe(true);
    expect(adjudication.invariants.isMathematicallyBalanced).toBe(true);
    expect(adjudication.invariants.hasDoubleDeductions).toBe(false);

    // Ledger totals in integer paise
    expect(adjudication.ledger.totalClaimedPaise).toBe(totalPaise);
    expect(
      adjudication.ledger.finalInsurerPayablePaise +
      adjudication.ledger.totalPatientResponsibilityPaise
    ).toBe(totalPaise);

    // Excluded items: Rs. 3,000 PPE/gloves + Rs. 10,000 room rent excess disallowed = 1,300,000 paise
    expect(adjudication.ledger.totalExcludedNonPayablePaise).toBe(1300000);

    // Deductible applied (25,000 -> 2,500,000 paise)
    expect(adjudication.ledger.appliedDeductiblePaise).toBe(2500000);

    // Non-network copay applied
    expect(adjudication.ledger.appliedCopayPaise).toBeGreaterThan(0);
  });

  // 1.7 ICU Daily Capping & Non-Application of Proportionate Deduction to ICU (Clause 2.2)
  it('1.7 Enforces ICU limit capping (2% SI = Rs. 20,000/day) and confirms ICU breach does NOT trigger proportionate deductions on surgeon/OT expenses', async () => {
    const ingestion = await policyDocumentIngestionService.ingestPolicyPdf(
      policyPdfBuffer,
      'synthetic_45pp.pdf'
    );
    const segments = policySegmentationEngine.segmentDocument(ingestion);
    const consolidated = policySegmentationEngine.consolidateExtraction(ingestion, segments);
    const extractedPolicy = consolidated.policyData as any;

    // Bill with ICU stay exceeding 2% SI (Rs. 20,000/day):
    // ICU Stay: 2 days @ Rs. 25,000/day = Rs. 50,000 (5,000,000 paise)
    // Surgeon Consultation: Rs. 60,000 (6,000,000 paise)
    // Total Claimed: Rs. 1,10,000 (11,000,000 paise)
    const bill = {
      billId: 'bill_synth_icu_01',
      hospitalName: 'Apex Cardiac Care Center (In-Network)',
      hospitalId: 'hosp_apex_cardiac',
      patientName: 'Aditya Verma',
      invoiceNumber: 'INV-ICU-2026-771',
      admissionDate: '2026-07-01',
      dischargeDate: '2026-07-03',
      currency: 'INR',
      originalBillTotalPaise: 11000000,
      netPayablePaise: 11000000,
      lineItems: [
        {
          itemId: 'icu_item_1',
          originalDescription: 'Intensive Care Unit (ICU) charges (2 days @ 25,000)',
          category: 'ICU_CHARGES' as const,
          quantity: 2,
          unitPricePaise: 2500000,
          claimedAmountPaise: 5000000,
          isNonPayableByRegulation: false
        },
        {
          itemId: 'icu_item_2',
          originalDescription: 'Senior Cardiac Surgeon Consultation',
          category: 'SURGEON_CONSULTATION' as const,
          quantity: 1,
          unitPricePaise: 6000000,
          claimedAmountPaise: 6000000,
          isNonPayableByRegulation: false
        }
      ]
    };

    const adjudication = claimAdjudicationService.adjudicateClaim({
      requestId: 'req_synth_icu_01',
      treatmentDate: '2026-07-01',
      bill: bill as any,
      policyDocument: extractedPolicy,
      financialRules: {
        sumInsuredPaise: 100000000, // Rs. 10 Lakhs
        roomLimit: extractedPolicy.roomLimit,
        icuLimit: extractedPolicy.icuLimit, // 2% = Rs. 20,000/day
        proportionateDeductionSupported: true,
        deductiblePaise: 0,
        copayPercentage: 0,
        networkStatus: 'verified'
      }
    });

    // Invariants
    expect(adjudication.invariants.auditPassed).toBe(true);
    expect(adjudication.invariants.isMathematicallyBalanced).toBe(true);
    expect(adjudication.invariants.hasDoubleDeductions).toBe(false);

    // ICU Stage Check:
    // Daily rate Rs. 25,000 exceeds Rs. 20,000 limit -> Daily excess = Rs. 5,000 * 2 = Rs. 10,000 (1,000,000 paise disallowed)
    const icuStage = adjudication.ledger.itemStages.find(s => s.itemId === 'icu_item_1');
    expect(icuStage).toBeDefined();
    expect(icuStage?.excludedNonPayablePaise).toBe(1000000); // Rs. 10,000 excess disallowed
    expect(icuStage?.finalItemApprovedPaise).toBe(4000000);   // Rs. 40,000 eligible

    // Crucial Contractual Verification (Clause 2.2):
    // ICU breach shall NOT trigger proportionate deductions on surgeon expenses!
    const surgeonStage = adjudication.ledger.itemStages.find(s => s.itemId === 'icu_item_2');
    expect(surgeonStage).toBeDefined();
    expect(surgeonStage?.proportionateDisallowancePaise).toBe(0); // ZERO proportionate deduction!
    expect(surgeonStage?.finalItemApprovedPaise).toBe(6000000);   // Full Rs. 60,000 eligible

    // Overall Totals
    expect(adjudication.ledger.totalClaimedPaise).toBe(11000000);
    expect(adjudication.ledger.totalExcludedNonPayablePaise).toBe(1000000);
    expect(adjudication.ledger.totalProportionateDisallowancePaise).toBe(0);
    expect(adjudication.ledger.finalInsurerPayablePaise).toBe(10000000); // Rs. 1,00,000 payable
    expect(adjudication.ledger.totalPatientResponsibilityPaise).toBe(1000000); // Rs. 10,000 patient excess
  });
});
