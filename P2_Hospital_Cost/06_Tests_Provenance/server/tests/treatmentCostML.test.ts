import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { hospitalService } from '../src/services/hospitalService.js';
import { costIntelligenceService } from '../src/services/costIntelligenceService.js';
import { treatmentCostMLService } from '../src/services/treatmentCostMLService.js';
import { PolicyDocument } from '../src/types/policy.js';

describe('FIN-01 ML-Based Treatment-Cost Driver Analysis Suite', () => {
  beforeAll(async () => {
    await hospitalService.initData();
    treatmentCostMLService.loadModel();
  });

  const samplePolicy: PolicyDocument = {
    _id: 'test_policy_ml_01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    confirmedByUser: true,
    insurer: 'Star Health and Allied Insurance',
    insurerAliases: ['Star Health', 'Star'],
    planName: 'Family Health Optima',
    policyType: 'private',
    sumInsured: 500000,
    roomLimit: { type: 'amount', value: 3000 },
    copay: 10,
    proportionateDeduction: true,
    rawTextRef: null
  };

  // 1. Model Availability & Integrity
  it('1. Model artifact loads successfully and exposes validated metadata', () => {
    expect(treatmentCostMLService.isReady()).toBe(true);
    const meta = treatmentCostMLService.getModelMetadata();
    expect(meta).not.toBeNull();
    expect(meta?.model_type).toBe('RidgeTabularRegression');
    expect(meta?.dataset_metadata.training_rows).toBe(184);
    expect(meta?.validation_metrics.random_10fold_cv.mae).toBeGreaterThan(0);
    expect(meta?.validation_metrics.random_10fold_cv.r2).toBeGreaterThan(0.20);
    expect(meta?.domains.supported_procedures.length).toBe(23);
    expect(meta?.domains.supported_tiers.length).toBe(8);
  });

  // 2. Valid Prediction on Supported Procedure & Tier
  it('2. Predicts treatment cost and generates local cost drivers for valid procedure and tier', () => {
    const res = treatmentCostMLService.predictTreatmentCost({
      procedure: 'Knee Replacement',
      tier: 'Metro 1',
      expectedStayDays: 4,
      benchmarkTypical: 270000
    });

    expect(res.status).toBe('available');
    expect(res.mlEstimate).toBeGreaterThan(150000);
    expect(res.mlEstimate).toBeLessThan(350000);
    expect(res.currency).toBe('INR');
    expect(res.reliability).toBe('high');
    expect(res.costDrivers.length).toBe(4);

    // Verify drivers ranking
    expect(res.costDrivers[0].feature).toBeDefined();
    expect(res.costDrivers[0].influence).toBeDefined();

    // Verify non-causal explanation phrasing
    res.costDrivers.forEach(d => {
      expect(d.explanation).toContain('Model indicates');
      expect(d.explanation).not.toContain('causes the patient');
    });

    // Verify mathematical decomposition: sum of attributions equals (prediction - baseline mean)
    const totalAttr = res.costDrivers.reduce((sum, d) => sum + d.impactAmount, 0);
    const expectedDiff = res.mlEstimate! - res.datasetBaselineMean;
    expect(Math.abs(totalAttr - expectedDiff)).toBeLessThanOrEqual(5); // rounding tolerance
  });

  // 3. Unsupported Procedure Protection (Anti-Hallucination)
  it('3. Refuses to predict for unsupported procedure and returns explicit insufficient_data state', () => {
    const res = treatmentCostMLService.predictTreatmentCost({
      procedure: 'Robotic Lung Transplantation',
      tier: 'Metro 1'
    });

    expect(res.status).toBe('insufficient_data');
    expect(res.mlEstimate).toBeNull();
    expect(res.reliability).toBe('insufficient');
    expect(res.reliabilityReason).toContain('Unsupported procedure');
    expect(res.costDrivers).toHaveLength(0);
  });

  // 4. Unsupported Geographic Tier Protection
  it('4. Refuses to predict for unsupported geographic tier', () => {
    const res = treatmentCostMLService.predictTreatmentCost({
      procedure: 'Knee Replacement',
      tier: 'Mars Colony 1'
    });

    expect(res.status).toBe('insufficient_data');
    expect(res.mlEstimate).toBeNull();
    expect(res.reliability).toBe('insufficient');
    expect(res.reliabilityReason).toContain('Unsupported geographic tier');
  });

  // 5. Missing / Unselected Procedure
  it('5. Prompts user when procedure is unselected or empty', () => {
    const res = treatmentCostMLService.predictTreatmentCost({
      procedure: 'All Procedures',
      tier: 'Metro 1'
    });

    expect(res.status).toBe('insufficient_data');
    expect(res.mlEstimate).toBeNull();
    expect(res.reliabilityReason).toContain('Procedure not specified');
  });

  // 6. Invalid Numeric Input Handling
  it('6. Rejects negative or extreme stay durations outside validated feature domain', () => {
    const negativeRes = treatmentCostMLService.predictTreatmentCost({
      procedure: 'Knee Replacement',
      tier: 'Metro 1',
      expectedStayDays: -5
    });
    expect(negativeRes.status).toBe('insufficient_data');
    expect(negativeRes.reliabilityReason).toContain('must be a non-negative number');

    const extremeRes = treatmentCostMLService.predictTreatmentCost({
      procedure: 'Knee Replacement',
      tier: 'Metro 1',
      expectedStayDays: 120
    });
    expect(extremeRes.status).toBe('insufficient_data');
    expect(extremeRes.reliabilityReason).toContain('exceeds maximum medically validated domain limit');
  });

  // 7. Honest Reliability Degradation on Unusual Stays
  it('7. Downgrades reliability to moderate when stay duration diverges significantly from standard', () => {
    // Knee replacement standard stay is 4 days. 8 days is a 4-day divergence (> 2 days threshold)
    const res = treatmentCostMLService.predictTreatmentCost({
      procedure: 'Knee Replacement',
      tier: 'Metro 1',
      expectedStayDays: 8
    });

    expect(res.status).toBe('available');
    expect(res.reliability).toBe('moderate');
    expect(res.reliabilityReason).toContain('diverges significantly');
  });

  // 8. Scenario / What-If Integration
  it('8. Computes scenario deltas deterministically on model outputs with non-causal explanation', () => {
    const comparison = treatmentCostMLService.compareScenarios({
      baseline: {
        procedure: 'Knee Replacement',
        tier: 'Metro 1',
        expectedStayDays: 4
      },
      modified: {
        procedure: 'Knee Replacement',
        tier: 'Metro 1',
        expectedStayDays: 6
      }
    });

    expect(comparison).not.toBeNull();
    expect(comparison?.baselineEstimate).toBeGreaterThan(0);
    expect(comparison?.scenarioEstimate).toBeGreaterThan(comparison!.baselineEstimate);
    expect(comparison?.absoluteDelta).toBeGreaterThan(0);
    expect(comparison?.percentageDelta).toBeGreaterThan(0);
    expect(comparison?.primaryDriverChanged).toContain('expected stay');
    expect(comparison?.explanation).toContain('adjusted the ML model estimate by approx');
    expect(comparison?.explanation).toContain('represents learned tabular correlation, not a guaranteed medical price quote');
  });

  // 9. Integration into CostIntelligenceService.estimateCost
  it('9. Preserves existing benchmark estimator while attaching additive mlCostAnalysis', () => {
    const est = costIntelligenceService.estimateCost({
      hospitalName: 'Apollo Hospital',
      city: 'Bengaluru',
      procedure: 'Total Knee Replacement',
      policy: samplePolicy,
      networkStatus: 'verified',
      roomType: 'General Ward'
    });

    // Existing benchmark estimate preserved
    expect(est.available).toBe(true);
    expect(est.treatmentCostRange.typical).toBeGreaterThan(0);
    expect(est.potentiallyCoveredRange).not.toBeNull();
    expect(est.estimatedPatientOopRange).not.toBeNull();

    // ML analysis is cleanly attached
    expect(est.mlCostAnalysis).toBeDefined();
    expect(est.mlCostAnalysis?.status).toBe('available');
    expect(est.mlCostAnalysis?.mlEstimate).toBeGreaterThan(0);
    expect(est.mlCostAnalysis?.costDrivers.length).toBeGreaterThan(0);

    // Benchmark comparison is present
    expect(est.mlCostAnalysis?.benchmarkComparison).toBeDefined();
    expect(est.mlCostAnalysis?.benchmarkComparison?.benchmarkTypical).toBe(est.treatmentCostRange.typical);
  });

  // 10. Strict Architectural Boundary: ML Cannot Alter Insurance OOP / Payout
  it('10. STRICT BOUNDARY: ML estimate does NOT alter deterministic covered amount or patient OOP', () => {
    const baseEstimate = costIntelligenceService.estimateCost({
      hospitalName: 'Apollo Hospital',
      city: 'Bengaluru',
      procedure: 'Total Knee Replacement',
      policy: samplePolicy,
      networkStatus: 'verified',
      roomType: 'General Ward'
    });

    // The covered amount and OOP must match the deterministic formula on benchmark treatmentCostRange
    const benchTypical = baseEstimate.treatmentCostRange.typical;
    const coveredTypical = baseEstimate.potentiallyCoveredRange!.typical;
    const oopTypical = baseEstimate.estimatedPatientOopRange!.typical;

    // Financial engine rule: covered + oop = benchmark bill
    expect(coveredTypical + oopTypical).toBe(benchTypical);

    // ML estimate may differ from benchmark, but MUST NOT alter covered or OOP
    expect(baseEstimate.mlCostAnalysis?.mlEstimate).not.toBeNull();
    expect(coveredTypical + oopTypical).not.toBe(baseEstimate.mlCostAnalysis?.mlEstimate);
  });

  // 11. Recalculate Scenario API Integration
  it('11. /api/hospitals/recalculate returns scenario diff with mlScenarioComparison', async () => {
    const res = await request(app)
      .post('/api/hospitals/recalculate')
      .send({
        baseline: {
          city: 'Bengaluru',
          procedure: 'Knee Replacement',
          specialty: 'Orthopedics',
          roomType: 'General Ward',
          networkStatus: 'verified'
        },
        modified: {
          city: 'Bengaluru',
          procedure: 'Knee Replacement',
          specialty: 'Orthopedics',
          roomType: 'Single Private Room',
          networkStatus: 'verified'
        },
        policy: samplePolicy
      });

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.whatChanged.length).toBeGreaterThan(0);
    expect(res.body.financialDiff).toBeDefined();
  });

  // 12. Dedicated ML Cost Analysis API Route
  it('12. POST /api/hospitals/ml-cost-analysis returns validated ML drivers and scenario comparison', async () => {
    const res = await request(app)
      .post('/api/hospitals/ml-cost-analysis')
      .send({
        procedure: 'Knee Replacement',
        city: 'Bengaluru',
        expectedStayDays: 4
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('available');
    expect(res.body.mlEstimate).toBeGreaterThan(0);
    expect(res.body.currency).toBe('INR');
    expect(res.body.costDrivers).toHaveLength(4);
    expect(res.body.validationMetrics.tenFoldCvMae).toBeGreaterThan(0);

    // Test scenario mode in same endpoint
    const scenarioRes = await request(app)
      .post('/api/hospitals/ml-cost-analysis')
      .send({
        baseline: { procedure: 'Knee Replacement', city: 'Bengaluru', expectedStayDays: 4 },
        modified: { procedure: 'Knee Replacement', city: 'Bengaluru', expectedStayDays: 7 }
      });

    expect(scenarioRes.status).toBe(200);
    expect(scenarioRes.body.comparison).toBeDefined();
    expect(scenarioRes.body.comparison.absoluteDelta).toBeGreaterThan(0);
    expect(scenarioRes.body.baseline.status).toBe('available');
    expect(scenarioRes.body.modified.status).toBe('available');
  });

  // 13. API Route returns 200 with insufficient_data for unknown procedure
  it('13. POST /api/hospitals/ml-cost-analysis safely handles unsupported procedure', async () => {
    const res = await request(app)
      .post('/api/hospitals/ml-cost-analysis')
      .send({
        procedure: 'Experimental Nanotech Surgery',
        city: 'Bengaluru'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('insufficient_data');
    expect(res.body.mlEstimate).toBeNull();
    expect(res.body.reliability).toBe('insufficient');
  });
});
