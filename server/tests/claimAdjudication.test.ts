import { describe, it, expect } from 'vitest';
import { claimAdjudicationService } from '../src/services/claimAdjudicationService.js';
import {
  CLAIM_ENGINE_BENCHMARK_FIXTURES
} from '../src/evaluation/claimEngineBenchmarkDataset.js';
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaise,
  BillDocument,
  ClaimLineItem
} from '../src/types/claim.js';
import { ClaimAdjudicationRequest } from '../src/types/adjudication.js';

describe('FIN-01 Deterministic Claim Adjudication Engine Suite', () => {
  // ==========================================================================
  // 1. Authoritative 20-Scenario Benchmark Test Suite
  // ==========================================================================
  describe('Authoritative Calculation Oracles (20 Scenarios)', () => {
    for (const fixture of CLAIM_ENGINE_BENCHMARK_FIXTURES) {
      it(`Scenario ${fixture.scenarioNumber}: ${fixture.name}`, () => {
        const result = claimAdjudicationService.adjudicateClaim(fixture.request);
        const exp = fixture.expected;

        expect(result.ledger.totalClaimedPaise).toBe(exp.totalClaimedPaise);
        expect(result.ledger.totalExcludedNonPayablePaise).toBe(exp.excludedNonPayablePaise);
        expect(result.ledger.totalProportionateDisallowancePaise).toBe(exp.proportionateDisallowancePaise);
        expect(result.ledger.totalSublimitDisallowancePaise).toBe(exp.sublimitDisallowancePaise);
        expect(result.ledger.appliedDeductiblePaise).toBe(exp.appliedDeductiblePaise);
        expect(result.ledger.appliedCopayPaise).toBe(exp.appliedCopayPaise);
        expect(result.ledger.sumInsuredCapDisallowancePaise).toBe(exp.sumInsuredCapDisallowancePaise);
        expect(result.ledger.finalInsurerPayablePaise).toBe(exp.finalInsurerPayablePaise);
        expect(result.ledger.totalPatientResponsibilityPaise).toBe(exp.totalPatientResponsibilityPaise);
        expect(result.invariants.isMathematicallyBalanced).toBe(exp.isMathematicallyBalanced);
        expect(result.reviewRequired).toBe(exp.reviewRequired);

        if (exp.expectedReviewReasonKeywords) {
          const allReasons = [
            ...result.reviewReasons,
            ...result.billReconciliation.issues.map(i => `${i.issueType}: ${i.message}`),
            ...result.itemizedLedger.flatMap(i => i.reviewReasons)
          ].join(' ');

          for (const kw of exp.expectedReviewReasonKeywords) {
            expect(allReasons).toContain(kw);
          }
        }
      });
    }
  });

  // ==========================================================================
  // 2. Strict Mathematical Invariants & Monetary Rules
  // ==========================================================================
  describe('Mathematical Invariants & Monetary Precision', () => {
    it('Invariant 1: All financial amounts in ledger and trace MUST be integers (zero floating-point paise)', () => {
      const fixture = CLAIM_ENGINE_BENCHMARK_FIXTURES[19]; // Scenario 20: Star Health regression
      const result = claimAdjudicationService.adjudicateClaim(fixture.request);

      expect(Number.isInteger(result.ledger.totalClaimedPaise)).toBe(true);
      expect(Number.isInteger(result.ledger.totalExcludedNonPayablePaise)).toBe(true);
      expect(Number.isInteger(result.ledger.totalProportionateDisallowancePaise)).toBe(true);
      expect(Number.isInteger(result.ledger.totalSublimitDisallowancePaise)).toBe(true);
      expect(Number.isInteger(result.ledger.appliedDeductiblePaise)).toBe(true);
      expect(Number.isInteger(result.ledger.appliedCopayPaise)).toBe(true);
      expect(Number.isInteger(result.ledger.sumInsuredCapDisallowancePaise)).toBe(true);
      expect(Number.isInteger(result.ledger.finalInsurerPayablePaise)).toBe(true);
      expect(Number.isInteger(result.ledger.totalPatientResponsibilityPaise)).toBe(true);

      for (const step of result.trace.steps) {
        expect(Number.isInteger(step.inputBasePaise)).toBe(true);
        expect(Number.isInteger(step.adjustmentAmountPaise)).toBe(true);
        expect(Number.isInteger(step.outputAmountPaise)).toBe(true);
      }
    });

    it('Invariant 2: Fundamental Balance Conservation holds across valid claims', () => {
      // Total Claimed = Insurer Payable + Patient Responsibility
      for (const fixture of CLAIM_ENGINE_BENCHMARK_FIXTURES) {
        if (fixture.scenarioNumber === 18) continue; // Skip invalid negative input fixture
        const result = claimAdjudicationService.adjudicateClaim(fixture.request);
        const sumShares = result.ledger.finalInsurerPayablePaise + result.ledger.totalPatientResponsibilityPaise;
        expect(sumShares).toBe(result.ledger.totalClaimedPaise);
        expect(result.invariants.isMathematicallyBalanced).toBe(true);
      }
    });

    it('Invariant 3: Insurer payable is strictly non-negative for valid claims', () => {
      for (const fixture of CLAIM_ENGINE_BENCHMARK_FIXTURES) {
        if (fixture.scenarioNumber === 18) continue; // Exclude invalid negative input scenario
        const result = claimAdjudicationService.adjudicateClaim(fixture.request);
        expect(result.ledger.finalInsurerPayablePaise).toBeGreaterThanOrEqual(0);
        expect(result.invariants.hasNegativePayable).toBe(false);
      }

      // Explicit check for Scenario 18: Negative input is properly flagged
      const negFixture = CLAIM_ENGINE_BENCHMARK_FIXTURES[17];
      const negResult = claimAdjudicationService.adjudicateClaim(negFixture.request);
      expect(negResult.invariants.hasNegativePayable).toBe(true);
      expect(negResult.ledger.finalInsurerPayablePaise).toBe(0); // Insurer payable clamped to 0
    });

    it('Invariant 4: Line item allocations reconcile exactly to claim-level totals', () => {
      const fixture = CLAIM_ENGINE_BENCHMARK_FIXTURES[10]; // Scenario 11: 4 items with deductible
      const result = claimAdjudicationService.adjudicateClaim(fixture.request);

      const sumItemInsurerPayable = result.itemizedLedger.reduce((sum, item) => sum + item.insurerPayablePaise, 0);
      const sumItemPatientResp = result.itemizedLedger.reduce((sum, item) => sum + item.patientResponsibilityPaise, 0);

      expect(sumItemInsurerPayable).toBe(result.ledger.finalInsurerPayablePaise);
      expect(sumItemPatientResp).toBe(result.ledger.totalPatientResponsibilityPaise);
    });

    it('Invariant 5: Zero double deductions in adjustment ledger', () => {
      for (const fixture of CLAIM_ENGINE_BENCHMARK_FIXTURES) {
        const result = claimAdjudicationService.adjudicateClaim(fixture.request);
        expect(result.invariants.hasDoubleDeductions).toBe(false);

        const seenIds = new Set<string>();
        for (const adj of result.adjustmentLedger) {
          expect(seenIds.has(adj.adjustmentId)).toBe(false);
          seenIds.add(adj.adjustmentId);
        }
      }
    });
  });

  // ==========================================================================
  // 3. Determinism, Idempotence & Safe Recomputation
  // ==========================================================================
  describe('Determinism & Recomputation Safety', () => {
    it('Repeated execution with identical inputs produces bit-for-bit identical ledger values', () => {
      const fixture = CLAIM_ENGINE_BENCHMARK_FIXTURES[8]; // Scenario 9: Proportionate deduction
      const run1 = claimAdjudicationService.adjudicateClaim(fixture.request);
      const run2 = claimAdjudicationService.adjudicateClaim(fixture.request);

      expect(run1.ledger.totalClaimedPaise).toBe(run2.ledger.totalClaimedPaise);
      expect(run1.ledger.totalExcludedNonPayablePaise).toBe(run2.ledger.totalExcludedNonPayablePaise);
      expect(run1.ledger.totalProportionateDisallowancePaise).toBe(run2.ledger.totalProportionateDisallowancePaise);
      expect(run1.ledger.finalInsurerPayablePaise).toBe(run2.ledger.finalInsurerPayablePaise);
      expect(run1.ledger.totalPatientResponsibilityPaise).toBe(run2.ledger.totalPatientResponsibilityPaise);
      expect(run1.adjustmentLedger.length).toBe(run2.adjustmentLedger.length);
      expect(run1.trace.steps.length).toBe(run2.trace.steps.length);
    });

    it('Recomputation does not mutate historical assessment and tracks prior assessment ID', () => {
      const fixture = CLAIM_ENGINE_BENCHMARK_FIXTURES[0]; // Scenario 1: ₹50,000 appendectomy
      const initialAssessment = claimAdjudicationService.adjudicateClaim(fixture.request);

      // Modified bill with added medication
      const updatedRequest: ClaimAdjudicationRequest = {
        ...fixture.request,
        bill: {
          ...fixture.request.bill,
          lineItems: [
            ...fixture.request.bill.lineItems,
            {
              itemId: 'item_postop_meds',
              originalDescription: 'Postoperative Antibiotics',
              category: 'MEDICINES_PHARMACY',
              quantity: 1,
              unitPricePaise: rupeesToPaise(5000),
              claimedAmountPaise: rupeesToPaise(5000),
              currency: 'INR',
              provenance: {
                sourceType: 'SYNTHETIC_BENCHMARK',
                rawExtractedText: 'Postoperative Antibiotics',
                extractedTimestamp: '2026-10-10T12:00:00Z',
                confidenceScore: 1.0
              },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            }
          ],
          originalBillTotalPaise: rupeesToPaise(55000)
        }
      };

      const recomputedHistory = claimAdjudicationService.recomputeAssessment(
        updatedRequest,
        initialAssessment,
        'Added post-operative prescription charges'
      );

      // Historical assessment remains intact
      expect(initialAssessment.ledger.totalClaimedPaise).toBe(rupeesToPaise(50000));
      expect(initialAssessment.ledger.finalInsurerPayablePaise).toBe(rupeesToPaise(50000));

      // Recomputed assessment has distinct ID and correctly references prior
      expect(recomputedHistory.assessmentId).not.toBe(initialAssessment.assessmentId);
      expect(recomputedHistory.priorAssessmentId).toBe(initialAssessment.assessmentId);
      expect(recomputedHistory.result.ledger.totalClaimedPaise).toBe(rupeesToPaise(55000));
      expect(recomputedHistory.result.ledger.finalInsurerPayablePaise).toBe(rupeesToPaise(55000));
    });
  });

  // ==========================================================================
  // 4. Uncertainty & Non-Assumption Invariants
  // ==========================================================================
  describe('Uncertainty Propagation & Fallback Safety', () => {
    it('Missing deductible in policy NEVER defaults to zero; triggers review', () => {
      const request: ClaimAdjudicationRequest = {
        requestId: 'req_missing_ded',
        treatmentDate: '2025-06-12',
        bill: {
          billId: 'bill_test',
          hospitalName: 'Apollo',
          billDate: '2025-06-12',
          admissionDate: '2025-06-12',
          dischargeDate: '2025-06-12',
          originalBillTotalPaise: rupeesToPaise(50000),
          calculatedItemsTotalPaise: rupeesToPaise(50000),
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [
            {
              itemId: 'it_1',
              originalDescription: 'Daycare Chemotherapy',
              category: 'DAYCARE_PACKAGE',
              quantity: 1,
              unitPricePaise: rupeesToPaise(50000),
              claimedAmountPaise: rupeesToPaise(50000),
              currency: 'INR',
              provenance: {
                sourceType: 'SYNTHETIC_BENCHMARK',
                rawExtractedText: 'Daycare Chemotherapy',
                extractedTimestamp: '2026-10-10T12:00:00Z',
                confidenceScore: 1.0
              },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            }
          ],
          uploadedAt: '2026-10-10T12:00:00Z',
          extractedAt: '2026-10-10T12:00:00Z'
        },
        financialRules: {
          sumInsuredPaise: rupeesToPaise(500000),
          deductiblePaise: null, // Unspecified deductible
          copayPercentage: 0,
          networkStatus: 'verified'
        }
      };

      const result = claimAdjudicationService.adjudicateClaim(request);
      expect(result.reviewRequired).toBe(true);
      expect(result.reviewReasons.some(r => r.includes('deductible not specified'))).toBe(true);
    });

    it('Non-network hospital with unspecified non-network copay NEVER assumes 0% or base copay', () => {
      const request: ClaimAdjudicationRequest = {
        requestId: 'req_non_net_uncertain',
        treatmentDate: '2025-06-12',
        bill: {
          billId: 'bill_test_non_net',
          hospitalName: 'City Nursing Home',
          billDate: '2025-06-12',
          admissionDate: '2025-06-12',
          dischargeDate: '2025-06-12',
          originalBillTotalPaise: rupeesToPaise(40000),
          calculatedItemsTotalPaise: rupeesToPaise(40000),
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [
            {
              itemId: 'it_2',
              originalDescription: 'Fracture Closed Reduction',
              category: 'DAYCARE_PACKAGE',
              quantity: 1,
              unitPricePaise: rupeesToPaise(40000),
              claimedAmountPaise: rupeesToPaise(40000),
              currency: 'INR',
              provenance: {
                sourceType: 'SYNTHETIC_BENCHMARK',
                rawExtractedText: 'Fracture Closed Reduction',
                extractedTimestamp: '2026-10-10T12:00:00Z',
                confidenceScore: 1.0
              },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            }
          ],
          uploadedAt: '2026-10-10T12:00:00Z',
          extractedAt: '2026-10-10T12:00:00Z'
        },
        financialRules: {
          sumInsuredPaise: rupeesToPaise(500000),
          deductiblePaise: 0,
          copayPercentage: 10, // Base network copay is 10%
          nonNetworkCopayPercentage: null, // Non-network copay is unstated!
          networkStatus: 'no_match' // Non-network facility
        }
      };

      const result = claimAdjudicationService.adjudicateClaim(request);
      expect(result.reviewRequired).toBe(true);
      expect(result.ledger.appliedCopayPaise).toBe(0); // Not assumed!
      expect(result.reviewReasons.some(r => r.includes('Non-network co-payment percentage is not specified'))).toBe(true);
    });
  });
});
