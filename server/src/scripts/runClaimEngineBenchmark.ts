import { claimAdjudicationService } from '../services/claimAdjudicationService.js';
import { CLAIM_ENGINE_BENCHMARK_FIXTURES, ClaimBenchmarkFixture } from '../evaluation/claimEngineBenchmarkDataset.js';
import { paiseToRupees, formatPaise } from '../types/claim.js';

interface BenchmarkRunResult {
  fixtureId: string;
  name: string;
  passed: boolean;
  errors: string[];
  actualClaimed: number;
  actualPayable: number;
  actualPatientResp: number;
  balanced: boolean;
  reviewRequired: boolean;
}

export function runClaimEngineBenchmark(): {
  total: number;
  passed: number;
  failed: number;
  accuracy: number;
  results: BenchmarkRunResult[];
} {
  console.log('='.repeat(80));
  console.log('FIN-01 DETERMINISTIC CLAIM ADJUDICATION ENGINE BENCHMARK (PROMPT 5)');
  console.log('Evaluating 20 Authoritative Financial Calculation Scenarios');
  console.log('='.repeat(80));

  const results: BenchmarkRunResult[] = [];
  let passedCount = 0;

  for (const fixture of CLAIM_ENGINE_BENCHMARK_FIXTURES) {
    const errors: string[] = [];
    const actual = claimAdjudicationService.adjudicateClaim(fixture.request);
    const exp = fixture.expected;

    // 1. Total Claimed Check
    if (actual.ledger.totalClaimedPaise !== exp.totalClaimedPaise) {
      errors.push(`Claimed Mismatch: Expected ${exp.totalClaimedPaise}, got ${actual.ledger.totalClaimedPaise}`);
    }

    // 2. Excluded / Non-payable check
    if (actual.ledger.totalExcludedNonPayablePaise !== exp.excludedNonPayablePaise) {
      errors.push(`Excluded Mismatch: Expected ${exp.excludedNonPayablePaise}, got ${actual.ledger.totalExcludedNonPayablePaise}`);
    }

    // 3. Proportionate disallowance check
    if (actual.ledger.totalProportionateDisallowancePaise !== exp.proportionateDisallowancePaise) {
      errors.push(`PropDisallowance Mismatch: Expected ${exp.proportionateDisallowancePaise}, got ${actual.ledger.totalProportionateDisallowancePaise}`);
    }

    // 4. Sublimit disallowance check
    if (actual.ledger.totalSublimitDisallowancePaise !== exp.sublimitDisallowancePaise) {
      errors.push(`Sublimit Mismatch: Expected ${exp.sublimitDisallowancePaise}, got ${actual.ledger.totalSublimitDisallowancePaise}`);
    }

    // 5. Deductible check
    if (actual.ledger.appliedDeductiblePaise !== exp.appliedDeductiblePaise) {
      errors.push(`Deductible Mismatch: Expected ${exp.appliedDeductiblePaise}, got ${actual.ledger.appliedDeductiblePaise}`);
    }

    // 6. Copay check
    if (actual.ledger.appliedCopayPaise !== exp.appliedCopayPaise) {
      errors.push(`Copay Mismatch: Expected ${exp.appliedCopayPaise}, got ${actual.ledger.appliedCopayPaise}`);
    }

    // 7. Sum Insured Cap check
    if (actual.ledger.sumInsuredCapDisallowancePaise !== exp.sumInsuredCapDisallowancePaise) {
      errors.push(`SICap Mismatch: Expected ${exp.sumInsuredCapDisallowancePaise}, got ${actual.ledger.sumInsuredCapDisallowancePaise}`);
    }

    // 8. Final Insurer Payable check
    if (actual.ledger.finalInsurerPayablePaise !== exp.finalInsurerPayablePaise) {
      errors.push(`FinalPayable Mismatch: Expected ${exp.finalInsurerPayablePaise}, got ${actual.ledger.finalInsurerPayablePaise}`);
    }

    // 9. Total Patient Responsibility check
    if (actual.ledger.totalPatientResponsibilityPaise !== exp.totalPatientResponsibilityPaise) {
      errors.push(`PatientResp Mismatch: Expected ${exp.totalPatientResponsibilityPaise}, got ${actual.ledger.totalPatientResponsibilityPaise}`);
    }

    // 10. Mathematical Balance check
    if (actual.invariants.isMathematicallyBalanced !== exp.isMathematicallyBalanced) {
      errors.push(`Balance Mismatch: Expected ${exp.isMathematicallyBalanced}, got ${actual.invariants.isMathematicallyBalanced}`);
    }

    // 11. Review Required check
    if (actual.reviewRequired !== exp.reviewRequired) {
      errors.push(`ReviewRequired Mismatch: Expected ${exp.reviewRequired}, got ${actual.reviewRequired}`);
    }

    // 12. Review Reason keyword check
    if (exp.expectedReviewReasonKeywords && exp.expectedReviewReasonKeywords.length > 0) {
      const allReasons = [
        ...actual.reviewReasons,
        ...actual.billReconciliation.issues.map(i => `${i.issueType}: ${i.message}`),
        ...actual.itemizedLedger.flatMap(i => i.reviewReasons)
      ].join(' ');

      for (const kw of exp.expectedReviewReasonKeywords) {
        if (!allReasons.includes(kw)) {
          errors.push(`Missing Expected Review Keyword: '${kw}' in [${allReasons}]`);
        }
      }
    }

    const passed = errors.length === 0;
    if (passed) passedCount++;

    results.push({
      fixtureId: fixture.fixtureId,
      name: fixture.name,
      passed,
      errors,
      actualClaimed: actual.ledger.totalClaimedPaise,
      actualPayable: actual.ledger.finalInsurerPayablePaise,
      actualPatientResp: actual.ledger.totalPatientResponsibilityPaise,
      balanced: actual.invariants.isMathematicallyBalanced,
      reviewRequired: actual.reviewRequired
    });

    const statusMark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(
      `[${String(fixture.scenarioNumber).padStart(2, '0')}] ${statusMark} | ${fixture.name.padEnd(42)} | Claimed: ${formatPaise(actual.ledger.totalClaimedPaise).padStart(12)} | Insurer: ${formatPaise(actual.ledger.finalInsurerPayablePaise).padStart(12)} | Patient: ${formatPaise(actual.ledger.totalPatientResponsibilityPaise).padStart(12)}`
    );

    if (!passed) {
      for (const err of errors) {
        console.log(`      ⚠️  ${err}`);
      }
    }
  }

  const accuracy = (passedCount / CLAIM_ENGINE_BENCHMARK_FIXTURES.length) * 100;
  console.log('='.repeat(80));
  console.log(`BENCHMARK SUMMARY: ${passedCount}/${CLAIM_ENGINE_BENCHMARK_FIXTURES.length} PASSED (${accuracy.toFixed(2)}%)`);
  console.log('='.repeat(80));

  return {
    total: CLAIM_ENGINE_BENCHMARK_FIXTURES.length,
    passed: passedCount,
    failed: CLAIM_ENGINE_BENCHMARK_FIXTURES.length - passedCount,
    accuracy,
    results
  };
}

// Auto-run when executed directly via tsx
if (process.argv[1]?.endsWith('runClaimEngineBenchmark.ts') || process.argv[1]?.endsWith('runClaimEngineBenchmark.js')) {
  const summary = runClaimEngineBenchmark();
  if (summary.failed > 0) {
    process.exit(1);
  }
}
