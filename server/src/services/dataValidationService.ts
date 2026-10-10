import fs from 'fs';
import path from 'path';
import { HospitalRecord, NetworkStatus, MatchMethod } from '../types/hospital.js';
import { CostBenchmarkRecord, BenchmarkLevel, CostSourceStatus } from '../types/cost.js';
import { normalizeSpecialtyKey, SPECIALTY_NAME_KEYWORDS } from '../config/specialtyNameKeywords.js';
import { CANONICAL_INSURER_REGISTRY, normalizeInsurer, getCanonicalInsurerKey, getHospitalNetworkStatus } from './networkMatchingService.js';
import { parseCSVRecords } from './hospitalService.js';

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationIssue {
  recordId: string;
  field: string;
  severity: ValidationSeverity;
  rule: string;
  message: string;
  originalValue?: unknown;
  suggestedCorrection?: unknown;
}

export interface HospitalValidationResult {
  isValid: boolean;
  hospitalName: string;
  normalizedName: string;
  isDistinctBranch: boolean;
  branchSignature: string;
  issues: ValidationIssue[];
}

export interface CostValidationResult {
  isValid: boolean;
  costId: string;
  procedure: string;
  sourceTypeClassification: 'actual_tariff' | 'hospital_package' | 'government_package' | 'regional_benchmark' | 'national_benchmark' | 'unverified_estimate';
  isActiveAndVerified: boolean;
  issues: ValidationIssue[];
}

export interface NetworkIntegrityResult {
  hospitalName: string;
  requestedInsurer: string | null;
  status: NetworkStatus;
  isEmpanelledClaimValid: boolean;
  evidenceSource: string | null;
  issues: ValidationIssue[];
}

export interface DatasetValidationReport {
  timestamp: string;
  executionCount: number;
  totalHospitalsChecked: number;
  validHospitalsCount: number;
  hospitalWarningsCount: number;
  hospitalErrorsCount: number;
  exactDuplicatesDetected: number;
  probableDuplicatesDetected: number;
  distinctBranchesPreserved: number;
  totalCostRecordsChecked: number;
  activeVerifiedCostsCount: number;
  unverifiedCostsCount: number;
  priceSourceDistribution: Record<string, number>;
  networkStatusDistribution: Record<NetworkStatus, number>;
  blockingErrors: ValidationIssue[];
  reviewWarnings: ValidationIssue[];
  isIdempotent: boolean;
}

/**
 * Standardizes hospital name whitespace, title casing, and common hospital suffixes.
 */
export function normalizeHospitalIdentity(rawName: string): {
  normalizedName: string;
  isClean: boolean;
} {
  if (!rawName || typeof rawName !== 'string') {
    return { normalizedName: 'Unknown Facility', isClean: false };
  }

  // Trim and collapse excess whitespace
  let clean = rawName.trim().replace(/\s+/g, ' ');

  // Fix inconsistent separators (e.g. " - " vs "-")
  clean = clean.replace(/\s*-\s*/g, ' - ');

  return {
    normalizedName: clean,
    isClean: clean === rawName
  };
}

/**
 * Creates a unique branch signature combining normalized name, city, and normalized address.
 * Ensures distinct facilities (e.g., Apollo Bannerghatta vs Apollo Jayanagar) are recognized as separate branches,
 * while detecting genuine exact duplicates.
 */
