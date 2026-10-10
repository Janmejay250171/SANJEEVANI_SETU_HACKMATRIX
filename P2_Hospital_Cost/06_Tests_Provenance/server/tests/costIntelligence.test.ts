import { describe, it, expect, beforeAll } from 'vitest';
import { costIntelligenceService } from '../src/services/costIntelligenceService.js';
import { normalizeProcedure } from '../src/services/procedureNormalizerService.js';
import { hospitalService } from '../src/services/hospitalService.js';
import { PolicyDocument } from '../src/types/policy.js';

const mockHdfcPolicy: PolicyDocument = {
  policyNumber: 'HDFC-ERGO-001',
  insurer: 'HDFC ERGO General Insurance Company Limited',
  insurerAliases: ['HDFC ERGO', 'HDFC'],
  policyType: 'retail',
  sumInsured: 500000,
  roomRentLimit: {
    type: 'percent',
    value: 1, // 1% of SI = 5,000/day
    rawText: '1% of Sum Insured per day'
  },
  icuRentLimit: {
    type: 'percent',
    value: 2, // 2% of SI = 10,000/day
    rawText: '2% of Sum Insured per day'
  },
  copay: {
    type: 'network_tiered',
    value: 0,
    rawText: '0% co-pay for network hospitals; non-network terms not stated'
  },
  deductible: {
    type: 'none',
    value: 0
  },
  exclusions: ['Cosmetic Surgery', 'Dental Treatment', 'Alternative Medicine']
};

const insufficientPolicy: PolicyDocument = {
  ...mockHdfcPolicy,
  sumInsured: null, // Sum insured missing / unstated
  copay: null,
  nonNetworkCopay: null
};

const sufficientPolicy: PolicyDocument = {
  ...mockHdfcPolicy,
  sumInsured: 500000,
  copay: 0,
  roomRentLimit: { type: 'percent', value: 1 }
};

