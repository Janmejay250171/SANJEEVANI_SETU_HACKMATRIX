import { describe, it, expect, beforeAll } from 'vitest';
import {
  treatmentCostIngestionService,
  normalizePriceClassification,
  RawCostObservation
} from '../src/services/treatmentCostIngestionService.js';
import { CostIntelligenceService } from '../src/services/costIntelligenceService.js';
import { HospitalService } from '../src/services/hospitalService.js';
import { PHASE2_CURATED_COST_OBSERVATIONS } from '../src/data/phase2CuratedCostObservations.js';
import { CostBenchmarkRecord } from '../src/types/cost.js';

describe('Phase 2: Evidence-Backed Treatment-Cost Dataset Suite', () => {
  let costService: CostIntelligenceService;
  let hospitalService: HospitalService;

  beforeAll(async () => {
    costService = new CostIntelligenceService();
    costService.loadBenchmarks();
    hospitalService = new HospitalService();
    await hospitalService.initData();
  });

  // 1. Source Provenance Preservation
  describe('1. Source Provenance Preservation', () => {
    it('preserves full source provenance metadata on all ingested observations', () => {
      const sampleObservation: RawCostObservation = {
        cost_id: 'TEST_PROV_001',
        procedure_raw: 'Cataract Surgery',
        procedure_code: 'PROC_CATARACT',
        hospital_name: 'Test Eye Center',
        city: 'Bengaluru',
        cost_low: 30000,
        cost_typical: 40000,
        cost_high: 50000,
        currency: 'INR',
        price_classification: 'regional_benchmark',
        source_name: 'GIPSA Preferred Provider Network Schedule',
        source_document: 'PPN Ophthalmology Tariff Grid 2023',
        source_url: 'https://psu-insurers.org.in/ppn',
        source_date: '2023-04-01',
        data_year: 2023,
        date_verified: '2026-10-10',
        source_status: 'VERIFIED',
        active: true,
        package_inclusions: ['Pre-op eval', 'Monofocal IOL', 'OT charges'],
        package_exclusions: ['Premium multifocal lens'],
        notes: 'Strict PPN schedule'
      };

      const result = treatmentCostIngestionService.ingestCostRecords([sampleObservation]);
      expect(result.report.acceptedCount).toBe(1);
      const record = result.ingestedRecords[0];

      expect(record.source_name).toBe('GIPSA Preferred Provider Network Schedule');
      expect(record.source_document).toBe('PPN Ophthalmology Tariff Grid 2023');
      expect(record.source_url).toBe('https://psu-insurers.org.in/ppn');
      expect(record.source_date).toBe('2023-04-01');
      expect(record.date_verified).toBe('2026-10-10');
      expect(record.package_terms?.inclusions).toContain('Pre-op eval');
      expect(record.package_terms?.exclusions).toContain('Premium multifocal lens');
    });
  });

  // 2. Price Classification Integrity
  describe('2. Price Classification Integrity', () => {
    it('accurately normalizes explicit price classifications', () => {
      expect(normalizePriceClassification('government_package_rate')).toBe('government_package_rate');
      expect(normalizePriceClassification('actual_hospital_tariff')).toBe('actual_hospital_tariff');
      expect(normalizePriceClassification('hospital_package_price')).toBe('hospital_package_price');
      expect(normalizePriceClassification('regional_benchmark')).toBe('regional_benchmark');
      expect(normalizePriceClassification('national_benchmark')).toBe('national_benchmark');
      expect(normalizePriceClassification('historical_observation')).toBe('historical_observation');
      expect(normalizePriceClassification('random_string')).toBe('unverified_price');
    });
  });

  // 3. Invalid or Missing Prices
  describe('3. Invalid or Missing Prices', () => {
    it('rejects observations with non-positive or missing cost_low', () => {
      const invalidCost: RawCostObservation = {
        procedure_raw: 'Total Knee Replacement',
        cost_low: -1000,
        cost_high: 80000,
        source_name: 'Test Source'
      };

      const res = treatmentCostIngestionService.ingestCostRecords([invalidCost]);
      expect(res.report.acceptedCount).toBe(0);
      expect(res.report.rejectedCount).toBe(1);
      expect(res.report.validationIssues.some(i => i.field === 'cost_low')).toBe(true);
    });

    it('rejects observations where cost_high is less than cost_low', () => {
      const invertedCost: RawCostObservation = {
        procedure_raw: 'Cataract Surgery',
        cost_low: 50000,
        cost_high: 20000,
        source_name: 'Test Source'
      };

      const res = treatmentCostIngestionService.ingestCostRecords([invertedCost]);
      expect(res.report.acceptedCount).toBe(0);
      expect(res.report.validationIssues.some(i => i.field === 'cost_high')).toBe(true);
    });
  });

  // 4. Zero Versus Unknown Values
  describe('4. Zero Versus Unknown Values', () => {
    it('distinguishes lack of verified data from confirmed zero costs', () => {
      // Procedure without verified benchmark returns available: false
      const estimate = costService.estimateCost({
        procedure: 'Rare Pediatric Neuro-Vascular Reconstruction',
        city: 'Bengaluru'
      });

      expect(estimate.available).toBe(false);
      expect(estimate.treatmentCostRange.low).toBe(0);
      expect(estimate.treatmentCostRange.high).toBe(0);
      expect(estimate.treatmentCostRange.displayRange).not.toBe('₹0');
      expect(estimate.unavailableReason).toBeDefined();
    });
  });

  // 5. Duplicate Detection and Idempotent Imports
  describe('5. Duplicate Detection and Idempotent Imports', () => {
    it('detects duplicate price observations within the same batch', () => {
      const obsA: RawCostObservation = {
        cost_id: 'DUP_1',
        procedure_raw: 'Total Knee Replacement',
        procedure_code: 'PROC_KNEE_REPLACEMENT',
        hospital_name: 'City Ortho Center',
        city: 'Bengaluru',
        room_category: 'General Ward',
        cost_low: 150000,
        cost_high: 200000,
        currency: 'INR',
        source_name: 'Ortho Schedule 2024',
        data_year: 2024
      };

      const obsB: RawCostObservation = { ...obsA, cost_id: 'DUP_2' };

      const res = treatmentCostIngestionService.ingestCostRecords([obsA, obsB]);
      expect(res.report.acceptedCount).toBe(1);
      expect(res.report.exactDuplicatesCount).toBe(1);
    });

    it('executes repeated ingestion idempotently without duplicate record proliferation', () => {
      const initialCount = costService.getAllBenchmarks().length;
      const report1 = costService.ingestAndMergeRecords(PHASE2_CURATED_COST_OBSERVATIONS);
      const countAfterFirst = costService.getAllBenchmarks().length;

      const report2 = costService.ingestAndMergeRecords(PHASE2_CURATED_COST_OBSERVATIONS);
      const countAfterSecond = costService.getAllBenchmarks().length;

      expect(countAfterSecond).toBe(countAfterFirst);
      expect(countAfterFirst).toBeGreaterThanOrEqual(initialCount);
    });
  });

  // 6. Date and Currency Validation
  describe('6. Date and Currency Validation', () => {
    it('rejects foreign currencies not permitted by SehatSure', () => {
      const foreignCurrency: RawCostObservation = {
        procedure_raw: 'Total Knee Replacement',
        cost_low: 5000,
        cost_high: 8000,
        currency: 'USD',
        source_name: 'US Medical Tourism Catalog'
      };

      const res = treatmentCostIngestionService.ingestCostRecords([foreignCurrency]);
      expect(res.report.acceptedCount).toBe(0);
      expect(res.report.validationIssues.some(i => i.field === 'currency')).toBe(true);
    });
  });

  // 7. Procedure and Room-Category Matching
  describe('7. Procedure and Room-Category Matching', () => {
    it('correctly maps all 5 Phase 2 curated procedures to canonical identifiers', () => {
      const procs = [
        'Cataract Surgery',
        'Total Knee Replacement',
        'Laparoscopic Appendectomy',
        'Caesarean Section (C-Section)',
        'Inguinal Hernia Repair'
      ];

      for (const p of procs) {
        const est = costService.estimateCost({
          procedure: p,
          city: 'Bengaluru',
          roomType: 'General Ward'
        });
        expect(est.available).toBe(true);
        expect(est.canonicalProcedureId).toBeDefined();
        expect(est.canonicalProcedureId).not.toBe('UNKNOWN');
      }
    });
  });

  // 8. Separation of Hospital Tariffs from Government Package Rates
  describe('8. Separation of Hospital Tariffs from Government Package Rates', () => {
    it('rejects labeling a government statutory package rate as a private hospital tariff', () => {
      const conflictingRecord: RawCostObservation = {
        procedure_raw: 'Total Knee Replacement',
        cost_low: 80000,
        cost_high: 80000,
        hospital_type: 'Private',
        source_type: 'hospital_tariff',
        price_classification: 'government_package_rate',
        source_name: 'AB-PMJAY Schedule'
      };

      const res = treatmentCostIngestionService.ingestCostRecords([conflictingRecord]);
      expect(res.report.acceptedCount).toBe(0);
      expect(res.report.validationIssues.some(i => i.field === 'price_classification')).toBe(true);
    });

    it('displays explicit statutory disclaimer when government package benchmark is retrieved', () => {
      const est = costService.estimateCost({
        procedure: 'Total Knee Replacement',
        city: 'Bengaluru'
      });

      if (est.isGovernmentPackageOnly) {
        expect(est.statutoryReferenceDisclaimer).toContain('statutory');
      }
    });
  });

  // 9. Prevention of Unsupported Prices Being Presented as Verified
  describe('9. Prevention of Unsupported Prices Being Presented as Verified', () => {
    it('ensures unverified price observations are NOT indexed as active verified benchmarks', () => {
      const unverifiedObservation: RawCostObservation = {
        cost_id: 'UNVER_TEST_001',
        procedure_raw: 'Cataract Surgery',
        cost_low: 45000,
        cost_high: 65000,
        source_name: 'Unverified Online Forum',
        source_status: 'UNVERIFIED',
        active: false
      };

      const report = costService.ingestAndMergeRecords([unverifiedObservation]);
      expect(report.acceptedCount).toBe(1);

      const activeList = costService.getActiveBenchmarks();
      expect(activeList.some(b => b.cost_id === 'UNVER_TEST_001')).toBe(false);
    });
  });

  // 10. Correct Insufficient-Data Behavior
  describe('10. Correct Insufficient-Data Behavior', () => {
    it('returns explicit insufficient-data response rather than arbitrary fabrication when procedure is unselected', () => {
      const est = costService.estimateCost({
        procedure: 'All Procedures',
        city: 'Bengaluru'
      });

      expect(est.available).toBe(false);
      expect(est.isProcedureUnselected).toBe(true);
      expect(est.unavailableReason).toBe('Select a procedure for cost estimation');
    });

    it('refuses to substitute an unrelated procedure (e.g. Angiography never substitutes Angioplasty)', () => {
      const est = costService.estimateCost({
        procedure: 'Coronary Angiography',
        city: 'Bengaluru'
      });

      expect(est.available).toBe(false);
      expect(est.unavailableReason).toContain('Angiography');
    });
  });

  // 11. Compatibility with Existing Recommendation and Cost Services
  describe('11. Compatibility with Existing Recommendation and Cost Services', () => {
    it('integrates seamlessly with HospitalService search without runtime exceptions', () => {
      const mockPolicy = {
        policyId: 'POL_PHASE2_TEST',
        policyNumber: 'POL-P2-001',
        insurer: 'HDFC ERGO General Insurance',
        policyType: 'Corporate Group Health Shield',
        sumInsured: 500000,
        copay: 0,
        networkHospitals: [],
        roomRentLimit: { type: 'none' as const, value: null },
        icuLimit: { type: 'none' as const, value: null }
      };

      const searchResult = hospitalService.search({
        policy: mockPolicy,
        city: 'Bengaluru',
        specialty: 'Orthopedics',
        procedure: 'Total Knee Replacement'
      });

      expect(searchResult.totalCount).toBeGreaterThan(0);
      expect(searchResult.hospitals.length).toBeGreaterThan(0);
      const topHospital = searchResult.hospitals[0];
      expect(topHospital.hospital).toBeDefined();
      expect(topHospital.score).toBeDefined();
    });
  });
});
