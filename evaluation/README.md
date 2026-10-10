# SehatSure System Reliability & Empirical Evaluation Artifacts

This directory contains the machine-readable evaluation results, test runs, and configuration artifacts for the comprehensive reliability audit of the SehatSure healthcare platform.

## Artifact Manifest

| File | Description | Total Cases | Primary Result |
| :--- | :--- | :--- | :--- |
| `financial_engine_results.csv` | Independent Oracle vs Production Financial Engine | 2,000 | 100.00% Exact Match (Max Rupee Error: INR 0) |
| `ml_evaluation_results.csv` | Leakage-safe 10-Fold CV on `pvt_costs.csv` | 184 | MAE: INR 45,468, R2: 0.3037, Within +-20%: 28.3% |
| `end_to_end_results.csv` | Multi-stage pipeline runs (70 in-domain, 30 out-domain) | 100 | 100/100 Correct Handling (70 Adjudicated, 30 Refused) |
| `metamorphic_results.csv` | 5 Metamorphic relations testing directional consistency | 500 | 100.00% Metamorphic Preservation (MR1-MR5) |
| `adversarial_results.csv` | Boundary, stress, and malicious input safety test | 50 | 100.00% Safe Handling / Refusal |
| `rag_evaluation_results.csv` | Policy QA factual, numeric, cross-section & abstention queries | 30 | Ans: 30/30 (100%), Cit: 30/30 (100%), Abs: 30/30 (100%) |
| `policy_extraction_results.csv`| Field-level ground truth audit against 6 real policies | 60 | 100.00% Field Extraction Accuracy (60/60) |
| `evaluation_summary.json` | Consolidated machine-readable metric repository | All | JSON aggregation across all subsystems |
| `test_config.json` | Environment, seed, and dataset hash manifest | N/A | Deterministic Seed: 42, Python 3.12, Node v22 |

## Reproduction Instructions

1. **Deterministic Financial & Pipeline Audit**:
   ```bash
   cd server
   npx tsx src/scripts/runSystemEvaluation.ts
   ```

2. **ML Regression & Word Report Generation**:
   ```bash
   python scripts/run_ml_and_report_evaluation.py
   ```

3. **Baseline Regression Suite**:
   ```bash
   cd server
   npm test -- --run
   ```
