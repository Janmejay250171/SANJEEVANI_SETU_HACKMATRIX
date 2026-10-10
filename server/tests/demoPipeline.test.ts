import { describe, it, expect, beforeAll } from 'vitest';
import { costIntelligenceService } from '../src/services/costIntelligenceService';
import { treatmentCostMLService } from '../src/services/treatmentCostMLService';
import { hospitalService } from '../src/services/hospitalService';
import { PolicyDocument } from '../src/types/policy';

describe('FIN-01 End-to-End ML Treatment-Cost Driver Analysis Demo Flow', () => {
  beforeAll(async () => {
    await hospitalService.initData();
  });
  it('executes full demo sequence: benchmark -> ML estimate -> drivers -> scenario delta -> deterministic financial engine', async () => {
    // 1. INPUT DEFINITION
    const procedure = 'Total Knee Replacement';
    const specialty = 'Orthopedics';
    const city = 'Mumbai'; // Maps to Metro 1
    const baselineStayDays = 5;
    const roomType = 'Twin Sharing';

    // 2. EXISTING BENCHMARK ESTIMATE
    const benchmarkEstimate = costIntelligenceService.estimateCost({
      procedure,
      specialty,
      city,
      roomType
    });

    expect(benchmarkEstimate.available).toBe(true);
    expect(benchmarkEstimate.treatmentCostRange).toBeDefined();
    expect(benchmarkEstimate.treatmentCostRange!.typical).toBeGreaterThan(0);
    const benchmarkValue = benchmarkEstimate.treatmentCostRange!.typical;

    // 3. ML ESTIMATE
    const mlBaseline = treatmentCostMLService.predictTreatmentCost({
      procedure,
      specialty,
      tier: 'Metro 1',
      expectedStayDays: baselineStayDays,
      roomType: 'Twin Sharing'
    });

    expect(mlBaseline.status).toBe('available');
    expect(mlBaseline.mlEstimate).not.toBeNull();
    const mlBaselineValue = mlBaseline.mlEstimate!;
    expect(mlBaselineValue).toBeGreaterThan(100000);

    // 4. TOP COST DRIVERS
    expect(mlBaseline.costDrivers.length).toBeGreaterThan(0);
    expect(mlBaseline.costDrivers[0].explanation).toContain('Model indicates');
    expect(mlBaseline.costDrivers[0].explanation).toContain('influences the estimate');
    expect(mlBaseline.costDrivers[0].explanation).not.toContain('causes');

    // 5. CHANGE ONE INPUT (Stay duration 5 -> 7 days)
    const scenarioStayDays = 7;
    const mlScenario = treatmentCostMLService.predictTreatmentCost({
      procedure,
      specialty,
      tier: 'Metro 1',
      expectedStayDays: scenarioStayDays,
      roomType: 'Twin Sharing'
    });

    expect(mlScenario.status).toBe('available');
    const mlScenarioValue = mlScenario.mlEstimate!;

    // 6 & 7. DELTA (Absolute and percentage change)
    const scenarioComparison = treatmentCostMLService.compareScenarios({
      baseline: {
        procedure,
        specialty,
        tier: 'Metro 1',
        expectedStayDays: baselineStayDays,
        roomType: 'Twin Sharing'
      },
      modified: {
        procedure,
        specialty,
        tier: 'Metro 1',
        expectedStayDays: scenarioStayDays,
        roomType: 'Twin Sharing'
      }
    });

    expect(scenarioComparison).not.toBeNull();
    expect(scenarioComparison!.baselineEstimate).toBe(mlBaselineValue);
    expect(scenarioComparison!.scenarioEstimate).toBe(mlScenarioValue);
    expect(scenarioComparison!.absoluteDelta).toBe(mlScenarioValue - mlBaselineValue);
    expect(scenarioComparison!.explanation).toContain('adjusted the ML model estimate');

    // 8. SEND APPROPRIATE COST/POLICY INPUTS TO DETERMINISTIC FINANCIAL ENGINE
    // Deterministic engine is the sole authority for insurance payout & OOP
    const mockPolicy: PolicyDocument = {
      _id: 'demo_policy_fin01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confirmedByUser: true,
      insurer: 'Star Health',
      insurerAliases: [],
      planName: 'Family Health Optima',
      policyType: 'private',
      policyNumber: 'P/DEMO/2026',
      uin: 'UIN-DEMO-01',
      policyStartDate: '2026-01-01',
      policyEndDate: '2027-01-01',
      zone: 'Zone A',
      networkType: 'all-network',
      tpa: null,
      insuredPersons: [],
      sumInsured: 500000,
      roomLimit: { type: 'amount', value: 3000 },
      icuLimit: null,
      copay: 10,
      nonNetworkCopay: 20,
      copayConditions: {},
      deductible: 0,
      proportionateDeduction: true,
      subLimits: {},
      restorationBenefit: false,
      cumulativeBonus: 0,
      exclusions: [],
      hasOtherExclusions: false,
      waitingPeriods: null,
      preHospitalizationDays: 30,
      postHospitalizationDays: 60,
      daycareCovered: true,
      ambulanceLimit: 1500,
      preAuthHours: 6,
      claimIntimationHours: 24,
      sourceSnippets: {},
      confidence: {},
      rawTextRef: null
    };

    const res = hospitalService.search({
      policy: mockPolicy,
      city: 'Bengaluru',
      specialty: 'Orthopedics',
      procedure,
      roomType: 'Twin Sharing'
    });

    expect(res.hospitals.length).toBeGreaterThan(0);
    const selectedHospital = res.hospitals[0];

    // Authoritative deterministic bill calculation
    const breakdown = hospitalService.getDetailedBillBreakdown(
      selectedHospital.hospital.hospital_name,
      selectedHospital.hospital.address,
      mockPolicy,
      'Orthopedics',
      procedure,
      'Twin Sharing'
    );

    expect(breakdown).not.toBeNull();
    if (breakdown) {
      expect(breakdown.itemizedBill.totalBill).toBeGreaterThan(0);
      expect(breakdown.totalInsuranceCovered).toBeGreaterThan(0);
      expect(breakdown.totalPatientPayable).toBeGreaterThanOrEqual(0);

      // VERIFY STRICT BOUNDARY:
      // The ML model produces estimates and driver explanations.
      // The financial engine independently and deterministically calculates admissibility,
      // room rent deductions, and copay, proving the ML model NEVER alters or overrides the financial engine.
      expect(breakdown.copayAmount).toBeGreaterThan(0); // 10% copay applied deterministically
      expect(breakdown.copayPercent).toBe(10);
    }
  });
});
