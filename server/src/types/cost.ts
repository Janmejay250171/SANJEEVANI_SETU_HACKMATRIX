export type BenchmarkLevel =
  | 'hospital_specific'
  | 'maharashtra_regional'
  | 'state_benchmark'
  | 'regional_benchmark'
  | 'national'
  | 'national_benchmark'
  | 'government_package'
  | 'academic_estimate'
  | 'unavailable';

export type CostConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient_data';

export type CostSourceStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'VALUE_NOT_SUPPORTED'
  | 'TRANSFORMATION_NOT_VERIFIED';

export interface CostBenchmarkRecord {
  cost_id: string;
  canonical_procedure_id: string;
  canonical_procedure_name: string;
  specialty: string;
  hospital_id: string;
  hospital_name: string;
  city: string;
  state: string;
  room_category: string;
  cost_low: number;
  cost_typical: number;
  cost_high: number;
  reference_rate?: number;
  currency: string;
  benchmark_level: BenchmarkLevel;
  source_type: string;
  source_name: string;
  source_url: string;
  source_document: string;
  source_page: string;
  source_table?: string;
  data_year: number;
  source_date: string;
  sample_size?: number;
  confidence_level: CostConfidenceLevel;
  notes: string;
  source_status?: CostSourceStatus;
  active?: boolean;
  exact_package_rate?: number;
  // Backward compatibility aliases
  procedure: string;
  procedure_code: string;
  geography: string;
}

export interface CostRange {
  min: number;
  max: number;
  low: number;
  typical: number;
  high: number;
  displayRange: string;
  isExactPackageRate?: boolean;
}

export interface CostProvenance {
  costId: string;
  benchmarkLevel: BenchmarkLevel;
  sourceType?: string;
  sourceName: string;
  sourceDocument: string;
  sourcePage?: string;
  sourceTable?: string;
  sourceDate?: string;
  dataYear: number;
  geography: string;
  confidenceLevel: CostConfidenceLevel;
  notes?: string;
  sourceUrl?: string;
  sourceStatus?: CostSourceStatus;
  active?: boolean;
  exactPackageRate?: number;
}

export interface CostBreakdownItem {
  category: string;
  grossAmount: number;
  approvedAmount: number;
  deductionReason?: string;
}

export interface CostIntelligenceEstimate {
  available: boolean;
  isProcedureUnselected?: boolean;
  unavailableReason?: string;
  fallbackNotice?: string;
  canonicalProcedureId?: string;
  clinicalDescription?: string;
  procedure: string;
  procedureCode: string;
  canonicalSpecialty: string;
  hospitalName?: string;
  city?: string;
  benchmarkLevel: BenchmarkLevel;
  confidence?: CostConfidenceLevel;
  treatmentCostRange: CostRange;
  potentiallyCoveredRange: CostRange | null;
  estimatedPatientOopRange: CostRange | null;
  coveredReliable: boolean;
  oopReliable: boolean;
  policyCoverageUnavailableReason?: string;
  missingInformation: string[];
  policyConstraintsApplied?: string[];
  factors?: string[];
  provenance: CostProvenance | null;
  whyThisEstimate: string[];
  disclaimer: string;
  scenarioExplanation?: string;
  isGovernmentPackageOnly?: boolean;
  exactPackageRate?: number;
  statutoryReferenceDisclaimer?: string;
  mlCostAnalysis?: TreatmentCostMLResult | null;
  costEstimateLevel?: 'benchmark' | 'model_reference' | 'unavailable';
  hasModelEstimate?: boolean;
  // Backward compatibility fields
  totalCost?: number;
  displayLow?: number;
  displayHigh?: number;
  roomCost?: number;
  treatmentCost?: number;
  estimatedStayDays?: number;
  roomCostPerDay?: number;
}

export type CostDriverInfluence = 'strong' | 'moderate' | 'low';
export type CostDriverDirection = 'above_baseline' | 'below_baseline';
export type MLReliabilityLevel = 'high' | 'moderate' | 'limited' | 'insufficient';

export interface CostDriverAttribution {
  feature: string;
  rawFeatureKey: string;
  impactAmount: number;
  direction: CostDriverDirection;
  influence: CostDriverInfluence;
  percentageContribution: number;
  explanation: string;
}

export interface MLValidationMetrics {
  tenFoldCvMae: number;
  tenFoldCvR2: number;
  groupedProcCvMae: number;
  groupedProcCvR2: number;
  leaveOneTierOutMae: number;
  trainingFitMae: number;
  validationStrategy: string;
}

export interface MLScenarioComparison {
  baselineEstimate: number;
  scenarioEstimate: number;
  absoluteDelta: number;
  percentageDelta: number;
  primaryDriverChanged: string;
  explanation: string;
}

export interface TreatmentCostMLResult {
  status: 'available' | 'insufficient_data';
  modelVersion: string;
  mlEstimate: number | null;
  displayEstimate: string;
  currency: 'INR';
  reliability: MLReliabilityLevel;
  reliabilityReason: string;
  datasetBaselineMean: number;
  sampleSupportCount?: number;
  procedureRecordsCount?: number;
  matchedProcedure?: string;
  matchedTier?: string;
  canonicalSpecialty?: string;
  actualStayDays?: number;
  costDrivers: CostDriverAttribution[];
  scenarioComparison?: MLScenarioComparison;
  validationMetrics: MLValidationMetrics;
  limitations: string[];
  disclaimer: string;
  benchmarkComparison?: {
    benchmarkTypical: number;
    mlEstimate: number;
    difference: number;
    explanation: string;
  };
}

export interface CostEstimate {
  policyId: string;
  hospitalId: string;
  procedureName: string;
  roomCategory: string;
  expectedDays: number;
  totalEstimatedBill: number;
  insurerPayable: number;
  patientPayable: number;
  proportionateDeductionApplied: boolean;
  copayAmount: number;
  deductibleApplied: number;
  breakdown: CostBreakdownItem[];
}
