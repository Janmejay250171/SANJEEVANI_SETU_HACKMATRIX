import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { costModelEvaluationService } from '../src/services/costModelEvaluationService.js';
import { treatmentCostMLService } from '../src/services/treatmentCostMLService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Priority 2: Defensible Cost-Prediction Model & Baseline Verification Suite', () => {
  // 2.1 Audit the Current Model & Dataset
  it('2.1 Verifies the 184 validated training rows, target variable definition, and feature schema', () => {
    const { pvtRows, govtRows } = costModelEvaluationService.loadDatasets();

    // 184 validated empirical rows
    expect(pvtRows).toHaveLength(184);
    expect(govtRows).toHaveLength(184);

    // Target variable: mean_cost in INR
    for (const r of pvtRows) {
      expect(r.mean_cost).toBeGreaterThan(0);
      expect(r.low_cost).toBeGreaterThan(0);
      expect(r.highest_cost).toBeGreaterThanOrEqual(r.low_cost);
      expect(r.estimated_stay_days).toBeGreaterThanOrEqual(0);
      expect(r.procedure.length).toBeGreaterThan(0);
      expect(r.tier.length).toBeGreaterThan(0);
      expect(r.specialty.length).toBeGreaterThan(0);
    }

    // Model artifact metadata check
    const artifact = treatmentCostMLService.getModelMetadata();
    expect(artifact).not.toBeNull();
    expect(artifact?.model_type).toBe('RidgeTabularRegression');
    expect(artifact?.dataset_metadata.training_rows).toBe(184);
    expect(artifact?.target.name).toBe('mean_cost');
    expect(artifact?.target.currency).toBe('INR');
  });

  // 2.2 Model Comparison Against Transparent Baselines
  it('2.2 Evaluates Ridge regression against transparent baselines (Procedure Median, Tier Median, Govt Packages)', () => {
    const report = costModelEvaluationService.runFullEvaluation();

    expect(report.datasetRowsCount).toBe(184);
    expect(report.uniqueProceduresCount).toBe(23);
    expect(report.uniqueTiersCount).toBe(8);
    expect(report.uniqueSpecialtiesCount).toBe(7);

    const { mlRidgeModel, procedureMedianBaseline, procedureTierMedianBaseline, governmentPackageBaseline } = report.modelsEvaluated;

    // Both MAE and MedAE computed
    expect(mlRidgeModel.mae).toBeGreaterThan(0);
    expect(mlRidgeModel.medAe).toBeGreaterThan(0);
    expect(procedureMedianBaseline.mae).toBeGreaterThan(0);
    expect(procedureTierMedianBaseline.mae).toBeGreaterThan(0);
    expect(governmentPackageBaseline.mae).toBeGreaterThan(0);

    // Ridge model captures tier variance and achieves higher R2 than simple overall procedure median
    expect(mlRidgeModel.r2).toBeGreaterThanOrEqual(procedureMedianBaseline.r2);

    // Statutory Government rates (CGHS/AB-PMJAY) are significantly different from private tariffs
    expect(governmentPackageBaseline.mae).toBeGreaterThan(25000);

    // Interval coverage [low_cost, highest_cost] achieves 100% empirical coverage
    expect(mlRidgeModel.intervalCoverage95).toBe(100);
    expect(mlRidgeModel.meanIntervalWidth).toBeGreaterThan(20000);
  });

  // 2.3 Detailed Breakdown by Specialty and Geographic Tier
  it('2.3 Reports evaluation metrics across specialties and geographic tiers without synthetic fabrication', () => {
    const report = costModelEvaluationService.runFullEvaluation();

    // Specialty breakdown
    const specialties = Object.keys(report.breakdownBySpecialty);
    expect(specialties).toContain('Cardiology');
    expect(specialties).toContain('Orthopedics');
    expect(specialties).toContain('General Surgery');
    expect(specialties).toContain('Neurology');

    for (const [spec, sData] of Object.entries(report.breakdownBySpecialty)) {
      expect(sData.sampleCount).toBeGreaterThan(0);
      expect(sData.actualMean).toBeGreaterThan(0);
      expect(sData.mlMae).toBeGreaterThan(0);
    }

    // Tier breakdown (Metro 1 to Town 2)
    const tiers = Object.keys(report.breakdownByTier);
    expect(tiers).toContain('Metro 1');
    expect(tiers).toContain('Town 2');

    for (const [tier, tData] of Object.entries(report.breakdownByTier)) {
      expect(tData.sampleCount).toBeGreaterThan(0);
      expect(tData.actualMean).toBeGreaterThan(0);
      expect(tData.mlMae).toBeGreaterThan(0);
    }
  });

  // 2.4 Evidence-Backed Uncertainty and Strict Refusal on Insufficient Data
  it('2.4 Returns explicit insufficient_data status for unsupported procedures, unsupported tiers, or extreme stays', () => {
    // Unsupported procedure -> Refusal
    const unsupportedProcRes = treatmentCostMLService.predictTreatmentCost({
      procedure: 'Robotic Space Nanotherapy',
      tier: 'Metro 1'
    });
    expect(unsupportedProcRes.status).toBe('insufficient_data');
    expect(unsupportedProcRes.mlEstimate).toBeNull();
    expect(unsupportedProcRes.reliability).toBe('insufficient');
    expect(unsupportedProcRes.reliabilityReason).toContain('Unsupported procedure');

    // Unsupported tier -> Refusal
    const unsupportedTierRes = treatmentCostMLService.predictTreatmentCost({
      procedure: 'Angioplasty',
      tier: 'Antarctica Base 4'
    });
    expect(unsupportedTierRes.status).toBe('insufficient_data');
    expect(unsupportedTierRes.mlEstimate).toBeNull();
    expect(unsupportedTierRes.reliabilityReason).toContain('Unsupported geographic tier');

    // Extreme stay duration exceeding validated domain limit -> Refusal
    const extremeStayRes = treatmentCostMLService.predictTreatmentCost({
      procedure: 'Hernia Repair',
      tier: 'Metro 1',
      expectedStayDays: 120 // extreme duration
    });
    expect(extremeStayRes.status).toBe('insufficient_data');
    expect(extremeStayRes.mlEstimate).toBeNull();
    expect(extremeStayRes.reliabilityReason).toContain('exceeds maximum medically validated domain limit');

    // Valid supported query -> Available with cost drivers and limitations
    const validRes = treatmentCostMLService.predictTreatmentCost({
      procedure: 'Hernia Repair',
      tier: 'Metro 1',
      expectedStayDays: 2
    });
    expect(validRes.status).toBe('available');
    expect(validRes.mlEstimate).toBeGreaterThan(30000);
    expect(validRes.costDrivers.length).toBeGreaterThan(0);
    expect(validRes.limitations.length).toBeGreaterThan(0);
    expect(validRes.disclaimer).toBeDefined();
  });
});
