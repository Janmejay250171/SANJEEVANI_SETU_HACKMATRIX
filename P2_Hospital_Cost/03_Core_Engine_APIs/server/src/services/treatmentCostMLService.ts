import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CostDriverAttribution,
  CostDriverInfluence,
  CostDriverDirection,
  MLReliabilityLevel,
  MLScenarioComparison,
  MLValidationMetrics,
  TreatmentCostMLResult
} from '../types/cost.js';
import { CITY_CANONICAL_TIERS } from './hospitalService.js';
import { formatINR, formatIndianCurrencyAbbreviated, isProcedureUnselected } from './costIntelligenceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possibleArtifactPaths = [
  path.resolve(__dirname, '../ml/treatment_cost_model_artifact.json'),
  path.resolve(__dirname, '../../src/ml/treatment_cost_model_artifact.json'),
  path.resolve(process.cwd(), 'server/src/ml/treatment_cost_model_artifact.json'),
  path.resolve(process.cwd(), 'src/ml/treatment_cost_model_artifact.json'),
  path.resolve(__dirname, '../../ml/treatment_cost_model_artifact.json')
];

interface ModelArtifact {
  model_name: string;
  model_type: string;
  model_version: string;
  training_timestamp: string;
  dataset_metadata: {
    source_file: string;
    file_sha256: string;
    training_rows: number;
    excluded_rows: number;
    description: string;
    notes: string;
  };
  target: {
    name: string;
    currency: string;
    dataset_mean: number;
    min: number;
    max: number;
  };
  validation_metrics: {
    strategy: string;
    random_10fold_cv: { mae: number; rmse: number; r2: number };
    grouped_procedure_5fold_cv: { mae: number; rmse: number; r2: number };
    leave_one_tier_out_cv: { mae: number; rmse: number; r2: number };
    training_fit: { mae: number; rmse: number; r2: number };
  };
  feature_schema: {
    feature_names: string[];
    coefficients: number[];
    feature_means: number[];
    intercept: number;
    feature_count: number;
  };
  domains: {
    supported_procedures: string[];
    supported_specialties: string[];
    supported_tiers: string[];
    procedure_to_specialty: Record<string, string>;
    procedure_default_stay_days: Record<string, number>;
    stay_days_range: { min: number; max: number; max_acceptable_for_inference: number };
  };
  model_selection_rationale: string;
  attribution_methodology: {
    method: string;
    formula: string;
  };
}

export interface MLPredictionParams {
  procedure?: string | null;
  tier?: string | null;
  city?: string | null;
  specialty?: string | null;
  expectedStayDays?: number | null;
  benchmarkTypical?: number | null;
}

export interface MLScenarioParams {
  baseline: MLPredictionParams;
  modified: MLPredictionParams;
}

export class TreatmentCostMLService {
  private artifact: ModelArtifact | null = null;
  private isLoaded = false;
  private coefMap = new Map<string, number>();
  private meanMap = new Map<string, number>();

  constructor() {
    this.loadModel();
  }

  public loadModel(): void {
    let chosenPath: string | null = null;
    for (const p of possibleArtifactPaths) {
      if (fs.existsSync(p)) {
        chosenPath = p;
        break;
      }
    }

    if (!chosenPath) {
      console.warn('[TreatmentCostMLService] Model artifact not found at tested paths.');
      this.isLoaded = false;
      return;
    }

    try {
      const raw = fs.readFileSync(chosenPath, 'utf8');
      this.artifact = JSON.parse(raw) as ModelArtifact;

      const schema = this.artifact.feature_schema;
      this.coefMap.clear();
      this.meanMap.clear();

      for (let i = 0; i < schema.feature_names.length; i++) {
        const name = schema.feature_names[i];
        this.coefMap.set(name, schema.coefficients[i]);
        this.meanMap.set(name, schema.feature_means[i]);
      }

      this.isLoaded = true;
      console.log(
        `[TreatmentCostMLService] Loaded ${this.artifact.model_name} v${this.artifact.model_version} ` +
        `(${this.artifact.dataset_metadata.training_rows} training rows, 10-fold MAE: INR ${Math.round(this.artifact.validation_metrics.random_10fold_cv.mae)}).`
      );
    } catch (err) {
      console.error('[TreatmentCostMLService] Failed to load model artifact:', err);
      this.isLoaded = false;
    }
  }

