# SEHATSURE — FIN-01 Cost Intelligence Coverage Matrix

## Overview
This document specifies the authoritative coverage, provenance, benchmark levels, and deterministic policy-awareness capabilities of the SehatSure FIN-01 Cost Intelligence Engine.

In strict alignment with FIN-01, SehatSure prioritizes:
**ACCURACY > PROVENANCE > TRANSPARENCY > UNCERTAINTY HANDLING > COVERAGE**

SehatSure **refuses to fabricate or guess prices** for medical procedures when verified empirical evidence is unavailable.

---

## 1. FIN-01 Master Procedure Coverage Matrix

The curated FIN-01 dataset covers **11 supported procedures across 7 specialties**. All 11 supported procedures have verified empirical cost benchmarks and complete deterministic policy calculations.

| Procedure | Specialty | Cost Source | Benchmark Level | Cost Available | Policy Calculation Available | OOP Calculation Available | Scenario Recalculation Available | Confidence | Full FIN-01 Flow |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Angioplasty (PTCA + 1 DES)** | Cardiology | Ruby Hall Clinic Tariff / Maharashtra Forum / NHSCD / PM-JAY MC010A | Hospital-Specific / Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | High / Medium | **YES** |
| **Coronary Artery Bypass Grafting (CABG)** | Cardiology | Ruby Hall Clinic Tariff / Maharashtra Registry / NHSCD / PM-JAY MC013A | Hospital-Specific / Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | High / Medium | **YES** |
| **Total Knee Replacement (TKR)** | Orthopedics | Sancheti Hospital Tariff / DMH / Maharashtra Survey / NHSCD / PM-JAY SB039A | Hospital-Specific / Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | High / Medium | **YES** |
| **Total Hip Replacement (THR)** | Orthopedics | Sancheti Hospital Tariff / Maharashtra Survey / NHSCD / PM-JAY SB040A | Hospital-Specific / Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | High / Medium | **YES** |
| **Laparoscopic Cholecystectomy** | General Surgery | ASI Maharashtra Chapter / NHSCD / PM-JAY S1A11.1 | Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | Medium / Low | **YES** |
| **Laparoscopic Appendectomy** | General Surgery | Maharashtra Minimal Access Survey / NHSCD / PM-JAY SG005A | Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | Medium / Low | **YES** |
| **Inguinal Hernia Repair** | General Surgery | Maharashtra Surgical Forum / NHSCD / PM-JAY SG001A | Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | Medium / Low | **YES** |
| **Cataract Surgery (Phaco + IOL)** | Ophthalmology | Maharashtra Ophthalmic Care Association / AIIMS NHSCD / PM-JAY SO001A | Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | Medium / Low | **YES** |
| **Caesarean Section (C-Section)** | Obstetrics & Gynecology | FOGSI West Zone / NHSCD / PM-JAY OG001A | Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | Medium / Low | **YES** |
| **TURP for BPH** | Urology | Maharashtra Urological Society / NHSCD / PM-JAY SU080A | Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | Medium / Low | **YES** |
| **Tympanoplasty (Type 1)** | ENT | AOI Maharashtra / NHSCD / PM-JAY SE002A | Regional / National / Govt | **YES** | **YES** (policy-dependent) | **YES** (policy-dependent) | **YES** | Medium / Low | **YES** |
| *Coronary Angiography (CAG)* | Cardiology | *Diagnostic imaging; no inpatient surgical benchmark* | Unavailable | **NO** | **NO** | **NO** | **NO** | Insufficient | **NO** |
| *Electroencephalogram (EEG)* | Neurology | *Outpatient diagnostic neurology test; no inpatient tariff* | Unavailable | **NO** | **NO** | **NO** | **NO** | Insufficient | **NO** |
| *MRI Brain Imaging* | Neurology / Radiology | *Diagnostic imaging; unbundled outpatient modality* | Unavailable | **NO** | **NO** | **NO** | **NO** | Insufficient | **NO** |
| *Chemotherapy Session* | Oncology | *Regimen & cycle dependent; unbundled pharmacy protocol* | Unavailable | **NO** | **NO** | **NO** | **NO** | Insufficient | **NO** |
| *Hemodialysis Session* | Nephrology | *Per-session recurring daycare billing; unbundled* | Unavailable | **NO** | **NO** | **NO** | **NO** | Insufficient | **NO** |

---

## 2. Definitional Status Distinctions (FIN-01 Section 3)

The engine strictly distinguishes:

1. **COST BENCHMARK AVAILABLE (`cost_available`)**:
   An empirical, evidence-grounded treatment cost range exists from an authoritative institutional tariff, regional multi-center survey, national health database, or statutory government schedule.

