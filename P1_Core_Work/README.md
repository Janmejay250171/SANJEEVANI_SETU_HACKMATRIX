# Person 1 — Core Intelligence Engine, Hospital Network & Costing
## Sanjeevani Setu Core Work Package (`P1_Core_Work`)

- **Author**: Janmejay250171
- **Target Platform**: Sanjeevani Setu (`SANJEEVANI_SETU_HACKMATRIX`)
- **Status**: All 6 Phases Completed, Verified & 100% Passing Test Suites

---

## Phase Overview & Structure

| Phase Folder | Phase Name | Assigned Items | Verification Status |
| :--- | :--- | :---: | :---: |
| [`01_Data_Inspection`](file:///d:/BTECH/HACKMATRIX_FIN01/SANJEEVANI%20SETU/P1_Core_Work/01_Data_Inspection/) | Data Inspection & Benchmark Validation | 9 | Completed & Verified |
| [`02_Contracts_Models`](file:///d:/BTECH/HACKMATRIX_FIN01/SANJEEVANI%20SETU/P1_Core_Work/02_Contracts_Models/) | Contracts, Domain Types & Data Models | 5 | Completed & Verified |
| [`03_Core_Engine_APIs`](file:///d:/BTECH/HACKMATRIX_FIN01/SANJEEVANI%20SETU/P1_Core_Work/03_Core_Engine_APIs/) | Core Intelligence Services & REST APIs | 6 | Completed & Verified |
| [`04_Cost_Demo`](file:///d:/BTECH/HACKMATRIX_FIN01/SANJEEVANI%20SETU/P1_Core_Work/04_Cost_Demo/) | Standalone Cost Demo Prototype & Visualizer | 11 | Completed & Verified |
| [`05_Data_Model_Tooling`](file:///d:/BTECH/HACKMATRIX_FIN01/SANJEEVANI%20SETU/P1_Core_Work/05_Data_Model_Tooling/) | Data Pipeline Tooling & ML Pipelines | 4 | Completed & Verified |
| [`06_Tests_Provenance`](file:///d:/BTECH/HACKMATRIX_FIN01/SANJEEVANI%20SETU/P1_Core_Work/06_Tests_Provenance/) | Test Suites, Provenance & ML Driver Analysis | 9 | Completed & 151/151 Tests Passing |

---

## Detailed Phase Breakdown

### Phase 1: `01_Data_Inspection/`
Inspection, schema audit, and verification of core hospital datasets, empirical private costs, government tariffs, and ML artifacts.
- `evaluation/financial_engine_results.csv` (2,000 deterministic test scenarios)
- `evaluation/ml_evaluation_results.csv` (184 regression sample predictions)
- `govt_costs.csv` (184 statutory procedures under CGHS / PM-JAY)
- `hospitals.csv` (53,022 sanitized hospital facilities)
- `pvt_costs.csv` (184 empirical private hospital procedure rates)
- `server/cleaning_report.json` (52,978 clean record audit trail)
- `server/src/ml/training_summary.json` (RidgeTabularRegression CV metrics)
- `server/src/ml/treatment_cost_model_artifact.json` (Serialized regression model)
- `treatment_cost_benchmarks.csv` (38 authoritative benchmark tariffs)
- `README.txt` (Phase verification checklist)

### Phase 2: `02_Contracts_Models/`
Formal TypeScript interfaces, keyword dictionaries, and Mongoose ODM schemas.
- `server/src/config/specialtyNameKeywords.ts` (Specialty semantic classification keywords)
- `server/src/types/hospital.ts` (Hospital, tier, and search query typing)
- `server/src/types/cost.ts` (Level A–D tariff provenance interfaces)
- `server/src/models/Hospital.ts` (Mongoose schema with geospatial indices)
- `server/src/models/CostModel.ts` (Mongoose schema for cost benchmarks)
- `README.txt` (Phase verification checklist)

### Phase 3: `03_Core_Engine_APIs/`
Operational intelligence engines for hospital search, fuzzy network matching, ML inferencing, and Express endpoints.
- `server/src/services/hospitalService.ts` (Multi-factor ranking & scoring)
- `server/src/services/networkMatchingService.ts` (Cashless insurer network validation)
- `server/src/services/treatmentCostMLService.ts` (Ridge regression inferencing)
- `server/src/services/costIntelligenceService.ts` (Deterministic financial engine & conservative fallback)
- `server/src/controllers/hospitalController.ts` (REST controller methods)
- `server/src/routes/hospitalRoutes.ts` (Express router routes)
- `README.txt` (Phase verification checklist)

### Phase 4: `04_Cost_Demo/`
Zero-dependency, standalone client-side web prototype for exploring procedure cost benchmarks and stay durations.
- `cost/app.js` (In-browser CSV parsing & calculation engine)
- `cost/index.html` (Interactive responsive estimator interface)
- `cost/style.css` (Glassmorphic styles and design tokens)
- `cost/README.md` (Standalone demo documentation)
- Standalone CSV dataset copies (`govt_costs.csv`, `hospitals.csv`, `pvt_costs.csv`, `treatment_cost_benchmarks.csv`)
- `README.txt` (Phase verification checklist)

### Phase 5: `05_Data_Model_Tooling/`
Dataset hygiene pipelines, ML model training, and benchmark integrity validation.
- `scripts/train_treatment_cost_model.py` (RidgeTabularRegression training pipeline)
- `scripts/validateBenchmarks.cjs` (Benchmark range & data integrity validator — 38/38 passed)
- `server/clean_hospitals_dataset.py` (15-stage hospital cleaning script)
- `server/detailed_analysis.py` (Metro distribution analysis script)
- `README.txt` (Phase verification checklist)

### Phase 6: `06_Tests_Provenance/`
Authoritative documentation, provenance specifications, and automated Vitest test suites.
- `hospital_dataset_sources_with_costing_engine_updated.pdf` (ROHINI & statutory rate sources)
- `ML_TREATMENT_COST_DRIVER_ANALYSIS.md` (Cost driver attribution & regression analysis)
- `TREATMENT_COST_DATASET_PROVENANCE.md` (Levels A–D tariff provenance specification)
- `server/tests/costIntelligence.test.ts` (69/69 passing tests)
- `server/tests/hospitalCleaning.test.ts` (2/2 passing tests)
- `server/tests/hospitalRanking.test.ts` (4/4 passing tests)
- `server/tests/networkMatching.test.ts` (13/13 passing tests)
- `server/tests/specialtyNamePriority.test.ts` (50/50 passing tests)
- `server/tests/treatmentCostML.test.ts` (13/13 passing tests)
- `README.txt` (Phase verification checklist)

---

## Test Verification Summary
```
Test Files  6 passed (6)
     Tests  151 passed (151)
```
100% of unit tests pass deterministically across all hospital, network, and cost modules.
