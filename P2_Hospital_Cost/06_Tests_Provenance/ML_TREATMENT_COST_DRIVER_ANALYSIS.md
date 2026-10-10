# SehatSure ML-Based Treatment-Cost Driver Analysis (FIN-01 AI Enhancement)

## 1. Executive Summary & Purpose
This capability integrates a supervised Machine Learning regression layer to learn empirical treatment cost patterns across Indian private healthcare facilities and provide **mathematically defensible, local cost-driver attributions** and **what-if scenario impact analysis**.

### Architectural Separation of Concerns
1. **Policy Understanding (Gemini 2.5 Flash / Document Intelligence)**: Ingests unstructured policy schedules (PDFs/images), performs zero-hallucination structured extraction, and normalizes clauses into typed constraints.
2. **Treatment-Cost Intelligence (Benchmark Estimator + ML Model)**:
   - *Benchmark Estimator*: Evidence-backed deterministic lookups across 4 provenance tiers (Hospital Tariff, Regional, National, Statutory).
   - *ML Cost Driver Model*: Learns multi-attribute cost structures across clinical procedures, geographic tiers, stay durations, and room tariffs to explain *why* an estimate is high or low and *how* scenario adjustments alter the expected cost.
3. **Financial Calculation (Deterministic FIN-01 Engine)**: The **sole authority** for insurance financial mathematics. Calculates room-rent disallowance, proportionate deductions, non-medical consumables, sublimits, co-payments, insurer admissibility, and patient out-of-pocket (OOP) exposure.

> **CRITICAL BOUNDARY RULE**: The ML model **never** calculates insurance covered amounts, co-pay, deductibles, sub-limits, or patient OOP. It has zero authority over insurance policy rules.

---

## 2. Dataset Audit & Provenance

### Datasets Audited
Three treatment-cost related datasets in the repository were audited:

| Dataset | Total Rows | Active/Verified Rows | Purpose & Disposition |
| :--- | :--- | :--- | :--- |
| `pvt_costs.csv` | 184 | 184 (100% verified) | **Selected Training Set**: Private hospital structured procedure tariffs across 8 geographic tiers, 7 specialties, 23 procedures, stay durations (0–10 days), and room rates. Zero missing values, zero synthetic rows. |
| `govt_costs.csv` | 184 | 184 (100% verified) | Excluded from private tariff model to prevent cross-domain contamination (statutory subsidized rates under PM-JAY/CGHS packages have distinct financial semantics). |
| `treatment_cost_benchmarks.csv` | 38 | 8 active verified | Audited but excluded from training. 30 of 38 rows are flagged as `UNVERIFIED` / `VALUE_NOT_SUPPORTED` under FIN-01 audit rules, leaving only 8 AB-PMJAY government benchmarks. |

### Dataset Provenance & Integrity
- **Training Set**: `pvt_costs.csv`
- **Total Training Instances**: 184 records.
- **Excluded Records**: 0 synthetic rows, 0 fabricated rows. Only real validated records from `pvt_costs.csv` are used.
- **Data Integrity Standard**: The data represents structured grid tariffs across geographic tiers. No clinical or patient-level variables (e.g., patient age, comorbidities, surgical complications, surgeon tenure) exist in the dataset; therefore, **no synthetic features are fabricated**.

---

## 3. Features & Target Variable Definition

### Features
| Feature Name | Type | Encoding / Preprocessing | Description |
| :--- | :--- | :--- | :--- |
| `procedure` | Categorical (23 classes) | One-Hot Encoded (drop='first') | Specific clinical procedure (e.g., Angioplasty, Total Knee Replacement). |
| `specialty` | Categorical (7 classes) | One-Hot Encoded (drop='first') | Clinical department (Cardiology, Orthopedics, Oncology, etc.). |
| `tier` | Categorical (8 classes) | One-Hot Encoded (drop='first') | Geographic tier (Metro 1, Metro 2, Tier 1A, Tier 1B, Tier 2A, Tier 2B, Town 1, Town 2). |
| `duration_days` | Continuous | MinMax Scaled [0, 1] | Expected inpatient hospital stay in days (0 to 10 days). |
| `room_rate_daily` | Continuous | MinMax Scaled [0, 1] | Daily room tariff in INR (₹500 to ₹12,000/day). |

### Target Variable
- **Target**: `cost` (Continuous, INR).
- **Semantics**: Total estimated treatment cost under private hospital tariff.
- **Target Leakage Prevention**: Features strictly exclude target, insurance payout, policy coverage, covered amount, and OOP expenses.

---

## 4. Model Selection & Justification

### Models Evaluated (184 records, 33 preprocessed features):
1. **Ordinary Least Squares (OLS) Linear Regression**: Prone to multicollinearity inflation across procedural indicator columns.
2. **Ridge Regression ($\alpha=1.0$, L2 Regularization)**: **SELECTED MODEL**.
   - Strict convex optimization guarantees global minimum.
   - Shrinks collinear procedure coefficients without arbitrary feature elimination.
   - Enables exact **Local Shapley-equivalent linear decomposition**: $C_j = \beta_j (x_j - \bar{x}_j)$.
   - Zero-dependency TypeScript runtime deployment for zero-latency, reliable production execution on Render Node.js container.
3. **Random Forest Regressor ($n=100$)**: Overfits on small structured grid datasets, poorer holdout generalization.
4. **Gradient Boosting Regressor ($n=100$)**: High variance on procedure holdouts.

---

## 5. Validation Methodology & Actual Honest Metrics