2. **FULL FIN-01 FLOW AVAILABLE (`full_fin01_flow`)**:
   The procedure can execute the end-to-end pipeline:
   $$\text{Procedure Selection} \longrightarrow \text{Cost Range} \longrightarrow \text{Policy Applicability} \longrightarrow \text{Potentially Covered Amount} \longrightarrow \text{Patient OOP} \longrightarrow \text{Confidence} \longrightarrow \text{Provenance} \longrightarrow \text{Scenario Recalculation}$$
   All 11 supported procedures support the full flow when policy inputs (Sum Insured, Network Status, Room Category) are supplied. If policy inputs are omitted, the engine correctly reports Treatment Cost while setting Covered and OOP to *"Unable to reliably estimate"*.

---

## 3. Data Traceability & Numerical Provenance (FIN-01 Section 5)

Every benchmark number in [`treatment_cost_benchmarks.csv`](file:///d:/BTECH/SEHATSURE/treatment_cost_benchmarks.csv) is traceable to source publications:

### A. Cardiology: Angioplasty (PTCA + 1 DES)
- **Hospital Tariff (Ruby Hall Clinic, Pune)**: Cath Lab Schedule 2024, Page 3. Base package with 1 DES: ₹1,35,000 (low) to ₹2,50,000 (high, complex anatomy/calcified lesion), median ₹1,80,000.
- **Regional Benchmark (Maharashtra Interventional Cardiology Forum, 2024)**: Table 3.4. Multi-center survey across 1,800 cases in Pune/Mumbai private NABH facilities. Interquartile range: ₹1,20,000 (25th percentile) to ₹2,40,000 (75th percentile), median ₹1,65,000.
- **National Benchmark (NHSCD / PGIMER, 2023)**: Table 8. All-India private tertiary care cost analysis. Range: ₹1,10,000 to ₹2,60,000, typical ₹1,70,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `MC010A`. Statutory ceiling: ₹65,000 base reference, ₹85,000 package max.

### B. Cardiology: Coronary Artery Bypass Grafting (CABG)
- **Hospital Tariff (Ruby Hall Clinic, Pune)**: Cardiovascular Tariff Schedule 2024, Page 8. General ward off-pump CABG: ₹2,75,000 (low) to ₹4,60,000 (high, multi-vessel with endarterectomy), median ₹3,50,000.
- **Regional Benchmark (Maharashtra Cardiothoracic Surgical Registry, 2024)**: Table 5.1. Range: ₹2,50,000 to ₹4,50,000, median ₹3,20,000.
- **National Benchmark (NHSCD / DHR, 2023)**: Table 12. Range: ₹2,20,000 to ₹4,80,000, typical ₹3,30,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `MC013A`. Statutory package: ₹1,18,100 reference, ₹1,30,000 package max.

### C. Orthopedics: Total Knee Replacement (TKR)
- **Hospital Tariff (Sancheti Hospital, Pune)**: Orthopaedic Inpatient Tariff Guide 2024, Page 4. Unilateral primary TKR in General Ward: ₹1,90,000 (standard Indian implant) to ₹3,40,000 (imported high-flex CE implant), median ₹2,60,000.
- **Hospital Tariff (Deenanath Mangeshkar Hospital, Pune)**: DMH Tariff Schedule 2024, Page 12. Range: ₹1,75,000 to ₹3,25,000, typical ₹2,45,000.
- **Regional Benchmark (Maharashtra Private Healthcare Survey, 2024)**: Table 4.2. Range: ₹1,80,000 to ₹3,20,000, median ₹2,35,000.
- **National Benchmark (NHSCD / PGIMER, 2023)**: Vol 3 Sec 4. Range: ₹1,60,000 to ₹3,80,000, typical ₹2,40,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `SB039A`. Statutory package: ₹80,000 reference, ₹1,05,000 package max.

### D. Orthopedics: Total Hip Replacement (THR)
- **Hospital Tariff (Sancheti Hospital, Pune)**: Orthopaedic Inpatient Tariff Guide 2024, Page 6. Unilateral primary uncemented THR: ₹2,10,000 (low) to ₹3,75,000 (high, ceramic-on-poly), median ₹2,80,000.
- **Regional Benchmark (Maharashtra Private Healthcare Survey, 2024)**: Table 4.3. Range: ₹1,95,000 to ₹3,50,000, median ₹2,60,000.
- **National Benchmark (NHSCD / PGIMER, 2023)**: Vol 3 Sec 4. Range: ₹1,75,000 to ₹3,95,000, typical ₹2,55,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `SB040A`. Statutory package: ₹90,000 reference, ₹1,20,000 package max.

### E. General Surgery: Laparoscopic Cholecystectomy
- **Regional Benchmark (ASI Maharashtra Chapter, 2024)**: Table 6.2. 2,100 surveyed private cases. Range: ₹60,000 to ₹1,30,000, median ₹85,000.
- **National Benchmark (NHSCD / DHR, 2023)**: Table 5. Range: ₹50,000 to ₹1,40,000, typical ₹82,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `S1A11.1`. Statutory package: ₹22,800 reference, ₹28,000 package max.

### F. General Surgery: Laparoscopic Appendectomy
- **Regional Benchmark (Maharashtra Minimal Access Surgery Group, 2024)**: Table 2.8. Range: ₹45,000 to ₹95,000, median ₹65,000.
- **National Benchmark (NHSCD / DHR, 2023)**: Table 7. Range: ₹40,000 to ₹1,05,000, typical ₹62,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `SG005A`. Statutory package: ₹18,000 reference, ₹25,000 package max.

### G. General Surgery: Inguinal Hernia Repair
- **Regional Benchmark (Maharashtra Surgical Forum, 2024)**: Table 3.1. Range: ₹45,000 to ₹1,00,000, median ₹68,000.
- **National Benchmark (NHSCD / DHR, 2023)**: Table 4. Range: ₹40,000 to ₹1,10,000, typical ₹65,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `SG001A`. Statutory package: ₹16,000 reference, ₹24,000 package max.

### H. Ophthalmology: Cataract Surgery (Phaco + Foldable IOL)
- **Regional Benchmark (Maharashtra Ophthalmic Care Association, 2024)**: Table 2.1. Range: ₹25,000 to ₹65,000, median ₹38,000.
- **National Benchmark (AIIMS Ophthalmic Studies & NHSCD, 2023)**: Chapter 4. Range: ₹20,000 to ₹75,000, typical ₹35,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `SO001A`. Statutory package: ₹10,500 reference, ₹14,000 package max.

### I. Obstetrics & Gynecology: Caesarean Section (C-Section)
- **Regional Benchmark (FOGSI West Zone / Maharashtra Chapter, 2024)**: Table 1.5. Range: ₹50,000 to ₹1,10,000, median ₹72,000.
- **National Benchmark (NHSCD / DHR, 2023)**: Table 3. Range: ₹45,000 to ₹1,20,000, typical ₹70,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `OG001A`. Statutory package: ₹15,000 reference, ₹22,000 package max.

### J. Urology: Transurethral Resection of the Prostate (TURP)
- **Regional Benchmark (Maharashtra Urological Society, 2024)**: Table 5.2. Range: ₹55,000 to ₹1,20,000, median ₹78,000.
- **National Benchmark (NHSCD / DHR, 2023)**: Table 9. Range: ₹48,000 to ₹1,25,000, typical ₹72,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `SU080A`. Statutory package: ₹18,000 reference, ₹24,000 package max.

### K. ENT: Tympanoplasty (Type 1 Eardrum Repair)
- **Regional Benchmark (AOI Maharashtra Chapter, 2024)**: Table 3.6. Range: ₹35,000 to ₹85,000, median ₹52,000.
- **National Benchmark (NHSCD / DHR, 2023)**: Table 6. Range: ₹30,000 to ₹90,000, typical ₹48,000.
- **Statutory Government Package (NHA AB-PMJAY HBP 2.2, 2022)**: Code `SE002A`. Statutory package: ₹12,000 reference, ₹18,000 package max.

---

## 4. Cost Fallback Hierarchy (Level A $\to$ Level F)

```
LEVEL A: Hospital-Specific Verified Tariff
   ↓ (if unavailable at specific hospital)
LEVEL B: Maharashtra / Regional Healthcare Benchmark (2024)
   ↓ (if outside Maharashtra or state data unavailable)
LEVEL C: National Healthcare Benchmark (NHSCD / PGIMER / DHR 2023)
   ↓ (if national private benchmark unavailable)
LEVEL D: Statutory Government Package Reference Rate (NHA AB-PMJAY HBP 2.2)
   ↓ (if procedure not benchmarked)
LEVEL F: Refusal to Guess ("Insufficient reliable cost data. SehatSure will not guess.")
```

Every estimate below Level A includes a prominent **Fallback Notice**:
> *"Hospital-specific tariff unavailable. [Level] benchmark used."*

---

## 5. Specialty Match $\neq$ Procedure Match Enforcement

- **Specialty Match**: Facility operates an accredited department in the specialty (e.g., 915 Cardiology facilities in Delhi).
- **Procedure Match**: Facility has verified institutional pricing evidence for the specific procedure.
- If Specialty Matches = 915 and Procedure Matches = 0, the UI renders:
  - `915 Specialty Matches`
  - `0 Procedure Matches`
  - `NO RELIABLE COST BENCHMARK`
  - `🛡️ SehatSure will not substitute another procedure's cost.`

---

## 6. Financial Separation & Uncertainty Handling

The engine guarantees strict independence between:
1. **Estimated Treatment Cost**: Empirical benchmark range.
2. **Potentially Covered Amount**: Calculated deterministically via policy sum insured, room limits, and co-payment clauses.
3. **Estimated Patient Responsibility (OOP)**: $\text{Billed Expense} - \text{Covered Amount}$.

**Uncertainty Handling Rule**:
If policy information is incomplete (e.g., unstated sum insured, unstated non-network co-payment, or unselected room type), the engine **refuses to assume that insurer share equals treatment cost**. Both Potentially Covered and Patient OOP evaluate to:
> **"Unable to reliably estimate"**

along with an itemized `missingInformation` array explaining the exact missing inputs.
