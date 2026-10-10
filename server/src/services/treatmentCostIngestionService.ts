import {
  CostBenchmarkRecord,
  TreatmentPriceClassification,
  TreatmentPricePackageTerms,
  CostSourceStatus,
  CostConfidenceLevel,
  BenchmarkLevel
} from '../types/cost.js';
import { normalizeProcedure, CANONICAL_PROCEDURES } from './procedureNormalizerService.js';
import { normalizeHospitalIdentity } from './dataValidationService.js';

export interface RawCostObservation {
  cost_id?: string;
  procedure_raw: string;
  procedure_code?: string;
  specialty?: string;
  hospital_name?: string;
  branch_name?: string;
  hospital_id?: string;
  hospital_type?: string;
  city?: string;
  state?: string;
  room_category?: string;
  cost_low: number | string;
  cost_typical?: number | string;
  cost_high: number | string;
  currency?: string;
  unit?: string;
  price_classification?: string;
  source_type?: string;
  source_name: string;
  source_document?: string;
  source_url?: string;
  source_page?: string;
  source_date?: string;
  data_year?: number | string;
  date_verified?: string;
  source_status?: string;
  active?: boolean | string;
  package_inclusions?: string[] | string;
  package_exclusions?: string[] | string;
  package_conditions?: string[] | string;
  notes?: string;
}

export interface IngestionValidationIssue {
  recordIndex: number;
  costId: string;
  field: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  value?: unknown;
}

export interface IngestionReport {
  timestamp: string;
  totalRecordsProcessed: number;
  acceptedCount: number;
  rejectedCount: number;
  warningCount: number;
  exactDuplicatesCount: number;
  recordsByClassification: Record<TreatmentPriceClassification, number>;
  procedureCoverage: Record<string, number>;
  geographicCoverage: Record<string, number>;
  validationIssues: IngestionValidationIssue[];
  isIdempotent: boolean;
}

/**
 * Standardizes treatment price classification strings into explicit canonical enums.
 */
export function normalizePriceClassification(raw?: string, sourceType?: string, benchmarkLevel?: string): TreatmentPriceClassification {
  const norm = (raw || '').toLowerCase().trim();
  const sType = (sourceType || '').toLowerCase().trim();
  const bLevel = (benchmarkLevel || '').toLowerCase().trim();

  // Explicit classification takes precedence
  if (norm === 'government_package_rate') return 'government_package_rate';
  if (norm === 'actual_hospital_tariff') return 'actual_hospital_tariff';
  if (norm === 'hospital_package_price') return 'hospital_package_price';
  if (norm === 'regional_benchmark') return 'regional_benchmark';
  if (norm === 'national_benchmark') return 'national_benchmark';
  if (norm === 'historical_observation') return 'historical_observation';
  if (norm === 'unverified_price') return 'unverified_price';

  // Fallback to source_type and benchmark_level
  if (sType === 'hospital_tariff') return 'actual_hospital_tariff';
  if (sType.includes('hospital_package')) return 'hospital_package_price';
  if (sType.includes('government') || bLevel === 'government_package') return 'government_package_rate';
  if (sType.includes('regional') || bLevel.includes('regional') || bLevel === 'state_benchmark') return 'regional_benchmark';
  if (sType.includes('national') || bLevel === 'national_benchmark' || bLevel === 'national') return 'national_benchmark';
  if (sType === 'historical_observation') return 'historical_observation';
  return 'unverified_price';
}

/**
 * Normalizes array or delimited string into string array
 */
