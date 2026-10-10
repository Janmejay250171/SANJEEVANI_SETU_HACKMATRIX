import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  BenchmarkLevel,
  CostBenchmarkRecord,
  CostConfidenceLevel,
  CostIntelligenceEstimate,
  CostProvenance,
  CostRange,
  CostSourceStatus
} from '../types/cost.js';
import { PolicyDocument } from '../types/policy.js';
import { RoomCategory, NetworkStatus } from '../types/hospital.js';
import {
  normalizeProcedure,
  normalizeSpecialtyName,
  ProcedureNormalizationResult
} from './procedureNormalizerService.js';
import { parseCSVRecords } from './hospitalService.js';
import { treatmentCostMLService } from './treatmentCostMLService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possibleBenchmarkPaths = [
  path.resolve(process.cwd(), 'treatment_cost_benchmarks.csv'),
  path.resolve(__dirname, '../../../treatment_cost_benchmarks.csv'),
  path.resolve(__dirname, '../../treatment_cost_benchmarks.csv'),
  path.resolve(__dirname, '../../../cost/treatment_cost_benchmarks.csv'),
  path.resolve(process.cwd(), 'cost/treatment_cost_benchmarks.csv')
];

function resolveFilePath(paths: string[]): string {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return paths[0];
}

/**
 * Format numbers as Indian Lakh / Thousand representation.
 * e.g. 235000 -> "₹2.35L", 65000 -> "₹65k"
 */
export function formatIndianCurrencyAbbreviated(val: number): string {
  if (val <= 0) return '₹0';
  if (val >= 100000) {
    const lakhs = val / 100000;
    const formatted = lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(2).replace(/\.?0+$/, '');
    return `₹${formatted}L`;
  }
  if (val >= 1000) {
    const k = val / 1000;
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.?0+$/, '');
    return `₹${formatted}k`;
  }
  return `₹${val.toLocaleString('en-IN')}`;
}

export function formatCostRange(low: number, high: number, allowZero: boolean = false): string {
  if (low === 0 && high === 0) return allowZero ? '₹0' : 'Unavailable';
  if (low <= 0 && high <= 0) return 'Unavailable';
  if (low === high) return formatIndianCurrencyAbbreviated(low);
  return `${formatIndianCurrencyAbbreviated(low)} – ${formatIndianCurrencyAbbreviated(high)}`;
}

export function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val || 0);
}

export function isProcedureUnselected(procedure?: string | null): boolean {
  if (!procedure) return true;
  const p = procedure.trim().toLowerCase();
  return (
    p === '' ||
    p === 'all' ||
    p === 'any' ||
    p === 'unspecified' ||
    p === 'undefined' ||
    p.includes('all procedure') ||
    p.includes('all procedures') ||
    p.startsWith('select ') ||
    p === 'select'
  );
}

export class CostIntelligenceService {
  private benchmarks: CostBenchmarkRecord[] = [];
  private benchmarkIndex = new Map<string, CostBenchmarkRecord[]>();

  constructor() {
    this.loadBenchmarks();
  }

