# FIN-01: Insurance Coverage & Treatment Cost Intelligence
## End-to-End User Journey & Demonstration Guide

This guide describes how to operate and demonstrate the **FIN-01 Claim Adjudication & Coverage Intelligence Engine** integrated within the SehatSure application.

---

## 1. Quick Start & Local Execution

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Starting the Applications

1. **Start the Express API Server (Port 5000)**:
   ```bash
   cd server
   npm run dev
   ```
   *Health Check*: `http://localhost:5000/api/health`

2. **Start the Vite Frontend Application (Port 5173)**:
   ```bash
   cd frontend
   npm run dev
   ```
   *Access*: Open `http://localhost:5173/` in your browser.

3. **Navigate to the Claim Workflow**:
   Click the **"Claim Intelligence"** tab in the top navigation bar or navigate directly to `http://localhost:5173/` and select the claims section.

---

## 2. Interactive Demonstration Scenarios

At the top of the **Claim Adjudication & Settlement Ledger** page, a scenario selector bar allows one-click loading and testing of the four primary clinical and financial scenarios:

### Scenario 1: Supported Treatment (Appendectomy)
- **Clinical Event**: Acute Appendectomy inpatient surgery.
- **Bill Items**:
  - Surgeon Operative Fee: ₹25,000
  - Operating Theater Charges: ₹15,000
  - Inpatient Nursing Care: ₹10,000
- **Total Claimed**: ₹50,000
- **Policy Applied**: Family Health Optima Base Policy v1.0 (SEC-01 Inpatient Coverage, 10% co-pay).
- **What to Observe**:
  1. **Ledger Table**: All 3 items approved under `SEC-01-INPATIENT` with ~91% relevance score.
  2. **Waterfall Calculation Trace**: Claimed ₹50,000 $\rightarrow$ Deductions ₹0 $\rightarrow$ Admissible Base ₹50,000 $\rightarrow$ 10% Co-pay ₹5,000 $\rightarrow$ **Potentially Payable ₹45,000** | **Patient Responsibility ₹5,000**.
  3. **Strict Invariant**: Mathematical conservation $\text{Payable} + \text{Patient} \equiv \text{Claimed}$.

### Scenario 2: Excluded Item (Elective Cosmetic Rhinoplasty)
- **Clinical Event**: Elective cosmetic reshaping.
- **Bill Items**:
  - Cosmetic Rhinoplasty Procedure: ₹75,000
- **Total Claimed**: ₹75,000
- **Policy Applied**: Standard Exclusions List (Clause `EXCL-01-COSMETIC`).
- **What to Observe**:
  1. **Ledger Table**: Item marked with 100% disallowance (₹75,000 deduction) under clause `EXCL-01-COSMETIC`.
  2. **Evidence Panel**: Verbatim policy excerpt: *"Aesthetic, cosmetic or plastic surgery treatments are strictly excluded unless necessitated by accidental injury."*
  3. **Calculation Trace**: Claimed ₹75,000 $\rightarrow$ Exclusion Deduction ₹75,000 $\rightarrow$ Admissible Base ₹0 $\rightarrow$ **Potentially Payable ₹0** | **Patient Responsibility ₹75,000**.

### Scenario 3: Missing / Conflicting Evidence (Bioresonance Detox)
- **Clinical Event**: Non-standard energy therapy for chronic fatigue.
- **Bill Items**:
  - Bioresonance Holistic Session: ₹30,000
- **Total Claimed**: ₹30,000
- **What to Observe**:
  1. **Assessment Status**: Marked clearly with an amber banner: `PENDING_HUMAN_REVIEW`.
  2. **Audit Warnings**: 3 review triggers flagged:
     - Unrecognized clinical procedure code.
     - Ambiguous evidence conflict between holistic and inpatient clauses.
     - Non-standard billing category.
  3. **Guardrail**: The UI guards the payable estimate and directs the claim to human underwriter review rather than hallucinating an approval.

### Scenario 4: Policy Amendment Precedence & Side-by-Side Reassessment
- **Clinical Event**: Maternity Hospitalization Claim (₹1,50,000).
- **Pre-Amendment Boundary**:
  - Treatment Date: `2024-10-15` (Prior to amendment effective date `2024-11-01`).
  - Applicable Contract: Base Policy v1.0 (Clause `MAT-01` with ₹50,000 maternity sub-limit).
  - Payable: ₹50,000.
- **Post-Amendment Boundary**:
  - Treatment Date: `2024-11-15` (After amendment effective date `2024-11-01`).
  - Applicable Contract: Endorsement `END-2024-MAT` v1.1 (Enhanced ₹1,50,000 sub-limit).
  - Payable: ₹1,50,000.
- **What to Observe**:
  1. Click **"Assess Claim"** under pre-amendment date.
  2. Modify treatment date or add endorsement and click **"Reassess Claim"**.
  3. **Side-by-Side Comparison Diff**: Displays Assessment V1 vs Assessment V2, showing the ₹1,00,000 payable delta, the modified clause rationale, and the preserved historical audit trail.

---

## 3. Human-in-the-Loop Item Correction Workflow

1. In the **Itemized Claim Ledger**, locate any bill line item.
2. Click the **"Edit Item"** button on the right of the row.
3. Update the description or claimed amount (e.g. correcting OCR typos).
4. Enter an audit explanation in the **Correction Reason** field.
5. Click **"Save & Recalculate"**.
6. The system sends `PUT /api/claims/:claimId/items/:itemId` and triggers `POST /api/claims/:claimId/reassess`, displaying the updated ledger and the before-and-after comparison.

---

## 4. Automated Verification Commands

All components, calculation oracles, and regression suites can be verified via command line:

```bash
# 1. Run all 14 Vitest unit, adjudication, and integration test suites (277 tests)
npm --prefix server test

# 2. Run the FIN-01 comprehensive evaluation benchmark (Retrieval & Oracles)
npm --prefix server run test:evaluation

# 3. Run legacy clinical treatment cost benchmark verification (38 benchmarks)
node scripts/validateBenchmarks.cjs

# 4. Run legacy UX semantic acceptance test suite (6 tests)
node scripts/verify_ux_semantics.mjs

# 5. Verify production builds
npm --prefix server run build
npm --prefix frontend run build
```
