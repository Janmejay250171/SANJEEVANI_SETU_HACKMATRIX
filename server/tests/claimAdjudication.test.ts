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

    it('Accurately adjudicates Worked Example 1A on Policy syn_fam_health_01 (5L SI, Rs. 5,000 Room Cap, 10% Non-Network Copay)', () => {
      const request: ClaimAdjudicationRequest = {
        requestId: 'req_worked_example_210k_policy_a',
        treatmentDate: '2026-06-01',
        bill: {
          billId: 'bill_worked_example_210k_a',
          hospitalName: 'Apex City Hospital (Non-Network)',
          billDate: '2026-06-04',
          admissionDate: '2026-06-01',
          dischargeDate: '2026-06-04',
          originalBillTotalPaise: rupeesToPaise(210000),
          calculatedItemsTotalPaise: rupeesToPaise(210000),
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [
            {
              itemId: 'item_room_210k',
              originalDescription: 'Deluxe Room Rent (3 days @ Rs. 8,000)',
              category: 'ROOM_RENT',
              quantity: 3,
              unitPricePaise: rupeesToPaise(8000),
              claimedAmountPaise: rupeesToPaise(24000),
              currency: 'INR',
              provenance: { sourceType: 'SYNTHETIC_BENCHMARK', rawExtractedText: 'Deluxe Room Rent', extractedTimestamp: '2026-10-10T00:00:00Z', confidenceScore: 1.0 },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            },
            {
              itemId: 'item_surgeon_210k',
              originalDescription: 'Surgeon Consultation & OT Charges',
              category: 'SURGEON_CONSULTATION',
              quantity: 1,
              unitPricePaise: rupeesToPaise(80000),
              claimedAmountPaise: rupeesToPaise(80000),
              currency: 'INR',
              provenance: { sourceType: 'SYNTHETIC_BENCHMARK', rawExtractedText: 'Surgeon Consultation & OT', extractedTimestamp: '2026-10-10T00:00:00Z', confidenceScore: 1.0 },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            },
            {
              itemId: 'item_pharmacy_210k',
              originalDescription: 'Pharmacy & Medications',
              category: 'MEDICINES_PHARMACY',
              quantity: 1,
              unitPricePaise: rupeesToPaise(40000),
              claimedAmountPaise: rupeesToPaise(40000),
              currency: 'INR',
              provenance: { sourceType: 'SYNTHETIC_BENCHMARK', rawExtractedText: 'Pharmacy & Medications', extractedTimestamp: '2026-10-10T00:00:00Z', confidenceScore: 1.0 },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            },
            {
              itemId: 'item_consumables_210k',
              originalDescription: 'Consumables & PPE Kit (Statutory Non-Payables)',
              category: 'CONSUMABLES_NON_PAYABLES',
              quantity: 1,
              unitPricePaise: rupeesToPaise(16000),
              claimedAmountPaise: rupeesToPaise(16000),
              currency: 'INR',
              provenance: { sourceType: 'SYNTHETIC_BENCHMARK', rawExtractedText: 'Consumables & PPE Kit', extractedTimestamp: '2026-10-10T00:00:00Z', confidenceScore: 1.0 },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: ['IRDAI_NON_PAYABLE'],
              isNonPayableByRegulation: true
            },
            {
              itemId: 'item_diag_210k',
              originalDescription: 'Diagnostics & Pathology Investigations',
              category: 'INVESTIGATIONS_DIAGNOSTICS',
              quantity: 1,
              unitPricePaise: rupeesToPaise(50000),
              claimedAmountPaise: rupeesToPaise(50000),
              currency: 'INR',
              provenance: { sourceType: 'SYNTHETIC_BENCHMARK', rawExtractedText: 'Diagnostics & Pathology', extractedTimestamp: '2026-10-10T00:00:00Z', confidenceScore: 1.0 },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            }
          ],
          uploadedAt: '2026-10-10T00:00:00Z',
          extractedAt: '2026-10-10T00:00:00Z'
        },
        financialRules: {
          sumInsuredPaise: rupeesToPaise(500000),
          roomLimit: { type: 'amount', value: 5000 },
          proportionateDeductionSupported: true,
          deductiblePaise: 0,
          copayPercentage: 0,
          nonNetworkCopayPercentage: 10,
          networkStatus: 'no_match'
        }
      };

      // 1. Explicitly verify the policy inputs justifying the outputs
      expect(request.financialRules?.sumInsuredPaise).toBe(rupeesToPaise(500000));
      expect(request.financialRules?.roomLimit?.value).toBe(5000);
      expect(request.financialRules?.proportionateDeductionSupported).toBe(true);
      expect(request.financialRules?.deductiblePaise).toBe(0);
      expect(request.financialRules?.nonNetworkCopayPercentage).toBe(10);
      expect(request.financialRules?.networkStatus).toBe('no_match');

      const result = claimAdjudicationService.adjudicateClaim(request);

      // Invariants
      expect(result.invariants.auditPassed).toBe(true);
      expect(result.invariants.isMathematicallyBalanced).toBe(true);
      expect(result.invariants.hasDoubleDeductions).toBe(false);

      // Line items:
      // 1. Room rent: 3 * 8000 = 24,000 claimed; daily excess = 3,000 * 3 = 9,000 disallowed; 15,000 admissible
      const roomStage = result.ledger.itemStages.find(s => s.itemId === 'item_room_210k');
      expect(roomStage?.excludedNonPayablePaise).toBe(rupeesToPaise(9000));
      expect(roomStage?.finalItemApprovedPaise).toBe(rupeesToPaise(15000));

      // 2. Surgeon: 80,000 claimed; proportionate factor = 5000/8000 = 62.5%; disallowance = 30,000; 50,000 admissible
      const surgeonStage = result.ledger.itemStages.find(s => s.itemId === 'item_surgeon_210k');
      expect(surgeonStage?.proportionateDisallowancePaise).toBe(rupeesToPaise(30000));
      expect(surgeonStage?.finalItemApprovedPaise).toBe(rupeesToPaise(50000));

      // 3. Pharmacy: 40,000 claimed; exempt from proportionate reduction; 40,000 admissible
      const pharmStage = result.ledger.itemStages.find(s => s.itemId === 'item_pharmacy_210k');
      expect(pharmStage?.finalItemApprovedPaise).toBe(rupeesToPaise(40000));

      // 4. Consumables: 16,000 claimed; IRDAI statutory exclusion; 0 admissible
      const consStage = result.ledger.itemStages.find(s => s.itemId === 'item_consumables_210k');
      expect(consStage?.excludedNonPayablePaise).toBe(rupeesToPaise(16000));
      expect(consStage?.finalItemApprovedPaise).toBe(0);

      // 5. Diagnostics: 50,000 claimed; EXEMPT from proportionate reduction under IRDAI guidelines; 50,000 admissible
      const diagStage = result.ledger.itemStages.find(s => s.itemId === 'item_diag_210k');
      expect(diagStage?.proportionateDisallowancePaise).toBe(0);
      expect(diagStage?.finalItemApprovedPaise).toBe(rupeesToPaise(50000));

      // Admissible before copay: 15k + 50k + 40k + 50k = Rs. 1,55,000
      expect(result.ledger.totalAdmissibleBeforeDeductiblePaise).toBe(rupeesToPaise(155000));

      // 10% non-network copay on 1,55,000 = Rs. 15,500
      expect(result.ledger.appliedCopayPaise).toBe(rupeesToPaise(15500));

      // Insurer settlement: 1,55,000 - 15,500 = Rs. 1,39,500
      expect(result.ledger.finalInsurerPayablePaise).toBe(rupeesToPaise(139500));

      // Patient responsibility: Disallowances (9k + 30k + 16k = 55k) + Copay (15.5k) = Rs. 70,500
      expect(result.ledger.totalPatientResponsibilityPaise).toBe(rupeesToPaise(70500));

      // Zero-discrepancy reconciliation invariant:
      expect(result.ledger.finalInsurerPayablePaise + result.ledger.totalPatientResponsibilityPaise).toBe(rupeesToPaise(210000));
    });

    it('Accurately adjudicates Worked Example 1B on 45-page Policy synth_doc_arogya_bharat_45pp (10L SI, Rs. 10,000 Room Cap, Rs. 25,000 Deductible, 20% Copay)', () => {
      // Under the 45-page policy:
      // SI: Rs. 10,00,000 (Page 2, Clause S.3)
      // Room rent limit: 1% of SI = Rs. 10,000/day (Page 7, Clause 2.1)
      // Deductible: Rs. 25,000 compulsory deductible (Page 2, Clause S.3)
      // Non-network copay: 20% (Page 39, Clause 10.2)
      // Actual room rate Rs. 8,000 <= Rs. 10,000 -> NO ROOM RENT BREACH, NO PROPORTIONATE DEDUCTION!
      const request45pp: ClaimAdjudicationRequest = {
        requestId: 'req_worked_example_210k_policy_b',
        treatmentDate: '2026-06-01',
        bill: {
          billId: 'bill_worked_example_210k_b',
          hospitalName: 'Apex City Hospital (Non-Network)',
          billDate: '2026-06-04',
          admissionDate: '2026-06-01',
          dischargeDate: '2026-06-04',
          originalBillTotalPaise: rupeesToPaise(210000),
          calculatedItemsTotalPaise: rupeesToPaise(210000),
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [
            {
              itemId: 'item_room_210k_b',
              originalDescription: 'Deluxe Room Rent (3 days @ Rs. 8,000)',
              category: 'ROOM_RENT',
              quantity: 3,
              unitPricePaise: rupeesToPaise(8000),
              claimedAmountPaise: rupeesToPaise(24000),
              currency: 'INR',
              provenance: { sourceType: 'SYNTHETIC_BENCHMARK', rawExtractedText: 'Deluxe Room Rent', extractedTimestamp: '2026-10-10T00:00:00Z', confidenceScore: 1.0 },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            },
            {
              itemId: 'item_surgeon_210k_b',
              originalDescription: 'Surgeon Consultation & OT Charges',
              category: 'SURGEON_CONSULTATION',
              quantity: 1,
              unitPricePaise: rupeesToPaise(80000),
              claimedAmountPaise: rupeesToPaise(80000),
              currency: 'INR',
              provenance: { sourceType: 'SYNTHETIC_BENCHMARK', rawExtractedText: 'Surgeon Consultation & OT', extractedTimestamp: '2026-10-10T00:00:00Z', confidenceScore: 1.0 },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            },
            {
              itemId: 'item_pharmacy_210k_b',
              originalDescription: 'Pharmacy & Medications',
              category: 'MEDICINES_PHARMACY',
              quantity: 1,
              unitPricePaise: rupeesToPaise(40000),
              claimedAmountPaise: rupeesToPaise(40000),
              currency: 'INR',
              provenance: { sourceType: 'SYNTHETIC_BENCHMARK', rawExtractedText: 'Pharmacy & Medications', extractedTimestamp: '2026-10-10T00:00:00Z', confidenceScore: 1.0 },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            },
            {
              itemId: 'item_consumables_210k_b',
              originalDescription: 'Consumables & PPE Kit (Statutory Non-Payables)',
              category: 'CONSUMABLES_NON_PAYABLES',
              quantity: 1,
              unitPricePaise: rupeesToPaise(16000),
              claimedAmountPaise: rupeesToPaise(16000),
              currency: 'INR',
              provenance: { sourceType: 'SYNTHETIC_BENCHMARK', rawExtractedText: 'Consumables & PPE Kit', extractedTimestamp: '2026-10-10T00:00:00Z', confidenceScore: 1.0 },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: ['IRDAI_NON_PAYABLE'],
              isNonPayableByRegulation: true
            },
            {
              itemId: 'item_diag_210k_b',
              originalDescription: 'Diagnostics & Pathology Investigations',
              category: 'INVESTIGATIONS_DIAGNOSTICS',
              quantity: 1,
              unitPricePaise: rupeesToPaise(50000),
              claimedAmountPaise: rupeesToPaise(50000),
              currency: 'INR',
              provenance: { sourceType: 'SYNTHETIC_BENCHMARK', rawExtractedText: 'Diagnostics & Pathology', extractedTimestamp: '2026-10-10T00:00:00Z', confidenceScore: 1.0 },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            }
          ],
          uploadedAt: '2026-10-10T00:00:00Z',
          extractedAt: '2026-10-10T00:00:00Z'
        },
        financialRules: {
          sumInsuredPaise: rupeesToPaise(1000000),
          roomLimit: { type: 'amount', value: 10000 },
          proportionateDeductionSupported: true,
          deductiblePaise: rupeesToPaise(25000),
          copayPercentage: 0,
          nonNetworkCopayPercentage: 20,
          networkStatus: 'no_match'
        }
      };

      // 1. Explicitly verify the policy inputs justifying the outputs
      expect(request45pp.financialRules?.sumInsuredPaise).toBe(rupeesToPaise(1000000));
      expect(request45pp.financialRules?.roomLimit?.value).toBe(10000);
      expect(request45pp.financialRules?.deductiblePaise).toBe(rupeesToPaise(25000));
      expect(request45pp.financialRules?.nonNetworkCopayPercentage).toBe(20);
      expect(request45pp.financialRules?.networkStatus).toBe('no_match');

      const result = claimAdjudicationService.adjudicateClaim(request45pp);

      // Invariants
      expect(result.invariants.auditPassed).toBe(true);
      expect(result.invariants.isMathematicallyBalanced).toBe(true);
      expect(result.invariants.hasDoubleDeductions).toBe(false);

      // Line items:
      // 1. Room rent: 3 * 8000 = 24,000 claimed; Rs. 8,000 <= Rs. 10,000 cap -> 0 disallowed, 24,000 admissible
      const roomStage = result.ledger.itemStages.find(s => s.itemId === 'item_room_210k_b');
      expect(roomStage?.excludedNonPayablePaise).toBe(0);
      expect(roomStage?.finalItemApprovedPaise).toBe(rupeesToPaise(24000));

      // 2. Surgeon: 80,000 claimed; NO room rent breach -> 0 proportionate disallowance, 80,000 admissible
      const surgeonStage = result.ledger.itemStages.find(s => s.itemId === 'item_surgeon_210k_b');
      expect(surgeonStage?.proportionateDisallowancePaise).toBe(0);
      expect(surgeonStage?.finalItemApprovedPaise).toBe(rupeesToPaise(80000));

      // 3. Pharmacy: 40,000 claimed; 40,000 admissible
      const pharmStage = result.ledger.itemStages.find(s => s.itemId === 'item_pharmacy_210k_b');
      expect(pharmStage?.finalItemApprovedPaise).toBe(rupeesToPaise(40000));

      // 4. Consumables: 16,000 claimed; IRDAI statutory exclusion; 0 admissible
      const consStage = result.ledger.itemStages.find(s => s.itemId === 'item_consumables_210k_b');
      expect(consStage?.excludedNonPayablePaise).toBe(rupeesToPaise(16000));
      expect(consStage?.finalItemApprovedPaise).toBe(0);

      // 5. Diagnostics: 50,000 claimed; 50,000 admissible
      const diagStage = result.ledger.itemStages.find(s => s.itemId === 'item_diag_210k_b');
      expect(diagStage?.proportionateDisallowancePaise).toBe(0);
      expect(diagStage?.finalItemApprovedPaise).toBe(rupeesToPaise(50000));

      // Admissible before deductible: 24k + 80k + 40k + 50k = Rs. 1,94,000
      expect(result.ledger.totalAdmissibleBeforeDeductiblePaise).toBe(rupeesToPaise(194000));

      // Deductible applied: min(1,94,000, 25,000) = Rs. 25,000
      expect(result.ledger.appliedDeductiblePaise).toBe(rupeesToPaise(25000));

      // Admissible post-deductible: 1,94,000 - 25,000 = Rs. 1,69,000
      // 20% non-network copay on 1,69,000 = Rs. 33,800
      expect(result.ledger.appliedCopayPaise).toBe(rupeesToPaise(33800));

      // Insurer settlement: 1,69,000 - 33,800 = Rs. 1,35,200
      expect(result.ledger.finalInsurerPayablePaise).toBe(rupeesToPaise(135200));

      // Patient responsibility: Consumables (16,000) + Deductible (25,000) + Copay (33,800) = Rs. 74,800
      expect(result.ledger.totalPatientResponsibilityPaise).toBe(rupeesToPaise(74800));

      // Zero-discrepancy reconciliation invariant:
      expect(result.ledger.finalInsurerPayablePaise + result.ledger.totalPatientResponsibilityPaise).toBe(rupeesToPaise(210000));
    });
  });
});