describe('FIN-01 Cost Intelligence Engine Test Suite', () => {
  beforeAll(async () => {
    await hospitalService.initData();
  });

  // 1. Procedure Normalization
  describe('1. Procedure Normalization Layer', () => {
    it('normalizes TKR and clinical synonyms to canonical Total Knee Replacement', () => {
      const aliases = ['TKR', 'Total Knee Replacement', 'Total Knee Arthroplasty', 'TKR-UNI'];
      for (const alias of aliases) {
        const norm = normalizeProcedure(alias);
        expect(norm.matched).toBe(true);
        expect(norm.canonical_procedure_name).toBe('Total Knee Replacement');
        expect(norm.procedure_code).toBe('TKR-UNI');
      }
    });

    it('normalizes Cataract Surgery with Phacoemulsification', () => {
      const aliases = ['Cataract', 'Cataract Surgery', 'Phacoemulsification', 'Phaco with Foldable IOL'];
      for (const alias of aliases) {
        const norm = normalizeProcedure(alias);
        expect(norm.matched).toBe(true);
        expect(norm.canonical_procedure_name).toBe('Cataract Surgery');
        expect(norm.procedure_code).toBe('CAT-PHACO');
      }
    });

    it('normalizes Angioplasty (PTCA + 1 DES)', () => {
      const aliases = ['Angioplasty', 'Coronary Angioplasty', 'PTCA with Stent', 'Coronary Stent'];
      for (const alias of aliases) {
        const norm = normalizeProcedure(alias);
        expect(norm.matched).toBe(true);
        expect(norm.canonical_procedure_id).toBe('ANGIOPLASTY_PTCA_1_DES');
        expect(norm.canonical_procedure_name).toBe('Angioplasty (PTCA + 1 DES)');
      }
    });

    it('preserves unrecognized procedure as raw without false canonical mapping', () => {
      const norm = normalizeProcedure('Experimental Gene Therapy');
      expect(norm.matched).toBe(false);
      expect(norm.canonical_procedure_name).toBe('Experimental Gene Therapy');
      expect(norm.procedure_code).toBe('');
    });
  });

  // 2. Hospital-Specific Cost Selection (Level A)
  describe('2. Hospital-Specific Cost Selection', () => {
    it('deactivates unverified hospital tariffs so they cannot be selected as authoritative Level A (Sancheti Hospital Pune)', () => {
      const b = costIntelligenceService.getBenchmarkById('COST_HOSP_001');
      expect(b).toBeDefined();
      expect(b?.source_status).toBe('UNVERIFIED');
      expect(b?.active).toBe(false);

      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Sancheti Hospital',
        city: 'Pune',
        specialty: 'Orthopaedics',
        procedure: 'Knee Replacement',
        policy: mockHdfcPolicy,
        networkStatus: 'verified',
        roomType: 'Twin Sharing'
      });

      // Cannot be selected as hospital_specific Level A
      expect(est.benchmarkLevel).not.toBe('hospital_specific');
      // Falls back to verified Level D statutory package rate (₹80,000)
      expect(est.available).toBe(true);
      expect(est.benchmarkLevel).toBe('government_package');
      expect(est.isGovernmentPackageOnly).toBe(true);
      expect(est.exactPackageRate).toBe(80000);
    });
  });

  // 3. Regional / Maharashtra Fallback (Level B)
  describe('3. Regional / State Fallback', () => {
    it('deactivates unverified Maharashtra state benchmarks and refuses to fabricate estimates', () => {
      const b = costIntelligenceService.getBenchmarkById('COST_STATE_005');
      expect(b).toBeDefined();
      expect(b?.source_status).toBe('UNVERIFIED');
      expect(b?.active).toBe(false);

      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Generic Community Hospital',
        city: 'Pune',
        specialty: 'General Surgery',
        procedure: 'Gallbladder Surgery (Cholecystectomy)',
        policy: mockHdfcPolicy,
        networkStatus: 'verified',
        roomType: 'Twin Sharing'
      });

      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
      expect(est.benchmarkLevel).toBe('unavailable');
    });
  });

  // 4. National Fallback (Level C)
  describe('4. National Healthcare Benchmark Fallback', () => {
    it('deactivates unverified National Benchmarks and rejects invalid CABG code MC013A', () => {
      const natB = costIntelligenceService.getBenchmarkById('COST_NAT_003');
      expect(natB?.source_status).toBe('UNVERIFIED');
      expect(natB?.active).toBe(false);

      const govtB = costIntelligenceService.getBenchmarkById('COST_GOVT_003');
      expect(govtB?.source_status).toBe('VALUE_NOT_SUPPORTED');
      expect(govtB?.active).toBe(false);

      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Apex Heart Center',
        city: 'Jaipur',
        specialty: 'Cardiology',
        procedure: 'Coronary Artery Bypass Graft (CABG)',
        policy: mockHdfcPolicy,
        networkStatus: 'verified',
        roomType: 'Single Private Room'
      });

      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
      expect(est.benchmarkLevel).toBe('unavailable');
    });
  });

  // 5. Government Package Reference (Level D)
  describe('5. Government Package Reference Rates', () => {
    it('preserves PM-JAY package rate as reference without fabricating private hospital bill', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'District Civil Hospital',
        city: 'Pune',
        specialty: 'Orthopaedics',
        procedure: 'Knee Replacement',
        policy: { ...mockHdfcPolicy, policyType: 'pmjay' },
        networkStatus: 'verified',
        roomType: 'General Ward'
      });

      expect(est.available).toBe(true);
      expect(est.disclaimer).toContain('AB-PMJAY');
      expect(est.disclaimer).toContain('government package reference');
    });
  });

  // 6. No-Data Behavior (MUST NEVER FABRICATE)
  describe('6. No-Data Rejection & Anti-Hallucination', () => {
    it('refuses to estimate and returns available=false when no benchmark exists', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Random Clinic',
        city: 'Indore',
        specialty: 'Oncology',
        procedure: 'Experimental Proton Beam Radiation',
        policy: mockHdfcPolicy,
        networkStatus: 'verified',
        roomType: 'Twin Sharing'
      });

      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
      expect(est.treatmentCostRange.min).toBe(0);
      expect(est.treatmentCostRange.max).toBe(0);
      expect(est.treatmentCostRange.displayRange).toBe('No reliable cost benchmark');
      expect(est.oopReliable).toBe(false);
    });

    it('rejects completely unknown procedures without guessing numbers', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'City Hospital',
        city: 'Pune',
        procedure: 'NonExistentProcedure12345',
        policy: mockHdfcPolicy,
        networkStatus: 'verified'
      });

      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBeDefined();
    });
  });

  // 7. Policy Room Rent & Proportionate Disallowance
  describe('7. Policy-Aware Room Rent & Proportionate Deduction', () => {
    it('applies proportionate disallowance when room rate exceeds policy limit (5,000/day limit on 5L SI)', () => {
      const res = costIntelligenceService.recalculateScenario({
        hospitalName: 'Sancheti Hospital',
        city: 'Pune',
        procedure: 'Knee Replacement',
        policy: mockHdfcPolicy,
        baseScenario: {
          roomType: 'Single Private Room',
          simulatedRoomRate: 8000, // 3000 excess per day over 5000 limit
          networkStatus: 'verified'
        },
        newScenario: {
          roomType: 'Twin Sharing',
          simulatedRoomRate: 4000, // Within 5000 limit
          networkStatus: 'verified'
        }
      });

      expect(res.available).toBe(true);
      expect(res.baseEstimate.available).toBe(true);
      expect(res.newEstimate.available).toBe(true);

      // In base scenario with ₹8,000/day room, proportionate disallowance is triggered
      expect(res.baseEstimate.policyConstraintsApplied.some(c => c.includes('Proportionate disallowance'))).toBe(true);

      // In new scenario with ₹4,000/day room, room rent is within limit
      expect(res.newEstimate.policyConstraintsApplied.some(c => c.includes('within policy limit'))).toBe(true);

      // What changed explanation should reflect room rate reduction
      expect(res.whatChanged.some(c => c.includes('Room Category'))).toBe(true);
    });
  });

  // 8. Co-payment Application
  describe('8. Co-payment Logic', () => {
    it('applies 0% co-pay for network hospital under HDFC ERGO policy', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Sancheti Hospital',
        city: 'Pune',
        procedure: 'Knee Replacement',
        policy: mockHdfcPolicy,
        networkStatus: 'verified',
        roomType: 'Twin Sharing'
      });

      expect(est.policyConstraintsApplied.some(p => p.includes('0% network co-payment'))).toBe(true);
    });

    it('does not assume non-network co-pay when unstated in policy, flagging as missing information', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Sancheti Hospital',
        city: 'Pune',
        procedure: 'Knee Replacement',
        policy: mockHdfcPolicy,
        networkStatus: 'no_match',
        roomType: 'Twin Sharing'
      });

      expect(est.policyConstraintsApplied.some(p => p.includes('Non-network co-payment not stated'))).toBe(true);
      expect(est.missingInformation.some(m => m.includes('Non-network co-payment terms'))).toBe(true);
      expect(est.oopReliable).toBe(false);
    });
  });

  // 9. Missing Information Handling
  describe('9. Missing Information Transparency', () => {
    it('flags unselected room category and unstated non-network terms instead of inventing defaults', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Generic Hospital',
        city: 'Pune',
        procedure: 'Cataract Surgery',
        policy: mockHdfcPolicy,
        networkStatus: 'unverified'
      });

      expect(est.missingInformation.length).toBeGreaterThan(0);
      expect(est.whyThisEstimate.some(w => w.includes('Missing Information'))).toBe(true);
    });
  });

  // 10. Scenario Recalculation ("What Changed?")
  describe('10. Scenario Recalculation & Differential Explanation', () => {
    it('computes exact differential when shifting from non-network to network hospital', () => {
      const res = costIntelligenceService.recalculateScenario({
        hospitalName: 'Sancheti Hospital',
        city: 'Pune',
        procedure: 'Knee Replacement',
        policy: mockHdfcPolicy,
        baseScenario: {
          networkStatus: 'no_match',
          roomType: 'Twin Sharing'
        },
        newScenario: {
          networkStatus: 'verified',
          roomType: 'Twin Sharing'
        }
      });

      expect(res.available).toBe(true);
      expect(res.whatChanged.length).toBeGreaterThan(0);
      expect(res.whatChanged.some(c => c.includes('Network Status'))).toBe(true);
    });
  });

  // 11. Range Consistency & Validation
  describe('11. Cost Range Integrity', () => {
    it('guarantees min <= typical <= max across all benchmarks in dataset', () => {
      const benchmarks = costIntelligenceService.getAllBenchmarks();
      expect(benchmarks.length).toBeGreaterThan(0);

      for (const b of benchmarks) {
        expect(b.cost_low).toBeGreaterThan(0);
        expect(b.cost_high).toBeGreaterThan(0);
        expect(b.cost_low).toBeLessThanOrEqual(b.cost_high);
        if (b.cost_typical > 0) {
          expect(b.cost_low).toBeLessThanOrEqual(b.cost_typical);
          expect(b.cost_typical).toBeLessThanOrEqual(b.cost_high);
        }
        expect(b.currency).toBe('INR');
        expect(b.data_year).toBeGreaterThanOrEqual(2020);
        expect(b.source_name).toBeDefined();
        expect(b.source_name.length).toBeGreaterThan(0);
      }
    });
  });

  // 12. Four-Scenario FIN-01 UI & Fallback Matrix
  describe('12. Four-Scenario FIN-01 UI & Fallback Matrix', () => {
    // Scenario A: Cardiology + All Procedures -> Ask user to select a procedure.
    it('Scenario A: Cardiology + All Procedures asks user to select a procedure', () => {
      const est1 = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'All Procedures in this Dept',
        hospitalName: 'Ruby Hall Clinic',
        city: 'Pune'
      });

      expect(est1.available).toBe(false);
      expect(est1.isProcedureUnselected).toBe(true);
      expect(est1.unavailableReason).toBe('Select a procedure for cost estimation');
      expect(est1.disclaimer).toBe(
        'Hospital matching is available for this specialty, but treatment cost depends on the specific procedure. Select a procedure to view an evidence-backed cost benchmark.'
      );

      const est2 = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: '',
        hospitalName: 'Ruby Hall Clinic',
        city: 'Pune'
      });
      expect(est2.available).toBe(false);
      expect(est2.isProcedureUnselected).toBe(true);
      expect(est2.unavailableReason).toBe('Select a procedure for cost estimation');
    });

    // Scenario B: Procedure without verified benchmark -> Sanjeevani Setu refuses to guess
    it('Scenario B: Procedure without verified benchmark refuses to guess', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'Angioplasty',
        hospitalName: 'Sahyadri Super Speciality Hospital',
        city: 'Pune',
        state: 'Maharashtra',
        policy: mockHdfcPolicy,
        networkStatus: 'verified'
      });

      expect(est.available).toBe(false);
      expect(est.benchmarkLevel).toBe('unavailable');
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
      expect(est.treatmentCostRange.low).toBe(0);
      expect(est.treatmentCostRange.high).toBe(0);
    });

    // Scenario C: Procedure with verified Government Scheme Package Reference (e.g. Total Knee Replacement)
    it('Scenario C: Procedure with verified Government Scheme Package Reference returns exact statutory rate', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        hospitalName: 'Ruby Hall Clinic',
        city: 'Pune',
        policy: mockHdfcPolicy,
        networkStatus: 'verified'
      });

      expect(est.available).toBe(true);
      expect(est.benchmarkLevel).toBe('government_package');
      expect(est.isGovernmentPackageOnly).toBe(true);
      expect(est.exactPackageRate).toBe(80000);
      expect(est.treatmentCostRange.low).toBe(80000);
      expect(est.treatmentCostRange.high).toBe(80000);
      expect(est.treatmentCostRange.typical).toBe(80000);
      expect(est.treatmentCostRange.displayRange).toContain('₹80,000');
      expect(est.disclaimer).toContain('Statutory government package reference');
    });

    // Scenario D: Unsupported procedure -> "Insufficient reliable cost data. Sanjeevani Setu will not guess."
    it('Scenario D: Unsupported procedure returns "Insufficient reliable cost data. Sanjeevani Setu will not guess."', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Neurosurgery',
        procedure: 'Robotic Stereotactic Radiosurgery 7D',
        hospitalName: 'Ruby Hall Clinic',
        city: 'Pune',
        policy: mockHdfcPolicy
      });

      expect(est.available).toBe(false);
      expect(est.isProcedureUnselected).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
      expect(est.disclaimer).toContain('does not currently have verified evidence');
      expect(est.benchmarkLevel).toBe('unavailable');
      expect(est.treatmentCostRange.low).toBe(0);
      expect(est.treatmentCostRange.high).toBe(0);
    });
  });

  // =========================================================================
  // 13. Section 9 Dedicated Automated Tests: Angiography != Angioplasty
  // =========================================================================
  describe('13. Procedure Taxonomy & Distinction: Angiography vs Angioplasty (FIN-01 Section 9)', () => {
    // TEST 1: Angiography != Angioplasty
    it('TEST 1: Angiography != Angioplasty (clinical distinction preserved)', () => {
      const normAngio = normalizeProcedure('Angiography', 'Cardiology');
      const normPlasty = normalizeProcedure('Angioplasty (PTCA + 1 DES)', 'Cardiology');

      expect(normAngio.canonical_procedure_id).not.toBe(normPlasty.canonical_procedure_id);
      expect(normAngio.canonical_procedure_id).toBe('ANGIOGRAPHY');
      expect(normPlasty.canonical_procedure_id).toBe('ANGIOPLASTY_PTCA_1_DES');
      expect(normAngio.procedure_code).toBe('CAG-DIAG');
      expect(normPlasty.procedure_code).toBe('PTCA-1DES');
      expect(normAngio.canonical_procedure_name).toBe('Angiography');
      expect(normPlasty.canonical_procedure_name).toBe('Angioplasty (PTCA + 1 DES)');
      expect(normAngio.clinical_description).toBe('Diagnostic vascular imaging');
      expect(normPlasty.clinical_description).toBe('Coronary intervention with one drug-eluting stent');
    });

    // TEST 2: Angiography must not use Angioplasty cost
    it('TEST 2: Angiography must not use Angioplasty cost and returns conservative refusal', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'Angiography',
        city: 'Delhi',
        policy: mockHdfcPolicy
      });

      expect(est.available).toBe(false);
      expect(est.canonicalProcedureId).toBe('ANGIOGRAPHY');
      expect(est.unavailableReason).toBe('Insufficient reliable cost data for Angiography.');
      expect(est.disclaimer).toBe(
        'No verified cost benchmark is currently available for Angiography. Sanjeevani Setu will not substitute an Angioplasty benchmark because the procedures are clinically different.'
      );
      expect(est.treatmentCostRange.low).toBe(0);
      expect(est.treatmentCostRange.high).toBe(0);
      expect(est.whyThisEstimate).toContain(
        'Angiography is selected, but Sanjeevani Setu currently has no verified cost benchmark for this procedure.'
      );
      expect(est.whyThisEstimate).toContain(
        'No verified cost benchmark is currently available for Angiography. Sanjeevani Setu will not substitute an Angioplasty benchmark because the procedures are clinically different.'
      );
    });

    // TEST 3: Cardiology + Angiography correctly reports 0 procedure matches if dataset contains none
    it('TEST 3: Cardiology + Angiography correctly reports 0 procedure matches in Delhi', () => {
      const res = hospitalService.search({
        city: 'Delhi',
        specialty: 'Cardiology',
        procedure: 'Angiography',
        policy: mockHdfcPolicy,
        networkOnly: false
      });

      expect(res.specialtyMatchedCount).toBe(22);
      expect(res.procedureMatchedCount).toBe(0);
      expect(res.hospitals.length).toBeGreaterThan(0);
      // All hospital estimates should report available: false with the Angiography warning
      for (const item of res.hospitals) {
        expect(item.estimate.available).toBe(false);
        expect(item.estimate.costIntelligence?.canonicalProcedureId).toBe('ANGIOGRAPHY');
        expect(item.estimate.costIntelligence?.unavailableReason).toBe('Insufficient reliable cost data for Angiography.');
      }
    });

    // TEST 4: Angioplasty with invalid government code MC010A and unverified citations is rejected
    it('TEST 4: Angioplasty refuses to estimate when all benchmarks are unverified or miscoded', () => {
      const govtB = costIntelligenceService.getBenchmarkById('COST_GOVT_004');
      expect(govtB?.source_status).toBe('VALUE_NOT_SUPPORTED');
      expect(govtB?.active).toBe(false);

      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'Angioplasty',
        city: 'Delhi',
        policy: mockHdfcPolicy
      });

      expect(est.available).toBe(false);
      expect(est.canonicalProcedureId).toBe('ANGIOPLASTY_PTCA_1_DES');
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
      expect(est.treatmentCostRange.low).toBe(0);
      expect(est.treatmentCostRange.high).toBe(0);
    });

    // TEST 5: Unverified Ruby Hall Angioplasty tariff cannot be selected
    it('TEST 5: Unverified Ruby Hall Angioplasty tariff is deactivated and not selected', () => {
      const hospB = costIntelligenceService.getBenchmarkById('COST_HOSP_004');
      expect(hospB?.source_status).toBe('UNVERIFIED');
      expect(hospB?.active).toBe(false);

      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'Angioplasty',
        hospitalName: 'Ruby Hall Clinic',
        city: 'Pune',
        policy: mockHdfcPolicy
      });

      expect(est.available).toBe(false);
      expect(est.benchmarkLevel).toBe('unavailable');
    });

    // TEST 6: Unverified Maharashtra regional Angioplasty benchmark cannot be selected
    it('TEST 6: Unverified Maharashtra regional Angioplasty benchmark is deactivated and not selected', () => {
      const stateB = costIntelligenceService.getBenchmarkById('COST_STATE_004');
      expect(stateB?.source_status).toBe('UNVERIFIED');
      expect(stateB?.active).toBe(false);

      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'Angioplasty',
        hospitalName: 'Sahyadri Super Speciality Hospital',
        city: 'Pune',
        state: 'Maharashtra',
        policy: mockHdfcPolicy
      });

      expect(est.available).toBe(false);
      expect(est.benchmarkLevel).toBe('unavailable');
    });

    // TEST 7: If no benchmark exists, system refuses to guess
    it('TEST 7: If no benchmark exists, system refuses to guess', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'Experimental Cardiac Stem Cell Infusion 9000',
        city: 'Delhi',
        policy: mockHdfcPolicy
      });

      expect(est.available).toBe(false);
      expect(est.treatmentCostRange.low).toBe(0);
      expect(est.treatmentCostRange.high).toBe(0);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
      expect(est.disclaimer).toContain('does not currently have verified evidence');
    });
  });

  // =========================================================================
  // 14. FIN-01 Financial Independence & Procedure Matching: Six Critical Cases
  // =========================================================================
  describe('14. FIN-01 Critical Review: Six Financial Independence & Procedure Match Test Cases', () => {
    // Case 1: Treatment cost available + policy insufficient
    // → Treatment cost shown
    // → Covered amount unavailable
    // → Patient responsibility unavailable
    it('Case 1: Treatment cost available + policy insufficient -> Treatment cost shown, Covered amount unavailable, Patient OOP unavailable', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'District Hospital',
        city: 'Pune',
        state: 'Maharashtra',
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: insufficientPolicy,
        networkStatus: 'verified'
      });

      // Treatment cost benchmark IS available and shown (Level D statutory package)
      expect(est.available).toBe(true);
      expect(est.benchmarkLevel).toBe('government_package');
      expect(est.isGovernmentPackageOnly).toBe(true);
      expect(est.treatmentCostRange.low).toBe(80000);
      expect(est.treatmentCostRange.high).toBe(80000);
      expect(est.treatmentCostRange.displayRange).toContain('₹80,000');

      // But covered amount and patient OOP MUST be unavailable (never assign treatment cost to insurer)
      expect(est.potentiallyCoveredRange).toBeNull();
      expect(est.estimatedPatientOopRange).toBeNull();
      expect(est.coveredReliable).toBe(false);
      expect(est.oopReliable).toBe(false);
      expect(est.policyCoverageUnavailableReason).toBe('Policy-adjusted coverage/OOP unavailable with current information.');
      expect(est.missingInformation.some(m => m.includes('Sum insured'))).toBe(true);
      expect(est.disclaimer).toContain('Statutory government package reference');
    });

    // Case 2: Treatment cost available + sufficient policy rules
    // → Calculate potentially covered amount
    // → Calculate patient responsibility
    // → Explain calculation
    it('Case 2: Treatment cost available + sufficient policy rules -> Calculate potentially covered and patient OOP with full explanation', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'District Hospital',
        city: 'Pune',
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: sufficientPolicy,
        networkStatus: 'verified',
        roomType: 'General Ward'
      });

      expect(est.available).toBe(true);
      expect(est.coveredReliable).toBe(true);
      expect(est.oopReliable).toBe(true);
      expect(est.potentiallyCoveredRange).not.toBeNull();
      expect(est.estimatedPatientOopRange).not.toBeNull();

      // Calculation verified: 0% copay, room rent within limit, cost within 5L SI
      expect(est.potentiallyCoveredRange?.low).toBe(80000);
      expect(est.potentiallyCoveredRange?.high).toBe(80000);
      expect(est.estimatedPatientOopRange?.low).toBe(0);
      expect(est.estimatedPatientOopRange?.high).toBe(0);
      expect(est.estimatedPatientOopRange?.displayRange).toBe('₹0');
      expect(est.whyThisEstimate.some(w => w.includes('0% network co-payment'))).toBe(true);
      expect(est.whyThisEstimate.some(w => w.includes('Sum Insured'))).toBe(true);
    });

    // Case 3: No treatment cost benchmark
    // → Cost unavailable
    // → Covered amount unavailable
    // → Patient responsibility unavailable
    it('Case 3: No treatment cost benchmark -> Cost unavailable, Covered unavailable, Patient OOP unavailable', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Apollo Hospital',
        city: 'Delhi',
        specialty: 'Cardiology',
        procedure: 'Unpublished Experimental Gene Therapy 2099',
        policy: sufficientPolicy,
        networkStatus: 'verified'
      });

      expect(est.available).toBe(false);
      expect(est.treatmentCostRange.low).toBe(0);
      expect(est.treatmentCostRange.high).toBe(0);
      expect(est.treatmentCostRange.displayRange).toBe('No reliable cost benchmark');
      expect(est.potentiallyCoveredRange).toBeNull();
      expect(est.estimatedPatientOopRange).toBeNull();
      expect(est.coveredReliable).toBe(false);
      expect(est.oopReliable).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
    });

    // Case 4: Specialty match but no procedure evidence
    // → Specialty match shown
    // → Procedure match = 0
    // → Do not estimate hospital-specific procedure cost
    it('Case 4: Specialty match but no procedure evidence -> Specialty match shown, Procedure match = 0, No fabricated cost', () => {
      const res = hospitalService.search({
        city: 'Delhi',
        specialty: 'Cardiology',
        procedure: 'Angiography',
        policy: sufficientPolicy
      });

      // Specialty matches exist
      expect(res.specialtyMatchedCount).toBe(22);
      // But procedure matches must be strictly 0 because no procedure-level evidence exists
      expect(res.procedureMatchedCount).toBe(0);

      // Hospital cards must NOT fabricate hospital-specific procedure cost
      for (const item of res.hospitals) {
        expect(item.estimate.available).toBe(false);
        expect(item.estimate.costIntelligence?.canonicalProcedureId).toBe('ANGIOGRAPHY');
        expect(item.estimate.costIntelligence?.coveredReliable).toBe(false);
        expect(item.estimate.costIntelligence?.oopReliable).toBe(false);
      }
    });

    // Case 5: Unverified hospital-specific tariff cannot be selected
    it('Case 5: Unverified hospital-specific tariff cannot be selected as authoritative Level A (Ruby Hall)', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Ruby Hall Clinic',
        city: 'Pune',
        specialty: 'Cardiology',
        procedure: 'Angioplasty',
        policy: sufficientPolicy,
        networkStatus: 'verified'
      });

      expect(est.benchmarkLevel).not.toBe('hospital_specific');
      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
    });

    // Case 6: Unverified Maharashtra regional benchmark cannot be selected
    it('Case 6: Unverified Maharashtra regional benchmark cannot be selected as authoritative Level B', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Sahyadri Super Speciality Hospital',
        city: 'Pune',
        state: 'Maharashtra',
        specialty: 'General Surgery',
        procedure: 'Laparoscopic Cholecystectomy',
        policy: sufficientPolicy,
        networkStatus: 'verified'
      });

      expect(est.benchmarkLevel).not.toBe('state_benchmark');
      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
    });
  });

  // 10. FIN-01 Finalization Coverage & Invariance Suite (Master Requirements)
  describe('10. FIN-01 Finalization Verification & Clinical Invariance', () => {
    it('1. Supported procedure (Total Hip Replacement) returns evidence-backed Government Package Reference', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Sancheti Hospital',
        city: 'Pune',
        specialty: 'Orthopedics',
        procedure: 'Hip Replacement',
        policy: sufficientPolicy,
        networkStatus: 'verified'
      });
      expect(est.available).toBe(true);
      expect(est.benchmarkLevel).toBe('government_package');
      expect(est.canonicalProcedureId).toBe('TOTAL_HIP_REPLACEMENT');
      expect(est.exactPackageRate).toBe(90000);
      expect(est.treatmentCostRange.low).toBe(90000);
      expect(est.treatmentCostRange.high).toBe(90000);
      expect(est.isGovernmentPackageOnly).toBe(true);
      expect(est.disclaimer).toContain('Statutory government package reference');
    });

    it('2. Supported procedure (TURP for BPH in Urology) returns verified statutory package rate', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Ruby Hall Clinic',
        city: 'Pune',
        specialty: 'Urology',
        procedure: 'TURP',
        policy: sufficientPolicy,
        networkStatus: 'verified'
      });
      expect(est.available).toBe(true);
      expect(est.benchmarkLevel).toBe('government_package');
      expect(est.canonicalProcedureId).toBe('TURP_BPH');
      expect(est.exactPackageRate).toBe(18000);
      expect(est.treatmentCostRange.low).toBe(18000);
      expect(est.treatmentCostRange.high).toBe(18000);
    });

    it('3. Supported procedure (Tympanoplasty in ENT) returns verified statutory package rate', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'General Hospital',
        city: 'Pune',
        specialty: 'ENT',
        procedure: 'Tympanoplasty',
        policy: sufficientPolicy,
        networkStatus: 'verified'
      });
      expect(est.available).toBe(true);
      expect(est.benchmarkLevel).toBe('government_package');
      expect(est.canonicalProcedureId).toBe('TYMPANOPLASTY');
      expect(est.exactPackageRate).toBe(12000);
      expect(est.treatmentCostRange.low).toBe(12000);
      expect(est.treatmentCostRange.high).toBe(12000);
    });

    it('4. Unsupported procedure (EEG in Neurology) strictly refuses to guess and shows transparent message', () => {
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Max Super Speciality Hospital',
        city: 'Delhi',
        specialty: 'Neurology',
        procedure: 'EEG',
        policy: sufficientPolicy,
        networkStatus: 'verified'
      });
      expect(est.available).toBe(false);
      expect(est.confidence).toBe('insufficient_data');
      expect(est.treatmentCostRange.displayRange).toBe('No reliable cost benchmark');
      expect(est.potentiallyCoveredRange).toBeNull();
      expect(est.estimatedPatientOopRange).toBeNull();
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
      expect(est.whyThisEstimate[0]).toContain('Sanjeevani Setu currently does not have a verified evidence-backed treatment-cost benchmark for EEG');
      expect(est.whyThisEstimate[1]).toBe("Sanjeevani Setu will not substitute another procedure's cost.");
    });

    it('5. Angiography != Angioplasty (diagnostic vs therapeutic strict separation)', () => {
      const normAngio = normalizeProcedure('Angiography');
      const normPlasty = normalizeProcedure('Angioplasty');

      expect(normAngio.canonical_procedure_id).toBe('ANGIOGRAPHY');
      expect(normPlasty.canonical_procedure_id).toBe('ANGIOPLASTY_PTCA_1_DES');
      expect(normAngio.canonical_procedure_id).not.toBe(normPlasty.canonical_procedure_id);

      // Angiography cost lookup must NOT return Angioplasty benchmark
      const estAngio = costIntelligenceService.estimateCost({
        hospitalName: 'Ruby Hall Clinic',
        city: 'Pune',
        specialty: 'Cardiology',
        procedure: 'Angiography',
        policy: sufficientPolicy
      });
      expect(estAngio.available).toBe(false);
      expect(estAngio.treatmentCostRange.low).toBe(0);
      expect(estAngio.whyThisEstimate[1]).toContain('Angiography');
    });

    it('6. Specialty match != procedure match: Delhi Cardiology search yields specialty matches but 0 procedure matches for Angiography', () => {
      const res = hospitalService.search({
        city: 'Delhi',
        specialty: 'Cardiology',
        procedure: 'Angiography',
        policy: sufficientPolicy
      });
      expect(res.specialtyMatchedCount).toBe(22);
      expect(res.procedureMatchedCount).toBe(0);
      for (const item of res.hospitals) {
        expect(item.estimate.available).toBe(false);
      }
    });

    it('7. Cost Fallback Hierarchy: Unverified Level A/B/C deactivated, verified Level D statutory rate selected', () => {
      // Total Knee Replacement at Sancheti Hospital falls back to Level D statutory package rate (₹80,000)
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Sancheti Hospital',
        city: 'Pune',
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(true);
      expect(est.benchmarkLevel).toBe('government_package');
      expect(est.exactPackageRate).toBe(80000);
      expect(est.treatmentCostRange.low).toBe(80000);
      expect(est.isGovernmentPackageOnly).toBe(true);
      expect(est.disclaimer).toContain('Statutory government package reference');
    });

    it('8. Treatment cost != insurer payment when policy information is insufficient', () => {
      const incompletePolicy: PolicyDocument = {
        ...sufficientPolicy,
        sumInsured: undefined // Missing sum insured
      };
      const est = costIntelligenceService.estimateCost({
        hospitalName: 'District Hospital',
        city: 'Pune',
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: incompletePolicy
      });
      expect(est.available).toBe(true);
      expect(est.treatmentCostRange.low).toBe(80000);
      expect(est.treatmentCostRange.high).toBe(80000);
      // Insurer and Patient share MUST NOT be assumed equal to treatment cost
      expect(est.potentiallyCoveredRange).toBeNull();
      expect(est.estimatedPatientOopRange).toBeNull();
      expect(est.coveredReliable).toBe(false);
      expect(est.oopReliable).toBe(false);
      expect(est.missingInformation).toContain('Sum insured not specified in policy');
    });

    it('9. Confidence levels reflect evidence hierarchy accurately', () => {
      // Government package: Low confidence
      const lowConf = costIntelligenceService.estimateCost({
        hospitalName: 'District Hospital',
        city: 'Pune',
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: sufficientPolicy
      });
      expect(lowConf.confidence).toBe('low');

      // Insufficient: Unsupported procedure
      const insuffConf = costIntelligenceService.estimateCost({
        hospitalName: 'Max Hospital',
        city: 'Delhi',
        specialty: 'Neurology',
        procedure: 'EEG',
        policy: sufficientPolicy
      });
      expect(insuffConf.confidence).toBe('insufficient_data');
    });

    it('10. Scenario simulator recalculates treatment cost and coverage when room category changes', () => {
      const res = costIntelligenceService.recalculateScenario({
        hospitalName: 'District Hospital',
        city: 'Pune',
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: sufficientPolicy,
        baseScenario: {
          roomType: 'Single Private Room',
          simulatedRoomRate: 8000,
          networkStatus: 'verified'
        },
        newScenario: {
          roomType: 'Twin Sharing',
          simulatedRoomRate: 4000,
          networkStatus: 'verified'
        }
      });

      expect(res.available).toBe(true);
      expect(res.baseEstimate.available).toBe(true);
      expect(res.newEstimate.available).toBe(true);
      expect(res.whatChanged.some(c => c.includes('Room Category'))).toBe(true);
    });

    it('11. Exactly 8 procedures have verified Level D Government Scheme Package benchmarks, while unverified/invalid procedures refuse to guess', () => {
      const verified8 = [
        'Total Knee Replacement',
        'Cataract Surgery',
        'Laparoscopic Appendectomy',
        'Caesarean Section',
        'Inguinal Hernia Repair',
        'Total Hip Replacement',
        'TURP',
        'Tympanoplasty'
      ];

      for (const proc of verified8) {
        const est = costIntelligenceService.estimateCost({
          procedure: proc,
          policy: sufficientPolicy
        });
        expect(est.available).toBe(true);
        expect(est.benchmarkLevel).toBe('government_package');
        expect(est.exactPackageRate).toBeGreaterThan(0);
        expect(est.isGovernmentPackageOnly).toBe(true);
      }

      // Procedures with miscoded government rates or unverified rack rates refuse to guess
      const unverifiedProcedures = [
        'CABG',
        'Angioplasty',
        'Laparoscopic Cholecystectomy',
        'EEG',
        'Angiography'
      ];

      for (const proc of unverifiedProcedures) {
        const est = costIntelligenceService.estimateCost({
          procedure: proc,
          policy: sufficientPolicy
        });
        expect(est.available).toBe(false);
      }
    });

    it('12. Treatment Cost, Potentially Covered, and Patient OOP are strictly separated without false parity', () => {
      const noSiPolicy: PolicyDocument = {
        ...sufficientPolicy,
        sumInsured: undefined
      };

      const est = costIntelligenceService.estimateCost({
        hospitalName: 'District Hospital',
        city: 'Pune',
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: noSiPolicy,
        networkStatus: 'verified'
      });

      // 1. Treatment cost IS available (Level D reference ₹80,000)
      expect(est.available).toBe(true);
      expect(est.exactPackageRate).toBe(80000);

      // 2. Potentially covered MUST NOT equal treatment cost
      expect(est.potentiallyCoveredRange).toBeNull();
      expect(est.coveredReliable).toBe(false);

      // 3. Patient OOP MUST NOT be fabricated
      expect(est.estimatedPatientOopRange).toBeNull();
      expect(est.oopReliable).toBe(false);

      // 4. Missing information must explicitly flag missing sum insured
      expect(est.missingInformation.some(m => m.toLowerCase().includes('sum insured'))).toBe(true);
    });
  });

  // =========================================================================
  // 15. Section 15 FIN-01 Cost Benchmark Forensic Remediation — 12 Deterministic Tests
  // =========================================================================
  describe('15. FIN-01 Cost Benchmark Forensic Remediation — 12 Deterministic Tests (Section 15)', () => {
    // TEST 1: Unverified hospital tariff cannot be selected as authoritative benchmark
    it('TEST 1: Unverified hospital tariff cannot be selected as authoritative benchmark', () => {
      const b = costIntelligenceService.getBenchmarkById('COST_HOSP_001');
      expect(b?.source_status).toBe('UNVERIFIED');
      expect(b?.active).toBe(false);

      const hasMatch = costIntelligenceService.hasHospitalProcedureMatch('Sancheti Hospital', 'Total Knee Replacement');
      expect(hasMatch).toBe(false);

      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Sancheti Hospital',
        procedure: 'Total Knee Replacement',
        policy: sufficientPolicy
      });
      expect(est.benchmarkLevel).not.toBe('hospital_specific');
    });

    // TEST 2: Unverified Maharashtra benchmark cannot be selected as authoritative benchmark
    it('TEST 2: Unverified Maharashtra benchmark cannot be selected as authoritative benchmark', () => {
      const b = costIntelligenceService.getBenchmarkById('COST_STATE_001');
      expect(b?.source_status).toBe('UNVERIFIED');
      expect(b?.active).toBe(false);

      const est = costIntelligenceService.estimateCost({
        hospitalName: 'Generic Hospital',
        city: 'Pune',
        state: 'Maharashtra',
        procedure: 'Total Knee Replacement',
        policy: sufficientPolicy
      });
      expect(est.benchmarkLevel).not.toBe('state_benchmark');
      expect(est.benchmarkLevel).not.toBe('maharashtra_regional');
    });

    // TEST 3: Invalid CABG code MC013A rejected
    it('TEST 3: Invalid CABG code MC013A rejected (Septal Ablation, not CABG)', () => {
      const b = costIntelligenceService.getBenchmarkById('COST_GOVT_003');
      expect(b?.source_status).toBe('VALUE_NOT_SUPPORTED');
      expect(b?.active).toBe(false);

      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'CABG',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
    });

    // TEST 4: Invalid PTCA code MC010A rejected
    it('TEST 4: Invalid PTCA code MC010A rejected (PDA Stenting, not adult PTCA)', () => {
      const b = costIntelligenceService.getBenchmarkById('COST_GOVT_004');
      expect(b?.source_status).toBe('VALUE_NOT_SUPPORTED');
      expect(b?.active).toBe(false);

      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'Angioplasty',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
    });

    // TEST 5: Invalid Lap Chole code S1A11.1 rejected
    it('TEST 5: Invalid Lap Chole code S1A11.1 rejected (non-official code)', () => {
      const b = costIntelligenceService.getBenchmarkById('COST_GOVT_005');
      expect(b?.source_status).toBe('VALUE_NOT_SUPPORTED');
      expect(b?.active).toBe(false);

      const est = costIntelligenceService.estimateCost({
        specialty: 'General Surgery',
        procedure: 'Laparoscopic Cholecystectomy',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
    });

    // TEST 6: Government single rate: exact referenceRate shown, no unsupported range generated
    it('TEST 6: Government single rate shows exact referenceRate without unsupported range', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(true);
      expect(est.benchmarkLevel).toBe('government_package');
      expect(est.isGovernmentPackageOnly).toBe(true);
      expect(est.exactPackageRate).toBe(80000);
      expect(est.treatmentCostRange.low).toBe(80000);
      expect(est.treatmentCostRange.typical).toBe(80000);
      expect(est.treatmentCostRange.high).toBe(80000);
      expect(est.treatmentCostRange.isExactPackageRate).toBe(true);
      expect(est.treatmentCostRange.displayRange).toContain('₹80,000');
    });

    // TEST 7: Verified benchmark allowed in authoritative hierarchy
    it('TEST 7: Verified benchmark allowed in authoritative hierarchy', () => {
      const cataract = costIntelligenceService.estimateCost({
        specialty: 'Ophthalmology',
        procedure: 'Cataract Surgery',
        policy: sufficientPolicy
      });
      expect(cataract.available).toBe(true);
      expect(cataract.benchmarkLevel).toBe('government_package');
      expect(cataract.exactPackageRate).toBe(10500);

      const tkr = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: sufficientPolicy
      });
      expect(tkr.available).toBe(true);
      expect(tkr.exactPackageRate).toBe(80000);
    });

    // TEST 8: No verified benchmark returns available = false, "No reliable cost benchmark"
    it('TEST 8: No verified benchmark returns available = false and "No reliable cost benchmark"', () => {
      const cabg = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'CABG',
        policy: sufficientPolicy
      });
      expect(cabg.available).toBe(false);
      expect(cabg.unavailableReason).toBe('No reliable cost benchmark');
      expect(cabg.disclaimer).toContain('does not currently have verified evidence');

      const chole = costIntelligenceService.estimateCost({
        specialty: 'General Surgery',
        procedure: 'Laparoscopic Cholecystectomy',
        policy: sufficientPolicy
      });
      expect(chole.available).toBe(false);
      expect(chole.unavailableReason).toBe('No reliable cost benchmark');
    });

    // TEST 9: Angiography does not inherit Angioplasty benchmark
    it('TEST 9: Angiography does not inherit Angioplasty benchmark', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'Angiography',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(false);
      expect(est.canonicalProcedureId).toBe('ANGIOGRAPHY');
      expect(est.treatmentCostRange.low).toBe(0);
      expect(est.disclaimer).toContain('Angiography');
    });

    // TEST 10: EEG does not inherit another neurology procedure benchmark
    it('TEST 10: EEG does not inherit another neurology procedure benchmark', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Neurology',
        procedure: 'EEG',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(false);
      expect(est.treatmentCostRange.low).toBe(0);
      expect(est.whyThisEstimate[1]).toBe("Sanjeevani Setu will not substitute another procedure's cost.");
    });

    // TEST 11: Treatment cost vs potentially covered: no insurerShare = treatmentCost shortcut
    it('TEST 11: Treatment cost vs potentially covered: no insurerShare = treatmentCost shortcut', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: null // No policy provided
      });
      expect(est.available).toBe(true);
      expect(est.treatmentCostRange.typical).toBe(80000);
      expect(est.potentiallyCoveredRange).toBeNull();
      expect(est.coveredReliable).toBe(false);
    });

    // TEST 12: Patient responsibility cannot be fabricated when policy inputs are missing
    it('TEST 12: Patient responsibility cannot be fabricated when policy inputs are missing', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: insufficientPolicy // Missing sum insured
      });
      expect(est.available).toBe(true);
      expect(est.estimatedPatientOopRange).toBeNull();
      expect(est.oopReliable).toBe(false);
      expect(est.missingInformation.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 16. Section 19 FIN-01 Cost Estimation Semantic Fix — 12 Deterministic Tests
  // =========================================================================
  describe('16. FIN-01 Cost Estimation Semantic Fix — 12 Deterministic Tests (Section 19)', () => {
    // TEST 1: Government package ₹80,000 must NOT generate ₹1,24,000.
    // Expected: referenceRate = 80000, No synthetic component breakdown.
    it('TEST 1: Government package ₹80,000 must NOT generate ₹1,24,000', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: mockHdfcPolicy
      });
      expect(est.available).toBe(true);
      expect(est.exactPackageRate).toBe(80000);
      expect(est.treatmentCostRange.typical).toBe(80000);
      expect(est.treatmentCostRange.min).toBe(80000);
      expect(est.treatmentCostRange.max).toBe(80000);
      // Must NOT be ₹1,24,000
      expect(est.treatmentCostRange.typical).not.toBe(124000);
    });

    // TEST 2: Government package must not generate a fabricated low/typical/high range.
    // Expected: low = typical = high = 80000 internally.
    it('TEST 2: Government package must not generate a fabricated low/typical/high range', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: mockHdfcPolicy
      });
      expect(est.treatmentCostRange.low).toBe(80000);
      expect(est.treatmentCostRange.typical).toBe(80000);
      expect(est.treatmentCostRange.high).toBe(80000);
      expect(est.treatmentCostRange.min).toBe(80000);
      expect(est.treatmentCostRange.max).toBe(80000);
      expect(est.treatmentCostRange.isExactPackageRate).toBe(true);
    });

    // TEST 3: No 5% non-medical deduction unless authoritative policy/rule exists.
    it('TEST 3: No 5% non-medical deduction unless authoritative policy/rule exists', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: mockHdfcPolicy
      });
      const impact = (hospitalService as any).calculatePolicyImpact(
        {
          available: true,
          level: 'tier',
          lowCost: 80000,
          meanCost: 80000,
          highestCost: 80000,
          segmentAdjustedCost: 80000,
          hospitalVariation: 0,
          treatmentCost: 80000,
          roomCost: 0,
          totalCost: 80000,
          displayLow: 80000,
          displayHigh: 80000,
          estimatedStayDays: 1,
          roomCostPerDay: 0,
          costIntelligence: est
        },
        mockHdfcPolicy,
        'verified',
        'General Ward',
        'Orthopedics',
        'Total Knee Replacement'
      );
      expect(impact.modelledNonMedicalAllowance).toBe(0);
    });

    // TEST 4: Patient OOP unavailable when necessary inputs are missing.
    // Expected: oopReliable = false.
    it('TEST 4: Patient OOP unavailable when necessary inputs are missing', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: insufficientPolicy // Missing sum insured
      });
      expect(est.available).toBe(true);
      expect(est.oopReliable).toBe(false);
      expect(est.estimatedPatientOopRange).toBeNull();
    });

    // TEST 5: Potentially admissible amount must not automatically equal government package reference.
    it('TEST 5: Potentially admissible amount must not automatically equal government package reference', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: null // No policy provided
      });
      expect(est.available).toBe(true);
      expect(est.treatmentCostRange.typical).toBe(80000);
      expect(est.potentiallyCoveredRange).toBeNull();
      expect(est.coveredReliable).toBe(false);
    });

    // TEST 6: Actual insurer payment remains unguaranteed.
    it('TEST 6: Actual insurer payment remains unguaranteed', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement',
        policy: sufficientPolicy
      });
      expect(est.disclaimer).toContain('Statutory government package reference');
      expect(est.statutoryReferenceDisclaimer).toBe('This is a statutory scheme package/reimbursement reference, not a private hospital bill quote.');
    });

    // TEST 7: CABG returns no reliable benchmark.
    it('TEST 7: CABG returns no reliable benchmark', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'CABG',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
    });

    // TEST 8: Angioplasty returns no reliable benchmark.
    it('TEST 8: Angioplasty returns no reliable benchmark', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'Angioplasty',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
    });

    // TEST 9: Lap Chole returns no reliable benchmark.
    it('TEST 9: Lap Chole returns no reliable benchmark', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'General Surgery',
        procedure: 'Laparoscopic Cholecystectomy',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(false);
      expect(est.unavailableReason).toBe('No reliable cost benchmark');
    });

    // TEST 10: Angiography does not inherit Angioplasty.
    it('TEST 10: Angiography does not inherit Angioplasty', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Cardiology',
        procedure: 'Angiography',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(false);
      expect(est.canonicalProcedureId).toBe('ANGIOGRAPHY');
      expect(est.disclaimer).toContain('Angiography');
      expect(est.treatmentCostRange.typical).toBe(0);
    });

    // TEST 11: EEG does not inherit arbitrary Neurology costs.
    it('TEST 11: EEG does not inherit arbitrary Neurology costs', () => {
      const est = costIntelligenceService.estimateCost({
        specialty: 'Neurology',
        procedure: 'EEG',
        policy: sufficientPolicy
      });
      expect(est.available).toBe(false);
      expect(est.treatmentCostRange.typical).toBe(0);
      expect(est.whyThisEstimate[1]).toBe("Sanjeevani Setu will not substitute another procedure's cost.");
    });

    // TEST 12: Dataset-based network match must not render as "Verified Network Partner" unless authoritative evidence exists.
    it('TEST 12: Dataset-based network match must not render as "Verified Network Partner" unless authoritative evidence exists', () => {
      const searchRes = hospitalService.search({
        policy: mockHdfcPolicy,
        city: 'Pune',
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement'
      });
      expect(searchRes.hospitals.length).toBeGreaterThan(0);
      const sample = searchRes.hospitals[0];
      const breakdown = hospitalService.getDetailedBillBreakdown(
        sample.hospital.hospital_name,
        sample.hospital.address,
        mockHdfcPolicy,
        'Orthopedics',
        'Total Knee Replacement'
      );
      expect(breakdown).not.toBeNull();
      if (breakdown) {
        const netRec = breakdown.aiRecommendations.find(r => r.title.includes('Network') || r.title.includes('Match'));
        if (netRec) {
          expect(netRec.title).not.toBe('Verified Network Partner (Cashless Eligible)');
          if (breakdown.networkInfo.networkStatus === 'verified') {
            expect(netRec.title).toBe('Dataset-Based Network Match');
          }
        }
      }
    });
  });
});
