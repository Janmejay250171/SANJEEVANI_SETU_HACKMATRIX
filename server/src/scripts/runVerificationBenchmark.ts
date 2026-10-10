import { clauseIndexingService } from '../services/clauseIndexingService.js';
import { hybridRetrievalService } from '../services/hybridRetrievalService.js';
import { evidenceVerificationService } from '../services/evidenceVerificationService.js';
import {
  VERIFICATION_BENCHMARK_DATASET,
  VerificationBenchmarkItem
} from '../evaluation/verificationBenchmarkDataset.js';
import { PolicyVersionRecord } from '../types/policyVersion.js';
import { PolicyDocument } from '../types/policy.js';
import { BillItemVerificationContext, EvidenceOutcome } from '../types/verification.js';

// ============================================================================
// Synthetic Policy Fixtures for Evaluation
// ============================================================================

const createBasePolicyData = (): PolicyDocument => ({
  _id: 'doc_synthetic_base_v1',
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
    roomLimit: 'Room rent, boarding and nursing expenses up to Rs.3,000 per day',
    icuLimit: 'ICU charges up to 2% of sum insured per day',
    copay: 'A co-payment of 10% applies to each and every admissible claim',
    proportionateDeduction: 'Associated medical expenses shall be paid in proportion to the eligible room rent limit',
    subLimits: 'Sub-limit for cataract surgery is capped at Rs.40,000 per eye',
    exclusions: 'Elective cosmetic surgery, dental treatment (except due to accidental injury), and weight loss treatments are permanently excluded'
  },
  confidence: { roomLimit: 'high', sumInsured: 'high' },
  rawTextRef: '/storage/synthetic_policy_v1.pdf'
});

const baseVersionV1: PolicyVersionRecord = {
  familyId: 'syn_fam_health_01',
  versionId: 'syn_ver_base_2025_v1',
  versionNumber: '1.0',
  documentType: 'BASE_POLICY',
  parentVersionId: null,
  amendmentScope: null,
  insurerId: 'syn_ins_01',
  insurerName: 'Synthetic Health Assurance Ltd',
  planName: 'Synthetic Comprehensive Health Shield',
  documentId: 'doc_synthetic_base_v1',
  effectiveFrom: '2025-01-01',
  effectiveTo: '2025-12-31',
  uploadTimestamp: '2025-01-05T10:00:00.000Z',
  extractedTimestamp: '2025-01-05T10:05:00.000Z',
  extractionStatus: 'VERIFIED',
  clauseModifications: [],
  policyData: createBasePolicyData(),
  unresolvedQuestions: []
};

const amendmentVersionV1_1: PolicyVersionRecord = {
  familyId: 'syn_fam_health_01',
  versionId: 'syn_ver_amend_2025_v1.1',
  versionNumber: '1.1',
  documentType: 'AMENDMENT',
  parentVersionId: 'syn_ver_base_2025_v1',
  amendmentScope: 'MODIFIES_SPECIFIC_CLAUSES',
  insurerId: 'syn_ins_01',
  insurerName: 'Synthetic Health Assurance Ltd',
  planName: 'Synthetic Comprehensive Health Shield - Endorsement A',
  documentId: 'doc_synthetic_amend_v1.1',
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
  policyData: createBasePolicyData(),
  unresolvedQuestions: []
};

// ============================================================================
// Evaluation Metrics
// ============================================================================

export interface VerificationEvaluationReport {
  totalItems: number;
  correctOutcomes: number;
  accuracy: number;
  macroF1: number;
  exclusionPrecision: number;
  exclusionRecall: number;
  exclusionF1: number;
  reviewTriggerRecall: number;
  citationIntegrityRate: number;
  invalidReferenceRate: number;
  itemResults: Array<{
    id: string;
    description: string;
    expectedOutcome: EvidenceOutcome;
    predictedOutcome: EvidenceOutcome;
    isOutcomeMatch: boolean;
    expectedReview: boolean;
    predictedReview: boolean;
    citationVerified: boolean;
    precedenceRole: string;
    controllingClauseId?: string;
  }>;
}

