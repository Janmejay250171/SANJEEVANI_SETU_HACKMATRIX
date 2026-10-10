import { describe, it, expect, beforeAll } from 'vitest';
import {
  normalizeHospitalIdentity,
  createBranchSignature,
  validateSpecialtyField,
  validateHospitalRecord,
  validateNetworkStatusIntegrity,
  validateCostBenchmarkRecord,
  dataValidationService
} from '../src/services/dataValidationService.js';
import { HospitalRecord, NetworkStatus } from '../src/types/hospital.js';
import { CostBenchmarkRecord } from '../src/types/cost.js';
import { HospitalService } from '../src/services/hospitalService.js';
import { CostIntelligenceService } from '../src/services/costIntelligenceService.js';
import { getHospitalNetworkStatus } from '../src/services/networkMatchingService.js';
import { PolicyDocument } from '../src/types/policy.js';

describe('Phase 1: Hospital Data Accuracy, Correction & Validation Suite', () => {
  let hospitalService: HospitalService;
  let costService: CostIntelligenceService;

  beforeAll(async () => {
    hospitalService = new HospitalService();
    await hospitalService.initData();
    costService = new CostIntelligenceService();
    costService.loadBenchmarks();
  });

  // 1. Exact Duplicate Detection
  describe('1. Exact Duplicate Detection', () => {
    it('detects and flags identical hospital records sharing name, city, and address', () => {
      const hospitalA: HospitalRecord = {
        hospital_name: 'Metro City Hospital',
        hospital_type: 'Private',
        address: '123 MG Road, Central District',
        city: 'Bengaluru',
        insurers: ['HDFC ERGO General Insurance'],
        insurersRaw: 'HDFC ERGO General Insurance',
        rating: 4.5,
        specialties: ['Cardiology'],
        tier: 'Metro 1',
        segment: 'Premium'
      };

      const hospitalB: HospitalRecord = { ...hospitalA }; // exact duplicate

      const seenSignatures = new Set<string>();
      const resultA = validateHospitalRecord(hospitalA, seenSignatures);
      expect(resultA.isValid).toBe(true);
      expect(resultA.issues.filter(i => i.rule === 'EXACT_DUPLICATE_DETECTED')).toHaveLength(0);

      seenSignatures.add(resultA.branchSignature);
      const resultB = validateHospitalRecord(hospitalB, seenSignatures);
      expect(resultB.isValid).toBe(false);
      expect(resultB.issues.some(i => i.rule === 'EXACT_DUPLICATE_DETECTED')).toBe(true);
    });
  });

  // 2. Probable Duplicates and Distinct Hospital Branches
  describe('2. Distinct Hospital Branch Preservation', () => {
    it('does NOT merge distinct branches sharing the same hospital brand across different locations', () => {
      const apolloBannerghatta: HospitalRecord = {
        hospital_name: 'Apollo Hospital',
        hospital_type: 'Private',
        address: '154/11 Opp. IIMB, Bannerghatta Road',
        city: 'Bengaluru',
        insurers: ['HDFC ERGO General Insurance', 'Star Health'],
        insurersRaw: 'HDFC ERGO, Star Health',
        rating: 4.8,
        specialties: ['Cardiology', 'Orthopedics'],
        tier: 'Metro 1',
        segment: 'Premium'
      };

      const apolloJayanagar: HospitalRecord = {
        hospital_name: 'Apollo Hospital',
        hospital_type: 'Private',
        address: '21/2, 14th Cross, 3rd Block East, Jayanagar',
        city: 'Bengaluru',
        insurers: ['HDFC ERGO General Insurance'],
        insurersRaw: 'HDFC ERGO',
        rating: 4.6,
        specialties: ['General Surgery'],
        tier: 'Metro 1',
        segment: 'Premium'
      };

      const sig1 = createBranchSignature(apolloBannerghatta.hospital_name, apolloBannerghatta.city, apolloBannerghatta.address);
      const sig2 = createBranchSignature(apolloJayanagar.hospital_name, apolloJayanagar.city, apolloJayanagar.address);

      expect(sig1).not.toBe(sig2);

      const seen = new Set<string>();
      const res1 = validateHospitalRecord(apolloBannerghatta, seen);
      seen.add(res1.branchSignature);

      const res2 = validateHospitalRecord(apolloJayanagar, seen);
      expect(res2.isValid).toBe(true);
      expect(res2.isDistinctBranch).toBe(true);
      expect(res2.issues.filter(i => i.rule === 'EXACT_DUPLICATE_DETECTED')).toHaveLength(0);
    });
  });

  // 3. Hospital Identity Normalization
  describe('3. Hospital Identity Normalization', () => {
    it('normalizes whitespace and cleans punctuation consistently without data loss', () => {
      const rawName = '  Fortis   Escorts    Heart  Institute - Okhla   ';
      const { normalizedName } = normalizeHospitalIdentity(rawName);
      expect(normalizedName).toBe('Fortis Escorts Heart Institute - Okhla');
    });

    it('gracefully handles empty or non-string hospital names', () => {
      const { normalizedName } = normalizeHospitalIdentity('');
      expect(normalizedName).toBe('Unknown Facility');
    });
  });

  // 4. Specialty Normalization and Filtering
  describe('4. Specialty Normalization and Filtering', () => {
    it('correctly maps known specialties to canonical taxonomy', () => {
      const { isValid, canonicalSpecialties } = validateSpecialtyField(['Cardio', 'Bone and Joint', 'Eye Care']);
      expect(isValid).toBe(true);
      expect(canonicalSpecialties).toContain('Cardiology');
      expect(canonicalSpecialties).toContain('Orthopedics');
      expect(canonicalSpecialties).toContain('Ophthalmology');
    });

    it('flags unmapped specialty terms for review', () => {
      const { isValid, unmappedSpecialties } = validateSpecialtyField(['Cardiology', 'Hyperbaric Cryogenics']);
      expect(isValid).toBe(false);
      expect(unmappedSpecialties).toContain('Hyperbaric Cryogenics');
    });
  });

  // 5. Missing and Malformed Data
  describe('5. Missing and Malformed Data Handling', () => {
    it('rejects records with missing hospital name as blocking errors', () => {
      const invalidRecord: HospitalRecord = {
        hospital_name: '',
        hospital_type: 'Private',
        address: 'Some Street',
        city: 'Mumbai',
        insurers: ['Star Health'],
        insurersRaw: 'Star Health',
        rating: 4.0,
        specialties: ['Cardiology'],
        tier: 'Metro 1',
        segment: 'Standard Private'
      };

      const result = validateHospitalRecord(invalidRecord);
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.rule === 'IDENTITY_NAME_REQUIRED')).toBe(true);
    });

    it('flags addresses with multiple pincodes as warnings for manual review', () => {
      const anomalyRecord: HospitalRecord = {
        hospital_name: 'Test Hospital',
        hospital_type: 'Private',
        address: 'D No 117615, Main Road, Pin 560001',
        city: 'Bengaluru',
        insurers: ['Star Health'],
        insurersRaw: 'Star Health',
        rating: 4.0,
        specialties: ['Cardiology'],
        tier: 'Metro 1',
        segment: 'Standard Private'
      };

      const result = validateHospitalRecord(anomalyRecord);
      expect(result.issues.some(i => i.rule === 'ADDRESS_MULTIPLE_PINCODES')).toBe(true);
    });
  });

  // 6. Provenance and Verification Metadata
  describe('6. Provenance and Verification Metadata', () => {
    it('requires source_name and verified source_status on active benchmark records', () => {
      const validBenchmark: CostBenchmarkRecord = {
        cost_id: 'COST_GOVT_001',
        canonical_procedure_id: 'PROC_KNEE_REPLACEMENT',
        canonical_procedure_name: 'Total Knee Replacement',
        procedure: 'Total Knee Replacement',
        procedure_code: 'PROC_KNEE_REPLACEMENT',
        specialty: 'Orthopedics',
        hospital_id: '',
        hospital_name: '',
        city: '',
        state: '',
        geography: 'National',
        room_category: 'General Ward',
        cost_low: 72000,
        cost_typical: 80000,
        cost_high: 88000,
        currency: 'INR',
        benchmark_level: 'government_package',
        source_type: 'government_package',
        source_name: 'National Health Authority (NHA) AB-PMJAY HBP 2.2',
        source_url: 'https://pmjay.gov.in',
        source_document: 'Health Benefit Package 2.2 Master Package Document',
        source_page: 'Page 42',
        source_date: '2022-01-01',
        data_year: 2022,
        confidence_level: 'high',
        notes: 'Statutory package tariff',
        source_status: 'VERIFIED',
        active: true
      };

      const res = validateCostBenchmarkRecord(validBenchmark);
      expect(res.isValid).toBe(true);
      expect(res.isActiveAndVerified).toBe(true);
    });

    it('blocks active benchmark records that have unverified source_status', () => {
      const unverifiedActive: CostBenchmarkRecord = {
        cost_id: 'COST_UNVER_001',
        canonical_procedure_id: 'PROC_KNEE_REPLACEMENT',
        canonical_procedure_name: 'Total Knee Replacement',
        procedure: 'Total Knee Replacement',
        procedure_code: 'PROC_KNEE_REPLACEMENT',
        specialty: 'Orthopedics',
        hospital_id: '',
        hospital_name: '',
        city: '',
        state: '',
        geography: 'National',
        room_category: 'General Ward',
        cost_low: 50000,
        cost_typical: 70000,
        cost_high: 90000,
        currency: 'INR',
        benchmark_level: 'national_benchmark',
        source_type: 'benchmark',
        source_name: 'Unverified Web Survey',
        source_url: '',
        source_document: '',
        source_page: '',
        source_date: '',
        data_year: 2023,
        confidence_level: 'low',
        notes: '',
        source_status: 'UNVERIFIED',
        active: true // Active but unverified!
      };

      const res = validateCostBenchmarkRecord(unverifiedActive);
      expect(res.isValid).toBe(false);
      expect(res.issues.some(i => i.rule === 'UNVERIFIED_RECORD_ACTIVE')).toBe(true);
    });
  });

  // 7. Correct Handling of All Four Network Statuses
  describe('7. Correct Handling of All Four Network Statuses', () => {
    const hospitalWithInsurers: HospitalRecord = {
      hospital_name: 'Fortis Hospital',
      hospital_type: 'Private',
      address: 'Cunningham Road',
      city: 'Bengaluru',
      insurers: ['HDFC ERGO General Insurance', 'Star Health and Allied Insurance'],
      insurersRaw: 'HDFC ERGO, Star Health',
      rating: 4.7,
      specialties: ['Cardiology'],
      tier: 'Metro 1',
      segment: 'Premium'
    };

    const hospitalWithoutInsurers: HospitalRecord = {
      hospital_name: 'Community Clinic',
      hospital_type: 'Private',
      address: 'Main Bazaar',
      city: 'Bengaluru',
      insurers: [],
      insurersRaw: '',
      rating: 3.5,
      specialties: ['General Surgery'],
      tier: 'Metro 1',
      segment: 'Budget/Local'
    };

    it('returns "verified" when hospital lists the policy insurer', () => {
      const res = getHospitalNetworkStatus(hospitalWithInsurers, 'HDFC ERGO General Insurance');
      expect(res.networkStatus).toBe('verified');
    });

    it('returns "no_match" when hospital lists insurers, but requested insurer is not among them', () => {
      const res = getHospitalNetworkStatus(hospitalWithInsurers, 'Bajaj Allianz General Insurance');
      expect(res.networkStatus).toBe('no_match');
    });

    it('returns "unverified" when hospital has no insurer information at all', () => {
      const res = getHospitalNetworkStatus(hospitalWithoutInsurers, 'HDFC ERGO General Insurance');
      expect(res.networkStatus).toBe('unverified');
    });

    it('returns "unknown" when policy insurer is null, undefined, or empty', () => {
      const res1 = getHospitalNetworkStatus(hospitalWithInsurers, null);
      expect(res1.networkStatus).toBe('unknown');

      const res2 = getHospitalNetworkStatus(hospitalWithInsurers, '');
      expect(res2.networkStatus).toBe('unknown');
    });
  });

  // 8. Prevention of Unsupported Empanelment Claims
  describe('8. Prevention of Unsupported Empanelment Claims', () => {
    it('ensures directory presence alone never results in verified network status', () => {
      const hospital: HospitalRecord = {
        hospital_name: 'Random Nursing Home',
        hospital_type: 'Private',
        address: '1st Cross',
        city: 'Mysore',
        insurers: [],
        insurersRaw: '',
        rating: 3.0,
        specialties: ['Gynecology'],
        tier: 'City 1',
        segment: 'Budget/Local'
      };

      const audit = validateNetworkStatusIntegrity(hospital, 'ICICI Lombard');
      expect(audit.isEmpanelledClaimValid).toBe(false);
      expect(audit.status).not.toBe('verified');
    });
  });

  // 9. Distinction Between Actual Prices, Package Rates, and Benchmarks
  describe('9. Distinction Between Actual Prices, Package Rates, and Benchmarks', () => {
    it('strictly separates government package rates from private hospital tariffs and national benchmarks', () => {
      const govtRecord: CostBenchmarkRecord = {
        cost_id: 'COST_GOVT_002',
        canonical_procedure_id: 'PROC_CATARACT',
        canonical_procedure_name: 'Cataract Surgery',
        procedure: 'Cataract Surgery',
        procedure_code: 'PROC_CATARACT',
        specialty: 'Ophthalmology',
        hospital_id: '',
        hospital_name: '',
        city: '',
        state: '',
        geography: 'National',
        room_category: 'General Ward',
        cost_low: 10500,
        cost_typical: 10500,
        cost_high: 10500,
        currency: 'INR',
        benchmark_level: 'government_package',
        source_type: 'government_package',
        source_name: 'NHA AB-PMJAY',
        source_url: 'https://pmjay.gov.in',
        source_document: 'HBP 2.2',
        source_page: '12',
        source_date: '2022',
        data_year: 2022,
        confidence_level: 'high',
        notes: '',
        source_status: 'VERIFIED',
        active: true
      };

      const nationalRecord: CostBenchmarkRecord = {
        cost_id: 'COST_NAT_001',
        canonical_procedure_id: 'PROC_CATARACT',
        canonical_procedure_name: 'Cataract Surgery',
        procedure: 'Cataract Surgery',
        procedure_code: 'PROC_CATARACT',
        specialty: 'Ophthalmology',
        hospital_id: '',
        hospital_name: '',
        city: '',
        state: '',
        geography: 'India',
        room_category: 'General Ward',
        cost_low: 25000,
        cost_typical: 35000,
        cost_high: 50000,
        currency: 'INR',
        benchmark_level: 'national_benchmark',
        source_type: 'benchmark',
        source_name: 'Insurance Information Bureau (IIB)',
        source_url: '',
        source_document: 'Annual Health Report',
        source_page: '24',
        source_date: '2023',
        data_year: 2023,
        confidence_level: 'medium',
        notes: '',
        source_status: 'UNVERIFIED',
        active: false
      };

      const govtAudit = validateCostBenchmarkRecord(govtRecord);
      const natAudit = validateCostBenchmarkRecord(nationalRecord);

      expect(govtAudit.sourceTypeClassification).toBe('government_package');
      expect(natAudit.sourceTypeClassification).toBe('national_benchmark');
      expect(govtAudit.sourceTypeClassification).not.toBe(natAudit.sourceTypeClassification);
    });
  });

  // 10. Dataset Ingestion and Runtime Compatibility
  describe('10. Dataset Ingestion and Runtime Compatibility', () => {
    it('successfully loads production hospitals dataset with non-zero records', () => {
      const stats = hospitalService.getDatasetStats();
      expect(stats.totalRecordsParsed).toBeGreaterThan(50000);
      expect(stats.validRecordsLoaded).toBeGreaterThan(50000);
      expect(stats.malformedRecordsRejected).toBeLessThan(100);
    });

    it('correctly loads verified active cost benchmarks', () => {
      const activeBenchmarks = costService.getActiveBenchmarks();
      expect(activeBenchmarks.length).toBe(8);
      for (const bm of activeBenchmarks) {
        expect(bm.source_status).toBe('VERIFIED');
        expect(bm.active).toBe(true);
        expect(bm.cost_typical).toBeGreaterThan(0);
        expect(bm.benchmark_level).toBe('government_package');
      }
    });
  });

  // 11. Existing Recommendation Behavior and Specialty Filtering
  describe('11. Existing Recommendation Behavior and Specialty Filtering', () => {
    it('ensures hospitals lacking the requested specialty are NOT returned when specialty filter is applied', () => {
      const mockPolicy: PolicyDocument = {
        policyId: 'TEST_POL_001',
        policyNumber: 'POL-12345',
        insurer: 'HDFC ERGO General Insurance',
        policyType: 'Family Floater',
        sumInsured: 500000,
        copay: 0,
        networkHospitals: [],
        roomRentLimit: { type: 'none', value: null },
        icuLimit: { type: 'none', value: null }
      };

      const result = hospitalService.search({
        policy: mockPolicy,
        city: 'Bengaluru',
        specialty: 'Ophthalmology'
      });

      expect(result.hospitals.length).toBeGreaterThan(0);
      for (const item of result.hospitals.slice(0, 20)) {
        const h = item.hospital;
        // Each matched hospital must either have Ophthalmology in specialties or have an eye-related keyword in name
        const hasSpec = h.specialties.some(s => s.toLowerCase().includes('ophthalmology') || s.toLowerCase().includes('eye'));
        const hasEyeInName = /eye|netra|drishti|vision|retina/i.test(h.hospital_name);
        expect(hasSpec || hasEyeInName).toBe(true);
      }
    });
  });

  // 12. Repeated Execution of the Validation Pipeline (Idempotence)
  describe('12. Repeated Execution of the Validation Pipeline', () => {
    it('executes repeatedly without mutating records or altering validation metrics', () => {
      const sampleHospitals = hospitalService.getHospitals('Bengaluru').slice(0, 100);
      const mockBenchmarks: CostBenchmarkRecord[] = [
        {
          cost_id: 'COST_TEST_1',
          canonical_procedure_id: 'PROC_CATARACT',
          canonical_procedure_name: 'Cataract Surgery',
          procedure: 'Cataract Surgery',
          procedure_code: 'PROC_CATARACT',
          specialty: 'Ophthalmology',
          hospital_id: '',
          hospital_name: '',
          city: '',
          state: '',
          geography: 'National',
          room_category: 'General Ward',
          cost_low: 10500,
          cost_typical: 10500,
          cost_high: 10500,
          currency: 'INR',
          benchmark_level: 'government_package',
          source_type: 'government_package',
          source_name: 'NHA AB-PMJAY',
          source_url: 'https://pmjay.gov.in',
          source_document: 'HBP 2.2',
          source_page: '12',
          source_date: '2022',
          data_year: 2022,
          confidence_level: 'high',
          notes: '',
          source_status: 'VERIFIED',
          active: true
        }
      ];

      const report1 = dataValidationService.validateCompleteDataset(sampleHospitals, mockBenchmarks, 'HDFC ERGO General Insurance');
      const report2 = dataValidationService.validateCompleteDataset(sampleHospitals, mockBenchmarks, 'HDFC ERGO General Insurance');

      expect(report1.totalHospitalsChecked).toBe(report2.totalHospitalsChecked);
      expect(report1.validHospitalsCount).toBe(report2.validHospitalsCount);
      expect(report1.exactDuplicatesDetected).toBe(report2.exactDuplicatesDetected);
      expect(report1.distinctBranchesPreserved).toBe(report2.distinctBranchesPreserved);
      expect(report1.activeVerifiedCostsCount).toBe(report2.activeVerifiedCostsCount);
      expect(report1.isIdempotent).toBe(true);
    });
  });
});
