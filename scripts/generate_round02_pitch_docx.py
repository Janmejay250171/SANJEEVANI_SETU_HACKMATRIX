#!/usr/bin/env python3
"""
Generates: SEHATSURE_ROUND_02_PITCH_AND_EVALUATION_STRATEGY.docx
"""

import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
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
    for cell in table.rows[0].cells:
        set_cell_background(cell, header_bg)
        set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(9.5)
                run.font.name = "Calibri"

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
    set_cell_margins(cell, top=130, bottom=130, left=180, right=180)

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
    p.paragraph_format.space_after = Pt(2)
    r_title = p.add_run(f"★ {title}\n")
    r_title.bold = True
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(10.5)
    r_title.font.color.rgb = RGBColor(15, 118, 110)

    r_text = p.add_run(text)
    r_text.font.name = "Calibri"
    r_text.font.size = Pt(9.5)
    r_text.font.color.rgb = RGBColor(51, 65, 85)
    doc.add_paragraph()

def build_pitch_document():
    doc = Document()

    for sec in doc.sections:
        sec.top_margin = Inches(0.8)
        sec.bottom_margin = Inches(0.8)
        sec.left_margin = Inches(0.8)
        sec.right_margin = Inches(0.8)

    # Document Header
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run("SEHATSURE — ROUND 02 PRESENTATION PLAYBOOK")
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(22)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(15, 118, 110)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(14)
    r_sub = p_sub.add_run("Hackathon Evaluation Strategy: Impactful Implemented Strengths & High-Value Roadmap")
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(13)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # Criteria Mapping Table
    t_map = doc.add_table(rows=6, cols=3)
    t_map.rows[0].cells[0].paragraphs[0].add_run("Evaluation Criterion")
    t_map.rows[0].cells[1].paragraphs[0].add_run("Core Implemented Proof Point")
    t_map.rows[0].cells[2].paragraphs[0].add_run("High-Impact Future Extension")

    t_map.rows[1].cells[0].paragraphs[0].add_run("1. Innovativeness")
    t_map.rows[1].cells[1].paragraphs[0].add_run("FIN-01 Bill-Shock Prevention + Anti-Hallucination Refusal Engine")
    t_map.rows[1].cells[2].paragraphs[0].add_run("Direct TPA Pre-Auth API Integration + Crowdsourced Bill Audits")

    t_map.rows[2].cells[0].paragraphs[0].add_run("2. Tech Stack")
    t_map.rows[2].cells[1].paragraphs[0].add_run("Zero-dependency <2ms TypeScript ML inference + Web Speech API + Gemini RAG")
    t_map.rows[2].cells[2].paragraphs[0].add_run("Edge ML on WASM (100% offline mobile) + ABDM/ABHA integration")

    t_map.rows[3].cells[0].paragraphs[0].add_run("3. Presentation")
    t_map.rows[3].cells[1].paragraphs[0].add_run("Problem-first storytelling, live Hindi voice demo, and honest CV metric disclosure")
    t_map.rows[3].cells[2].paragraphs[0].add_run("Interactive patient cost-risk scorecard & claim simulation")

    t_map.rows[4].cells[0].paragraphs[0].add_run("4. UI/UX")
    t_map.rows[4].cells[1].paragraphs[0].add_run("Unified Voice & Text Drawer + 'Why This Estimate' provenance card")
    t_map.rows[4].cells[2].paragraphs[0].add_run("1-Click WhatsApp voice assistant + AR Emergency Hospital Route Finder")

    t_map.rows[5].cells[0].paragraphs[0].add_run("5. AI & ML Integration")
    t_map.rows[5].cells[1].paragraphs[0].add_run("Supervised Ridge Regressor with exact Shapley attributions + Gemini RAG")
    t_map.rows[5].cells[2].paragraphs[0].add_run("Dual-Head Quantile Gradient Boosting (CatBoost) + Conformal Prediction")
    style_table(t_map, header_bg="0F766E", alt_bg="F8FAFC")
    doc.add_paragraph()

    # Section 1: Innovativeness
    h1 = doc.add_heading("Criterion 1: Innovativeness (Creativity & Originality)", level=1)
    h1.style.font.color.rgb = RGBColor(15, 118, 110)
    
    doc.add_heading("What We Have Implemented (Tell the Judges):", level=2)
    doc.add_paragraph("1. Solving 'Medical Bill Shock' at the Root: 70% of Indian patients face devastating out-of-pocket hospital bills not because they lack insurance, but because of obscure policy clauses like Proportionate Deduction, room rent ceilings, and non-network penalties. SehatSure is the first platform that dynamically combines hospital treatment pricing with statutory policy contract law to predict exact out-of-pocket costs before admission.")
    doc.add_paragraph("2. Anti-Hallucination Refusal Standard: Unlike generic AI healthcare apps that invent arbitrary hospital quotes, SehatSure implements an evidence-backed refusal principle: if no verified benchmark exists for a procedure (e.g. Angiography), the platform strictly refuses to fabricate an insurance payout, displays a clear warning, and provides an informational ML reference.")
    doc.add_paragraph("3. Vernacular Clinical Normalization: Converts everyday slang ('घुटने का ऑपरेशन', 'मोतियाबिंद का लेंस') into canonical clinical standards (Total Knee Replacement, Phacoemulsification) and maps them to AB-PMJAY and CGHS tariff codes.")

    doc.add_heading("Future Implementation Points (Roadmap to Propose):", level=2)
    doc.add_paragraph("• Real-Time Pre-Authorization Estimator: Direct API connectivity with TPAs (Medi Assist, Paramount, Vidal) to pre-clear cashless claim approval within 15 minutes of hospital selection.")
    doc.add_paragraph("• Crowdsourced Patient Bill Auditing: A secure portal where discharged patients upload anonymized final hospital bills. An automated audit engine identifies overbilling discrepancies and enriches our hospital tariff database.")

    # Section 2: Tech Stack
    h2 = doc.add_heading("Criterion 2: Tech Stack (Modern Tools & Engineering)", level=1)
    h2.style.font.color.rgb = RGBColor(15, 118, 110)

    doc.add_heading("What We Have Implemented (Tell the Judges):", level=2)
    doc.add_paragraph("1. Zero-Dependency Sub-Millisecond ML Runtime: Trained offline using Python (scikit-learn Ridge Regression), the model artifact is exported to a pure JSON schema. In production, Node.js executes the matrix dot product and exact linear Shapley decomposition in TypeScript with < 2ms latency, avoiding heavy Python server bottlenecks.")
    doc.add_paragraph("2. Full-Duplex Multilingual Voice AI: Integrated Web Speech Recognition API with real-time language switching (Hindi, Marathi, English) and browser SpeechSynthesis (TTS) paired with Google Gemini Generative AI.")
    doc.add_paragraph("3. Resilient Full-Stack Architecture: Modern React (Vite), Express, TypeScript, and MongoDB. Includes auto-restoration fallbacks so transient policy IDs and demo sessions never encounter 404 errors across server restarts.")

    doc.add_heading("Future Implementation Points (Roadmap to Propose):", level=2)
    doc.add_paragraph("• Edge ML on WebAssembly (WASM): Compiling clinical normalizers and regression models to WebAssembly, enabling 100% offline cost prediction on low-end smartphones in rural areas without internet connectivity.")
    doc.add_paragraph("• FHIR / ABDM (Ayushman Bharat Digital Mission) Protocol: Integrating ABHA IDs to automatically retrieve personal policy schedules and health records directly from government-verified digital health lockers.")

    # Section 3: Presentation
    h3 = doc.add_heading("Criterion 3: Presentation (Clarity, Organization & Delivery)", level=1)
    h3.style.font.color.rgb = RGBColor(15, 118, 110)

    add_callout(
        doc,
        "THE 3-MINUTE JUDGE DEMO FLOW",
        "Step 1: The Problem — Upload a 40-page HDFC ERGO policy. Show how a 1% room rent limit triggers proportionate disallowance.\n"
        "Step 2: The Transparency — Navigate to Hospital Discovery. Open the 'Why This Estimate' card and show exact source citations and top cost drivers.\n"
        "Step 3: The Voice Experience — Click 'Ask SehatSure', speak in Hindi: 'मेरी आंख में मोतियाबिंद है, कितना खर्च आएगा?' and let judges hear the spoken answer."
    )
    doc.add_paragraph("• The 'Honest AI' Pitch: Stand out from competitors by disclosing true metrics: 10-fold CV MAE of ₹45,468 and explaining why unseen procedures have negative R2, proving that SehatSure protects patients through deterministic financial guardrails rather than blind AI guessing.")

    # Section 4: UI/UX
    h4 = doc.add_heading("Criterion 4: UI/UX (User Experience & Seamless Design)", level=1)
    h4.style.font.color.rgb = RGBColor(15, 118, 110)

    doc.add_heading("What We Have Implemented (Tell the Judges):", level=2)
    doc.add_paragraph("1. Unified Voice & Text Assistant Drawer: Persistent floating trigger (Sparkles + Mic) allowing seamless toggling between typing and speaking naturally without UI clashing.")
    doc.add_paragraph("2. 'Why This Estimate?' Transparency Cards: Eradicates black-box opacity. Users can inspect exact document provenance (e.g. AB-PMJAY HBP 2.2), confidence badges, and top ML cost drivers (+₹1.58L procedure complexity, -₹12k city tier discount).")
    doc.add_paragraph("3. Interactive Itemized Bill Breakdown: Clear visual hierarchy separating room charges, doctor fees, consumables, deductibles, and co-payments with visual alerts when policy boundaries are exceeded.")

    doc.add_heading("Future Implementation Points (Roadmap to Propose):", level=2)
    doc.add_paragraph("• 1-Click WhatsApp Voice Bot: Extending SehatSure to WhatsApp for rural and elderly patients: send a photo of a doctor's prescription or policy schedule to receive spoken audio notes in their native language.")
    doc.add_paragraph("• AR Hospital Emergency Navigator: In-transit emergency routing guiding ambulances directly to empanelled cashless emergency wards.")

    # Section 5: AI & ML Integration
    h5 = doc.add_heading("Criterion 5: AI & ML Integration (Quality & Depth)", level=1)
    h5.style.font.color.rgb = RGBColor(15, 118, 110)

    doc.add_heading("What We Have Implemented (Tell the Judges):", level=2)
    doc.add_paragraph("1. Supervised Ridge Tabular Regressor: Trained on verified Indian healthcare tariffs across 39 features (23 procedures, 7 specialties, 8 tiers, stay duration). Calculates exact local Shapley feature attributions (C_j = beta_j * (x_j - mean_x_j)), explaining cost variations mathematically.")
    doc.add_paragraph("2. Grounded RAG with Google Gemini: Unlike standard chatbots, our voice assistant's prompt is dynamically injected with the user's specific policy terms, room rent caps, and top 3 specialized hospital matches from our database.")
    doc.add_paragraph("3. Separation of Powers Architecture: ML advises on expected clinical cost patterns; the deterministic accounting engine computes statutory rupee settlements. This guarantees zero financial hallucination.")

    doc.add_heading("Future Implementation Points (Roadmap to Propose):", level=2)
    doc.add_paragraph("• Dual-Head Quantile Gradient Boosting (CatBoost/LightGBM): Predicting 10th percentile (P10), median (P50), and 90th percentile (P90) bill ranges to capture medical complication variances.")
    doc.add_paragraph("• Conformal Prediction with 90% Guarantee: Mathematically guaranteed prediction intervals ensuring 90% of actual patient bills fall within bounds.")
    doc.add_paragraph("• LayoutLM / Vision Transformer (ViT) Document Parser: Ingesting crumpled physical policy schedules and hospital estimate letters via camera upload.")

    # Section 6: Tough Judge Q&A Cheatsheet
    h6 = doc.add_heading("Tough Judge Q&A Cheatsheet", level=1)
    h6.style.font.color.rgb = RGBColor(15, 118, 110)

    doc.add_paragraph("Q1: 'Is your cost estimator just a lookup table or real ML?'")
    doc.add_paragraph("Answer: 'It is a hybrid architecture by design. For statutory reference baselines, we use audited benchmarks (AB-PMJAY HBP 2.2). Simultaneously, we run a trained Ridge Regressor across 39 features in TypeScript to calculate exact Shapley feature attributions. We intentionally separate statistical pattern estimation from deterministic insurance accounting to protect patient money.'")

    doc.add_paragraph("Q2: 'Why not use an LLM like GPT-4 or Gemini to calculate the hospital bill directly?'")
    doc.add_paragraph("Answer: 'Because LLMs are probabilistic text predictors and suffer from mathematical hallucination. A 1% error in room rent calculation can cost a patient ₹50,000 under proportionate deduction clauses. We use Gemini exclusively for multilingual conversation and use deterministic financial logic for the billing math.'")

    doc.add_paragraph("Q3: 'How do you handle hospitals where you have no private pricing data?'")
    doc.add_paragraph("Answer: 'We enforce an evidence-driven refusal principle. We fall back to verified city-tier benchmarks with a clear transparency notice. If no benchmark exists, we refuse to guess, protecting patients from false financial security.'")

    output_path = os.path.join(os.getcwd(), "SEHATSURE_ROUND_02_PITCH_AND_EVALUATION_STRATEGY.docx")
    doc.save(output_path)
    print(f"[SUCCESS] Round 02 Pitch Document saved to: {output_path}")

if __name__ == "__main__":
    build_pitch_document()
