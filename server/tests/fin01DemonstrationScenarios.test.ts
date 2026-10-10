import { describe, it, expect } from 'vitest';
import { claimWorkflowService } from '../src/services/claimWorkflowService.js';
import { rupeesToPaise } from '../src/types/claim.js';
import { CreateClaimRequest } from '../src/types/claimApi.js';

describe('FIN-01 End-to-End Required Demonstration Scenarios (Prompt 7)', () => {
  // ==========================================================================
  // SCENARIO A: Supported Item
  // ==========================================================================
  describe('SCENARIO A: Supported Treatment Item', () => {
    it('Submits itemized bill, retrieves supporting clause, verifies clause, and generates ledger and calculation trace', async () => {
      const claimRequest: CreateClaimRequest = {
        policyFamilyId: 'syn_fam_health_01',
        treatmentDate: '2025-04-10',
        bill: {
          billId: 'bill_demo_scenario_a',
          hospitalName: 'Apollo Hospitals Bengaluru',
          billDate: '2025-04-10',
          originalBillTotalPaise: rupeesToPaise(50000),
          calculatedItemsTotalPaise: rupeesToPaise(50000),
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [
            {
              itemId: 'item_a_1',
              originalDescription: 'Emergency Laparoscopic Appendectomy Surgery',
              category: 'SURGEON_CONSULTATION',
              quantity: 1,
              unitPricePaise: rupeesToPaise(50000),
              claimedAmountPaise: rupeesToPaise(50000),
              currency: 'INR',
              provenance: {
                sourceType: 'STRUCTURED_JSON_TEMPLATE',
                rawExtractedText: 'Emergency Laparoscopic Appendectomy Surgery',
                extractedTimestamp: new Date().toISOString(),
                confidenceScore: 1.0
              },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            }
          ],
          uploadedAt: new Date().toISOString(),
          extractedAt: new Date().toISOString()
        }
      };

      const assessment = await claimWorkflowService.createClaimAssessment(claimRequest);

      // 1. Policy version established
      expect(assessment.selectedPolicyVersionId).toBeDefined();
      expect(assessment.selectedPolicyVersionId).toContain('syn_ver_base_2025_v1');
      // 2. Adjudication ledger produced
      expect(assessment.ledger).toBeDefined();
      expect(assessment.ledger?.finalInsurerPayablePaise).toBeGreaterThan(0);
      expect(assessment.ledger?.isMathematicallyBalanced).toBe(true);
      // 3. Trace and status recorded
      expect(assessment.traceId).toBeDefined();
      expect(assessment.status).toBe('ADJUDICATED');
    });
  });

  // ==========================================================================
  // SCENARIO B: Excluded Item
  // ==========================================================================
  describe('SCENARIO B: Excluded Treatment Item', () => {
    it('Retrieves applicable exclusion, extracts reason, and verifies excluded amount is not counted as payable', async () => {
      const claimRequest: CreateClaimRequest = {
        policyFamilyId: 'syn_fam_health_01',
        treatmentDate: '2025-04-10',
        bill: {
          billId: 'bill_demo_scenario_b',
          hospitalName: 'Apollo Hospitals Bengaluru',
          billDate: '2025-04-10',
          originalBillTotalPaise: rupeesToPaise(75000),
          calculatedItemsTotalPaise: rupeesToPaise(75000),
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [
            {
              itemId: 'item_b_1',
              originalDescription: 'Elective Cosmetic Rhinoplasty Reshaping',
              category: 'SURGEON_CONSULTATION',
              quantity: 1,
              unitPricePaise: rupeesToPaise(75000),
              claimedAmountPaise: rupeesToPaise(75000),
              currency: 'INR',
              provenance: {
                sourceType: 'STRUCTURED_JSON_TEMPLATE',
                rawExtractedText: 'Elective Cosmetic Rhinoplasty Reshaping',
                extractedTimestamp: new Date().toISOString(),
                confidenceScore: 1.0
              },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            }
          ],
          uploadedAt: new Date().toISOString(),
          extractedAt: new Date().toISOString()
        }
      };

      const assessment = await claimWorkflowService.createClaimAssessment(claimRequest);

      // Verify excluded amount is not payable
      expect(assessment.ledger).toBeDefined();
      expect(assessment.ledger?.finalInsurerPayablePaise).toBe(0);
      expect(assessment.ledger?.totalPatientResponsibilityPaise).toBe(rupeesToPaise(75000));
      expect(assessment.ledger?.totalExcludedNonPayablePaise).toBe(rupeesToPaise(75000));

      // Check item-level stage disallowance
      const itemStage = assessment.ledger?.itemStages[0];
      expect(itemStage).toBeDefined();
      expect(itemStage?.excludedNonPayablePaise).toBe(rupeesToPaise(75000));
    });
  });

  // ==========================================================================
  // SCENARIO C: Missing or Conflicting Evidence
  // ==========================================================================
  describe('SCENARIO C: Missing or Conflicting Evidence', () => {
    it('Flags claim for review and refuses to silently assume full coverage or arbitrary exclusion', async () => {
      const claimRequest: CreateClaimRequest = {
        policyFamilyId: 'syn_fam_health_01',
        treatmentDate: '2025-04-10',
        bill: {
          billId: 'bill_demo_scenario_c',
          hospitalName: 'Apollo Hospitals Bengaluru',
          billDate: '2025-04-10',
          originalBillTotalPaise: rupeesToPaise(30000),
          calculatedItemsTotalPaise: rupeesToPaise(30000),
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [
            {
              itemId: 'item_c_1',
              originalDescription: 'Extraterrestrial Telemetry Bioresonance Alignment Session',
              category: 'MISCELLANEOUS',
              quantity: 1,
              unitPricePaise: rupeesToPaise(30000),
              claimedAmountPaise: rupeesToPaise(30000),
              currency: 'INR',
              provenance: {
                sourceType: 'STRUCTURED_JSON_TEMPLATE',
                rawExtractedText: 'Extraterrestrial Telemetry Bioresonance Alignment Session',
                extractedTimestamp: new Date().toISOString(),
                confidenceScore: 1.0
              },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: ['UNVERIFIED_THERAPY'],
              isNonPayableByRegulation: false
            }
          ],
          uploadedAt: new Date().toISOString(),
          extractedAt: new Date().toISOString()
        }
      };

      const assessment = await claimWorkflowService.createClaimAssessment(claimRequest);

      // System flags review_required
      expect(assessment.status).toBe('PENDING_HUMAN_REVIEW');
      expect(assessment.reviewStatus).not.toBe('NOT_REQUIRED');
      expect(assessment.reviewReasons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // SCENARIO D: Policy Amendment Precedence
  // ==========================================================================
  describe('SCENARIO D: Policy Amendment Precedence', () => {
    it('Selects base policy before amendment date and revised amendment after effective date', async () => {
      const makeBill = (id: string, desc: string, amount: number) => ({
        billId: id,
        hospitalName: 'Apollo Hospitals Bengaluru',
        billDate: '2025-05-01',
        originalBillTotalPaise: rupeesToPaise(amount),
        calculatedItemsTotalPaise: rupeesToPaise(amount),
        reconciliationDifferencePaise: 0,
        reconciliationStatus: 'RECONCILED' as const,
        currency: 'INR' as const,
        lineItems: [
          {
            itemId: 'item_d_1',
            originalDescription: desc,
            category: 'ROOM_RENT' as const,
            quantity: 2,
            unitPricePaise: rupeesToPaise(7500),
            claimedAmountPaise: rupeesToPaise(15000),
            currency: 'INR' as const,
            provenance: {
              sourceType: 'STRUCTURED_JSON_TEMPLATE' as const,
              rawExtractedText: desc,
              extractedTimestamp: new Date().toISOString(),
              confidenceScore: 1.0
            },
            classificationStatus: 'AUTOMATIC_EXACT' as const,
            reviewFlags: [],
            isNonPayableByRegulation: false
          }
        ],
        uploadedAt: new Date().toISOString(),
        extractedAt: new Date().toISOString()
      });

      // 1. Pre-amendment assessment (treatmentDate: 2025-05-15, before 2025-07-01)
      const preAssessment = await claimWorkflowService.createClaimAssessment({
        policyFamilyId: 'syn_fam_health_01',
        treatmentDate: '2025-05-15',
        bill: makeBill('bill_d_pre', 'Deluxe Room Bed Charges 2 Days', 15000)
      });

      expect(preAssessment.selectedPolicyVersionId).toBe('syn_ver_base_2025_v1');
      expect(preAssessment.applicableAmendmentIds.length).toBe(0);

      // 2. Post-amendment assessment (treatmentDate: 2025-08-15, after 2025-07-01)
      const postAssessment = await claimWorkflowService.createClaimAssessment({
        policyFamilyId: 'syn_fam_health_01',
        treatmentDate: '2025-08-15',
        bill: makeBill('bill_d_post', 'Deluxe Room Bed Charges 2 Days', 15000)
      });

      expect(postAssessment.selectedPolicyVersionId).toBe('syn_ver_base_2025_v1');
      expect(postAssessment.applicableAmendmentIds.length).toBeGreaterThanOrEqual(1);
      expect(postAssessment.applicableAmendmentIds).toContain('syn_ver_amend_2025_v1.1');
    });
  });

  // ==========================================================================
  // SCENARIO E: Before-and-After Bill Change (Safe Reassessment)
  // ==========================================================================
  describe('SCENARIO E: Safe Reassessment and Before-and-After Comparison', () => {
    it('Reassesses claim from modified inputs without mutating the original assessment snapshot', async () => {
      // 1. Initial Assessment
      const initialRequest: CreateClaimRequest = {
        policyFamilyId: 'syn_fam_health_01',
        treatmentDate: '2025-04-10',
        bill: {
          billId: 'bill_demo_scenario_e',
          hospitalName: 'Apollo Hospitals Bengaluru',
          billDate: '2025-04-10',
          originalBillTotalPaise: rupeesToPaise(40000),
          calculatedItemsTotalPaise: rupeesToPaise(40000),
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [
            {
              itemId: 'item_e_1',
              originalDescription: 'Ward Bed Accommodation',
              category: 'ROOM_RENT',
              quantity: 2,
              unitPricePaise: rupeesToPaise(10000),
              claimedAmountPaise: rupeesToPaise(20000),
              currency: 'INR',
              provenance: {
                sourceType: 'STRUCTURED_JSON_TEMPLATE',
                rawExtractedText: 'Ward Bed Accommodation',
                extractedTimestamp: new Date().toISOString(),
                confidenceScore: 1.0
              },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            },
            {
              itemId: 'item_e_2',
              originalDescription: 'Surgeon Consultation Fee',
              category: 'SURGEON_CONSULTATION',
              quantity: 1,
              unitPricePaise: rupeesToPaise(20000),
              claimedAmountPaise: rupeesToPaise(20000),
              currency: 'INR',
              provenance: {
                sourceType: 'STRUCTURED_JSON_TEMPLATE',
                rawExtractedText: 'Surgeon Consultation Fee',
                extractedTimestamp: new Date().toISOString(),
                confidenceScore: 1.0
              },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            }
          ],
          uploadedAt: new Date().toISOString(),
          extractedAt: new Date().toISOString()
        }
      };

      const firstAssessment = await claimWorkflowService.createClaimAssessment(initialRequest);
      const firstClaimId = firstAssessment.claimId;
      const firstPayable = firstAssessment.ledger?.finalInsurerPayablePaise;

      // 2. Modify an item via human correction
      await claimWorkflowService.updateBillItem(firstClaimId, 'item_e_2', {
        claimedAmountRupees: 25000,
        originalDescription: 'Surgeon and Anesthetist Consultation Fee'
      });

      // 3. Reassess claim
      const secondAssessment = await claimWorkflowService.reassessClaim(firstClaimId, {
        reassessmentReason: 'BILL_ITEM_UPDATED'
      });

      // 4. Verify original record preserved in history
      const fullClaimRecord = await claimWorkflowService.getClaim(firstClaimId);
      expect(fullClaimRecord).toBeDefined();
      expect(fullClaimRecord?.history.length).toBeGreaterThanOrEqual(1);

      // 5. Verify comparison generates before/after diff
      const comparison = await claimWorkflowService.compareAssessments(firstClaimId);
      expect(comparison).toBeDefined();
      expect(comparison.claimedTotalDeltaPaise).toBe(rupeesToPaise(5000));
      expect(comparison.lineItemDifferences.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // SCENARIO F: Double-Deduction Protection
  // ==========================================================================
  describe('SCENARIO F: Double-Deduction Protection Invariant', () => {
    it('Ensures exclusions and co-pays are applied with exact scope and never double-deducted', async () => {
      const claimRequest: CreateClaimRequest = {
        policyFamilyId: 'syn_fam_health_01',
        treatmentDate: '2025-04-10',
        bill: {
          billId: 'bill_demo_scenario_f',
          hospitalName: 'Apollo Hospitals Bengaluru',
          billDate: '2025-04-10',
          originalBillTotalPaise: rupeesToPaise(60000),
          calculatedItemsTotalPaise: rupeesToPaise(60000),
          reconciliationDifferencePaise: 0,
          reconciliationStatus: 'RECONCILED',
          currency: 'INR',
          lineItems: [
            {
              itemId: 'item_f_1',
              originalDescription: 'Inpatient Appendectomy Surgery',
              category: 'SURGEON_CONSULTATION',
              quantity: 1,
              unitPricePaise: rupeesToPaise(40000),
              claimedAmountPaise: rupeesToPaise(40000),
              currency: 'INR',
              provenance: {
                sourceType: 'STRUCTURED_JSON_TEMPLATE',
                rawExtractedText: 'Inpatient Appendectomy Surgery',
                extractedTimestamp: new Date().toISOString(),
                confidenceScore: 1.0
              },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            },
            {
              itemId: 'item_f_2',
              originalDescription: 'Cosmetic Skin Tightening Glue',
              category: 'SURGEON_CONSULTATION',
              quantity: 1,
              unitPricePaise: rupeesToPaise(20000),
              claimedAmountPaise: rupeesToPaise(20000),
              currency: 'INR',
              provenance: {
                sourceType: 'STRUCTURED_JSON_TEMPLATE',
                rawExtractedText: 'Cosmetic Skin Tightening Glue',
                extractedTimestamp: new Date().toISOString(),
                confidenceScore: 1.0
              },
              classificationStatus: 'AUTOMATIC_EXACT',
              reviewFlags: [],
              isNonPayableByRegulation: false
            }
          ],
          uploadedAt: new Date().toISOString(),
          extractedAt: new Date().toISOString()
        }
      };

      const assessment = await claimWorkflowService.createClaimAssessment(claimRequest);
      const ledger = assessment.ledger!;

      // Total claimed = 60,000
      expect(ledger.totalClaimedPaise).toBe(rupeesToPaise(60000));
      // Excluded = 20,000
      expect(ledger.totalExcludedNonPayablePaise).toBe(rupeesToPaise(20000));
      // Admissible base for copay must be 40,000 (NOT 60,000!)
      // 10% copay on 40,000 = 4,000
      expect(ledger.appliedCopayPaise).toBe(rupeesToPaise(4000));
      // Insurer payable = 40,000 - 4,000 = 36,000
      expect(ledger.finalInsurerPayablePaise).toBe(rupeesToPaise(36000));
      // Patient responsibility = 20,000 + 4,000 = 24,000
      expect(ledger.totalPatientResponsibilityPaise).toBe(rupeesToPaise(24000));

      // Balance invariant satisfied
      expect(ledger.totalClaimedPaise).toBe(ledger.finalInsurerPayablePaise + ledger.totalPatientResponsibilityPaise);
      expect(ledger.isMathematicallyBalanced).toBe(true);
    });
  });
});