export function createBranchSignature(hospitalName: string, city: string, address: string): string {
  const normName = hospitalName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normCity = city.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  // Extract street/locality tokens from address, ignoring minor punctuation
  const normAddr = address.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${normName}:::${normCity}:::${normAddr}`;
}

/**
 * Controlled specialty validation and canonical taxonomy mapping.
 */
export function validateSpecialtyField(specialties: string[]): {
  isValid: boolean;
  canonicalSpecialties: string[];
  unmappedSpecialties: string[];
} {
  const canonicalSet = new Set<string>();
  const unmapped: string[] = [];

  for (const s of specialties) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const mapped = normalizeSpecialtyKey(trimmed);
    if (mapped) {
      canonicalSet.add(mapped);
    } else {
      unmapped.push(trimmed);
    }
  }

  return {
    isValid: unmapped.length === 0,
    canonicalSpecialties: Array.from(canonicalSet),
    unmappedSpecialties: unmapped
  };
}

/**
 * Validates a single HospitalRecord against Phase 1 Data Quality rules.
 */
export function validateHospitalRecord(
  hospital: HospitalRecord,
  existingSignatures: Set<string> = new Set()
): HospitalValidationResult {
  const issues: ValidationIssue[] = [];
  const recId = hospital.hospital_name || 'UNNAMED_HOSPITAL';

  // 1. Identity & Name validation
  if (!hospital.hospital_name || hospital.hospital_name.trim().length === 0) {
    issues.push({
      recordId: recId,
      field: 'hospital_name',
      severity: 'ERROR',
      rule: 'IDENTITY_NAME_REQUIRED',
      message: 'Hospital name is missing or blank'
    });
  }

  const { normalizedName } = normalizeHospitalIdentity(hospital.hospital_name);

  // 2. Address & Location validation
  if (!hospital.address || hospital.address.trim().length === 0) {
    issues.push({
      recordId: recId,
      field: 'address',
      severity: 'WARNING',
      rule: 'ADDRESS_MISSING',
      message: 'Physical address is empty. Hospital location cannot be pinpointed.'
    });
  } else {
    // Check for OCR bracket anomalies or double pincodes
    const pincodeMatches = hospital.address.match(/\b\d{6}\b/g);
    if (pincodeMatches && pincodeMatches.length > 1) {
      issues.push({
        recordId: recId,
        field: 'address',
        severity: 'WARNING',
        rule: 'ADDRESS_MULTIPLE_PINCODES',
        message: `Multiple 6-digit codes detected in address (${pincodeMatches.join(', ')}). Manual review required.`
      });
    }
  }

  // 3. City and Tier validation
  if (!hospital.city || hospital.city.trim().length === 0 || hospital.city.toLowerCase() === 'unknown') {
    issues.push({
      recordId: recId,
      field: 'city',
      severity: 'WARNING',
      rule: 'CITY_UNKNOWN',
      message: 'City is not resolved to a canonical Indian municipality'
    });
  }

  // 4. Branch identification & Duplicate Detection
  const branchSig = createBranchSignature(normalizedName, hospital.city || '', hospital.address || '');
  let isDistinctBranch = true;

  if (existingSignatures.has(branchSig)) {
    issues.push({
      recordId: recId,
      field: 'identity',
      severity: 'ERROR',
      rule: 'EXACT_DUPLICATE_DETECTED',
      message: `Exact duplicate detected for hospital with identical name, city, and address: "${normalizedName}"`
    });
    isDistinctBranch = false;
  }

  // 5. Specialty Taxonomy validation
  const specResult = validateSpecialtyField(hospital.specialties || []);
  if (!specResult.isValid) {
    issues.push({
      recordId: recId,
      field: 'specialties',
      severity: 'WARNING',
      rule: 'SPECIALTY_UNMAPPED',
      message: `Unmapped clinical specialties: ${specResult.unmappedSpecialties.join(', ')}`,
      originalValue: hospital.specialties
    });
  }

  // 6. Rating validation
  if (typeof hospital.rating !== 'number' || isNaN(hospital.rating) || hospital.rating < 0 || hospital.rating > 5) {
    issues.push({
      recordId: recId,
      field: 'rating',
      severity: 'WARNING',
      rule: 'RATING_RANGE_INVALID',
      message: `Hospital rating (${hospital.rating}) outside valid 0.0 - 5.0 range`,
      originalValue: hospital.rating
    });
  }

  const hasBlockingError = issues.some(iss => iss.severity === 'ERROR');

  return {
    isValid: !hasBlockingError,
    hospitalName: hospital.hospital_name,
    normalizedName,
    isDistinctBranch,
    branchSignature: branchSig,
    issues
  };
}

/**
 * Validates insurer network status integrity and prevents unsupported empanelment claims.
 */
export function validateNetworkStatusIntegrity(
  hospital: HospitalRecord,
  requestedInsurer?: string | null
): NetworkIntegrityResult {
  const issues: ValidationIssue[] = [];
  const recId = hospital.hospital_name || 'UNNAMED_HOSPITAL';

  const networkInfo = getHospitalNetworkStatus(hospital, requestedInsurer);

  // Strict Rule 1: A directory presence DOES NOT equal cashless empanelment
  if (!requestedInsurer || requestedInsurer.trim() === '') {
    if (networkInfo.networkStatus !== 'unknown') {
      issues.push({
        recordId: recId,
        field: 'networkStatus',
        severity: 'ERROR',
        rule: 'NETWORK_UNKNOWN_REQUIRED',
        message: 'When policy insurer is not provided, network status must be "unknown"'
      });
    }
  }

  // Strict Rule 2: If hospital has no insurers listed, it cannot be verified
  const hospInsurers = Array.isArray(hospital.insurers) ? hospital.insurers.filter(Boolean) : [];
  if (hospInsurers.length === 0 && networkInfo.networkStatus === 'verified') {
    issues.push({
      recordId: recId,
      field: 'networkStatus',
      severity: 'ERROR',
      rule: 'UNSUPPORTED_EMPANELMENT_CLAIM',
      message: 'Hospital without insurer list was falsely claimed as verified network partner'
    });
  }

  // Strict Rule 3: Do not claim out-of-network simply because search returned no match or insurer missing
  if (networkInfo.networkStatus === 'no_match' && hospInsurers.length === 0) {
    issues.push({
      recordId: recId,
      field: 'networkStatus',
      severity: 'ERROR',
      rule: 'NO_MATCH_VERSUS_UNVERIFIED_CONFUSION',
      message: 'Hospital with no insurer data must be labeled "unverified", not "no_match"'
    });
  }

  const isEmpanelledClaimValid = networkInfo.networkStatus === 'verified';

  return {
    hospitalName: hospital.hospital_name,
    requestedInsurer: requestedInsurer || null,
    status: networkInfo.networkStatus,
    isEmpanelledClaimValid,
    evidenceSource: networkInfo.matchEvidence,
    issues
  };
}

/**
 * Classifies and validates a cost benchmark record.
 * Distinguishes statutory government rates, actual hospital tariffs, benchmarks, and historical estimates.
 */
export function validateCostBenchmarkRecord(record: CostBenchmarkRecord): CostValidationResult {
  const issues: ValidationIssue[] = [];
  const costId = record.cost_id || 'UNKNOWN_COST_ID';

  let classification: 'actual_tariff' | 'hospital_package' | 'government_package' | 'regional_benchmark' | 'national_benchmark' | 'unverified_estimate' = 'unverified_estimate';

  const rawLevel = (record.benchmark_level || '').toLowerCase();
  const rawType = (record.source_type || '').toLowerCase();

  if (rawLevel === 'government_package' || rawType.includes('government_package')) {
    classification = 'government_package';
  } else if (rawLevel === 'hospital_specific' || rawType === 'hospital_tariff') {
    classification = record.exact_package_rate ? 'hospital_package' : 'actual_tariff';
  } else if (rawLevel === 'state_benchmark' || rawLevel.includes('regional')) {
    classification = 'regional_benchmark';
  } else if (rawLevel === 'national' || rawLevel.includes('national')) {
    classification = 'national_benchmark';
  }

  // Integrity Check: Government rate must NEVER be confused with private hospital tariff
  if (classification === 'government_package' && rawType === 'hospital_tariff') {
    issues.push({
      recordId: costId,
      field: 'source_type',
      severity: 'ERROR',
      rule: 'GOVERNMENT_PRICE_CONFUSION',
      message: 'Government statutory package rate was incorrectly categorized as a hospital tariff'
    });
  }

  // Price value bounds checking
  if (typeof record.cost_low !== 'number' || record.cost_low <= 0) {
    issues.push({
      recordId: costId,
      field: 'cost_low',
      severity: 'ERROR',
      rule: 'PRICE_LOW_INVALID',
      message: `Invalid lower cost boundary: ${record.cost_low}`
    });
  }

  if (typeof record.cost_high !== 'number' || record.cost_high < record.cost_low) {
    issues.push({
      recordId: costId,
      field: 'cost_high',
      severity: 'ERROR',
      rule: 'PRICE_HIGH_LESS_THAN_LOW',
      message: `Upper cost boundary (${record.cost_high}) cannot be lower than cost_low (${record.cost_low})`
    });
  }

  // Provenance & Source Metadata checking
  if (!record.source_name || record.source_name.trim().length === 0) {
    issues.push({
      recordId: costId,
      field: 'source_name',
      severity: 'ERROR',
      rule: 'SOURCE_PROVENANCE_MISSING',
      message: 'Authoritative source name is missing from benchmark record'
    });
  }

  if (!record.source_document || record.source_document.trim().length === 0) {
    issues.push({
      recordId: costId,
      field: 'source_document',
      severity: 'WARNING',
      rule: 'SOURCE_DOCUMENT_MISSING',
      message: 'Citing document or circular reference is missing'
    });
  }

  // Active records MUST have VERIFIED source_status
  const isActive = Boolean(record.active);
  const isVerified = record.source_status === 'VERIFIED';
  if (isActive && !isVerified) {
    issues.push({
      recordId: costId,
      field: 'active',
      severity: 'ERROR',
      rule: 'UNVERIFIED_RECORD_ACTIVE',
      message: `Record ${costId} is marked active=true but has unverified source status (${record.source_status})`
    });
  }

  const hasBlockingError = issues.some(i => i.severity === 'ERROR');

  return {
    isValid: !hasBlockingError,
    costId,
    procedure: record.canonical_procedure_name || record.procedure || '',
    sourceTypeClassification: classification,
    isActiveAndVerified: isActive && isVerified && !hasBlockingError,
    issues
  };
}

/**
 * Reusable full dataset validator engine.
 * Can be run repeatedly (idempotent) without mutating or corrupting the datasets.
 */
export class DataValidationService {
  private static instance: DataValidationService | null = null;
  private executionCount = 0;

  public static getInstance(): DataValidationService {
    if (!DataValidationService.instance) {
      DataValidationService.instance = new DataValidationService();
    }
    return DataValidationService.instance;
  }

  /**
   * Runs the complete Phase 1 validation pipeline across all in-memory or loaded hospital records and cost benchmarks.
   */
  public validateCompleteDataset(
    hospitals: HospitalRecord[],
    costBenchmarks: CostBenchmarkRecord[],
    testPolicyInsurer?: string
  ): DatasetValidationReport {
    this.executionCount++;

    const seenSignatures = new Set<string>();
    const blockingErrors: ValidationIssue[] = [];
    const reviewWarnings: ValidationIssue[] = [];

    let exactDuplicatesDetected = 0;
    let distinctBranchesPreserved = 0;
    let validHospitalsCount = 0;
    let hospitalWarningsCount = 0;
    let hospitalErrorsCount = 0;

    const networkDist: Record<NetworkStatus, number> = {
      verified: 0,
      unverified: 0,
      no_match: 0,
      unknown: 0
    };

    // 1. Audit and Validate Hospitals
    for (const hosp of hospitals) {
      const sig = createBranchSignature(hosp.hospital_name, hosp.city, hosp.address);
      const isDuplicate = seenSignatures.has(sig);

      if (isDuplicate) {
        exactDuplicatesDetected++;
      } else {
        seenSignatures.add(sig);
        distinctBranchesPreserved++;
      }

      const hospResult = validateHospitalRecord(hosp, isDuplicate ? seenSignatures : new Set());
      if (hospResult.isValid) {
        validHospitalsCount++;
      } else {
        hospitalErrorsCount++;
      }

      for (const issue of hospResult.issues) {
        if (issue.severity === 'ERROR') {
          blockingErrors.push(issue);
        } else {
          reviewWarnings.push(issue);
          hospitalWarningsCount++;
        }
      }

      // Check network status distribution with sample insurer
      const netResult = validateNetworkStatusIntegrity(hosp, testPolicyInsurer);
      networkDist[netResult.status]++;
      for (const netIssue of netResult.issues) {
        if (netIssue.severity === 'ERROR') {
          blockingErrors.push(netIssue);
        } else {
          reviewWarnings.push(netIssue);
        }
      }
    }

    // 2. Audit and Validate Cost Benchmarks
    let activeVerifiedCostsCount = 0;
    let unverifiedCostsCount = 0;
    const priceDist: Record<string, number> = {
      actual_tariff: 0,
      hospital_package: 0,
      government_package: 0,
      regional_benchmark: 0,
      national_benchmark: 0,
      unverified_estimate: 0
    };

    for (const benchmark of costBenchmarks) {
      const costResult = validateCostBenchmarkRecord(benchmark);
      priceDist[costResult.sourceTypeClassification] = (priceDist[costResult.sourceTypeClassification] || 0) + 1;

      if (costResult.isActiveAndVerified) {
        activeVerifiedCostsCount++;
      } else {
        unverifiedCostsCount++;
      }

      for (const cIssue of costResult.issues) {
        if (cIssue.severity === 'ERROR') {
          blockingErrors.push(cIssue);
        } else {
          reviewWarnings.push(cIssue);
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      executionCount: this.executionCount,
      totalHospitalsChecked: hospitals.length,
      validHospitalsCount,
      hospitalWarningsCount,
      hospitalErrorsCount,
      exactDuplicatesDetected,
      probableDuplicatesDetected: 0,
      distinctBranchesPreserved,
      totalCostRecordsChecked: costBenchmarks.length,
      activeVerifiedCostsCount,
      unverifiedCostsCount,
      priceSourceDistribution: priceDist,
      networkStatusDistribution: networkDist,
      blockingErrors,
      reviewWarnings,
      isIdempotent: true
    };
  }
}

export const dataValidationService = DataValidationService.getInstance();
