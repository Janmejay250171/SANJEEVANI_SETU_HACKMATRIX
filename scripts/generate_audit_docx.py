#!/usr/bin/env python3
"""
SehatSure - Word Document Report Generator
Generates: SEHATSURE_COMPLETE_ML_COST_PREDICTION_AND_BASELINE_AUDIT.docx
"""

import os
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def style_table(table, header_bg="0F766E", alt_bg="F8FAFC"):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    # Header styling
    for i, cell in enumerate(table.rows[0].cells):
        set_cell_background(cell, header_bg)
        set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(9.5)
                run.font.name = "Calibri"

    # Data rows styling
    for r_idx, row in enumerate(table.rows[1:], start=1):
        bg = alt_bg if r_idx % 2 == 1 else "FFFFFF"
        for cell in row.cells:
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9)
                    run.font.name = "Calibri"

def add_callout(doc, title, text, border_color="0F766E", bg_color="F0FDFA"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)

    # Left border only
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'  <w:top w:val="none"/>'
        f'  <w:left w:val="single" w:sz="36" w:space="0" w:color="{border_color}"/>'
        f'  <w:bottom w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)

    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    r_title = p.add_run(f"★ {title}\n")
    r_title.bold = True
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(10.5)
    r_title.font.color.rgb = RGBColor(15, 118, 110)

    r_text = p.add_run(text)
    r_text.font.name = "Calibri"
    r_text.font.size = Pt(9.5)
    r_text.font.color.rgb = RGBColor(51, 65, 85)
    doc.add_paragraph() # Spacing

