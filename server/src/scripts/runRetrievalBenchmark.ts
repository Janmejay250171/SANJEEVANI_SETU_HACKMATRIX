import { clauseIndexingService } from '../services/clauseIndexingService.js';
import { hybridRetrievalService } from '../services/hybridRetrievalService.js';
import { embeddingService } from '../services/embeddingService.js';
import { RETRIEVAL_BENCHMARK_DATASET, RetrievalBenchmarkItem } from '../evaluation/retrievalBenchmarkDataset.js';
import { PolicyVersionRecord } from '../types/policyVersion.js';
import { PolicyDocument } from '../types/policy.js';
import { RetrievalMethod } from '../types/retrieval.js';

// ============================================================================
// Synthetic Policy Fixtures for Authoritative Evaluation
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
    roomLimit: 'Room rent, boarding and nursing expenses up to Rs.3,000 per day',
    icuLimit: 'ICU charges up to 2% of sum insured per day',
    copay: 'A co-payment of 10% applies to each and every admissible claim',
    proportionateDeduction: 'Associated medical expenses shall be paid in proportion to the eligible room rent limit',
    subLimits: 'Sub-limit for cataract surgery is capped at Rs.40,000 per eye',
    exclusions: 'Elective cosmetic surgery and weight loss treatments are permanently excluded'
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
  effectiveFrom: '2025-07-01', // Post July 1st
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
// Evaluation Metrics Engine
// ============================================================================

export interface MethodEvaluationMetrics {
  method: RetrievalMethod;
  totalQueries: number;
  recallAt5: number;
  recallAt10: number;
  mrr: number;
  ndcgAt10: number;
  avgLatencyMs: number;
  categoryBreakdown: Record<string, { recallAt5: number; mrr: number; count: number }>;
}

export async function evaluateRetrievalMethod(
  method: RetrievalMethod,
  items: RetrievalBenchmarkItem[],
  corpus: any[]
): Promise<MethodEvaluationMetrics> {
  let hitAt5Count = 0;
  let hitAt10Count = 0;
  let reciprocalRankSum = 0;
  let ndcgSum = 0;
  let totalLatency = 0;

  const categoryStats: Record<string, { hitsAt5: number; rrSum: number; count: number }> = {};

  for (const item of items) {
    categoryStats[item.queryType] = categoryStats[item.queryType] || { hitsAt5: 0, rrSum: 0, count: 0 };
    categoryStats[item.queryType].count++;

    const start = Date.now();
    const result = await hybridRetrievalService.matchBillItem(
      {
        billItemDescription: item.billItemDescription,
        normalizedDescription: item.normalizedDescription,
        category: item.category,
        familyId: item.familyId,
        treatmentDate: item.treatmentDate,
        topK: 10
      },
      corpus,
      method
    );
    totalLatency += Date.now() - start;

    // Collect all retrieved candidates across channels
    const allMatches = [
      ...result.supportiveClauses,
      ...result.limitClauses,
      ...result.exclusionClauses,
      ...result.conflictingClauses
    ].sort((a, b) => a.rank - b.rank);

    // Compute rank of first relevant clause
    let firstRelevantRank: number | null = null;
    let rank = 1;

    for (const match of allMatches.slice(0, 10)) {
      if (item.expectedRelevantClauseIds.includes(match.clause.clauseId)) {
        if (firstRelevantRank === null) {
          firstRelevantRank = rank;
        }
      }
      rank++;
    }

    if (firstRelevantRank !== null && firstRelevantRank <= 5) {
      hitAt5Count++;
      categoryStats[item.queryType].hitsAt5++;
    }
    if (firstRelevantRank !== null && firstRelevantRank <= 10) {
      hitAt10Count++;
    }

    const rr = firstRelevantRank !== null ? 1.0 / firstRelevantRank : 0;
    reciprocalRankSum += rr;
    categoryStats[item.queryType].rrSum += rr;

    // Binary DCG@10: 1 / log2(rank + 1)
    const dcg = firstRelevantRank !== null ? 1.0 / Math.log2(firstRelevantRank + 1) : 0;
    // Ideal DCG for 1 relevant item at rank 1: 1 / log2(2) = 1.0
    ndcgSum += dcg;
  }

  const N = items.length;
  const categoryBreakdown: Record<string, { recallAt5: number; mrr: number; count: number }> = {};

  for (const [cat, stats] of Object.entries(categoryStats)) {
    categoryBreakdown[cat] = {
      count: stats.count,
      recallAt5: Number((stats.hitsAt5 / stats.count).toFixed(3)),
      mrr: Number((stats.rrSum / stats.count).toFixed(3))
    };
  }

  return {
    method,
    totalQueries: N,
    recallAt5: Number((hitAt5Count / N).toFixed(3)),
    recallAt10: Number((hitAt10Count / N).toFixed(3)),
    mrr: Number((reciprocalRankSum / N).toFixed(3)),
    ndcgAt10: Number((ndcgSum / N).toFixed(3)),
    avgLatencyMs: Number((totalLatency / N).toFixed(2)),
    categoryBreakdown
  };
}

