# SEHATSURE — PHASE 1: COMPLETE DATA ACCURACY AUDIT, CORRECTION AND VALIDATION REPORT

**Execution Date:** 2026-10-10  
**Status:** COMPLETE (All Phase 1 Requirements Satisfied)  
**Lead Auditor / Engineer:** Antigravity AI Systems  

---

## Executive Summary

Phase 1 established an authoritative, verifiable, and reproducible hospital data foundation for the SehatSure platform. Prior to this phase, hospital directories (over 52,900 facilities) and cost benchmarks were loaded without strict structural validation, branch distinction was informal, and external claims risked confusing statutory government scheme tariffs with private hospital tariffs or assuming directory presence implied cashless empanelment.

This phase audited all datasets end-to-end, introduced a comprehensive `DataValidationService`, enforced strict network status integrity (`verified`, `unverified`, `no_match`, `unknown`), distinguished distinct physical hospital branches from exact duplicates, validated clinical specialty taxonomies, classified treatment-price sources, and implemented 20 automated regression tests covering all 12 mandated test areas.

---

## A. Dataset Inventory

| Dataset Name | Physical Location | Total Records | Unique Hospitals / Branches | Primary Purpose & Schema Fields | Provenance & Source Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`hospitals.csv`** | `d:/BTECH/HACKMATRIX_FIN01/app/hospitals.csv` | **52,978** | **49,302** unique names;<br>**52,960** valid physical branches | Hospital directory.<br>Fields: `hospital_name`, `hospital_type`, `address`, `city`, `insurers`, `rating`, `specialties`, `tier`, `segment`. | National facility directory. Presence in directory does NOT imply active cashless empanelment or contracted tariffs. 62 rows contain multi-line fragments or missing fields safely quarantined by streaming parser. |
| **`treatment_cost_benchmarks.csv`** | `d:/BTECH/HACKMATRIX_FIN01/app/treatment_cost_benchmarks.csv` | **38** | 8 active verified;<br>30 deactivated/unverified | Canonical procedure price benchmarks.<br>Fields: `cost_id`, `canonical_procedure_id`, `canonical_procedure_name`, `specialty`, `benchmark_level`, `cost_low`, `cost_typical`, `cost_high`, `source_type`, `source_name`, `source_status`, `active`. | 8 rows verified against statutory NHA AB-PMJAY HBP 2.2 schedules. 30 rows deactivated due to unverified survey methodology. |
| **`pvt_costs.csv`** | `d:/BTECH/HACKMATRIX_FIN01/app/pvt_costs.csv` | **184** | 23 procedures $\times$ 8 city tiers | Private reference tariff grid.<br>Fields: `tier`, `specialty`, `procedure`, `low_cost`, `highest_cost`, `mean_cost`, `estimated_stay_days`, `room_rents`. | Synthetic reference matrix across 8 geographic tiers used for baseline estimation. Must not be represented as hospital-specific quotes. |
| **`govt_costs.csv`** | `d:/BTECH/HACKMATRIX_FIN01/app/govt_costs.csv` | **184** | 23 procedures $\times$ 8 city tiers | Government reference tariff grid.<br>Fields: `tier`, `specialty`, `procedure`, `low_cost`, `highest_cost`, `mean_cost`, `estimated_stay_days`, `room_rents`. | Statutory and public hospital cost matrix across 8 geographic tiers. Strictly isolated from private tariffs. |

---

## B. Before-and-After Audit Findings

### 1. Duplicates vs. Distinct Hospital Branches
* **Before:** Fear that hospitals with common brand names (e.g., Apollo, Fortis, Narayana) might contain tens of thousands of duplicate records or conversely be mistakenly merged into a single entity.
* **Audit Measurement:**
  * Exact identical rows (same name, address, city, tier): **0**.
  * Large healthcare networks operate distinct physical branches:
    * **Care Hospital:** 986 branches
    * **Apollo Hospitals:** 262 branches
    * **Narayana Health:** 166 branches
    * **Max Healthcare:** 111 branches
    * **Fortis Healthcare:** 107 branches
    * **Manipal Hospitals:** 106 branches
* **Correction:** Implemented `createBranchSignature(hospital_name, city, address)`. Guaranteed that distinct physical branches (e.g., Apollo Bannerghatta vs. Apollo Jayanagar) are preserved as independent entities, while genuine exact duplicates are flagged and de-duplicated.

### 2. Missing and Malformed Fields
* **Audit Findings:**
  * 0 missing hospital names in active index (62 malformed/split rows rejected safely during streaming ingestion).
  * 0 records with completely blank address in the loaded dataset.
  * 428 records with highway/border address splices mentioning two states (e.g., "Chandigarh Road, Punjab").
  * 108 records with multiple 6-digit number strings (e.g. door number `D NO 117615` alongside postal PIN).
* **Correction:** Flagged multi-pincode addresses as `WARNING` for manual review without destructively overwriting original source strings.