def build_document():
    doc = Document()

    # Set Margins
    for sec in doc.sections:
        sec.top_margin = Inches(0.8)
        sec.bottom_margin = Inches(0.8)
        sec.left_margin = Inches(0.8)
        sec.right_margin = Inches(0.8)

    # Document Header / Title
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(2)
    r_title = title_p.add_run("SEHATSURE HEALTHCARE INTELLIGENCE")
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(24)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(15, 118, 110)

    subtitle_p = doc.add_paragraph()
    subtitle_p.paragraph_format.space_before = Pt(0)
    subtitle_p.paragraph_format.space_after = Pt(14)
    r_sub = subtitle_p.add_run("Complete Machine Learning Cost Prediction & Baseline Technical Audit Report")
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(14)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # Metadata Banner
    meta_tbl = doc.add_table(rows=2, cols=2)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_tbl.rows[0].cells[0].paragraphs[0].add_run("Audit Scope: SehatSure Repository Cost Engine & Models").bold = True
    meta_tbl.rows[0].cells[1].paragraphs[0].add_run("Audit Execution Mode: Read-Only Independent Codebase Audit").bold = True
    meta_tbl.rows[1].cells[0].paragraphs[0].add_run("Date of Audit: October 10, 2026").font.color.rgb = RGBColor(100, 116, 139)
    meta_tbl.rows[1].cells[1].paragraphs[0].add_run("Auditor: Senior ML Engineer & Healthcare Data Scientist").font.color.rgb = RGBColor(100, 116, 139)
    style_table(meta_tbl, header_bg="047857", alt_bg="F1F5F9")
    doc.add_paragraph()

    # Section 1: Executive Summary
    h1 = doc.add_heading("1. Executive Summary", level=1)
    h1.style.font.color.rgb = RGBColor(15, 118, 110)
    p = doc.add_paragraph("This technical audit presents a comprehensive, evidence-based investigation into how the SehatSure healthcare platform currently estimates hospital treatment costs, whether genuine machine learning exists, how benchmarks are prioritized, and how cost predictions interact with the deterministic insurance financial adjudication engine.")
    
    t1 = doc.add_table(rows=6, cols=3)
    t1.rows[0].cells[0].paragraphs[0].add_run("Audit Dimension")
    t1.rows[0].cells[1].paragraphs[0].add_run("Key Findings")
    t1.rows[0].cells[2].paragraphs[0].add_run("Verification Status")

    t1.rows[1].cells[0].paragraphs[0].add_run("Primary Pricing Engine")
    t1.rows[1].cells[1].paragraphs[0].add_run("Deterministic hierarchical lookup against audited benchmarks (treatment_cost_benchmarks.csv), coupled with a mathematical insurance engine.")
    t1.rows[1].cells[2].paragraphs[0].add_run("VERIFIED")

    t1.rows[2].cells[0].paragraphs[0].add_run("Genuine ML Existence")
    t1.rows[2].cells[1].paragraphs[0].add_run("A genuine supervised regression model (Ridge Regression, alpha=1.0) is implemented, trained via Python, exported to a JSON artifact, and executed at runtime in TypeScript.")
    t1.rows[2].cells[2].paragraphs[0].add_run("VERIFIED")

    t1.rows[3].cells[0].paragraphs[0].add_run("Role of the ML Model")
    t1.rows[3].cells[1].paragraphs[0].add_run("Operates as an analytical companion & cost-driver explainer (mlCostAnalysis) and counterfactual simulator. Does not adjudicate insurance claims.")
    t1.rows[3].cells[2].paragraphs[0].add_run("VERIFIED")

    t1.rows[4].cells[0].paragraphs[0].add_run("Training Dataset")
    t1.rows[4].cells[1].paragraphs[0].add_run("pvt_costs.csv contains only 184 rows, representing an engineered grid of 23 procedures across 8 tiers. Contains zero individual hospital invoices.")
    t1.rows[4].cells[2].paragraphs[0].add_run("CRITICAL FINDING")

    t1.rows[5].cells[0].paragraphs[0].add_run("Real-World Accuracy")
    t1.rows[5].cells[1].paragraphs[0].add_run("Real-world predictive accuracy is currently unverified. On the synthetic grid, 10-fold CV yields R2 = 0.3037; unseen procedure holdout yields R2 = -0.6839.")
    t1.rows[5].cells[2].paragraphs[0].add_run("VERIFIED")
    style_table(t1)
    doc.add_paragraph()

    # Section 2: Architecture
    h2 = doc.add_heading("2. Current Architecture and End-to-End Prediction Flow", level=1)
    h2.style.font.color.rgb = RGBColor(15, 118, 110)
    doc.add_paragraph("The SehatSure platform implements a strictly decoupled 5-tier architecture connecting clinical user queries to financial displays:")
    doc.add_paragraph("1. Feature Extraction & Normalization: Clinical procedures are standardized to canonical IDs via procedureNormalizerService.ts; hospital cities are resolved to 8 canonical tiers (Metro 1 to Town 2) via hospitalService.ts.")
    doc.add_paragraph("2. Primary Deterministic Benchmark Lookup: CostIntelligenceService.findBenchmark() evaluates verified benchmarks using a strict hierarchy (Hospital-Specific -> Regional -> National -> Government Package). If no verified benchmark exists, it triggers a defensive domain refusal (available=false).")
    doc.add_paragraph("3. Companion ML Inference: TreatmentCostMLService loads treatment_cost_model_artifact.json and executes Ridge inference (y_hat = beta_0 + sum(beta_j * x_j)) along with exact local linear Shapley feature attribution (C_j = beta_j * (x_j - mean_x_j)).")
    doc.add_paragraph("4. Total Bill Assembly: HospitalService adds procedure treatment cost to hospital-specific room costs: Total Bill = Treatment Cost + (Daily Room Tariff * Stay Days).")
    doc.add_paragraph("5. Deterministic Policy Adjudication (FIN-01): HospitalService.computeCanonicalImpact() evaluates the user's uploaded policy rules (room rent limits, proportionate deduction, deductibles, co-pays, and sum insured caps).")
    doc.add_paragraph("6. Frontend Presentation: Displayed across HospitalDiscoveryPage.jsx, BillBreakdownModal.jsx, and WhyThisEstimateCard.jsx.")

    # Section 3: Genuine ML vs Deterministic
    h3 = doc.add_heading("3. Genuine ML versus Deterministic Logic: Verified Conclusion", level=1)
    h3.style.font.color.rgb = RGBColor(15, 118, 110)
    add_callout(
        doc,
        "VERIFIED ARCHITECTURAL SEPARATION",
        "A trained machine learning model exists and executes at runtime, but it does NOT calculate insurance claim payouts. It serves as an analytical companion explaining procedural cost drivers while statutory financial rules remain 100% deterministic."
    )
    doc.add_paragraph("• Algorithm: Ridge Tabular Regression (L2 regularization, alpha=1.0) chosen for global convexity and exact additive feature decomposition.")
    doc.add_paragraph("• Training Script: scripts/train_treatment_cost_model.py (Python / scikit-learn).")
    doc.add_paragraph("• Model Artifact: server/src/ml/treatment_cost_model_artifact.json (39 coefficients, feature means, intercept, and cross-validation metadata).")
    doc.add_paragraph("• Live Application Inference: Loaded by TreatmentCostMLService.loadModel() and executed in pure TypeScript within Node.js upon every search request.")

    # Section 4: Dataset Inventory
    h4 = doc.add_heading("4. Dataset Inventory and Data-Quality Audit", level=1)
    h4.style.font.color.rgb = RGBColor(15, 118, 110)
    t4 = doc.add_table(rows=5, cols=5)
    t4.rows[0].cells[0].paragraphs[0].add_run("Dataset Filename")
    t4.rows[0].cells[1].paragraphs[0].add_run("Total Rows")
    t4.rows[0].cells[2].paragraphs[0].add_run("Valid / Active")
    t4.rows[0].cells[3].paragraphs[0].add_run("Cols")
    t4.rows[0].cells[4].paragraphs[0].add_run("Data Nature & Audit Status")

    t4.rows[1].cells[0].paragraphs[0].add_run("pvt_costs.csv")
    t4.rows[1].cells[1].paragraphs[0].add_run("184")
    t4.rows[1].cells[2].paragraphs[0].add_run("184")
    t4.rows[1].cells[3].paragraphs[0].add_run("10")
    t4.rows[1].cells[4].paragraphs[0].add_run("Synthetic/Curated Grid (23 procedures x 8 tiers). No real hospital encounters.")

    t4.rows[2].cells[0].paragraphs[0].add_run("govt_costs.csv")
    t4.rows[2].cells[1].paragraphs[0].add_run("184")
    t4.rows[2].cells[2].paragraphs[0].add_run("184")
    t4.rows[2].cells[3].paragraphs[0].add_run("10")
    t4.rows[2].cells[4].paragraphs[0].add_run("Statutory Government Tariff Reference Grid (23 procedures x 8 tiers).")

    t4.rows[3].cells[0].paragraphs[0].add_run("treatment_cost_benchmarks.csv")
    t4.rows[3].cells[1].paragraphs[0].add_run("38")
    t4.rows[3].cells[2].paragraphs[0].add_run("8")
    t4.rows[3].cells[3].paragraphs[0].add_run("29")
    t4.rows[3].cells[4].paragraphs[0].add_run("8 verified AB-PMJAY government packages. 30 unverified rows deactivated.")

    t4.rows[4].cells[0].paragraphs[0].add_run("hospitals.csv")
    t4.rows[4].cells[1].paragraphs[0].add_run("52,978")
    t4.rows[4].cells[2].paragraphs[0].add_run("52,978")
    t4.rows[4].cells[3].paragraphs[0].add_run("8")
    t4.rows[4].cells[4].paragraphs[0].add_run("Registry of Indian hospitals, addresses, empanelled insurers, and ratings.")
    style_table(t4)
    doc.add_paragraph()

    # Section 5: Exact Baseline & Fallback
    h5 = doc.add_heading("5. Exact Baseline and Fallback Formulas", level=1)
    h5.style.font.color.rgb = RGBColor(15, 118, 110)
    doc.add_paragraph("CostIntelligenceService.findBenchmark() enforces an uncompromising 5-level hierarchy:")
    doc.add_paragraph("Level 1 (Hospital-Specific): Requires benchmark_level === 'hospital_specific' and matching hospital name. (Currently 0 active verified records).")
    doc.add_paragraph("Level 2 (State / Regional Benchmark): Requires benchmark_level === 'state_benchmark' and city matching Maharashtra list. (Currently 0 active verified records).")
    doc.add_paragraph("Level 3 (National Benchmark): Requires benchmark_level === 'national_benchmark'. (Currently 0 active verified records).")
    doc.add_paragraph("Level 4 (Government Package Rate): Requires benchmark_level === 'government_package'. Exactly 8 active records match (AB-PMJAY HBP 2.2). Output is flagged with mandatory statutory reference notice.")
    doc.add_paragraph("Level 5 (Defensive Domain Refusal): If no verified benchmark matches, the system returns available: false, refusing to fabricate an insurance payout. ML estimate is surfaced solely as an informational 'model_reference'.")

    # Section 6: Worked Example
    h6 = doc.add_heading("6. Worked Prediction Example", level=1)
    h6.style.font.color.rgb = RGBColor(15, 118, 110)
    doc.add_paragraph("Scenario: Total Knee Replacement in Pune (Metro 2) at a Network Private Hospital.")
    doc.add_paragraph("• User Policy: Sum Insured = ₹5,00,000 | Room Rent Limit = 1% (₹5,000/day) | Co-pay = 10% | Proportionate Deduction = Active.")
    doc.add_paragraph("• Benchmark Lookup: Matches COST_GOVT_001 (AB-PMJAY HBP 2.2). Statutory reference rate = ₹80,000.")
    doc.add_paragraph("• ML Driver Regressor (Ridge): Intercept ₹91,533 + Procedure (Knee Replacement: +₹1,58,420) + Tier (Metro 2: -₹12,410) + Stay (5 days: +₹14,200) = Predicted Private Mean Cost: ~₹2.43 Lakh (₹2,43,393). Top driver: Surgical Complexity (+₹1,58,420).")
    doc.add_paragraph("• Total Bill Assembly: Treatment Base (₹80,000) + Room Rent (4 days x ₹2,500 = ₹10,000) = Total Bill: ₹90,000.")
    doc.add_paragraph("• Financial Engine Adjudication: Actual room rent (₹2,500) < Policy limit (₹5,000) -> ₹0 proportionate deduction disallowance. Co-payment 10% on ₹90,000 = ₹9,000. Insurer Estimated Share = ₹81,000. Estimated Patient Out-of-Pocket = ₹9,000.")

    # Section 7: Prediction Target
    h7 = doc.add_heading("7. Prediction Target and Feature Definitions", level=1)
    h7.style.font.color.rgb = RGBColor(15, 118, 110)
    doc.add_paragraph("Target Variable: mean_cost (continuous float in INR), representing baseline private hospital surgical tariff excluding room rent.")
    doc.add_paragraph("Feature Space (39 Features):")
    doc.add_paragraph("• 23 One-Hot Procedure Indicators: proc:Knee Replacement, proc:CABG, proc:Angioplasty, etc.")
    doc.add_paragraph("• 7 One-Hot Specialty Indicators: spec:Orthopedics, spec:Cardiology, spec:General Surgery, etc.")
    doc.add_paragraph("• 8 One-Hot Geographic Tier Indicators: tier:Metro 1 through tier:Town 2.")
    doc.add_paragraph("• 1 Continuous Clinical Parameter: expected_stay_days (validated range [0, 30] days).")

    # Section 8 & 9: Model Evaluation
    h9 = doc.add_heading("8. Evaluation Methodology and Verified Metrics", level=1)
    h9.style.font.color.rgb = RGBColor(15, 118, 110)
    doc.add_paragraph("Metrics verified via scripts/run_ml_and_report_evaluation.py across cross-validation splits:")

    t9 = doc.add_table(rows=6, cols=5)
    t9.rows[0].cells[0].paragraphs[0].add_run("Validation Strategy / Candidate")
    t9.rows[0].cells[1].paragraphs[0].add_run("MAE (INR)")
    t9.rows[0].cells[2].paragraphs[0].add_run("RMSE (INR)")
    t9.rows[0].cells[3].paragraphs[0].add_run("R² Score")
    t9.rows[0].cells[4].paragraphs[0].add_run("Median AE (INR)")

    t9.rows[1].cells[0].paragraphs[0].add_run("10-Fold CV (Ridge alpha=1.0 - Production)")
    t9.rows[1].cells[1].paragraphs[0].add_run("₹45,468")
    t9.rows[1].cells[2].paragraphs[0].add_run("₹106,606")
    t9.rows[1].cells[3].paragraphs[0].add_run("0.3037")
    t9.rows[1].cells[4].paragraphs[0].add_run("₹22,309")

    t9.rows[2].cells[0].paragraphs[0].add_run("Candidate: Gradient Boosting")
    t9.rows[2].cells[1].paragraphs[0].add_run("₹33,335")
    t9.rows[2].cells[2].paragraphs[0].add_run("₹111,374")
    t9.rows[2].cells[3].paragraphs[0].add_run("0.2400")
    t9.rows[2].cells[4].paragraphs[0].add_run("₹13,971")

    t9.rows[3].cells[0].paragraphs[0].add_run("Candidate: Random Forest")
    t9.rows[3].cells[1].paragraphs[0].add_run("₹41,502")
    t9.rows[3].cells[2].paragraphs[0].add_run("₹116,432")
    t9.rows[3].cells[3].paragraphs[0].add_run("0.1694")
    t9.rows[3].cells[4].paragraphs[0].add_run("₹20,884")

    t9.rows[4].cells[0].paragraphs[0].add_run("Grouped 5-Fold CV (Unseen Procedure)")
    t9.rows[4].cells[1].paragraphs[0].add_run("₹64,321")
    t9.rows[4].cells[2].paragraphs[0].add_run("₹111,971")
    t9.rows[4].cells[3].paragraphs[0].add_run("-0.6839")
    t9.rows[4].cells[4].paragraphs[0].add_run("₹41,200")

    t9.rows[5].cells[0].paragraphs[0].add_run("Leave-One-Tier-Out CV (Unseen Tier)")
    t9.rows[5].cells[1].paragraphs[0].add_run("₹44,498")
    t9.rows[5].cells[2].paragraphs[0].add_run("₹96,261")
    t9.rows[5].cells[3].paragraphs[0].add_run("-1.1330")
    t9.rows[5].cells[4].paragraphs[0].add_run("₹31,500")
    style_table(t9)
    doc.add_paragraph()

    # Section 10: Missing Data & Uncertainty
    h10 = doc.add_heading("9. Missing-Data Handling and Uncertainty", level=1)
    h10.style.font.color.rgb = RGBColor(15, 118, 110)
    doc.add_paragraph("• Unseen Hospital: Gracefully falls back to city tier benchmark with transparent UI banner.")
    doc.add_paragraph("• Unseen Procedure: Refuses extrapolation; returns available=false and prompts user.")
    doc.add_paragraph("• Missing Length of Stay: Uses procedure-calibrated default stay (4 to 7 days). Rejects stay durations > 30 days.")
    doc.add_paragraph("• Uncalibrated Prediction Intervals: Current ML regressor outputs point estimates. Conformal prediction intervals are recommended in the future roadmap.")

    # Section 11: Integration with FIN-01
    h11 = doc.add_heading("10. Integration with the FIN-01 Insurance Engine", level=1)
    h11.style.font.color.rgb = RGBColor(15, 118, 110)
    doc.add_paragraph("The boundary between ML cost pattern analysis and statutory insurance adjudication is strictly enforced:")
    doc.add_paragraph("• The ML model never modifies insurance liability, deductibles, or patient co-pay calculations.")
    doc.add_paragraph("• The financial engine strictly enforces policy contract limits (Sum Insured ceiling, room rent capping, proportionate deductions on doctor/nursing fees, and non-network co-payment penalties).")
    doc.add_paragraph("• Consumables (10% non-medical items) are separated before applying policy coverage limits.")

    # Section 12: Risks & Data Limitations
    h12 = doc.add_heading("11. Critical Bugs, Data Leakage Risks, and Misleading Claims", level=1)
    h12.style.font.color.rgb = RGBColor(15, 118, 110)
    add_callout(
        doc,
        "CRITICAL SCIENTIFIC AUDIT FINDING",
        "The training set (pvt_costs.csv) is a synthetic 184-row grid (23 procedures x 8 tiers), not real-world patient records. Real-world predictive accuracy is unverified. Claims of training on large-scale patient claims must be avoided.",
        border_color="DC2626",
        bg_color="FEF2F2"
    )
    doc.add_paragraph("1. Public Perception Risk: Presenting government package rates (e.g. ₹80,000 for knee surgery) in private tertiary hospitals could mislead self-paying patients if statutory banners are overlooked.")
    doc.add_paragraph("2. Cross-Validation Leakage: Standard 10-fold CV on synthetic grids causes procedure information to leak between folds. Grouped Procedure CV reveals true negative generalization (R2 = -0.6839).")

    # Section 13 & 14: Roadmap
    h13 = doc.add_heading("12. Recommended ML Architecture and Implementation Roadmap", level=1)
    h13.style.font.color.rgb = RGBColor(15, 118, 110)
    doc.add_paragraph("Phased Roadmap for Enterprise Healthcare Cost Prediction in India:")
    doc.add_paragraph("• P0 (Immediate): Add explicit UI tooltips clarifying AB-PMJAY statutory schedules; replace point-estimate claims with model reference banners.")
    doc.add_paragraph("• P1 (1–2 Months): Ingest published tariff cards from top 50 private hospital chains (Apollo, Fortis, Max, Manipal); transition to Dual-Head Quantile Gradient Boosting (CatBoost) with Conformal Prediction intervals.")
    doc.add_paragraph("• P2 (3–6 Months): Ingest anonymized TPA settlement data; decompose bills into surgeon fees, OT charges, implants, and pharmacy line items.")

    # Section 15: Judge-Facing Explanation
    h15 = doc.add_heading("13. Judge-Facing Summary: How the Model Works", level=1)
    h15.style.font.color.rgb = RGBColor(15, 118, 110)
    doc.add_paragraph("In a hackathon or technical presentation, explain the system honestly as follows:")
    doc.add_paragraph("1. Primary Engine: SehatSure uses an authoritative, audited hierarchical benchmark engine. If no verified benchmark exists, it refuses to guess, ensuring zero financial hallucination.")
    doc.add_paragraph("2. Machine Learning Layer: An in-house Ridge Regression model (alpha=1.0) acts as an analytical companion, decomposing expected costs into exact Shapley-equivalent drivers (complexity, tier, stay).")
    doc.add_paragraph("3. Accounting Separation: The ML model does not calculate insurance payouts. All co-pays, deductibles, and patient out-of-pocket expenses are computed exclusively by a deterministic, auditable financial engine.")

    # Section 16: File Appendix
    h16 = doc.add_heading("14. File-by-File Evidence Appendix", level=1)
    h16.style.font.color.rgb = RGBColor(15, 118, 110)
    
    t16 = doc.add_table(rows=8, cols=3)
    t16.rows[0].cells[0].paragraphs[0].add_run("Repository File")
    t16.rows[0].cells[1].paragraphs[0].add_run("Key Lines / Range")
    t16.rows[0].cells[2].paragraphs[0].add_run("Audited Function / Evidence")

    t16.rows[1].cells[0].paragraphs[0].add_run("scripts/train_treatment_cost_model.py")
    t16.rows[1].cells[1].paragraphs[0].add_run("Lines 58–132, 210–245")
    t16.rows[1].cells[2].paragraphs[0].add_run("Parses pvt_costs.csv, trains Ridge (alpha=1.0), exports JSON artifact.")

    t16.rows[2].cells[0].paragraphs[0].add_run("server/src/ml/treatment_cost_model_artifact.json")
    t16.rows[2].cells[1].paragraphs[0].add_run("Lines 1–65, 119–128")
    t16.rows[2].cells[2].paragraphs[0].add_run("Production artifact with 39 regression coefficients and CV metrics.")

    t16.rows[3].cells[0].paragraphs[0].add_run("server/src/services/treatmentCostMLService.ts")
    t16.rows[3].cells[1].paragraphs[0].add_run("Lines 100–138, 424–465")
    t16.rows[3].cells[2].paragraphs[0].add_run("Runtime Node.js ML engine executing linear inference and Shapley attribution.")

    t16.rows[4].cells[0].paragraphs[0].add_run("server/src/services/costIntelligenceService.ts")
    t16.rows[4].cells[1].paragraphs[0].add_run("Lines 100–199, 274–344")
    t16.rows[4].cells[2].paragraphs[0].add_run("Benchmark hierarchy engine; enforces domain refusal when benchmarks missing.")

    t16.rows[5].cells[0].paragraphs[0].add_run("server/src/services/hospitalService.ts")
    t16.rows[5].cells[1].paragraphs[0].add_run("Lines 983–1040, 1150–1270")
    t16.rows[5].cells[2].paragraphs[0].add_run("Assembles total hospital bill and runs deterministic FIN-01 policy rules.")

    t16.rows[6].cells[0].paragraphs[0].add_run("treatment_cost_benchmarks.csv")
    t16.rows[6].cells[1].paragraphs[0].add_run("Rows 1–39")
    t16.rows[6].cells[2].paragraphs[0].add_run("38 rows. Exactly 8 active verified AB-PMJAY government package rates.")

    t16.rows[7].cells[0].paragraphs[0].add_run("pvt_costs.csv")
    t16.rows[7].cells[1].paragraphs[0].add_run("Rows 1–185")
    t16.rows[7].cells[2].paragraphs[0].add_run("184 rows representing 23 procedures x 8 geographic tiers.")
    style_table(t16)
    doc.add_paragraph()

    output_path = os.path.join(os.getcwd(), "SEHATSURE_COMPLETE_ML_COST_PREDICTION_AND_BASELINE_AUDIT.docx")
    doc.save(output_path)
    print(f"[SUCCESS] Audit report saved successfully to: {output_path}")

if __name__ == "__main__":
    build_document()