function parseStringList(val?: string[] | string): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean);
  return String(val)
    .split(/[;|,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Service to validate, normalize, and ingest evidence-backed treatment cost observations.
 */
export class TreatmentCostIngestionService {
  private static instance: TreatmentCostIngestionService | null = null;

  public static getInstance(): TreatmentCostIngestionService {
    if (!TreatmentCostIngestionService.instance) {
      TreatmentCostIngestionService.instance = new TreatmentCostIngestionService();
    }
    return TreatmentCostIngestionService.instance;
  }

  /**
   * Generates a deterministic signature to identify exact duplicates across procedure, facility, room, and source.
   */
  public generateCostSignature(record: {
    canonical_procedure_id: string;
    hospital_name: string;
    branch_name?: string;
    city: string;
    room_category: string;
    source_name: string;
    data_year: number;
    price_classification?: string;
  }): string {
    const p = record.canonical_procedure_id.trim().toLowerCase();
    const h = (record.hospital_name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const b = (record.branch_name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const c = (record.city || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const r = (record.room_category || 'General Ward').trim().toLowerCase();
    const s = (record.source_name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const y = record.data_year || 2024;
    return `${p}:::${h}:::${b}:::${c}:::${r}:::${s}:::${y}`;
  }

  /**
   * Ingests, validates, and normalizes a batch of raw treatment cost observations.
   */
  public ingestCostRecords(rawRecords: RawCostObservation[]): {
    ingestedRecords: CostBenchmarkRecord[];
    report: IngestionReport;
  } {
    const issues: IngestionValidationIssue[] = [];
    const validRecords: CostBenchmarkRecord[] = [];
    const seenSignatures = new Set<string>();

    let exactDuplicatesCount = 0;
    const classificationCounts: Record<TreatmentPriceClassification, number> = {
      actual_hospital_tariff: 0,
      hospital_package_price: 0,
      government_package_rate: 0,
      regional_benchmark: 0,
      national_benchmark: 0,
      historical_observation: 0,
      unverified_price: 0
    };
    const procedureCoverage: Record<string, number> = {};
    const geographicCoverage: Record<string, number> = {};

    for (let i = 0; i < rawRecords.length; i++) {
      const raw = rawRecords[i];
      const recordIssues: IngestionValidationIssue[] = [];
      const costId = raw.cost_id ? String(raw.cost_id).trim() : `COST_INGEST_${i + 1}`;

      // 1. Procedure Normalization
      const procNorm = normalizeProcedure(raw.procedure_raw);
      let canonicalProcId = procNorm.canonical_procedure_id || raw.procedure_code || '';
      let canonicalProcName = procNorm.canonical_procedure_name || raw.procedure_raw.trim();

      if (!canonicalProcId || canonicalProcId === 'PROC_UNKNOWN') {
        recordIssues.push({
          recordIndex: i,
          costId,
          field: 'procedure_raw',
          severity: 'ERROR',
          message: `Unknown or unmappable clinical procedure: "${raw.procedure_raw}"`,
          value: raw.procedure_raw
        });
      }

      // 2. Pricing Boundaries
      const costLow = typeof raw.cost_low === 'number' ? raw.cost_low : parseFloat(String(raw.cost_low));
      const costHigh = typeof raw.cost_high === 'number' ? raw.cost_high : parseFloat(String(raw.cost_high));
      const costTyp = raw.cost_typical !== undefined && raw.cost_typical !== null
        ? (typeof raw.cost_typical === 'number' ? raw.cost_typical : parseFloat(String(raw.cost_typical)))
        : (!isNaN(costLow) && !isNaN(costHigh) ? Math.round((costLow + costHigh) / 2) : NaN);

      if (isNaN(costLow) || costLow <= 0) {
        recordIssues.push({
          recordIndex: i,
          costId,
          field: 'cost_low',
          severity: 'ERROR',
          message: `Invalid cost_low (${raw.cost_low}). Must be a positive number.`,
          value: raw.cost_low
        });
      }

      if (isNaN(costHigh) || costHigh < costLow) {
        recordIssues.push({
          recordIndex: i,
          costId,
          field: 'cost_high',
          severity: 'ERROR',
          message: `Invalid cost_high (${raw.cost_high}). Cannot be less than cost_low (${costLow}).`,
          value: raw.cost_high
        });
      }

      // 3. Currency Validation
      const currency = (raw.currency || 'INR').toUpperCase().trim();
      if (currency !== 'INR') {
        recordIssues.push({
          recordIndex: i,
          costId,
          field: 'currency',
          severity: 'ERROR',
          message: `Unsupported currency (${currency}). SehatSure mandates INR.`,
          value: currency
        });
      }

      // 4. Source Provenance
      if (!raw.source_name || raw.source_name.trim().length === 0) {
        recordIssues.push({
          recordIndex: i,
          costId,
          field: 'source_name',
          severity: 'ERROR',
          message: 'Authoritative source_name is required for every price observation',
          value: raw.source_name
        });
      }

      // 5. Data Year & Dates
      const dataYear = typeof raw.data_year === 'number' ? raw.data_year : parseInt(String(raw.data_year || '2024'), 10);
      if (isNaN(dataYear) || dataYear < 2018 || dataYear > 2030) {
        recordIssues.push({
          recordIndex: i,
          costId,
          field: 'data_year',
          severity: 'WARNING',
          message: `Unusual data_year (${raw.data_year}). Expected between 2018 and 2030.`,
          value: raw.data_year
        });
      }

      // 6. Classification
      const classification = normalizePriceClassification(raw.price_classification, raw.source_type, undefined);

      // Check Government vs Private tariff separation
      if (classification === 'government_package_rate' && (raw.hospital_type || '').toLowerCase() === 'private' && (raw.source_type || '').toLowerCase() === 'hospital_tariff') {
        recordIssues.push({
          recordIndex: i,
          costId,
          field: 'price_classification',
          severity: 'ERROR',
          message: 'Conflict: Statutory government package rates cannot be labeled as private hospital tariffs',
          value: classification
        });
      }

      // 7. Identity & Branch
      const normHosp = raw.hospital_name ? normalizeHospitalIdentity(raw.hospital_name).normalizedName : '';
      const normCity = raw.city ? raw.city.trim() : (classification === 'government_package_rate' ? 'National' : 'Unknown');
      const normState = raw.state ? raw.state.trim() : '';
      const roomCat = raw.room_category ? raw.room_category.trim() : 'General Ward';

      // 8. Duplicate Detection
      const sig = this.generateCostSignature({
        canonical_procedure_id: canonicalProcId,
        hospital_name: normHosp,
        branch_name: raw.branch_name,
        city: normCity,
        room_category: roomCat,
        source_name: raw.source_name || '',
        data_year: isNaN(dataYear) ? 2024 : dataYear,
        price_classification: classification
      });

      if (seenSignatures.has(sig)) {
        exactDuplicatesCount++;
        recordIssues.push({
          recordIndex: i,
          costId,
          field: 'identity',
          severity: 'ERROR',
          message: `Exact duplicate price observation detected for signature: ${sig}`,
          value: sig
        });
      } else {
        seenSignatures.add(sig);
      }

      // Collect issues
      for (const iss of recordIssues) {
        issues.push(iss);
      }

      const hasBlockingError = recordIssues.some(iss => iss.severity === 'ERROR');
      if (hasBlockingError) {
        continue;
      }

      // Construct normalized record
      const isActive = raw.active === true || raw.active === 'true' || raw.active === 'TRUE';
      const sourceStatus = (raw.source_status as CostSourceStatus) || (isActive ? 'VERIFIED' : 'UNVERIFIED');
      let bLevel: BenchmarkLevel = 'national_benchmark';
      if (classification === 'government_package_rate') bLevel = 'government_package';
      else if (classification === 'actual_hospital_tariff' || classification === 'hospital_package_price') bLevel = 'hospital_specific';
      else if (classification === 'regional_benchmark') bLevel = 'state_benchmark';

      const packageTerms: TreatmentPricePackageTerms = {
        inclusions: parseStringList(raw.package_inclusions),
        exclusions: parseStringList(raw.package_exclusions),
        conditions: parseStringList(raw.package_conditions)
      };

      const ingested: CostBenchmarkRecord = {
        cost_id: costId,
        canonical_procedure_id: canonicalProcId,
        canonical_procedure_name: canonicalProcName,
        procedure: canonicalProcName,
        procedure_code: canonicalProcId,
        specialty: raw.specialty || (procNorm as any).specialty || 'General Surgery',
        hospital_id: raw.hospital_id || '',
        hospital_name: normHosp,
        branch_name: raw.branch_name ? raw.branch_name.trim() : undefined,
        hospital_type: raw.hospital_type || (classification === 'government_package_rate' ? 'Government' : 'Private'),
        city: normCity,
        state: normState,
        geography: normCity === 'National' ? 'India' : (normState ? `${normCity}, ${normState}` : normCity),
        room_category: roomCat,
        cost_low: costLow,
        cost_typical: !isNaN(costTyp) ? costTyp : Math.round((costLow + costHigh) / 2),
        cost_high: costHigh,
        reference_rate: !isNaN(costTyp) ? costTyp : costLow,
        currency: 'INR',
        unit: raw.unit || 'Per Procedure Package',
        price_classification: classification,
        benchmark_level: bLevel,
        source_type: raw.source_type || classification,
        source_name: raw.source_name.trim(),
        source_url: raw.source_url || '',
        source_document: raw.source_document || '',
        source_page: raw.source_page || '',
        source_date: raw.source_date || `${dataYear}-01-01`,
        date_verified: raw.date_verified || new Date().toISOString().split('T')[0],
        data_year: isNaN(dataYear) ? 2024 : dataYear,
        confidence_level: (raw.source_status === 'VERIFIED' ? 'high' : 'medium') as CostConfidenceLevel,
        notes: raw.notes || '',
        source_status: sourceStatus,
        active: isActive,
        exact_package_rate: classification.includes('package') ? costTyp : undefined,
        package_terms: packageTerms
      };

      validRecords.push(ingested);
      classificationCounts[classification]++;
      procedureCoverage[canonicalProcName] = (procedureCoverage[canonicalProcName] || 0) + 1;
      geographicCoverage[normCity] = (geographicCoverage[normCity] || 0) + 1;
    }

    const report: IngestionReport = {
      timestamp: new Date().toISOString(),
      totalRecordsProcessed: rawRecords.length,
      acceptedCount: validRecords.length,
      rejectedCount: rawRecords.length - validRecords.length,
      warningCount: issues.filter(i => i.severity === 'WARNING').length,
      exactDuplicatesCount,
      recordsByClassification: classificationCounts,
      procedureCoverage,
      geographicCoverage,
      validationIssues: issues,
      isIdempotent: true
    };

    return {
      ingestedRecords: validRecords,
      report
    };
  }
}

export const treatmentCostIngestionService = TreatmentCostIngestionService.getInstance();
