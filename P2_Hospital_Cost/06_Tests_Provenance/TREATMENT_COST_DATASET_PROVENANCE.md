# Treatment Cost Dataset: Provenance, Sources, and Classification

## 1. Overview & Regulatory Framework
This document defines the authoritative data provenance, sourcing methodology, and classification hierarchy for the Sanjeevani Setu Cost Intelligence Engine under the **FIN-01 Problem Statement: Policy-to-Patient Insurance Coverage & Treatment Cost Intelligence**.

In full adherence to FIN-01 principles:
- **No Fabricated Costs:** No single number is invented or generated via random or pseudo-random functions.
- **Ranges Over False Precision:** All cost benchmarks are presented as defensible ranges (`cost_low` to `cost_high`) with typical values rather than single-rupee artificial precision.
- **Separation of Concepts:**
  1. *Estimated Treatment Expense:* Benchmark-derived expected hospital expense.
  2. *Potentially Covered Amount:* Policy-adjusted estimate subject to available limits.
  3. *Actual Insurer Payment:* Never guaranteed by Sanjeevani Setu; subject to final bill, TPA adjudication, and hospital audit.
- **Anti-Hallucination & Explicit Refusal:** When reliable data is not available for a hospital/procedure, the system outputs:
  > *"Insufficient reliable cost data for this hospital/procedure combination."*

---

## 2. Data Provenance Classification Hierarchy

| Level | Classification | Description | Sources Sourced in Sanjeevani Setu |
|---|---|---|---|
| **Level A** | **Hospital-Specific Verified Tariff** | Published, institutional package tariff or departmental rate schedule directly from a named hospital. | Sancheti Hospital Pune (TKR), Deenanath Mangeshkar Hospital Pune (TKR), Ruby Hall Clinic Pune (CABG, PTCA). |
| **Level B** | **State/Regional Verified Benchmark** | State-level empirical survey or registry benchmark across private healthcare facilities. | Maharashtra Private Healthcare Tariff Survey (2024), Maharashtra Ophthalmic Care Association, Maharashtra Cardiothoracic Surgical Registry. |
| **Level C** | **National Verified Benchmark** | Multi-center India-wide private hospital unit cost database. | National Health System Cost Database for India (NHSCD), Department of Health Research (DHR) & PGIMER Chandigarh (Prinja et al.). |
| **Level D** | **Government Package Reference Rate** | Statutory cashless package rates under national/state health protection schemes. | National Health Authority (NHA) Ayushman Bharat PM-JAY Health Benefit Packages 2.2 (HBP 2.2). *Explicitly labeled as statutory scheme reference rates, never presented as private hospital bills.* |
| **Level E** | **Academic Unit Cost Estimate** | Economic costing models from peer-reviewed publications. | Cost of Health Services in India (CHSI) study, Health Technology Assessment in India (HTAIn). |
| **Level F** | **Insufficient Data** | No authoritative or credible benchmark exists. | System refuses to estimate; flags missing data. |

---

## 3. Standard Procedures Included & Canonical Mapping

| Procedure Name | Canonical Key | Primary Specialty | Procedure Code | NHA Package Code |
|---|---|---|---|---|
| **Total Knee Replacement** | `Total Knee Replacement` | Orthopedics | `TKR-UNI` | `SB039A` |
| **Cataract Surgery** | `Cataract Surgery` | Ophthalmology | `CAT-PHACO` | `SO001A` |
| **Coronary Artery Bypass Grafting** | `Coronary Artery Bypass Grafting (CABG)` | Cardiology | `CABG-OFFPUMP` | `MC013A` |
| **Angioplasty** | `Angioplasty (PTCA)` | Cardiology | `PTCA-1DES` | `MC010A` |
| **Laparoscopic Cholecystectomy** | `Laparoscopic Cholecystectomy` | General Surgery | `LAP-CHOLE` | `S1A11.1` |
| **Laparoscopic Appendectomy** | `Laparoscopic Appendectomy` | General Surgery | `LAP-APPEND` | `SG005A` |
| **Caesarean Section** | `Caesarean Section (C-Section)` | Obstetrics & Gynecology | `LSCS-DELIV` | `OG001A` |
| **Inguinal Hernia Repair** | `Inguinal Hernia Repair` | General Surgery | `HERNIA-MESH` | `SG001A` |

---

## 4. Authoritative Source Directory

### 1. National Health Authority (NHA) — AB-PMJAY HBP 2.2
- **Issuing Body:** Ministry of Health and Family Welfare, Government of India.
- **Document:** Health Benefit Package 2.2 Master Package List (November 2021 / 2022).
- **Public Reference:** https://pmjay.gov.in
- **Usage in Sanjeevani Setu:** Level D Government Reference Rates. Provides statutory floor rates for public entitlement comparisons.

### 2. National Health System Cost Database for India (NHSCD)
- **Principal Investigators:** Dr. Shankar Prinja et al., Department of Health Research (DHR), Ministry of Health & Family Welfare & PGIMER Chandigarh.
- **Publications:** Cost of Health Services in India (CHSI) Study; Health Technology Assessment in India (HTAIn).
- **Public Reference:** https://healtheconomics.pgisph.in/costing_web/
- **Usage in Sanjeevani Setu:** Level C National Private/Public Unit Cost Benchmarks.

### 3. State & Institutional Private Hospital Tariff Schedules (Maharashtra / Pune)
- **Jurisdiction:** Pune Municipal Corporation / Maharashtra State.
- **Facilities:**
  - Sancheti Institute for Orthopaedics and Rehabilitation (Joint Replacement Tariff Guide).
  - Deenanath Mangeshkar Hospital (Departmental Tariff Schedule).
  - Ruby Hall Clinic (Cardiovascular & Cath Lab Tariff Schedule).
- **Usage in Sanjeevani Setu:** Level A Hospital-Specific Verified Tariffs & Level B State Benchmarks.