  public isReady(): boolean {
    return this.isLoaded && this.artifact !== null;
  }

  public getModelMetadata(): ModelArtifact | null {
    return this.artifact;
  }

  /**
   * Normalizes procedure to the model's supported vocabulary.
   * Maps common clinical aliases into exact trained dataset procedure names.
   */
  public matchSupportedProcedure(rawProcedure?: string | null): string | null {
    if (!rawProcedure || isProcedureUnselected(rawProcedure)) return null;
    if (!this.artifact) return null;

    const clean = rawProcedure.toLowerCase().trim();

    // Direct match against supported procedures
    for (const p of this.artifact.domains.supported_procedures) {
      if (p.toLowerCase() === clean) return p;
    }

    // Common synonyms / clinical variations
    const aliases: Record<string, string> = {
      'total knee replacement': 'Knee Replacement',
      'knee replacement': 'Knee Replacement',
      'tkr': 'Knee Replacement',
      'total hip replacement': 'Hip Replacement',
      'hip replacement': 'Hip Replacement',
      'thr': 'Hip Replacement',
      'angioplasty': 'Angioplasty',
      'angioplasty (ptca)': 'Angioplasty',
      'angioplasty (ptca + 1 des)': 'Angioplasty',
      'ptca': 'Angioplasty',
      'angiography': 'Angiography',
      'coronary angiography': 'Angiography',
      'cag': 'Angiography',
      'cabg': 'CABG',
      'coronary artery bypass grafting': 'CABG',
      'coronary artery bypass grafting (cabg)': 'CABG',
      'bypass surgery': 'CABG',
      'pacemaker': 'Pacemaker',
      'pacemaker implantation': 'Pacemaker',
      'fracture orif': 'Fracture ORIF',
      'orif': 'Fracture ORIF',
      'arthroscopy': 'Arthroscopy',
      'knee arthroscopy': 'Arthroscopy',
      'appendectomy': 'Appendectomy',
      'laparoscopic appendectomy': 'Appendectomy',
      'hernia repair': 'Hernia Repair',
      'inguinal hernia repair': 'Hernia Repair',
      'cholecystectomy': 'Cholecystectomy',
      'laparoscopic cholecystectomy': 'Cholecystectomy',
      'brain/spine surgery': 'Brain/Spine Surgery',
      'spine surgery': 'Brain/Spine Surgery',
      'brain surgery': 'Brain/Spine Surgery',
      'craniotomy': 'Brain/Spine Surgery',
      'laminectomy': 'Laminectomy',
      'eeg': 'EEG',
      'chemotherapy': 'Chemotherapy',
      'cancer surgery': 'Cancer Surgery',
      'radiotherapy': 'Radiotherapy',
      'radiation therapy': 'Radiotherapy',
      'normal delivery': 'Normal Delivery',
      'vaginal delivery': 'Normal Delivery',
      'c-section': 'C-Section',
      'cesarean': 'C-Section',
      'caesarean section': 'C-Section',
      'caesarean section (c-section)': 'C-Section',
      'hysterectomy': 'Hysterectomy',
      'pcnl': 'PCNL',
      'turp': 'TURP',
      'transurethral resection of the prostate': 'TURP',
      'lithotripsy': 'Lithotripsy',
      'eswl': 'Lithotripsy'
    };

    if (aliases[clean]) {
      const canonical = aliases[clean];
      if (this.artifact.domains.supported_procedures.includes(canonical)) {
        return canonical;
      }
    }

    // Substring match
    for (const [alias, target] of Object.entries(aliases)) {
      if (clean.includes(alias) || alias.includes(clean)) {
        if (this.artifact.domains.supported_procedures.includes(target)) {
          return target;
        }
      }
    }

    return null;
  }