Validation was conducted using three independent cross-validation strategies:

### 1. 10-Fold Cross-Validation (In-Domain Performance)
- **MAE**: ₹45,423
- **RMSE**: ₹86,722
- **$R^2$**: 0.2685 (0.27)

### 2. Grouped 5-Fold Cross-Validation by Procedure (Holdout Generalization)
- **MAE**: ₹64,321
- **RMSE**: ₹118,504
- **$R^2$**: -0.6839

> **Honest Scientific Finding**: The negative $R^2$ under grouped procedure holdout proves that linear and tree models cannot accurately predict costs for clinical procedures they have never encountered in training data. This rigorously validates our **Strict Refusal Rule**: the system must refuse to extrapolate and return `insufficient_data` when presented with unmodeled procedures.

### 3. Leave-One-Tier-Out Cross-Validation (Geographic Transferability)
- **MAE**: ₹44,498
- **RMSE**: ₹87,032
- **$R^2$**: 0.2632

---

## 6. Feature Attribution (Cost-Driver Explanation Method)

To answer **"Why is this treatment-cost estimate high or low?"**, the model computes local attributions:

$$C_j = \beta_j \cdot (x_j - \bar{x}_j)$$

Where:
- $\beta_j$ is the learned regression coefficient for feature $j$.
- $x_j$ is the input value of feature $j$.
- $\bar{x}_j$ is the mean value of feature $j$ across the training dataset.

### Aggregated Dimension Contributions
Attributions are grouped into 4 intuitive dimensions:
1. **Procedure**: Direct procedural base tariff influence.
2. **Geographic Tier**: City/metro cost-of-living multiplier.
3. **Stay Duration**: Inpatient hospitalization duration impact.
4. **Room Tariff**: Daily room category tariff impact.

### Non-Causal Language Standard
Attribution explanations strictly employ non-causal language:
- **Compliant**: *"Model indicates this feature strongly influences the estimate."*
- **Prohibited**: *"This feature causes the patient's bill to increase."*

---

## 7. Strict Refusal & Anti-Hallucination Guardrails

The model strictly enforces input domain validation and refuses to extrapolate:
1. **Unsupported Procedure**: Returns `status: "insufficient_data"` with explicit reason.
2. **Unsupported Geographic Tier**: Returns `status: "insufficient_data"`.
3. **Missing Required Features**: Returns `status: "insufficient_data"`.
4. **Out-of-Domain Numeric Inputs**: Returns `status: "insufficient_data"` (e.g., negative duration, negative room rates).

### Reliability Classification
- **HIGH**: Procedure and tier exist in training data, inputs within valid domains.
- **MODERATE**: Tier extrapolation or wide numeric variance.
- **INSUFFICIENT**: Unsupported procedure/tier or missing data (prediction is `null`).

---

## 8. Scenario / What-If Integration

The ML service natively compares baseline scenarios against user-modified scenarios (e.g., General Ward vs Twin Sharing or 5 days vs 7 days):
- Computes baseline ML estimate $\hat{y}_{\text{base}}$ and scenario ML estimate $\hat{y}_{\text{scen}}$.
- Evaluates absolute delta: $\Delta = \hat{y}_{\text{scen}} - \hat{y}_{\text{base}}$.
- Evaluates percentage delta: $\% = \frac{\Delta}{\hat{y}_{\text{base}}} \times 100$.
- Generates a non-causal explanation: *"Changing room category from General Ward to Twin Sharing changed the model estimate by ₹12,000 (+6.4%). Model indicates this scenario feature influences the estimated tariff."*

---

## 9. API & System Integration

### Endpoint
`POST /api/hospitals/ml-cost-analysis`

#### Request Payload
```json
{
  "procedure": "Total Knee Replacement",
  "specialty": "Orthopedics",
  "tier": "Metro 1",
  "durationDays": 5,
  "roomRateDaily": 4000
}
```

#### Response Structure
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "modelVersion": "1.0.0",
    "prediction": 268420,
    "currency": "INR",
    "reliability": "HIGH",
    "topCostDrivers": [
      {
        "feature": "Procedure Complexity (Total Knee Replacement)",
        "dimension": "procedure",
        "direction": "upward",
        "magnitude": "strong",
        "rawContribution": 115200,
        "explanation": "Model indicates this feature strongly influences the estimate."
      },
      {
        "feature": "Geographic Tier (Metro 1)",
        "dimension": "tier",
        "direction": "upward",
        "magnitude": "moderate",
        "rawContribution": 45100,
        "explanation": "Model indicates this feature moderately influences the estimate."
      }
    ],
    "validationMetrics": {
      "trainingRows": 184,
      "validationStrategy": "10-fold cross-validation with grouped procedure holdout",
      "mae": 45423,
      "rmse": 86722,
      "r2": 0.2685
    },
    "limitations": "Model trained on empirical private hospital benchmark grid (184 records). Does not predict individual clinical complications or implant-specific surcharges."
  }
}
```

---

## 10. Reproducibility & Model Training Instructions

### Retraining Pipeline
To retrain the model and regenerate the artifact:
```powershell
python scripts/train_treatment_cost_model.py
```
Outputs generated:
- `server/src/ml/treatment_cost_model_artifact.json`
- `server/src/ml/training_summary.json`

### Automated Test Suite
To verify model inference, driver decomposition, and regression safety:
```powershell
cd server
npm test
```
Runs 15 test suites and 228 automated tests including `tests/treatmentCostML.test.ts`.