export async function runVerificationBenchmark(): Promise<VerificationEvaluationReport> {
  console.log('\n======================================================================');
  console.log('   FIN-01 POLICY EVIDENCE VERIFICATION BENCHMARK EVALUATION');
  console.log('======================================================================\n');

  // 1. Index base and amendment versions
  console.log('Indexing synthetic base policy version 1.0...');
  const baseClauses = clauseIndexingService.indexPolicyVersion(baseVersionV1);
  console.log('Indexing synthetic amendment endorsement version 1.1...');
  const amendClauses = clauseIndexingService.indexPolicyVersion(amendmentVersionV1_1);
  const fullCorpus = [...baseClauses, ...amendClauses];

  let correctOutcomes = 0;
  let exclusionTruePositives = 0;
  let exclusionFalsePositives = 0;
  let exclusionFalseNegatives = 0;

  let expectedReviewCount = 0;
  let correctlyTriggeredReviewCount = 0;

  let verifiedCitationsCount = 0;
  let invalidReferencesCount = 0;

  // Outcome frequency maps for Macro-F1
  const uniqueOutcomes: EvidenceOutcome[] = ['supported', 'excluded', 'conditional', 'insufficient_evidence', 'conflicting', 'ambiguous', 'review_required'];
  const tpByOutcome: Record<string, number> = {};
  const fpByOutcome: Record<string, number> = {};
  const fnByOutcome: Record<string, number> = {};

  for (const o of uniqueOutcomes) {
    tpByOutcome[o] = 0;
    fpByOutcome[o] = 0;
    fnByOutcome[o] = 0;
  }

  const itemResults = [];

  for (const item of VERIFICATION_BENCHMARK_DATASET) {
    // 1. Retrieve policy evidence
    const retrievalResult = await hybridRetrievalService.matchBillItem(
      {
        familyId: item.familyId,
        treatmentDate: item.treatmentDate,
        billItemDescription: item.billItemDescription,
        category: item.category,
        claimedAmountPaise: item.claimedAmountPaise
      } as any,
      fullCorpus
    );

    // 2. Build verification context
    const context: BillItemVerificationContext = {
      billItemId: item.id,
      originalDescription: item.billItemDescription,
      category: item.category,
      claimedAmountPaise: item.claimedAmountPaise,
      clinicalDiagnosis: item.clinicalDiagnosis,
      billedRoomTariffPaise: item.billedRoomTariffPaise,
      treatmentDate: item.treatmentDate,
      policyVersionId: baseVersionV1.versionId,
      retrievedEvidence: retrievalResult
    };

    // 3. Execute authoritative verification
    const verificationResult = await evidenceVerificationService.verifyBillItemEvidence(context);

    // 4. Compare outcome
    const isOutcomeMatch = verificationResult.outcome === item.expectedOutcome;
    if (isOutcomeMatch) {
      correctOutcomes++;
      tpByOutcome[item.expectedOutcome]++;
    } else {
      fpByOutcome[verificationResult.outcome]++;
      fnByOutcome[item.expectedOutcome]++;
    }

    // 5. Exclusion Metrics
    if (item.expectedOutcome === 'excluded') {
      if (verificationResult.outcome === 'excluded') {
        exclusionTruePositives++;
      } else {
        exclusionFalseNegatives++;
      }
    } else if (verificationResult.outcome === 'excluded') {
      exclusionFalsePositives++;
    }

    // 6. Review Trigger Metrics
    if (item.expectedReviewRequired) {
      expectedReviewCount++;
      if (verificationResult.reviewRequired) {
        correctlyTriggeredReviewCount++;
      }
    }

    // 7. Citation Integrity
    if (verificationResult.citationIntegrityVerified) {
      verifiedCitationsCount++;
    } else {
      invalidReferencesCount++;
    }

    const controllingCit =
      verificationResult.supportingEvidence.find((c) => c.precedenceRole === 'CONTROLLING') ||
      verificationResult.adverseExclusionEvidence.find((c) => c.precedenceRole === 'CONTROLLING') ||
      verificationResult.supportingEvidence.find((c) => c.precedenceRole === 'EXCEPTION_APPLIED') ||
      verificationResult.supportingEvidence[0] ||
      verificationResult.adverseExclusionEvidence[0];

    itemResults.push({
      id: item.id,
      description: item.billItemDescription,
      expectedOutcome: item.expectedOutcome,
      predictedOutcome: verificationResult.outcome,
      isOutcomeMatch,
      expectedReview: item.expectedReviewRequired,
      predictedReview: verificationResult.reviewRequired,
      citationVerified: verificationResult.citationIntegrityVerified,
      precedenceRole: controllingCit?.precedenceRole || 'UNRESOLVED',
      controllingClauseId: controllingCit?.clauseId
    });
  }

  // Calculate Macro-F1 across active outcomes
  let macroF1Sum = 0;
  let activeOutcomeCount = 0;
  for (const o of uniqueOutcomes) {
    const tp = tpByOutcome[o];
    const fp = fpByOutcome[o];
    const fn = fnByOutcome[o];
    if (tp + fp + fn > 0) {
      activeOutcomeCount++;
      const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
      const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
      macroF1Sum += f1;
    }
  }
  const macroF1 = activeOutcomeCount > 0 ? macroF1Sum / activeOutcomeCount : 0;

  const totalItems = VERIFICATION_BENCHMARK_DATASET.length;
  const accuracy = correctOutcomes / totalItems;

  const exclusionPrecision =
    exclusionTruePositives + exclusionFalsePositives > 0
      ? exclusionTruePositives / (exclusionTruePositives + exclusionFalsePositives)
      : 1.0;
  const exclusionRecall =
    exclusionTruePositives + exclusionFalseNegatives > 0
      ? exclusionTruePositives / (exclusionTruePositives + exclusionFalseNegatives)
      : 1.0;
  const exclusionF1 =
    exclusionPrecision + exclusionRecall > 0
      ? (2 * exclusionPrecision * exclusionRecall) / (exclusionPrecision + exclusionRecall)
      : 0;

  const reviewTriggerRecall =
    expectedReviewCount > 0 ? correctlyTriggeredReviewCount / expectedReviewCount : 1.0;

  const citationIntegrityRate = verifiedCitationsCount / totalItems;
  const invalidReferenceRate = invalidReferencesCount / totalItems;

  // Print results table
  console.log('-----------------------------------------------------------------------------------------------------------------');
  console.log('| ID | Description | Expected | Predicted | Match | Review (Exp/Pred) | Citation OK |');
  console.log('-----------------------------------------------------------------------------------------------------------------');
  for (const r of itemResults) {
    const matchMark = r.isOutcomeMatch ? 'PASS' : 'FAIL';
    const reviewStr = `${r.expectedReview ? 'Y' : 'N'} / ${r.predictedReview ? 'Y' : 'N'}`;
    console.log(
      `| ${r.id.padEnd(30)} | ${r.description.slice(0, 28).padEnd(28)} | ${r.expectedOutcome.padEnd(12)} | ${r.predictedOutcome.padEnd(12)} | ${matchMark.padEnd(5)} | ${reviewStr.padEnd(17)} | ${(r.citationVerified ? 'YES' : 'NO').padEnd(11)} |`
    );
  }
  console.log('-----------------------------------------------------------------------------------------------------------------\n');

  console.log('SUMMARY METRICS:');
  console.log(`- Total Benchmark Items:             ${totalItems}`);
  console.log(`- Outcome Accuracy:                  ${(accuracy * 100).toFixed(2)}% (${correctOutcomes}/${totalItems})`);
  console.log(`- Macro-F1 across Outcomes:          ${(macroF1 * 100).toFixed(2)}%`);
  console.log(`- Exclusion Detection Precision:     ${(exclusionPrecision * 100).toFixed(2)}%`);
  console.log(`- Exclusion Detection Recall:        ${(exclusionRecall * 100).toFixed(2)}%`);
  console.log(`- Exclusion Detection F1:            ${(exclusionF1 * 100).toFixed(2)}%`);
  console.log(`- Review-Trigger Recall:             ${(reviewTriggerRecall * 100).toFixed(2)}% (${correctlyTriggeredReviewCount}/${expectedReviewCount})`);
  console.log(`- Citation Integrity Rate:           ${(citationIntegrityRate * 100).toFixed(2)}%`);
  console.log(`- Invalid Citation Reference Rate:   ${(invalidReferenceRate * 100).toFixed(2)}%`);
  console.log('\n======================================================================\n');

  return {
    totalItems,
    correctOutcomes,
    accuracy,
    macroF1,
    exclusionPrecision,
    exclusionRecall,
    exclusionF1,
    reviewTriggerRecall,
    citationIntegrityRate,
    invalidReferenceRate,
    itemResults
  };
}

// Execute standalone when invoked directly
if (process.argv[1]?.endsWith('runVerificationBenchmark.ts') || process.argv[1]?.endsWith('runVerificationBenchmark.js')) {
  runVerificationBenchmark().catch((err) => {
    console.error('Verification benchmark execution failed:', err);
    process.exit(1);
  });
}