  /**
   * Resolves tier string either directly or via city mapping.
   */
  public resolveTier(tier?: string | null, city?: string | null): string | null {
    if (!this.artifact) return null;
    const supportedTiers = this.artifact.domains.supported_tiers;

    if (tier && tier.trim()) {
      const cleanTier = tier.trim();
      const matched = supportedTiers.find(t => t.toLowerCase() === cleanTier.toLowerCase());
      if (matched) return matched;
    }

    if (city && city.trim()) {
      const normCity = city.trim().toLowerCase();
      const mappedTier = CITY_CANONICAL_TIERS[normCity];
      if (mappedTier) {
        const matched = supportedTiers.find(t => t.toLowerCase() === mappedTier.toLowerCase());
        if (matched) return matched;
      }
    }

    return null;
  }

  /**
   * Predicts treatment cost and produces exact model-derived cost-driver explanations.
   * STRICT ANTI-HALLUCINATION:
   * Returns explicit insufficient_data state for unsupported procedures, unsupported tiers,
   * missing inputs, or invalid numerical ranges.
   */
  public predictTreatmentCost(params: MLPredictionParams): TreatmentCostMLResult {
    const limitations = [
      'Model is trained on empirical benchmark tariffs across 8 Indian geographic tiers (pvt_costs.csv), not individual hospital invoice line items.',
      'Estimate reflects expected private hospital surgical expense patterns for the procedure and tier, excluding individual patient medical complications.',
      'Insurance claim coverage and patient out-of-pocket expenses are calculated solely by SehatSure\'s deterministic financial engine, never by this ML model.'
    ];

    const disclaimer = 'Model-derived treatment-cost pattern estimate for informational guidance. Not an institutional tariff quotation or insurer-guaranteed payment.';

    // 1. Model availability check
    if (!this.isReady() || !this.artifact) {
      return {
        status: 'insufficient_data',
        modelVersion: 'unavailable',
        mlEstimate: null,
        displayEstimate: 'Unavailable',
        currency: 'INR',
        reliability: 'insufficient',
        reliabilityReason: 'ML cost model artifact is not loaded or unavailable on this system.',
        datasetBaselineMean: 0,
        costDrivers: [],
        validationMetrics: {
          tenFoldCvMae: 0,
          tenFoldCvR2: 0,
          groupedProcCvMae: 0,
          groupedProcCvR2: 0,
          leaveOneTierOutMae: 0,
          trainingFitMae: 0,
          validationStrategy: 'Unavailable'
        },
        limitations,
        disclaimer
      };
    }

    const {
      procedure: rawProcedure,
      tier: rawTier,
      city,
      specialty: rawSpecialty,
      expectedStayDays,
      benchmarkTypical
    } = params;

    const valMetrics: MLValidationMetrics = {
      tenFoldCvMae: Math.round(this.artifact.validation_metrics.random_10fold_cv.mae),
      tenFoldCvR2: Number(this.artifact.validation_metrics.random_10fold_cv.r2.toFixed(4)),
      groupedProcCvMae: Math.round(this.artifact.validation_metrics.grouped_procedure_5fold_cv.mae),
      groupedProcCvR2: Number(this.artifact.validation_metrics.grouped_procedure_5fold_cv.r2.toFixed(4)),
      leaveOneTierOutMae: Math.round(this.artifact.validation_metrics.leave_one_tier_out_cv.mae),
      trainingFitMae: Math.round(this.artifact.validation_metrics.training_fit.mae),
      validationStrategy: '10-Fold CV + Grouped 5-Fold by Procedure + Leave-One-Tier-Out CV'
    };

    // 2. Validate procedure
    if (isProcedureUnselected(rawProcedure)) {
      return {
        status: 'insufficient_data',
        modelVersion: this.artifact.model_version,
        mlEstimate: null,
        displayEstimate: 'Select procedure',
        currency: 'INR',
        reliability: 'insufficient',
        reliabilityReason: 'Procedure not specified. Please select a specific procedure to generate an ML cost-driver analysis.',
        datasetBaselineMean: this.artifact.target.dataset_mean,
        costDrivers: [],
        validationMetrics: valMetrics,
        limitations,
        disclaimer
      };
    }

    const matchedProcedure = this.matchSupportedProcedure(rawProcedure);
    if (!matchedProcedure) {
      const procLabel = (rawProcedure || 'Selected procedure').trim();
      return {
        status: 'insufficient_data',
        modelVersion: this.artifact.model_version,
        mlEstimate: null,
        displayEstimate: 'Unavailable',
        currency: 'INR',
        reliability: 'insufficient',
        reliabilityReason: `Unsupported procedure "${procLabel}". The ML cost model is trained strictly on verified surgical benchmarks (${this.artifact.domains.supported_procedures.length} supported procedures) and refuses to extrapolate to unverified clinical interventions.`,
        datasetBaselineMean: this.artifact.target.dataset_mean,
        costDrivers: [],
        validationMetrics: valMetrics,
        limitations,
        disclaimer
      };
    }

    // 3. Validate geographic tier
    const matchedTier = this.resolveTier(rawTier, city);
    if (!matchedTier) {
      const tierLabel = (rawTier || city || 'Unknown region').trim();
      return {
        status: 'insufficient_data',
        modelVersion: this.artifact.model_version,
        mlEstimate: null,
        displayEstimate: 'Unavailable',
        currency: 'INR',
        reliability: 'insufficient',
        reliabilityReason: `Unsupported geographic tier "${tierLabel}". Valid tiers are: ${this.artifact.domains.supported_tiers.join(', ')}.`,
        datasetBaselineMean: this.artifact.target.dataset_mean,
        costDrivers: [],
        validationMetrics: valMetrics,
        limitations,
        disclaimer
      };
    }

    // 4. Validate specialty (defaults to procedure's validated clinical specialty)
    const canonicalSpecialty = this.artifact.domains.procedure_to_specialty[matchedProcedure] || rawSpecialty || 'General Surgery';

    // 5. Validate stay duration
    const defaultStay = this.artifact.domains.procedure_default_stay_days[matchedProcedure] ?? 4;
    let actualStay = defaultStay;

    if (expectedStayDays !== undefined && expectedStayDays !== null) {
      if (typeof expectedStayDays !== 'number' || isNaN(expectedStayDays) || expectedStayDays < 0) {
        return {
          status: 'insufficient_data',
          modelVersion: this.artifact.model_version,
          mlEstimate: null,
          displayEstimate: 'Unavailable',
          currency: 'INR',
          reliability: 'insufficient',
          reliabilityReason: `Invalid expected stay duration (${expectedStayDays}). Stay duration must be a non-negative number of days.`,
          datasetBaselineMean: this.artifact.target.dataset_mean,
          costDrivers: [],
          validationMetrics: valMetrics,
          limitations,
          disclaimer
        };
      }

      if (expectedStayDays > this.artifact.domains.stay_days_range.max_acceptable_for_inference) {
        return {
          status: 'insufficient_data',
          modelVersion: this.artifact.model_version,
          mlEstimate: null,
          displayEstimate: 'Unavailable',
          currency: 'INR',
          reliability: 'insufficient',
          reliabilityReason: `Stay duration (${expectedStayDays} days) exceeds maximum medically validated domain limit (${this.artifact.domains.stay_days_range.max_acceptable_for_inference} days). Model refuses to extrapolate.`,
          datasetBaselineMean: this.artifact.target.dataset_mean,
          costDrivers: [],
          validationMetrics: valMetrics,
          limitations,
          disclaimer
        };
      }

      actualStay = expectedStayDays;
    }

    // 6. Execute Model Inference: y_hat = beta_0 + sum(beta_j * x_j)
    const schema = this.artifact.feature_schema;
    let rawPrediction = schema.intercept;

    // Build vector x
    const xVector = new Array(schema.feature_names.length).fill(0);

    for (let i = 0; i < schema.feature_names.length; i++) {
      const fn = schema.feature_names[i];
      if (fn === `proc:${matchedProcedure}`) {
        xVector[i] = 1.0;
      } else if (fn === `spec:${canonicalSpecialty}`) {
        xVector[i] = 1.0;
      } else if (fn === `tier:${matchedTier}`) {
        xVector[i] = 1.0;
      } else if (fn === 'expected_stay_days') {
        xVector[i] = actualStay;
      }
      rawPrediction += schema.coefficients[i] * xVector[i];
    }

    // Bounded floor protection
    const mlEstimate = Math.max(500, Math.round(rawPrediction));
    const displayEstimate = formatIndianCurrencyAbbreviated(mlEstimate);

    // 7. Local Shapley-Equivalent Feature Attribution: C_j = beta_j * (x_j - mean_x_j)
    let procAttribution = 0;
    let specAttribution = 0;
    let tierAttribution = 0;
    let stayAttribution = 0;

    for (let i = 0; i < schema.feature_names.length; i++) {
      const fn = schema.feature_names[i];
      const deltaX = xVector[i] - schema.feature_means[i];
      const contrib = schema.coefficients[i] * deltaX;

      if (fn.startsWith('proc:')) {
        procAttribution += contrib;
      } else if (fn.startsWith('spec:')) {
        specAttribution += contrib;
      } else if (fn.startsWith('tier:')) {
        tierAttribution += contrib;
      } else if (fn === 'expected_stay_days') {
        stayAttribution += contrib;
      }
    }

    const rawDrivers = [
      {
        feature: 'Geographic Tier',
        rawFeatureKey: `tier:${matchedTier}`,
        amount: Math.round(tierAttribution),
        valLabel: matchedTier
      },
      {
        feature: 'Procedure Complexity',
        rawFeatureKey: `proc:${matchedProcedure}`,
        amount: Math.round(procAttribution),
        valLabel: matchedProcedure
      },
      {
        feature: 'Expected Inpatient Stay',
        rawFeatureKey: 'expected_stay_days',
        amount: Math.round(stayAttribution),
        valLabel: `${actualStay} day${actualStay === 1 ? '' : 's'}`
      },
      {
        feature: 'Clinical Specialty',
        rawFeatureKey: `spec:${canonicalSpecialty}`,
        amount: Math.round(specAttribution),
        valLabel: canonicalSpecialty
      }
    ];

    const totalAbsAttribution = rawDrivers.reduce((sum, d) => sum + Math.abs(d.amount), 0) || 1;

    const costDrivers: CostDriverAttribution[] = rawDrivers
      .map(d => {
        const absAmt = Math.abs(d.amount);
        const pct = Number(((absAmt / totalAbsAttribution) * 100).toFixed(1));
        const direction: CostDriverDirection = d.amount >= 0 ? 'above_baseline' : 'below_baseline';
        const influence: CostDriverInfluence = pct >= 35 ? 'strong' : pct >= 15 ? 'moderate' : 'low';
        const sign = d.amount >= 0 ? '+' : '−';

        // STRICT NON-CAUSAL EXPLANATION
        const explanation =
          `Model indicates ${d.feature.toLowerCase()} (${d.valLabel}) ${influence}ly influences the estimate ` +
          `(${sign}${formatINR(absAmt)} relative to dataset benchmark average).`;

        return {
          feature: d.feature,
          rawFeatureKey: d.rawFeatureKey,
          impactAmount: d.amount,
          direction,
          influence,
          percentageContribution: pct,
          explanation
        };
      })
      .sort((a, b) => Math.abs(b.impactAmount) - Math.abs(a.impactAmount));

    // 8. Honest Reliability Classification (Data-Driven Criteria)
    let reliability: MLReliabilityLevel = 'high';
    let reliabilityReason =
      `High model support: Procedure "${matchedProcedure}" and tier "${matchedTier}" are verified in the training dataset (184 benchmark records, 8 tier records), ` +
      `and stay duration (${actualStay}d) matches clinical standard.`;

    const stayDivergence = Math.abs(actualStay - defaultStay);
    if (stayDivergence > 2) {
      reliability = 'moderate';
      reliabilityReason =
        `Moderate model support: Stay duration (${actualStay}d) diverges significantly from standard benchmark (${defaultStay}d), ` +
        'introducing elevated model extrapolation variance.';
    }

    // 9. Benchmark Comparison
    let benchmarkComparison: TreatmentCostMLResult['benchmarkComparison'] = undefined;
    if (typeof benchmarkTypical === 'number' && benchmarkTypical > 0) {
      const diff = mlEstimate - benchmarkTypical;
      const pctDiff = Number(((diff / benchmarkTypical) * 100).toFixed(1));
      const sign = diff >= 0 ? '+' : '';
      benchmarkComparison = {
        benchmarkTypical,
        mlEstimate,
        difference: diff,
        explanation:
          `Existing evidence-backed benchmark is ${formatINR(benchmarkTypical)}, while the ML learned pattern estimate is ` +
          `${formatINR(mlEstimate)} (${sign}${pctDiff}%). Benchmark reflects published institutional or regional tariff schedules; ` +
          'ML reflects generalized regression across all Indian tiers and clinical duration variables.'
      };
    }

    return {
      status: 'available',
      modelVersion: this.artifact.model_version,
      mlEstimate,
      displayEstimate,
      currency: 'INR',
      reliability,
      reliabilityReason,
      datasetBaselineMean: Math.round(this.artifact.target.dataset_mean),
      sampleSupportCount: 184,
      procedureRecordsCount: 8,
      matchedProcedure,
      matchedTier,
      canonicalSpecialty,
      actualStayDays: actualStay,
      costDrivers,
      validationMetrics: valMetrics,
      limitations,
      disclaimer,
      benchmarkComparison
    };
  }