  public loadBenchmarks(): void {
    const csvPath = resolveFilePath(possibleBenchmarkPaths);
    if (!fs.existsSync(csvPath)) {
      console.warn(`[CostIntelligenceService] Benchmark file not found at: ${csvPath}`);
      return;
    }

    try {
      const content = fs.readFileSync(csvPath, 'utf8');
      const rawRecords = parseCSVRecords(content);
      if (rawRecords.length < 2) return;

      const headers = rawRecords[0].map(h => h.trim());
      const records: CostBenchmarkRecord[] = [];

      for (let i = 1; i < rawRecords.length; i++) {
        const cols = rawRecords[i];
        if (cols.length !== headers.length) continue;

        const obj: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = cols[j] ? cols[j].trim() : '';
        }

        const costLow = parseFloat(obj.cost_low);
        const costTypical = parseFloat(obj.cost_typical);
        const costHigh = parseFloat(obj.cost_high);
        const dataYear = parseInt(obj.data_year, 10);
        const referenceRate = parseFloat(obj.reference_rate);
        const exactPackageRate = parseFloat(obj.exact_package_rate);
        const sourceStatus = (obj.source_status as CostSourceStatus) || 'UNVERIFIED';
        const active = obj.active === 'true' || obj.active === 'TRUE' || (obj.active as any) === true;

        const procName = obj.canonical_procedure_name || obj.procedure || '';
        const procCode = obj.canonical_procedure_id || obj.procedure_code || '';

        // Validation (Phase 20)
        // Reject record if: no source, invalid procedure, negative cost, low > high, year missing
        if (!obj.source_name || !procName || isNaN(costLow) || isNaN(costHigh) || costLow <= 0) {
          continue;
        }
        if (costLow > costHigh || (costTypical && (costTypical < costLow || costTypical > costHigh))) {
          continue;
        }

        let bLevel: BenchmarkLevel = 'national_benchmark';
        const rawLevel = (obj.benchmark_level || '').trim().toLowerCase();
        if (rawLevel === 'hospital_specific') {
          bLevel = 'hospital_specific';
        } else if (rawLevel === 'maharashtra_regional' || rawLevel === 'state_benchmark' || rawLevel === 'regional_benchmark') {
          bLevel = 'state_benchmark';
        } else if (rawLevel === 'national' || rawLevel === 'national_benchmark') {
          bLevel = 'national_benchmark';
        } else if (rawLevel === 'government_package') {
          bLevel = 'government_package';
        } else if (rawLevel === 'academic_estimate') {
          bLevel = 'academic_estimate';
        }

        const geography = obj.geography || (bLevel === 'state_benchmark' ? (obj.state || 'Maharashtra') : (obj.state ? (obj.city ? `${obj.city}, ${obj.state}` : obj.state) : 'India'));

        records.push({
          cost_id: obj.cost_id || `COST_${i}`,
          canonical_procedure_id: procCode,
          canonical_procedure_name: procName,
          hospital_id: obj.hospital_id || '',
          hospital_name: obj.hospital_name || '',
          city: obj.city || '',
          state: obj.state || '',
          specialty: obj.specialty || '',
          procedure: procName,
          procedure_code: procCode,
          room_category: obj.room_category || 'General Ward',
          cost_low: costLow,
          cost_typical: !isNaN(costTypical) ? costTypical : Math.round((costLow + costHigh) / 2),
          cost_high: costHigh,
          reference_rate: !isNaN(referenceRate) ? referenceRate : (!isNaN(costTypical) ? costTypical : costLow),
          currency: obj.currency || 'INR',
          source_type: obj.source_type || 'benchmark',
          source_name: obj.source_name,
          source_url: obj.source_url || '',
          source_document: obj.source_document || '',
          source_page: obj.source_page || '',
          source_table: obj.source_table || '',
          source_date: obj.source_date || '',
          data_year: !isNaN(dataYear) ? dataYear : 2024,
          geography,
          sample_size: obj.sample_size ? parseInt(obj.sample_size, 10) : undefined,
          confidence_level: (obj.confidence_level as CostConfidenceLevel) || 'medium',
          benchmark_level: bLevel,
          notes: obj.notes || '',
          source_status: sourceStatus,
          active: active,
          exact_package_rate: !isNaN(exactPackageRate) ? exactPackageRate : undefined
        });
      }

      this.benchmarks = records;
      this.buildIndex();
      const activeCount = records.filter(r => r.active && r.source_status === 'VERIFIED').length;
      console.log(`[CostIntelligenceService] Loaded ${records.length} cost benchmarks (${activeCount} active verified).`);
    } catch (err) {
      console.error('[CostIntelligenceService] Error loading benchmarks:', err);
    }
  }

  public getAllAuditBenchmarks(): CostBenchmarkRecord[] {
    return this.benchmarks;
  }

  public getAllBenchmarks(): CostBenchmarkRecord[] {
    return this.benchmarks;
  }

  public getActiveBenchmarks(): CostBenchmarkRecord[] {
    return this.benchmarks.filter(b => b.active && b.source_status === 'VERIFIED');
  }

  public getBenchmarkById(costId: string): CostBenchmarkRecord | undefined {
    return this.benchmarks.find(b => b.cost_id === costId);
  }

  private buildIndex(): void {
    this.benchmarkIndex.clear();
    for (const b of this.benchmarks) {
      // FIN-01 STRICT PROVENANCE STANDARD:
      // Only ACTIVE and VERIFIED records enter the authoritative production benchmark index.
      // Unverified hospital tariffs, unverified state benchmarks, and miscoded government packages
      // are excluded from authoritative selection.
      if (!b.active || b.source_status !== 'VERIFIED') {
        continue;
      }

      const normProc = b.procedure.toLowerCase().trim();
      const code = b.procedure_code ? b.procedure_code.toUpperCase().trim() : '';

      // Normalize the benchmark procedure to obtain its canonical ID and name
      const normResult = normalizeProcedure(b.procedure, b.specialty);

      const keysToAdd = new Set<string>();
      keysToAdd.add(normProc);
      if (code) keysToAdd.add(code);
      if (b.canonical_procedure_id) keysToAdd.add(b.canonical_procedure_id.toUpperCase().trim());
      if (b.canonical_procedure_name) keysToAdd.add(b.canonical_procedure_name.toLowerCase().trim());

      if (normResult.matched) {
        if (normResult.canonical_procedure_id) {
          keysToAdd.add(normResult.canonical_procedure_id.toUpperCase().trim());
        }
        if (normResult.canonical_procedure_name) {
          keysToAdd.add(normResult.canonical_procedure_name.toLowerCase().trim());
        }
        if (normResult.procedure_code) {
          keysToAdd.add(normResult.procedure_code.toUpperCase().trim());
        }
      }

      for (const key of keysToAdd) {
        const list = this.benchmarkIndex.get(key) || [];
        if (!list.includes(b)) {
          list.push(b);
        }
        this.benchmarkIndex.set(key, list);
      }
    }
  }

  /**
   * Look up benchmark adhering strictly to hierarchy:
   * 1. Hospital-specific verified data
   * 2. State / Maharashtra benchmark
   * 3. National benchmark
   * 4. Government package / reference rate
   * 5. Unavailable / Insufficient data
   */
  public findBenchmark(
    procedureNorm: ProcedureNormalizationResult,
    hospitalName?: string,
    city?: string,
    state?: string,
    policyType?: string
  ): CostBenchmarkRecord | null {
    if (!procedureNorm.matched && !procedureNorm.canonical_procedure_name) {
      return null;
    }

    // Try finding candidate records by canonical_procedure_id, then procedure_code, then canonical_procedure_name
    let candidateRecords: CostBenchmarkRecord[] = [];
    if (procedureNorm.canonical_procedure_id) {
      candidateRecords = this.benchmarkIndex.get(procedureNorm.canonical_procedure_id.toUpperCase().trim()) || [];
    }
    if (candidateRecords.length === 0 && procedureNorm.procedure_code) {
      candidateRecords = this.benchmarkIndex.get(procedureNorm.procedure_code.toUpperCase().trim()) || [];
    }
    if (candidateRecords.length === 0 && procedureNorm.canonical_procedure_name) {
      candidateRecords = this.benchmarkIndex.get(procedureNorm.canonical_procedure_name.toLowerCase().trim()) || [];
    }
    if (candidateRecords.length === 0 && procedureNorm.source_procedure_name) {
      candidateRecords = this.benchmarkIndex.get(procedureNorm.source_procedure_name.toLowerCase().trim()) || [];
    }
    if (candidateRecords.length === 0) return null;

    // Special case: If policy is PM-JAY / statutory scheme, prioritize government package
    const isGovtPolicy = policyType === 'pmjay' || policyType === 'esi' || policyType === 'mjpjay';
    if (isGovtPolicy) {
      const govtMatch = candidateRecords.find(r => r.benchmark_level === 'government_package');
      if (govtMatch) return govtMatch;
    }

    // 1. Hospital-specific
    if (hospitalName && hospitalName.trim()) {
      const normHosp = hospitalName.toLowerCase().trim();
      const hospitalSpecific = candidateRecords.find(r =>
        r.benchmark_level === 'hospital_specific' &&
        r.hospital_name &&
        (normHosp.includes(r.hospital_name.toLowerCase()) || r.hospital_name.toLowerCase().includes(normHosp))
      );
      if (hospitalSpecific) return hospitalSpecific;
    }

    // 2. State / Regional Benchmark (e.g. Maharashtra or Pune)
    const normCity = (city || '').toLowerCase().trim();
    const MAHARASHTRA_CITIES = ['pune', 'mumbai', 'nagpur', 'nashik', 'aurangabad', 'thane', 'solapur', 'kolhapur', 'amravati', 'navi mumbai'];
    const isMaharashtra = (state && state.toLowerCase().trim() === 'maharashtra') || (normCity && MAHARASHTRA_CITIES.includes(normCity));

    if (isMaharashtra) {
      const stateMatch = candidateRecords.find(r =>
        (r.benchmark_level === 'state_benchmark' || r.benchmark_level === 'maharashtra_regional' || r.benchmark_level === 'regional_benchmark') &&
        (
          (r.state && r.state.toLowerCase().trim() === 'maharashtra') ||
          (normCity && r.city && r.city.toLowerCase().trim() === normCity)
        )
      );
      if (stateMatch) return stateMatch;
    }

    // 3. National Benchmark
    const nationalMatch = candidateRecords.find(r => r.benchmark_level === 'national_benchmark' || r.benchmark_level === 'national');
    if (nationalMatch) return nationalMatch;

    // 4. Government Package Rate (Clearly labeled as statutory reference)
    const govtMatch = candidateRecords.find(r => r.benchmark_level === 'government_package');
    if (govtMatch) return govtMatch;

    return null;
  }

  /**
   * Check whether an explicit hospital-specific procedure match exists.
   * (Must NOT treat regional/national/state benchmark fallbacks as hospital procedure matches).
   */
  public hasHospitalProcedureMatch(
    hospitalName?: string,
    procedure?: string,
    canonicalProcedureId?: string,
    specialty?: string
  ): boolean {
    if (!hospitalName || !hospitalName.trim()) return false;
    if (isProcedureUnselected(procedure) && !canonicalProcedureId) return false;

    const normProcedure = normalizeProcedure(procedure, specialty, canonicalProcedureId);
    if (!normProcedure.matched && !normProcedure.canonical_procedure_name) return false;

    // Look up candidate records specifically for this procedure
    let candidateRecords: CostBenchmarkRecord[] = [];
    if (normProcedure.canonical_procedure_id) {
      candidateRecords = this.benchmarkIndex.get(normProcedure.canonical_procedure_id.toUpperCase().trim()) || [];
    }
    if (candidateRecords.length === 0 && normProcedure.procedure_code) {
      candidateRecords = this.benchmarkIndex.get(normProcedure.procedure_code.toUpperCase().trim()) || [];
    }
    if (candidateRecords.length === 0 && normProcedure.canonical_procedure_name) {
      candidateRecords = this.benchmarkIndex.get(normProcedure.canonical_procedure_name.toLowerCase().trim()) || [];
    }
    if (candidateRecords.length === 0) return false;

    const normHosp = hospitalName.toLowerCase().trim();
    // Procedure-level match must come exclusively from explicit hospital procedure data
    return candidateRecords.some(r =>
      r.benchmark_level === 'hospital_specific' &&
      r.hospital_name &&
      (normHosp.includes(r.hospital_name.toLowerCase().trim()) || r.hospital_name.toLowerCase().trim().includes(normHosp))
    );
  }

  /**
   * Core Cost Intelligence Estimation Function
   */
  public estimateCost(params: {
    hospitalName?: string;
    city?: string;
    state?: string;
    procedure?: string;
    canonicalProcedureId?: string;
    specialty?: string;
    policy?: PolicyDocument | null;
    networkStatus?: NetworkStatus;
    roomType?: RoomCategory;
    simulatedRoomRate?: number;
  }): CostIntelligenceEstimate {
    const {
      hospitalName,
      city,
      state,
      procedure,
      canonicalProcedureId,
      specialty,
      policy,
      networkStatus = 'unverified',
      roomType = 'General Ward',
      simulatedRoomRate
    } = params;

    const canonicalSpecialty = normalizeSpecialtyName(specialty) || 'General';

    // 1. If procedure === "All Procedures in this Dept" or no canonical procedure selected:
    // Prompt the user to select a procedure instead of showing Insufficient Reliable Cost Data.
    if (isProcedureUnselected(procedure)) {
      const promptTitle = 'Select a procedure for cost estimation';
      const promptExplanation =
        'Hospital matching is available for this specialty, but treatment cost depends on the specific procedure. Select a procedure to view an evidence-backed cost benchmark.';

      const mlCostAnalysis = treatmentCostMLService.predictTreatmentCost({
        procedure,
        city,
        specialty: canonicalSpecialty
      });

      return {
        available: false,
        isProcedureUnselected: true,
        canonicalProcedureId: 'UNSELECTED',
        unavailableReason: promptTitle,
        confidence: 'insufficient_data',
        procedure: procedure && procedure.trim() ? procedure.trim() : 'All Procedures',
        procedureCode: 'UNSELECTED',
        canonicalSpecialty,
        hospitalName,
        city,
        benchmarkLevel: 'unavailable',
        treatmentCostRange: { min: 0, max: 0, low: 0, typical: 0, high: 0, displayRange: 'Select procedure' },
        potentiallyCoveredRange: null,
        estimatedPatientOopRange: null,
        coveredReliable: false,
        oopReliable: false,
        policyCoverageUnavailableReason: promptTitle,
        missingInformation: [promptExplanation],
        policyConstraintsApplied: [],
        factors: [promptExplanation],
        provenance: null,
        whyThisEstimate: [promptExplanation],
        disclaimer: promptExplanation,
        mlCostAnalysis
      };
    }

    const normProcedure = normalizeProcedure(procedure, specialty, canonicalProcedureId);

    if (!normProcedure.matched) {
      const procName = procedure && procedure.trim() ? procedure.trim() : 'this procedure';
      const unsupportedMsg = `SehatSure currently does not have a verified evidence-backed treatment-cost benchmark for ${procName}.`;
      const mlCostAnalysis = treatmentCostMLService.predictTreatmentCost({
        procedure: procName,
        city,
        specialty: canonicalSpecialty
      });

      return {
        available: false,
        isProcedureUnselected: false,
        canonicalProcedureId: normProcedure.canonical_procedure_id || 'UNKNOWN',
        clinicalDescription: normProcedure.clinical_description,
        unavailableReason: 'No reliable cost benchmark',
        confidence: 'insufficient_data',
        procedure: procName,
        procedureCode: 'UNKNOWN',
        canonicalSpecialty,
        hospitalName,
        city,
        benchmarkLevel: 'unavailable',
        treatmentCostRange: { min: 0, max: 0, low: 0, typical: 0, high: 0, displayRange: 'No reliable cost benchmark' },
        potentiallyCoveredRange: null,
        estimatedPatientOopRange: null,
        coveredReliable: false,
        oopReliable: false,
        policyCoverageUnavailableReason: unsupportedMsg,
        missingInformation: [
          `No authoritative clinical cost benchmark available for ${procName}`,
          'Actual hospital quote or formal treatment estimate required'
        ],
        policyConstraintsApplied: [],
        factors: [
          unsupportedMsg,
          "SehatSure will not substitute another procedure's cost."
        ],
        provenance: null,
        whyThisEstimate: [
          unsupportedMsg,
          "SehatSure will not substitute another procedure's cost."
        ],
        disclaimer: 'SehatSure does not currently have verified evidence to estimate this procedure\'s treatment cost.',
        mlCostAnalysis
      };
    }

    const benchmark = this.findBenchmark(normProcedure, hospitalName, city, state, policy?.policyType || undefined);
    if (!benchmark) {
      const procName = normProcedure.canonical_procedure_name || procedure || 'this procedure';
      const isAngiography =
        normProcedure.canonical_procedure_id === 'ANGIOGRAPHY' ||
        procName.toLowerCase().includes('angiography');

      const mlCostAnalysis = treatmentCostMLService.predictTreatmentCost({
        procedure: procName,
        city,
        specialty: canonicalSpecialty
      });

      const hasModelEstimate = Boolean(mlCostAnalysis && mlCostAnalysis.status === 'available' && mlCostAnalysis.mlEstimate);

      const unsupportedMsg = isAngiography
        ? 'Angiography is selected, but SehatSure currently has no verified cost benchmark for this procedure.'
        : `Government/authoritative benchmark unavailable for ${procName}.`;
      const unavailableReason = isAngiography
        ? 'Insufficient reliable cost data for Angiography.'
        : 'No reliable cost benchmark';
      const distinctNote = isAngiography
        ? 'No verified cost benchmark is currently available for Angiography. SehatSure will not substitute an Angioplasty benchmark because the procedures are clinically different.'
        : "SehatSure will not substitute another procedure's cost.";
      const disclaimer = isAngiography
        ? 'No verified cost benchmark is currently available for Angiography. SehatSure will not substitute an Angioplasty benchmark because the procedures are clinically different.'
        : 'SehatSure does not currently have verified evidence to estimate this procedure\'s treatment cost.';

      const treatmentCostRange: CostRange = {
        min: 0,
        max: 0,
        low: 0,
        typical: 0,
        high: 0,
        displayRange: isAngiography ? 'Unavailable' : 'No reliable cost benchmark'
      };

      return {
        available: false,
        costEstimateLevel: hasModelEstimate ? 'model_reference' : 'unavailable',
        hasModelEstimate,
        isProcedureUnselected: false,
        canonicalProcedureId: normProcedure.canonical_procedure_id,
        clinicalDescription: normProcedure.clinical_description,
        unavailableReason,
        confidence: hasModelEstimate ? ('model_estimate' as any) : 'insufficient_data',
        procedure: procName,
        procedureCode: normProcedure.procedure_code || 'UNKNOWN',
        canonicalSpecialty,
        hospitalName,
        city,
        benchmarkLevel: 'unavailable',
        treatmentCostRange,
        potentiallyCoveredRange: null,
        estimatedPatientOopRange: null,
        coveredReliable: false,
        oopReliable: false,
        policyCoverageUnavailableReason: 'Insurance coverage and patient OOP require verified hospital tariff cards or itemized billing. ML model does not calculate insurance payouts.',
        missingInformation: [
          `Government/authoritative benchmark unavailable for ${procName}`,
          'Actual hospital quote or formal treatment estimate required for insurance settlement'
        ],
        policyConstraintsApplied: [],
        factors: [
          unsupportedMsg,
          distinctNote
        ],
        provenance: null,
        whyThisEstimate: [
          unsupportedMsg,
          distinctNote
        ],
        disclaimer,
        mlCostAnalysis
      };
    }

    const isGovtPkg = benchmark.benchmark_level === 'government_package';
    const exactPkgRate = benchmark.exact_package_rate || benchmark.reference_rate || benchmark.cost_low;

    // Benchmark Treatment Cost Range
    // Government package uses the exact statutory rate without generating an artificial range spread
    const treatmentCostRange: CostRange = isGovtPkg
      ? {
          min: exactPkgRate,
          max: exactPkgRate,
          low: exactPkgRate,
          typical: exactPkgRate,
          high: exactPkgRate,
          displayRange: `Government Package Reference: ${formatINR(exactPkgRate)}`,
          isExactPackageRate: true
        }
      : {
          min: benchmark.cost_low,
          max: benchmark.cost_high,
          low: benchmark.cost_low,
          typical: benchmark.cost_typical,
          high: benchmark.cost_high,
          displayRange: formatCostRange(benchmark.cost_low, benchmark.cost_high),
          isExactPackageRate: false
        };

    const provenance: CostProvenance = {
      costId: benchmark.cost_id,
      benchmarkLevel: benchmark.benchmark_level,
      sourceType: benchmark.source_type,
      sourceName: benchmark.source_name,
      sourceDocument: benchmark.source_document,
      sourcePage: benchmark.source_page,
      sourceTable: benchmark.source_table,
      sourceDate: benchmark.source_date,
      dataYear: benchmark.data_year,
      geography: benchmark.geography,
      confidenceLevel: benchmark.confidence_level,
      notes: benchmark.notes,
      sourceUrl: benchmark.source_url,
      sourceStatus: benchmark.source_status,
      active: benchmark.active,
      exactPackageRate: isGovtPkg ? exactPkgRate : undefined
    };

    // Fallback notice when a non-hospital-specific benchmark is used (Requirement 4 & 9)
    let fallbackNotice: string | undefined = undefined;
    if (benchmark.benchmark_level !== 'hospital_specific') {
      if (benchmark.benchmark_level === 'state_benchmark' || benchmark.benchmark_level === 'maharashtra_regional') {
        fallbackNotice = 'Hospital-specific tariff unavailable. Maharashtra benchmark used.';
      } else if (benchmark.benchmark_level === 'regional_benchmark') {
        fallbackNotice = `Hospital-specific tariff unavailable. ${benchmark.geography || 'Regional'} benchmark used.`;
      } else if (benchmark.benchmark_level === 'national_benchmark' || benchmark.benchmark_level === 'national') {
        fallbackNotice = 'Hospital-specific tariff unavailable. National benchmark used.';
      } else if (isGovtPkg) {
        fallbackNotice = 'Hospital-specific tariff unavailable. Government package reference rate used.';
      }
    }

    // Evidence-driven confidence determination (Requirement 14)
    let derivedConfidence: CostConfidenceLevel = benchmark.confidence_level;
    if (benchmark.benchmark_level === 'hospital_specific') {
      derivedConfidence = policy ? 'high' : 'medium';
    } else if (
      benchmark.benchmark_level === 'state_benchmark' ||
      benchmark.benchmark_level === 'maharashtra_regional' ||
      benchmark.benchmark_level === 'regional_benchmark'
    ) {
      derivedConfidence = 'medium';
    } else if (
      benchmark.benchmark_level === 'national_benchmark' ||
      benchmark.benchmark_level === 'national' ||
      isGovtPkg
    ) {
      derivedConfidence = 'low';
    }

    const statutoryDisclaimer = 'Statutory government package reference (AB-PMJAY). Not a private hospital bill quote.';

    // If no policy provided, return treatment cost with unstated coverage
    if (!policy) {
      return {
        available: true,
        isGovernmentPackageOnly: isGovtPkg,
        exactPackageRate: isGovtPkg ? exactPkgRate : undefined,
        statutoryReferenceDisclaimer: isGovtPkg ? 'This is a statutory scheme package/reimbursement reference, not a private hospital bill quote.' : undefined,
        canonicalProcedureId: normProcedure.canonical_procedure_id,
        clinicalDescription: normProcedure.clinical_description,
        procedure: normProcedure.canonical_procedure_name,
        procedureCode: normProcedure.procedure_code,
        canonicalSpecialty,
        hospitalName,
        city,
        benchmarkLevel: benchmark.benchmark_level,
        confidence: derivedConfidence,
        costEstimateLevel: 'benchmark',
        hasModelEstimate: true,
        fallbackNotice,
        treatmentCostRange,
        potentiallyCoveredRange: null,
        estimatedPatientOopRange: null,
        coveredReliable: false,
        oopReliable: false,
        policyCoverageUnavailableReason: 'Policy-adjusted coverage/OOP unavailable with current information.',
        missingInformation: ['Insurance policy document not provided', 'Hospital-specific admission bill'],
        provenance,
        whyThisEstimate: [
          `✓ Treatment: ${normProcedure.canonical_procedure_name} (${normProcedure.procedure_code})`,
          hospitalName
            ? (benchmark.benchmark_level === 'hospital_specific'
              ? `✓ Hospital: Verified institutional tariff for ${hospitalName}`
              : `✓ Hospital: ${hospitalName} (${fallbackNotice || benchmark.benchmark_level})`)
            : `✓ Region: ${benchmark.geography}`,
          ...(fallbackNotice ? [`ℹ️ ${fallbackNotice}`] : []),
          isGovtPkg
            ? '🏛️ Government Scheme Package Reference: Statutory reference rate from AB-PMJAY HBP 2.2, not a private hospital bill quote.'
            : `✓ Benchmark: ${benchmark.source_name} (${benchmark.data_year})`,
          `✓ Level: ${benchmark.benchmark_level}`,
          'ℹ️ Policy coverage and OOP cannot be estimated without an uploaded policy document.'
        ],
        disclaimer: isGovtPkg
          ? statutoryDisclaimer
          : 'Treatment cost benchmark available, but policy-adjusted coverage/OOP cannot be estimated without an active policy.',
        mlCostAnalysis: treatmentCostMLService.predictTreatmentCost({
          procedure: normProcedure.canonical_procedure_name,
          city,
          specialty: canonicalSpecialty,
          expectedStayDays: 4,
          benchmarkTypical: benchmark.cost_typical
        }),
        totalCost: benchmark.cost_typical,
        displayLow: benchmark.cost_low,
        displayHigh: benchmark.cost_high,
        treatmentCost: benchmark.cost_typical,
        roomCost: 0,
        estimatedStayDays: 4,
        roomCostPerDay: 2500
      };
    }

    // Policy-Aware Coverage & OOP Calculation on the Range
    const calculation = this.calculatePolicyAdjustment({
      benchmark,
      treatmentCostRange,
      procedureNorm: normProcedure,
      canonicalSpecialty,
      policy,
      networkStatus,
      roomType,
      simulatedRoomRate
    });

    if (benchmark.benchmark_level === 'hospital_specific') {
      derivedConfidence = calculation.coveredReliable ? 'high' : 'medium';
    }

    const whyThisEstimate: string[] = [
      `✓ Treatment: ${normProcedure.canonical_procedure_name} (${normProcedure.procedure_code})`,
      hospitalName
        ? (benchmark.benchmark_level === 'hospital_specific'
          ? `✓ Hospital: Verified institutional tariff for ${hospitalName}`
          : `✓ Hospital: ${hospitalName} (${fallbackNotice || benchmark.benchmark_level})`)
        : `✓ Region: ${benchmark.geography}`,
      ...(fallbackNotice ? [`ℹ️ ${fallbackNotice}`] : []),
      isGovtPkg
        ? '🏛️ Government Scheme Package Reference: Statutory reference rate from AB-PMJAY HBP 2.2, not a private hospital bill quote.'
        : `✓ Cost Source: ${benchmark.source_name} (${benchmark.data_year})`,
      `✓ Network Status: ${networkStatus === 'verified' ? 'Cashless Empanelled Network' : networkStatus === 'no_match' ? 'Non-Network Facility' : 'Status Unverified'}`,
      `✓ Policy Evaluated: ${policy.insurer || 'Private Insurer'} (Sum Insured: ${policy.sumInsured ? formatINR(policy.sumInsured) : 'Not specified'})`,
      calculation.roomLimitAppliedNote,
      calculation.copayAppliedNote
    ];

    if (calculation.missingInformation.length > 0) {
      whyThisEstimate.push(`⚠️ Missing Information: ${calculation.missingInformation.join('; ')}`);
    }

    const disclaimer = isGovtPkg
      ? statutoryDisclaimer
      : !calculation.coveredReliable
        ? 'Treatment cost benchmark available, but policy-adjusted coverage and out-of-pocket responsibility cannot be reliably estimated with current policy information.'
        : 'Treatment cost estimated based on published benchmark ranges. Potentially covered amount is a policy-adjusted estimate and cannot be guaranteed by SehatSure.';

    return {
      available: true,
      isGovernmentPackageOnly: isGovtPkg,
      exactPackageRate: isGovtPkg ? exactPkgRate : undefined,
      statutoryReferenceDisclaimer: isGovtPkg ? 'This is a statutory scheme package/reimbursement reference, not a private hospital bill quote.' : undefined,
      canonicalProcedureId: normProcedure.canonical_procedure_id,
      clinicalDescription: normProcedure.clinical_description,
      procedure: normProcedure.canonical_procedure_name,
      procedureCode: normProcedure.procedure_code,
      canonicalSpecialty,
      hospitalName,
      city,
      benchmarkLevel: benchmark.benchmark_level,
      costEstimateLevel: 'benchmark',
      hasModelEstimate: true,
      confidence: derivedConfidence,
      fallbackNotice,
      treatmentCostRange,
      potentiallyCoveredRange: calculation.coveredRange,
      estimatedPatientOopRange: calculation.oopRange,
      coveredReliable: calculation.coveredReliable,
      oopReliable: calculation.oopReliable,
      policyCoverageUnavailableReason: calculation.policyCoverageUnavailableReason,
      missingInformation: calculation.missingInformation,
      policyConstraintsApplied: calculation.policyConstraintsApplied,
      factors: whyThisEstimate,
      provenance,
      whyThisEstimate,
      disclaimer,
      scenarioExplanation: calculation.scenarioExplanation,
      mlCostAnalysis: treatmentCostMLService.predictTreatmentCost({
        procedure: normProcedure.canonical_procedure_name,
        city,
        specialty: canonicalSpecialty,
        expectedStayDays: calculation.stayDays,
        benchmarkTypical: benchmark.cost_typical
      }),
      // Backward compatibility fields for hospital listing views
      totalCost: benchmark.cost_typical,
      displayLow: benchmark.cost_low,
      displayHigh: benchmark.cost_high,
      treatmentCost: benchmark.cost_typical,
      roomCost: calculation.referenceRoomCost,
      estimatedStayDays: calculation.stayDays,
      roomCostPerDay: calculation.dailyRoomRate
    };
  }

  /**
   * Deterministic Policy Adjustment Calculator on Cost Ranges
   */
  private calculatePolicyAdjustment(params: {
    benchmark: CostBenchmarkRecord;
    treatmentCostRange: CostRange;
    procedureNorm: ProcedureNormalizationResult;
    canonicalSpecialty: string;
    policy: PolicyDocument;
    networkStatus: NetworkStatus;
    roomType: RoomCategory;
    simulatedRoomRate?: number;
  }) {
    const {
      treatmentCostRange,
      procedureNorm,
      canonicalSpecialty,
      policy,
      networkStatus,
      roomType,
      simulatedRoomRate
    } = params;

    const isVerified = networkStatus === 'verified';
    const isStatutory = policy.policyType === 'pmjay' || policy.policyType === 'esi';
    const missingInformation: string[] = [];

    // Stay days & Room rate modeling
    const stayDays = procedureNorm.canonical_procedure_name.includes('Cataract') ? 0 : 4;
    let dailyRoomRate = 2500;
    if (simulatedRoomRate !== undefined && simulatedRoomRate > 0) {
      dailyRoomRate = simulatedRoomRate;
    } else if (roomType === 'Twin Sharing') {
      dailyRoomRate = 5000;
    } else if (roomType === 'Single Private Room') {
      dailyRoomRate = 9500;
    } else {
      dailyRoomRate = 2500;
    }

    const referenceRoomCost = stayDays > 0 ? dailyRoomRate * stayDays : 0;

    // 0. Exclusions check
    const isExcluded = Boolean(
      policy.exclusions &&
      Array.isArray(policy.exclusions) &&
      policy.exclusions.some(ex => {
        const e = ex.toLowerCase().trim();
        const p = procedureNorm.canonical_procedure_name.toLowerCase();
        const s = canonicalSpecialty.toLowerCase();
        return (p && (p.includes(e) || e.includes(p))) || (s && (s.includes(e) || e.includes(s)));
      })
    );

    if (isExcluded) {
      const exclusionNote = 'Exclusion Applied: Procedure is excluded under policy terms';
      const copayExclusionNote = 'Co-pay: N/A (100% Patient OOP due to exclusion)';
      return {
        coveredRange: { min: 0, max: 0, low: 0, typical: 0, high: 0, displayRange: '₹0' },
        oopRange: treatmentCostRange,
        coveredReliable: true,
        oopReliable: true,
        policyCoverageUnavailableReason: undefined,
        missingInformation: ['Excluded from policy coverage schedule'],
        policyConstraintsApplied: [exclusionNote, copayExclusionNote],
        roomLimitAppliedNote: exclusionNote,
        copayAppliedNote: copayExclusionNote,
        scenarioExplanation: `Treatment in ${canonicalSpecialty} is excluded under policy terms. Claim is not admissible.`,
        stayDays,
        dailyRoomRate,
        referenceRoomCost
      };
    }

    // 1. Statutory schemes (PM-JAY, ESI)
    if (isStatutory) {
      if (isVerified) {
        const roomNote = 'Statutory Scheme Entitlement: 100% Cashless at Empanelled Centers';
        const copayNote = 'Co-pay: Nil (Statutory)';
        return {
          coveredRange: treatmentCostRange,
          oopRange: { min: 0, max: 0, low: 0, typical: 0, high: 0, displayRange: '₹0 (100% Cashless)' },
          coveredReliable: true,
          oopReliable: true,
          policyCoverageUnavailableReason: undefined,
          missingInformation: [],
          policyConstraintsApplied: [roomNote, copayNote],
          roomLimitAppliedNote: roomNote,
          copayAppliedNote: copayNote,
          scenarioExplanation: 'Empanelled statutory facility provides 100% cashless coverage within scheme guidelines.',
          stayDays,
          dailyRoomRate,
          referenceRoomCost
        };
      } else {
        const roomNote = 'Statutory benefits restricted to empanelled network centers only';
        const copayNote = 'Co-pay: N/A (Non-empanelled statutory facility)';
        return {
          coveredRange: { min: 0, max: 0, low: 0, typical: 0, high: 0, displayRange: '₹0' },
          oopRange: treatmentCostRange,
          coveredReliable: true,
          oopReliable: true,
          policyCoverageUnavailableReason: undefined,
          missingInformation: ['Facility is not empanelled under statutory scheme'],
          policyConstraintsApplied: [roomNote, copayNote],
          roomLimitAppliedNote: roomNote,
          copayAppliedNote: copayNote,
          scenarioExplanation: 'Statutory cashless benefits do NOT apply at non-empanelled facilities.',
          stayDays,
          dailyRoomRate,
          referenceRoomCost
        };
      }
    }

    // 2. Private Insurance Limits
    const hasSumInsured = typeof policy.sumInsured === 'number' && policy.sumInsured > 0;
    const sumInsured = hasSumInsured ? (policy.sumInsured as number) : 0;
    if (!hasSumInsured) missingInformation.push('Sum insured not specified in policy');

    // Room limit
    const roomLimit = (policy as any).roomRentLimit || (policy as any).roomLimit;
    let eligibleRoomRatePerDay = 999999;
    let roomLimitAppliedNote = 'Room Limit: Unlimited';

    if (roomLimit) {
      if (roomLimit.type === 'amount' && roomLimit.value) {
        eligibleRoomRatePerDay = Number(roomLimit.value);
        roomLimitAppliedNote = `Room Limit Applied: ₹${eligibleRoomRatePerDay.toLocaleString('en-IN')}/day cap`;
      } else if (roomLimit.type === 'percent' && roomLimit.value) {
        const pct = Number(roomLimit.value);
        if (hasSumInsured) {
          eligibleRoomRatePerDay = Math.round(sumInsured * (pct / 100));
          roomLimitAppliedNote = `Room Limit Applied: ${pct}% of SI (₹${eligibleRoomRatePerDay.toLocaleString('en-IN')}/day)`;
        } else {
          roomLimitAppliedNote = `Room Limit Applied: ${pct}% of SI (Unknown SI)`;
        }
      }
    }

    const roomExcessPerDay = Math.max(0, dailyRoomRate - eligibleRoomRatePerDay);
    const totalRoomExcess = roomExcessPerDay * stayDays;

    // Proportionate Deduction Active?
    const proportionateDeductionActive = roomExcessPerDay > 0 && (policy as any).proportionateDeduction !== false;

    // Co-pay
    let copayPct: number | null = null;
    let isCopayUncertain = false;
    let copayAppliedNote = 'Co-pay: Nil';

    if (isVerified) {
      const copayVal = typeof policy.copay === 'number'
        ? policy.copay
        : (typeof (policy.copay as any)?.value === 'number' ? (policy.copay as any).value : 0);
      copayPct = copayVal;
      copayAppliedNote = `Network Co-pay Applied: ${copayPct}% network co-payment`;
    } else if (networkStatus === 'no_match') {
      // Non-network hospital
      const nonNetVal = typeof (policy as any).nonNetworkCopay === 'number'
        ? (policy as any).nonNetworkCopay
        : ((policy as any).nonNetworkCopay?.value);
      if (typeof nonNetVal === 'number' && nonNetVal >= 0) {
        copayPct = nonNetVal;
        copayAppliedNote = `Non-Network Co-pay Applied: ${copayPct}%`;
      } else {
        // Unknown non-network copay
        copayPct = null;
        isCopayUncertain = true;
        copayAppliedNote = 'Non-network co-payment not stated in policy (not assumed)';
        missingInformation.push('Non-network co-payment terms not specified in policy document');
      }
    } else {
      // networkStatus === 'unverified'
      copayPct = null;
      isCopayUncertain = true;
      copayAppliedNote = 'Hospital network empanelment status unverified';
      missingInformation.push('Hospital network empanelment status unverified for this insurer');
    }

    // Deductible
    const deductible = typeof policy.deductible === 'number' && policy.deductible >= 0 ? policy.deductible : 0;

    // DETERMINISTIC POLICY SUFFICIENCY CHECK
    // If critical policy information is unavailable (sum insured missing, co-pay uncertain, or network status unverified),
    // we MUST NOT guess or assume treatment cost = insurer payment!
    const isPolicySufficient = hasSumInsured && !isCopayUncertain;

    const policyConstraintsApplied: string[] = [
      roomLimitAppliedNote,
      copayAppliedNote
    ];
    if (hasSumInsured) {
      policyConstraintsApplied.push(`Sum Insured limit: ₹${sumInsured.toLocaleString('en-IN')}`);
    }

    if (!isPolicySufficient) {
      missingInformation.push('Actual hospital bill (final charge depends on patient medical complexity)');
      return {
        coveredRange: null,
        oopRange: null,
        coveredReliable: false,
        oopReliable: false,
        policyCoverageUnavailableReason: 'Policy-adjusted coverage/OOP unavailable with current information.',
        missingInformation,
        policyConstraintsApplied,
        roomLimitAppliedNote,
        copayAppliedNote,
        scenarioExplanation: `Policy-adjusted coverage and patient out-of-pocket responsibility cannot be reliably calculated because essential policy rules are incomplete (${missingInformation.join('; ')}). SehatSure will not assume treatment cost equals insurer payment.`,
        stayDays,
        dailyRoomRate,
        referenceRoomCost
      };
    }

    // Helper to evaluate single cost point when policy rules are sufficient
    const evaluatePoint = (billAmount: number) => {
      // Proportionate disallowance
      let propDisallowance = 0;
      if (proportionateDeductionActive && dailyRoomRate > 0) {
        const allowedRatio = Math.min(1, eligibleRoomRatePerDay / dailyRoomRate);
        const surgeryOTCharges = Math.max(0, billAmount - totalRoomExcess);
        propDisallowance = Math.round(surgeryOTCharges * (1 - allowedRatio));
      }

      const eligibleClaim = Math.max(0, billAmount - totalRoomExcess - propDisallowance);
      const postDeductible = Math.max(0, eligibleClaim - deductible);
      const copayAmt = (copayPct !== null && copayPct > 0) ? Math.round(postDeductible * (copayPct / 100)) : 0;
      let admissible = Math.max(0, postDeductible - copayAmt);

      // Check procedure-specific sub-limit if present
      if (policy.subLimits && typeof policy.subLimits === 'object') {
        for (const [subKey, subVal] of Object.entries(policy.subLimits)) {
          if (typeof subVal === 'number' && subVal > 0) {
            const k = subKey.toLowerCase();
            const p = procedureNorm.canonical_procedure_name.toLowerCase();
            if (p.includes(k) || k.includes(p)) {
              admissible = Math.min(admissible, subVal);
            }
          }
        }
      }

      const insurerShare = Math.min(admissible, sumInsured);
      const patientOop = billAmount - insurerShare;

      return {
        insurerShare: Math.max(0, insurerShare),
        patientOop: Math.max(0, patientOop),
        propDisallowance
      };
    };

    const lowEval = evaluatePoint(treatmentCostRange.low);
    const typicalEval = evaluatePoint(treatmentCostRange.typical);
    const highEval = evaluatePoint(treatmentCostRange.high);

    const coveredRange: CostRange = {
      min: lowEval.insurerShare,
      max: highEval.insurerShare,
      low: lowEval.insurerShare,
      typical: typicalEval.insurerShare,
      high: highEval.insurerShare,
      displayRange: formatCostRange(lowEval.insurerShare, highEval.insurerShare, true)
    };

    const oopRange: CostRange = {
      min: lowEval.patientOop,
      max: highEval.patientOop,
      low: lowEval.patientOop,
      typical: typicalEval.patientOop,
      high: highEval.patientOop,
      displayRange: formatCostRange(lowEval.patientOop, highEval.patientOop, true)
    };

    missingInformation.push('Actual hospital bill (final charge depends on patient medical complexity)');

    if (proportionateDeductionActive && roomExcessPerDay > 0) {
      policyConstraintsApplied.push(`Proportionate disallowance applied (~₹${typicalEval.propDisallowance.toLocaleString('en-IN')})`);
    } else if (dailyRoomRate <= eligibleRoomRatePerDay) {
      policyConstraintsApplied.push(`Room rent is within policy limit (₹${dailyRoomRate}/day <= ₹${eligibleRoomRatePerDay}/day)`);
    }

    let scenarioExplanation = '';
    if (roomExcessPerDay > 0) {
      scenarioExplanation = `Selected room (₹${dailyRoomRate}/day) exceeds eligible policy room cap by ₹${roomExcessPerDay}/day. Total room excess is ₹${totalRoomExcess}.`;
      if (proportionateDeductionActive) {
        scenarioExplanation += ` Proportionate deduction disallows ~₹${typicalEval.propDisallowance.toLocaleString('en-IN')} from associated medical fees.`;
      }
    } else {
      scenarioExplanation = `Selected room (₹${dailyRoomRate}/day) is within policy cap (₹${eligibleRoomRatePerDay}/day). No proportionate room deduction applied.`;
    }

    return {
      coveredRange,
      oopRange,
      coveredReliable: true,
      oopReliable: true,
      policyCoverageUnavailableReason: undefined,
      missingInformation,
      policyConstraintsApplied,
      roomLimitAppliedNote,
      copayAppliedNote,
      scenarioExplanation,
      stayDays,
      dailyRoomRate,
      referenceRoomCost
    };
  }

  /**
   * Scenario Recalculation Engine (FIN-01 Phase 16)
   * Explains what changed when parameters (room rate, network status) are modified.
   */
  public recalculateScenario(params: {
    hospitalName?: string;
    city?: string;
    procedure?: string;
    canonicalProcedureId?: string;
    specialty?: string;
    policy?: PolicyDocument | null;
    baseline?: {
      hospitalName?: string;
      city?: string;
      procedure?: string;
      canonicalProcedureId?: string;
      specialty?: string;
      policy?: PolicyDocument | null;
      networkStatus?: NetworkStatus;
      roomType?: RoomCategory;
      simulatedRoomRate?: number;
    };
    modified?: {
      hospitalName?: string;
      city?: string;
      procedure?: string;
      canonicalProcedureId?: string;
      specialty?: string;
      policy?: PolicyDocument | null;
      networkStatus?: NetworkStatus;
      roomType?: RoomCategory;
      simulatedRoomRate?: number;
    };
    baseScenario?: {
      networkStatus?: NetworkStatus;
      roomType?: RoomCategory;
      simulatedRoomRate?: number;
    };
    newScenario?: {
      networkStatus?: NetworkStatus;
      roomType?: RoomCategory;
      simulatedRoomRate?: number;
    };
  }) {
    const baseInput = {
      hospitalName: params.baseline?.hospitalName || params.hospitalName,
      city: params.baseline?.city || params.city,
      procedure: params.baseline?.procedure || params.procedure,
      canonicalProcedureId: params.baseline?.canonicalProcedureId || params.canonicalProcedureId,
      specialty: params.baseline?.specialty || params.specialty,
      policy: params.baseline?.policy !== undefined ? params.baseline.policy : params.policy,
      networkStatus: params.baseline?.networkStatus || params.baseScenario?.networkStatus || 'unverified',
      roomType: params.baseline?.roomType || params.baseScenario?.roomType || 'General Ward',
      simulatedRoomRate: params.baseline?.simulatedRoomRate || params.baseScenario?.simulatedRoomRate
    };

    const modInput = {
      hospitalName: params.modified?.hospitalName || params.hospitalName,
      city: params.modified?.city || params.city,
      procedure: params.modified?.procedure || params.procedure,
      canonicalProcedureId: params.modified?.canonicalProcedureId || params.canonicalProcedureId,
      specialty: params.modified?.specialty || params.specialty,
      policy: params.modified?.policy !== undefined ? params.modified.policy : params.policy,
      networkStatus: params.modified?.networkStatus || params.newScenario?.networkStatus || 'unverified',
      roomType: params.modified?.roomType || params.newScenario?.roomType || 'General Ward',
      simulatedRoomRate: params.modified?.simulatedRoomRate || params.newScenario?.simulatedRoomRate
    };

    const baseEst = this.estimateCost(baseInput);
    const modEst = this.estimateCost(modInput);

    const changes: string[] = [];

    // Room changes
    const baseRoom = baseInput.roomType;
    const modRoom = modInput.roomType;
    if (baseRoom !== modRoom || baseInput.simulatedRoomRate !== modInput.simulatedRoomRate) {
      changes.push(`Room Category changed from ${baseRoom} (₹${baseInput.simulatedRoomRate || 2500}/day) to ${modRoom} (₹${modInput.simulatedRoomRate || 2500}/day).`);
    }

    // Network status changes
    const baseNet = baseInput.networkStatus;
    const modNet = modInput.networkStatus;
    if (baseNet !== modNet) {
      changes.push(`Network Status changed from "${baseNet}" to "${modNet}".`);
    }

    let financialDiff = '';
    if (baseEst.estimatedPatientOopRange && modEst.estimatedPatientOopRange) {
      const oopDiff = modEst.estimatedPatientOopRange.typical - baseEst.estimatedPatientOopRange.typical;
      if (oopDiff > 0) {
        financialDiff = `Patient out-of-pocket responsibility increased by approx ${formatINR(oopDiff)} (${baseEst.estimatedPatientOopRange.displayRange} → ${modEst.estimatedPatientOopRange.displayRange}).`;
      } else if (oopDiff < 0) {
        financialDiff = `Patient out-of-pocket responsibility decreased by approx ${formatINR(Math.abs(oopDiff))} (${baseEst.estimatedPatientOopRange.displayRange} → ${modEst.estimatedPatientOopRange.displayRange}).`;
      } else {
        financialDiff = 'No significant change in expected out-of-pocket range.';
      }
    }

    return {
      available: baseEst.available && modEst.available,
      baseEstimate: baseEst,
      newEstimate: modEst,
      modifiedEstimate: modEst,
      whatChanged: changes,
      changes,
      financialDiff,
      explanation: `${changes.join(' ')} ${financialDiff}`,
      mlScenarioComparison: treatmentCostMLService.compareScenarios({
        baseline: {
          procedure: baseInput.procedure,
          city: baseInput.city,
          specialty: baseInput.specialty,
          expectedStayDays: baseEst.estimatedStayDays
        },
        modified: {
          procedure: modInput.procedure,
          city: modInput.city,
          specialty: modInput.specialty,
          expectedStayDays: modEst.estimatedStayDays
        }
      }) || undefined
    };
  }
}

export const costIntelligenceService = new CostIntelligenceService();