export async function runCompleteRetrievalBenchmark(): Promise<{
  lexical: MethodEvaluationMetrics;
  semantic: MethodEvaluationMetrics;
  hybrid: MethodEvaluationMetrics;
}> {
  // Index policy clauses
  const baseClauses = clauseIndexingService.indexPolicyVersion(baseVersionV1);
  const amendClauses = clauseIndexingService.indexPolicyVersion(amendmentVersionV1_1);
  const fullCorpus = [...baseClauses, ...amendClauses];

  const lexical = await evaluateRetrievalMethod('KEYWORD_BM25', RETRIEVAL_BENCHMARK_DATASET, fullCorpus);
  const semantic = await evaluateRetrievalMethod('SEMANTIC_VECTOR', RETRIEVAL_BENCHMARK_DATASET, fullCorpus);
  const hybrid = await evaluateRetrievalMethod('HYBRID_RRF', RETRIEVAL_BENCHMARK_DATASET, fullCorpus);

  return { lexical, semantic, hybrid };
}

// ============================================================================
// CLI Runner
// ============================================================================

async function main() {
  console.log('================================================================');
  console.log('FIN-01 HYBRID RETRIEVAL BENCHMARK EVALUATION (Prompt 3 of 8)');
  console.log('================================================================');
  console.log(`Dataset Items: ${RETRIEVAL_BENCHMARK_DATASET.length} labelled items across 8 query categories.`);
  console.log(`Remote Gemini Configured: ${embeddingService.isRemoteConfigured() ? 'Yes' : 'No (Deterministic Local Fallback)'}`);
  console.log('Running evaluation across all 3 baselines...\n');

  const { lexical, semantic, hybrid } = await runCompleteRetrievalBenchmark();

  console.log('------------------------------------------------------------------------------------------------');
  console.log('| Retrieval Baseline   | Recall@5 | Recall@10 | MRR    | nDCG@10 | Avg Latency (ms) |');
  console.log('------------------------------------------------------------------------------------------------');
  console.log(
    `| ${lexical.method.padEnd(20)} | ${lexical.recallAt5.toFixed(3).padEnd(8)} | ${lexical.recallAt10.toFixed(3).padEnd(9)} | ${lexical.mrr.toFixed(3).padEnd(6)} | ${lexical.ndcgAt10.toFixed(3).padEnd(7)} | ${lexical.avgLatencyMs.toFixed(2).padEnd(16)} |`
  );
  console.log(
    `| ${semantic.method.padEnd(20)} | ${semantic.recallAt5.toFixed(3).padEnd(8)} | ${semantic.recallAt10.toFixed(3).padEnd(9)} | ${semantic.mrr.toFixed(3).padEnd(6)} | ${semantic.ndcgAt10.toFixed(3).padEnd(7)} | ${semantic.avgLatencyMs.toFixed(2).padEnd(16)} |`
  );
  console.log(
    `| ${hybrid.method.padEnd(20)} | ${hybrid.recallAt5.toFixed(3).padEnd(8)} | ${hybrid.recallAt10.toFixed(3).padEnd(9)} | ${hybrid.mrr.toFixed(3).padEnd(6)} | ${hybrid.ndcgAt10.toFixed(3).padEnd(7)} | ${hybrid.avgLatencyMs.toFixed(2).padEnd(16)} |`
  );
  console.log('------------------------------------------------------------------------------------------------\n');

  console.log('Category-Specific Recall@5 Breakdown (Hybrid RRF):');
  for (const [cat, stats] of Object.entries(hybrid.categoryBreakdown)) {
    console.log(` • ${cat.padEnd(26)} : Recall@5 = ${stats.recallAt5.toFixed(2)}, MRR = ${stats.mrr.toFixed(2)} (${stats.count} queries)`);
  }
  console.log('\nBenchmark completed successfully.');
}

// Execute if run directly from tsx
if (process.argv[1] && process.argv[1].includes('runRetrievalBenchmark')) {
  main().catch(console.error);
}