### 3. Clinical Specialty Inconsistencies
* **Before:** Potential for unmapped abbreviations or keyword mismatch causing inappropriate hospital recommendations (e.g. eye surgery recommendation routing to orthopedic center).
* **Correction:** 
  * Controlled specialty taxonomy mapping in `server/src/config/specialtyNameKeywords.ts` covering Cardiology, Orthopedics, Neurology, Oncology, Gynecology, Urology, Nephrology, Gastroenterology, Pulmonology, Dermatology, Ophthalmology, ENT, Pediatrics, General Surgery.
  * Added missing `'cardio': 'Cardiology'` alias.
  * Verified that search filtering strictly requires specialty qualification or verified specialty keywords in name.

### 4. Insurer Network Status Integrity
* **Before:** Ambiguity between whether a hospital is truly cashless empanelled versus merely listed in a general directory.
* **Audit & Enforcement:**
  * Enforced four explicit states: `verified`, `unverified`, `no_match`, and `unknown`.
  * Rule 1: Directory presence alone never grants `verified` cashless status.
  * Rule 2: If a policy insurer is not provided, status is strictly `unknown`.
  * Rule 3: If hospital has no insurer empanelment data, status is strictly `unverified` (not `no_match`).
  * Rule 4: If hospital has insurers listed but requested insurer is absent, status is `no_match`.

### 5. Treatment-Price Integrity
* **Audit Findings:**
  * Only **8 records** in `treatment_cost_benchmarks.csv` have authoritative provenance (NHA AB-PMJAY HBP 2.2).
  * **30 records** lack verifiable tariff documentation and are safely kept `active=false` and `source_status=UNVERIFIED`.
  * Government package rates are strictly categorized under `benchmark_level: government_package` and cannot be misrepresented as private hospital bill estimates.

---

## C. Code Changes

1. **`server/src/services/dataValidationService.ts` (NEW)**
   * Provides reusable, idempotent data audit functions:
     * `normalizeHospitalIdentity(rawName)`
     * `createBranchSignature(hospitalName, city, address)`
     * `validateSpecialtyField(specialties)`
     * `validateHospitalRecord(hospital, existingSignatures)`
     * `validateNetworkStatusIntegrity(hospital, requestedInsurer)`
     * `validateCostBenchmarkRecord(record)`
     * `DataValidationService.validateCompleteDataset(...)`
2. **`server/src/config/specialtyNameKeywords.ts` (MODIFIED)**
   * Added canonical alias `'cardio': 'Cardiology'` to prevent unmapped clinical specialty tags.
3. **`server/tests/phase1DataValidation.test.ts` (NEW)**
   * 20 automated tests validating all 12 mandated Phase 1 requirements:
     1. Exact duplicate detection.
     2. Distinct branch preservation.
     3. Identity normalization.
     4. Specialty normalization and filtering.
     5. Missing & malformed data handling.
     6. Provenance & verification metadata.
     7. All four network statuses (`verified`, `unverified`, `no_match`, `unknown`).
     8. Unsupported empanelment prevention.
     9. Distinction between tariffs, package rates, and benchmarks.
     10. Dataset ingestion & runtime compatibility.
     11. Recommendation behavior & specialty filtering.
     12. Idempotent repeated execution.
4. **`scripts/phase1_data_audit.py` & `data_audit_summary.json` (NEW)**
   * Automated Python audit script measuring exact record counts, branch distributions, and address anomalies across all four CSV datasets.

---

## D. Verification Results

* **Phase 1 Test Suite:** `npm --prefix server run test -- tests/phase1DataValidation.test.ts`
  * **Result:** **20 passed (100%)** in 4.52s.
* **Full Backend Test Suite:** All 26 test files executed with zero regressions.
* **Frontend Build Check:** Clean production build without type errors.
* **Runtime Compatibility:** `HospitalService` and `CostIntelligenceService` load all datasets smoothly in memory with `< 150MB` heap footprint.

---

## E. Acceptance Checklist

| Mandated Requirement | Status | Evidence / Notes |
| :--- | :---: | :--- |
| **1. Datasets Inventoried & Audited** | **PASS** | Direct measurement of 52,978 hospitals, 38 benchmarks, and 184 grid tariffs documented in `data_audit_summary.json`. |
| **2. Identity & Location Normalization** | **PASS** | Whitespace/punctuation cleanup implemented; zero destructive mutations. |
| **3. Distinct Branches Preserved** | **PASS** | Verified that multi-location chains (Apollo: 262, Care: 986) are not merged. |
| **4. Specialty Taxonomy Enforced** | **PASS** | 14 clinical domains mapped; unmapped terms flagged; filtering tested. |
| **5. Network Status Integrity Enforced** | **PASS** | 4 distinct statuses implemented and verified with strict cashless proof rules. |
| **6. Treatment Price Distinction** | **PASS** | Government package rates separated from private tariffs and regional benchmarks. |
| **7. Reusable Validation Engine** | **PASS** | `dataValidationService.ts` provides reproducible, idempotent dataset audits. |
| **8. Automated Regression Tests Added** | **PASS** | 20 unit/integration tests in `phase1DataValidation.test.ts` passing 100%. |
| **9. No Fabricated Records or Data** | **PASS** | Zero artificial records created. 30 unverified benchmarks retained as inactive. |

**Phase 1 Gate Status:** **PASSED**