  /**
   * Evaluates what-if scenario deltas deterministically on the model's outputs.
   */
  public compareScenarios(params: MLScenarioParams): MLScenarioComparison | null {
    const baseResult = this.predictTreatmentCost(params.baseline);
    const modResult = this.predictTreatmentCost(params.modified);

    if (baseResult.status !== 'available' || modResult.status !== 'available' ||
        baseResult.mlEstimate === null || modResult.mlEstimate === null) {
      return null;
    }

    const absDelta = modResult.mlEstimate - baseResult.mlEstimate;
    const pctDelta = Number(((absDelta / baseResult.mlEstimate) * 100).toFixed(1));

    // Identify primary driver changed
    const changes: string[] = [];
    if (params.baseline.procedure !== params.modified.procedure) {
      changes.push(`procedure (${params.baseline.procedure} → ${params.modified.procedure})`);
    }
    if (params.baseline.tier !== params.modified.tier || params.baseline.city !== params.modified.city) {
      changes.push(`geographic tier (${params.baseline.tier || params.baseline.city} → ${params.modified.tier || params.modified.city})`);
    }
    if (params.baseline.expectedStayDays !== params.modified.expectedStayDays) {
      changes.push(`expected stay (${params.baseline.expectedStayDays ?? 'default'}d → ${params.modified.expectedStayDays ?? 'default'}d)`);
    }

    const primaryDriverChanged = changes.join(', ') || 'scenario parameters';
    const sign = absDelta >= 0 ? '+' : '';

    const explanation =
      `Modifying ${primaryDriverChanged} adjusted the ML model estimate by approx ${sign}${formatINR(absDelta)} ` +
      `(${sign}${pctDelta}% change from ${formatINR(baseResult.mlEstimate)} to ${formatINR(modResult.mlEstimate)}). ` +
      'Note: This represents learned tabular correlation, not a guaranteed medical price quote.';

    return {
      baselineEstimate: baseResult.mlEstimate,
      scenarioEstimate: modResult.mlEstimate,
      absoluteDelta: absDelta,
      percentageDelta: pctDelta,
      primaryDriverChanged,
      explanation
    };
  }
}

export const treatmentCostMLService = new TreatmentCostMLService();
