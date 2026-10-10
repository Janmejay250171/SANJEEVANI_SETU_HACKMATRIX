import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from defense_doc_builder.styles import (
    add_cover_page, add_heading_1, add_heading_2, add_heading_3,
    add_paragraph, add_bullet, add_callout, add_qa_card, format_table,
    COLOR_PRIMARY, COLOR_SECONDARY, COLOR_DANGER, COLOR_SUCCESS, COLOR_WARNING
)

def build_part1(doc: Document):
    print("   -> Building Cover Page, How to Use, Architecture, Inventory, FIN-01, Sections A, B, C...")

    # =========================================================================
    # 1. COVER PAGE
    # =========================================================================
    meta_rows = [
        ("Platform Name", "SehatSure (Hospitality Precision Care Decision Engine)"),
        ("Hackathon Challenge", "National AI/ML Healthcare Hackathon 2026 (FIN-01)"),
        ("Problem Statement", "FIN-01: Financial Precision in Healthcare Admission & Insurance Discovery"),
        ("Target Evaluation", "Final Round Technical Defense, Code Viva & Live Architecture Defense"),
        ("Primary Technology Stack", "React 18, Vite, Vanilla CSS, Node.js 20, Express 4, TypeScript 5, MongoDB, Gemini 3.1 Flash-Lite, Zod, Vitest"),
        ("Dataset Footprint", "52,960 Valid Empanelled Hospitals across 21,383 Cities; 8 Geographic Benchmark Tiers"),
        ("AI / LLM Architecture", "Google Gemini 3.1 Flash-Lite (Deterministic JSON Schema Extraction & AI Explanations)"),
        ("Mathematical Engine", "100% Deterministic Rule Engine (Proportionate Deductions, Deductibles, Co-pays, Sublimits)"),
        ("Document Classification", "CONFIDENTIAL — Technical Viva & Defense Question Bank (Source-of-Truth Verified)"),
        ("Build Timestamp", "October 2026 | Repository Revision: Final Production Defense Release")
    ]
    add_cover_page(
        doc,
        title="SEHATSURE — COMPLETE TECHNICAL DEFENSE QUESTION BANK",
        subtitle="Exhaustive 24-Hour Hackathon Defense Manual, Code Viva Playbook, Formula Sheets & Attack Protection",
        meta_rows=meta_rows
    )

    # =========================================================================
    # 2. HOW TO USE THIS QUESTION BANK
    # =========================================================================
    add_heading_1(doc, "1. How to Use This Technical Defense Question Bank")
    add_paragraph(
        doc,
        "This masterbook is an exhaustive, repository-audited technical defense manual designed to prepare our team for the final judging round of the AI/ML Healthcare Hackathon 2026. Every question, answer, formula, and code reference in this document has been cross-referenced against the actual SehatSure codebase, configuration files, and datasets. Nothing has been fabricated or assumed."
    )

    add_callout(
        doc,
        "The fundamental rule of hackathon technical defense is: THE CODE IS THE ULTIMATE TRUTH. Judges may inspect code on GitHub, challenge mathematical operations in real time, or test edge cases live on screen. Whenever an architectural limitation exists or a dataset has an unverified state, state it with technical clarity and explain the design trade-off rather than guessing or bluffing.",
        title="CORE DEFENSE PRINCIPLE",
        alert_type="warning"
    )

    add_heading_2(doc, "1.1 Anatomy of a Question Card")
    add_paragraph(
        doc,
        "Every question throughout this manual is formatted into four strict components to ensure rapid memorization and rigorous defense:"
    )
    add_bullet(doc, "Question", "The exact attack, probe, or challenge a technical judge, clinical auditor, or insurance specialist is likely to ask.")
    add_bullet(doc, "Ideal Answer", "The definitive, technically rigorous answer. It incorporates exact terminology, algorithmic complexity, architectural reasoning, and domain definitions.")
    add_bullet(doc, "Evidence in Code/Files", "The exact file path, function name, interface, or configuration variable that proves our answer is backed by working implementation.")
    add_bullet(doc, "Potential Follow-up", "The tough secondary probe a judge will launch if they suspect our initial answer was memorized or superficial.")

    add_heading_2(doc, "1.2 Visual Status & Risk Badges")
    add_paragraph(
        doc,
        "This manual utilizes four standardized visual tags to indicate the defense safety of each feature and claim:"
    )
    add_bullet(doc, "🟢 VERIFIED / SAFE", "The capability is 100% implemented, covered by automated Vitest regression suites, and mathematically proven in code. Safe to pitch assertively.")
    add_bullet(doc, "🟡 UNCERTAIN / QUALIFY", "The capability functions but relies on specific operational assumptions (e.g., local benchmark pricing rather than live hospital billing APIs). Always qualify with exact operational boundaries.")
    add_bullet(doc, "🔴 HIGH RISK / FIX", "A potential trap where careless wording or presentation could mislead judges (e.g., presenting an unverified hospital as empanelled). Never make unhedged claims here.")
    add_bullet(doc, "🚨 CRITICAL P0", "A critical system behavior or edge case that must be understood in detail and protected prior to final live demonstration.")

    # =========================================================================
    # 3. SEHATSURE ARCHITECTURE OVERVIEW
    # =========================================================================
    add_heading_1(doc, "2. SehatSure System Architecture & Technical Flow")
    add_paragraph(
        doc,
        "SehatSure is engineered as a unified, decoupled decision-support platform designed to solve the financial ambiguity of healthcare admission. The system strictly separates linguistic understanding (AI/LLM) from mathematical computation and hospital ranking (Deterministic Rule Engine)."
    )

    add_callout(
        doc,
        "CRITICAL ARCHITECTURAL SEPARATION:\n"
        "AI is the Reader, NEVER the Calculator.\n"
        "1. AI Layer (Gemini 3.1 Flash-Lite): Reads unstructured insurance PDFs, extracts clauses into a strict Zod-validated JSON schema, and translates final mathematical outputs into human-readable patient guidance.\n"
        "2. Deterministic Rule Engine (TypeScript in server/src/services/hospitalService.ts): Calculates room-rent excesses, proportionate deductions, deductibles, co-pays, sum-insured caps, out-of-pocket liabilities, and hospital fit rankings. Zero LLM hallucinations are possible in financial calculations.",
        title="ARCHITECTURAL INVARIANT",
        alert_type="info"
    )

    add_heading_2(doc, "2.1 End-to-End Operational Pipeline")
    add_paragraph(doc, "The actual lifecycle of a user request through the SehatSure codebase proceeds in 7 sequential phases:")
    add_bullet(doc, "Phase 1: Ingestion & Buffer Processing", "User uploads an insurance policy PDF in frontend (UploadZone.jsx) or selects a demo policy (DemoPicker.jsx). Multer receives the multipart stream in server/src/controllers/policyController.ts into an in-memory buffer. A secure UUID-based reference is stored in server/uploads/.")
    add_bullet(doc, "Phase 2: Text Parsing & LLM Ingestion", "server/src/services/pdfService.ts extracts raw ASCII/UTF-8 text via pdf-parse. If text extraction is non-empty (>50 characters), the raw text is sent to Google Gemini 3.1 Flash-Lite via server/src/services/geminiService.ts with a strict JSON-schema extraction prompt. If the PDF is scanned or textless, the raw buffer is forwarded as inline base64 data.")
    add_bullet(doc, "Phase 3: Schema Normalization & Scheme Overrides", "Raw LLM output is stripped of markdown fences by cleanRawJsonText(), parsed into JSON, and normalized by normalizerService.ts (regex currency parsing, percentage coercion, exclusion sanitization). If policyType is statutory (pmjay or esi), overrideService.ts enforces statutory zero-copay and unlimited/₹5L rules. The schema is validated against ExtractedPolicyZod in policySchema.ts.")
    add_bullet(doc, "Phase 4: Database Persistence & User Confirmation", "The validated policy is saved in MongoDB Atlas (or in-memory MongoMemoryServer fallback) with confirmedByUser: false. The frontend presents CoverageSummaryPage.jsx, allowing the patient to inspect confidence badges, view source snippets, and manually correct missing or low-confidence Tier 1 fields before locking the policy.")
    add_bullet(doc, "Phase 5: Geographic & Clinical Hospital Filtering", "Patient navigates to HospitalDiscoveryPage.jsx, specifying City, Medical Specialty, Procedure, and Room Category. server/src/services/hospitalService.ts executes an in-memory indexed query across 52,960 hospital records, matching city canonical keys, token-aware specialty keywords, and procedure availability.")
    add_bullet(doc, "Phase 6: Deterministic Financial Impact & Multi-Factor Ranking", "For every candidate hospital, calculateHospitalEstimate() looks up private/govt cost benchmarks across 8 geographic tiers, adjusts for hospital segment position (0.25 to 0.80), applies a deterministic hash variation (±5%), and adds 20% doctor fees + 10% diagnostics + room stay. Then calculatePolicyImpact() computes room excess, proportionate deduction, deductible, co-pay, and non-medical consumables. Finally, rankHospitals() calculates the 4-factor Policy Fit Score and sorts facilities.")
    add_bullet(doc, "Phase 7: Real-Time Care Journey Guidance & Client Simulator", "When admission begins, CareJourneyPage.jsx and server/src/services/journeyGuidanceEngine.ts track care journey events (admissions, room upgrades, pre-auth submissions, claim intimations), dynamically recomputing out-of-pocket liabilities and generating proactive financial alerts.")

    # =========================================================================
    # 4. COMPLETE REPOSITORY INVENTORY
    # =========================================================================
    add_heading_1(doc, "3. Complete Repository Inventory & Technology Audit")
    add_paragraph(
        doc,
        "Every file in the SehatSure repository has been indexed and analyzed. The table below outlines the structural role, technology, lines of code, and operational responsibilities of each primary component:"
    )

    inv_headers = ["File / Path", "Tech / Role", "Lines / Size", "Operational Responsibility"]
    inv_widths = [1.8, 1.1, 0.9, 3.0]
    inv_rows = [
        ["server/src/index.ts", "Express Server", "147 lines / 4.6 KB", "Entry point, CORS configuration, API route mounting, static SPA asset serving, demo policy auto-seeding."],
        ["server/src/config/env.ts", "Config / dotenv", "47 lines / 1.9 KB", "Environment variable loader, MongoDB URI resolver with regex validation, Gemini model selection."],
        ["server/src/config/db.ts", "Mongoose / Mongo", "53 lines / 2.4 KB", "MongoDB Atlas connection manager with automatic MongoMemoryServer embedded fallback."],
        ["server/src/config/specialtyNameKeywords.ts", "Clinical Heuristics", "566 lines / 18.8 KB", "18-specialty keyword dictionary with Strong (100), Medium (75), Weak (40) tiers and token-aware matching."],
        ["server/src/controllers/policyController.ts", "Express Controller", "352 lines / 9.8 KB", "PDF upload handling, Gemini extraction orchestration, demo policy cloning, CRUD, and controlled document retrieval."],
        ["server/src/controllers/hospitalController.ts", "Express Controller", "216 lines / 7.1 KB", "City search autocomplete, clinical taxonomy endpoint, hospital search and ranking, detailed bill breakdown endpoint."],
        ["server/src/controllers/journeyController.ts", "Express Controller", "291 lines / 10.1 KB", "Care journey state retrieval, event processing via JourneyGuidanceEngine, and Mongo/in-memory fallback persistence."],
        ["server/src/controllers/authController.ts", "Express Controller", "252 lines / 7.9 KB", "Native crypto.scryptSync password hashing, timing-safe authentication, token session issuance, profile data."],
        ["server/src/models/Policy.ts", "Mongoose Model", "95 lines / 2.8 KB", "MongoDB schema for insurance policies, confidence levels, source snippets, and confirmation state."],
        ["server/src/models/Hospital.ts", "Mongoose Model", "58 lines / 1.8 KB", "MongoDB schema for hospital records, empanelment lists, ratings, specialties, and geographic tiers."],
        ["server/src/models/Journey.ts", "Mongoose Model", "84 lines / 2.6 KB", "MongoDB schema for patient care journeys, event logs, active alerts, and financial snapshots."],
        ["server/src/models/User.ts", "Mongoose Model", "48 lines / 1.5 KB", "MongoDB schema for authenticated users, salted scrypt hashes, saved hospitals, and linked policies."],
        ["server/src/schemas/policySchema.ts", "Zod Validation", "105 lines / 4.1 KB", "Strict Zod extraction schema, Tier 1 required field validator, low-confidence field detector."],
        ["server/src/services/geminiService.ts", "AI / LLM Client", "265 lines / 13.7 KB", "Google Gemini client, JSON-mode prompt, 3-attempt exponential backoff, retry prompt feedback, fallback model."],
        ["server/src/services/hospitalService.ts", "Core Calculation Engine", "1,967 lines / 73.2 KB", "Stream CSV parser, string interning, 8-tier pricing engine, policy impact calculator, 4-factor ranking, search."],
        ["server/src/services/journeyGuidanceEngine.ts", "Care Journey Engine", "657 lines / 33.4 KB", "Rule-based event evaluator, financial impact re-calculator, alert generator, data provenance tracker."],
        ["server/src/services/networkMatchingService.ts", "Network Matching", "335 lines / 10.3 KB", "Empanelment engine, 16-insurer canonical registry, token-aware matching, guaranteed 4-state return."],
        ["server/src/services/normalizerService.ts", "Data Normalizer", "599 lines / 22.2 KB", "Indian currency string-to-number parser (Lakh/Cr), room limits, percentage coercion, exclusion sanitizer."],
        ["server/src/services/overrideService.ts", "Statutory Overrides", "136 lines / 5.4 KB", "Statutory PM-JAY and ESI rules injection, Tier 2 default values assignment, confidence tracking."],
        ["server/src/services/pdfService.ts", "PDF Parser", "12 lines / 0.4 KB", "Node pdf-parse wrapper for extracting textual contents from policy PDF buffers."],
        ["server/src/services/integration/MockIntegrationProviders.ts", "Mock Integrations", "164 lines / 5.5 KB", "Simulated HIS/EHR, TPA gateway, and claim status feeds with explicit 'SIMULATED DEMO' provenance."],
        ["server/src/utils/demoData.ts", "Mock Policies", "305 lines / 10.9 KB", "4 pre-seeded policies: Star Health, HDFC ERGO Corporate, PM-JAY Ayushman Bharat, ESI Scheme."],
        ["server/clean_hospitals_dataset.py", "Data Cleansing Script", "800 lines / 33.3 KB", "OCR artifact cleaner, address de-duplicator, city-state cross-validator, canonical tier assigner."],
        ["frontend/src/App.jsx", "React Root", "339 lines / 11.1 KB", "Single-page application router, session persistence via localStorage, auth-protection barriers."],
        ["frontend/src/index.css", "Vanilla CSS Design System", "2,350 lines / 47.8 KB", "Custom responsive healthcare design system, Teal/Navy palette, glassmorphism, micro-animations."],
        ["frontend/src/pages/UploadPage.jsx", "Frontend Page", "210 lines / 7.8 KB", "Policy upload drag-and-drop zone, demo policy selector, stepped processing animation."],
        ["frontend/src/pages/CoverageSummaryPage.jsx", "Frontend Page", "860 lines / 34.5 KB", "Interactive policy verification view, confidence badges, source snippet view, editable Tier 1 fields."],
        ["frontend/src/pages/HospitalDiscoveryPage.jsx", "Frontend Page", "1,514 lines / 70.0 KB", "Dynamic hospital search, cascading city/specialty/procedure filters, score breakdown & bill modals."],
        ["frontend/src/pages/CareJourneyPage.jsx", "Frontend Page", "820 lines / 33.1 KB", "Real-time care journey tracking interface, interactive 12-step simulator, live alert feed."],
        ["frontend/src/pages/HowItWorksPage.jsx", "Frontend Page", "750 lines / 36.4 KB", "Interactive educational manual explaining insurance math, proportionate deduction, and system workflow."],
        ["frontend/src/components/BillBreakdownModal.jsx", "UI Component", "680 lines / 27.4 KB", "Detailed itemized hospital bill modal, policy impact calculations, room upgrade savings calculator."],
        ["frontend/src/components/ScoreBreakdownModal.jsx", "UI Component", "450 lines / 18.1 KB", "Modal displaying 4-factor scoring breakdown, weights (50%, 25%, 15%, 10%), and granular tie-breakers."],
        ["frontend/src/components/WhyExplanationModal.jsx", "UI Component", "190 lines / 6.9 KB", "Transparency modal explaining exactly why a specific alert or recommendation was generated."],
        ["frontend/src/context/AuthContext.jsx", "React Context", "165 lines / 6.3 KB", "User authentication state, session storage, hospital bookmarking, policy linking."],
        ["frontend/src/utils/careJourneyAdvisor.js", "Frontend Logic", "410 lines / 16.5 KB", "Pre-admission checklist generator, insurance timeline calculations, emergency protocols."],
        ["frontend/src/utils/journeyGuidanceEngine.js", "Client Engine", "609 lines / 30.3 KB", "Client-side journey simulator engine mirroring server-side financial impact calculations."],
        ["hospitals.csv", "Primary Dataset", "53,022 rows / 11.0 MB", "52,960 validated hospital records across 21,383 cities in India with insurers and specialties."],
        ["pvt_costs.csv", "Benchmark Dataset", "131 rows / 12.8 KB", "Private hospital surgical benchmarks across 8 geographic tiers (low, mean, high, room rates, stay)."],
        ["govt_costs.csv", "Benchmark Dataset", "131 rows / 12.7 KB", "Government hospital surgical benchmarks and CGHS package rates across 8 geographic tiers."],
        ["render.yaml", "Deployment Blueprint", "21 lines / 0.5 KB", "Render Web Service configuration: Node runtime, single port full-stack build, environment variables."]
    ]
    tbl_inv = doc.add_table(rows=1, cols=4)
    format_table(tbl_inv, inv_widths, inv_headers, inv_rows)

    # =========================================================================
    # SECTION A — PROJECT FUNDAMENTALS
    # =========================================================================
    add_heading_1(doc, "SECTION A — Project Fundamentals & Value Proposition")
    add_paragraph(
        doc,
        "These questions probe the fundamental existence, clinical-financial necessity, problem scope, and foundational philosophy of SehatSure."
    )

    add_qa_card(
        doc,
        q_num="A.1",
        question="What exact problem does SehatSure solve, and why does this problem matter?",
        ideal_answer="SehatSure solves the acute financial blindness and informational chaos experienced by patients and caregivers during hospital admission in India. When a medical crisis occurs, families must navigate complex, 40-page insurance policy wordings filled with hidden clauses—such as room-rent sublimits, proportionate deduction penalties, mandatory co-pays, disease-specific caps, and restrictive empanelment lists. Without transparency, patients routinely select hospitals or room categories that trigger catastrophic out-of-pocket disallowances, forcing unexpected out-of-pocket payments that exceed ₹50,000 to ₹2,00,000 at discharge. SehatSure converts policy documents into structured mathematical constraints and matches them against over 52,000 hospitals, providing predictive, itemized cost estimates and network certainty before admission occurs.",
        evidence="README.md lines 12-22; server/src/services/hospitalService.ts lines 1014-1295 (calculatePolicyImpact); frontend/src/pages/HowItWorksPage.jsx.",
        followup="Why can't patients just ask the hospital TPA desk before getting admitted?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="A.2",
        question="Who is the target user of SehatSure, and what is their exact pain point?",
        ideal_answer="The primary user is an insurance policyholder, patient, or family caregiver planning an elective or emergency hospitalization. Their exact pain point is 'Post-Discharge Bill Shock'—the terrifying discovery at discharge that their 'cashless' insurance policy only covered 50% to 60% of the hospital bill because they chose a private room that exceeded their daily room-rent cap, thereby activating a proportionate deduction penalty across doctor fees and surgery charges. Secondary users include corporate HR benefits managers, healthcare advisors, and hospital insurance desks seeking transparent admission estimates.",
        evidence="README.md lines 358-367; frontend/src/components/BillBreakdownModal.jsx lines 120-190; server/src/types/policy.ts.",
        followup="Is SehatSure designed for emergency admissions or planned admissions?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="A.3",
        question="Why is the existing process insufficient? What happens without SehatSure?",
        ideal_answer="Currently, patients rely on fragmented PDF network lists published by insurers (which are often outdated or lack procedure-level costs) and verbal assurances from hospital receptionists. Without SehatSure, three critical failures occur: (1) Room Rent Disallowance: A patient with a ₹3,000 room limit occupies a ₹6,000 room, triggering a 50% proportionate deduction on associated medical expenses; (2) False Network Assumption: Patients assume a hospital is cashless because an insurer logo is displayed, only to find the empanelment expired or is reimbursement-only; (3) Financial Panic: Family members are forced to arrange emergency personal loans at discharge to settle disputed claim amounts.",
        evidence="server/src/services/hospitalService.ts lines 1186-1198 (proportionateDisallowance formula); server/src/services/networkMatchingService.ts lines 237-334; test_policy_text.txt.",
        followup="What percentage of private health insurance claims in India face deductions?",
        status_tag="QUALIFY"
    )

    add_qa_card(
        doc,
        q_num="A.4",
        question="What is the core technical innovation of SehatSure? What is the one-line value proposition?",
        ideal_answer="One-line Value Proposition: 'Financial precision at hospital admission through automated policy extraction, authoritative empanelment matching, and deterministic out-of-pocket cost prediction.' The core technical innovation is the complete decoupling of linguistic interpretation from financial calculation: Google Gemini extracts and normalizes unstructured clauses into a strict Zod-validated schema, while a 100% deterministic TypeScript rule engine executes IRDAI-compliant insurance mathematics across 52,960 hospitals without hallucination risk.",
        evidence="README.md lines 128-149; server/src/services/geminiService.ts lines 124-128; server/src/services/hospitalService.ts lines 1014-1295.",
        followup="Why not let the LLM calculate the patient's out-of-pocket bill directly?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="A.5",
        question="Why is SehatSure more than a chatbot? What makes this an AI/ML solution?",
        ideal_answer="A chatbot is an unstructured natural language conversational interface prone to mathematical hallucinations, confabulations, and non-deterministic pricing. SehatSure is an enterprise decision-support platform with a multi-stage architecture: (1) Computer Vision / Document Intelligence pipeline extracting structured terms from arbitrary PDFs; (2) Zod schema enforcement and automated error-feedback retry loops; (3) High-performance in-memory indexing of 52,960 spatial hospital records; (4) Multi-parameter scoring algorithm weighing Coverage Fit (50%), Cost Fit (25%), Institutional Trust (15%), and Co-Pay Fit (10%); (5) An interactive Care Journey Event State Machine evaluating real-time clinical milestones.",
        evidence="server/src/schemas/policySchema.ts lines 26-65; server/src/services/hospitalService.ts lines 1320-1460; frontend/src/pages/CareJourneyPage.jsx.",
        followup="What machine learning model did you train yourself?",
        status_tag="QUALIFY"
    )

    add_qa_card(
        doc,
        q_num="A.6",
        question="What part of building SehatSure was genuinely difficult?",
        ideal_answer="The genuinely difficult challenges were threefold: (1) Insurance Clause Normalization: Indian health insurance policies use highly inconsistent terminology (e.g. '1% of SI', 'Single Private A/C Room', 'Rs. 3000/day', 'Zone A tariff'). Normalizing these into deterministic numeric boundaries required sophisticated regex parsing and exclusion cross-referencing. (2) Real-World Dataset Cleansing: The raw 55,000-hospital dataset suffered from severe OCR errors, concatenated columns, duplicate addresses, and mismatched state mappings (e.g. Chennai mapped to Maharashtra). We wrote clean_hospitals_dataset.py to correct 9,777 tier mappings and remove 1,994 corrupt rows. (3) Sub-Second In-Memory Performance: Indexing 53,000 hospital records in Node.js within Render's 512MB RAM ceiling required custom readline streaming and string interning (internString()) to avoid V8 heap exhaustion.",
        evidence="server/clean_hospitals_dataset.py lines 10-20; server/src/services/normalizerService.ts lines 139-190; server/src/services/hospitalService.ts lines 420-430.",
        followup="How much RAM does the hospital dataset consume in memory after optimization?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="A.7",
        question="What assumptions does the system make, and what are its current limitations?",
        evidence="README.md lines 368-395; server/src/services/hospitalService.ts lines 61-70; hospital_dataset_sources_with_costing_engine_updated.pdf.",
        ideal_answer="Assumptions: (1) Procedure benchmarks represent city-tier medians modeled from CGHS and private healthcare data, adjusted by hospital segment (budget to luxury) and deterministic ±5% facility variation, rather than live hospital billing APIs; (2) Doctor fees (20%) and medicines/diagnostics (10%) are proportional to procedure complexity; (3) Non-medical consumables disallowance is modeled at 5% of total bill per standard IRDAI non-payable schedules. Limitations: (1) Scanned image-only PDFs without OCR text fallback return partial extractions requiring user confirmation; (2) Network empanelment reflects reference dataset lists from PolicyBazaar/Ditto rather than real-time insurer API handshakes; (3) Pre-existing disease waiting period waivers require user date-of-inception inputs.",
        followup="If procedure costs are benchmark estimates, how can you claim 'financial precision'?",
        status_tag="QUALIFY"
    )

    # =========================================================================
    # SECTION B — PROBLEM STATEMENT ALIGNMENT (FIN-01 / HACKMATRIX)
    # =========================================================================
    add_heading_1(doc, "SECTION B — Problem Statement Alignment (FIN-01 Challenge)")
    add_paragraph(
        doc,
        "The HackMatrix Problem Statement FIN-01 focuses on 'Precision Care Financial Intelligence'—bridging clinical decision support with financial transparency at the point of hospital admission. Below is the clause-by-clause compliance audit against the challenge requirements:"
    )

    fin_headers = ["FIN-01 Requirement", "SehatSure Implementation", "Code Reference", "Compliance", "Judge Question / Fix Needed"]
    fin_widths = [1.8, 1.8, 1.4, 0.8, 1.0]
    fin_rows = [
        [
            "1. Automated Policy Ingestion & Term Extraction",
            "Multi-format PDF ingestion, Gemini 3.1 Flash-Lite JSON extraction, Zod validation, confidence scoring.",
            "server/src/services/geminiService.ts\nserver/src/schemas/policySchema.ts",
            "FULLY COMPLIANT",
            "Judge: 'How do you handle OCR for scanned policies?' Fix: Clarify image base64 inline fallback."
        ],
        [
            "2. Policy Constraint & Exclusion Parsing",
            "Normalizes room rent, ICU caps, deductibles, co-pays, sublimits, exclusions, and waiting periods.",
            "server/src/services/normalizerService.ts\nserver/src/services/overrideService.ts",
            "FULLY COMPLIANT",
            "Judge: 'Can sublimits be confused with permanent exclusions?' Code proves sanitizeExclusions() separates them."
        ],
        [
            "3. Geolocation & Hospital Tier Discovery",
            "52,960 hospitals categorized into 8 tiers (Metro 1 to Town 2) with token-aware specialty keywords.",
            "server/src/services/hospitalService.ts\nserver/src/config/specialtyNameKeywords.ts",
            "FULLY COMPLIANT",
            "Judge: 'How do you prevent substring bugs like \"ear\" matching \"heart\"?' Code uses strict regex word boundaries."
        ],
        [
            "4. Insurer Empanelment & Cashless Verification",
            "16-insurer canonical registry with exact alias matching; guaranteed 4-state return (verified, unverified, etc.).",
            "server/src/services/networkMatchingService.ts",
            "FULLY COMPLIANT",
            "Judge: 'Do you ever show unverified hospitals as empanelled?' Code strictly prevents this (networkStatus: unverified)."
        ],
        [
            "5. Itemized Cost Estimation & OOP Prediction",
            "Procedure cost + 20% doctor fees + 10% diagnostics + room charges × stay days, with full policy deductions.",
            "server/src/services/hospitalService.ts (calculatePolicyImpact)",
            "FULLY COMPLIANT",
            "Judge: 'What is your proportionate deduction formula?' Fully documented and verified in audit regression test suite."
        ],
        [
            "6. Multi-Factor Scoring & Ranking",
            "Policy Fit Score weighing Coverage (50%), Cost Fit (25%), Institutional Trust (15%), Co-Pay (10%).",
            "server/src/services/hospitalService.ts (rankHospitals)",
            "FULLY COMPLIANT",
            "Judge: 'Why does Coverage Fit receive 50% weight?' Protects patients from catastrophic financial exposure."
        ],
        [
            "7. Explainable Decision Support & Journey Tracking",
            "Event state machine tracking care milestones with 'Why am I seeing this?' policy provenance modals.",
            "server/src/services/journeyGuidanceEngine.ts\nfrontend/src/pages/CareJourneyPage.jsx",
            "FULLY COMPLIANT",
            "Judge: 'Is the journey simulator tied to real events?' Simulated feeds are clearly labeled with explicit demo provenance."
        ]
    ]
    tbl_fin = doc.add_table(rows=1, cols=5)
    format_table(tbl_fin, fin_widths, fin_headers, fin_rows)

    # =========================================================================
    # SECTION C — COMPLETE ARCHITECTURE QUESTIONS
    # =========================================================================
    add_heading_1(doc, "SECTION C — Complete Architecture Defense")
    add_paragraph(doc, "These questions test system boundaries, data flow, failure recovery, scalability, and deployment topology:")

    add_qa_card(
        doc,
        q_num="C.1",
        question="Walk me through the exact technical flow from the millisecond a user uploads a PDF until ranked hospitals appear.",
        ideal_answer="1. Frontend: UploadZone.jsx sends a multipart/form-data POST request to /api/policy/upload with the PDF file. 2. Controller: policyController.ts receives the buffer via Multer memory storage, generates a policy ID (pol_<timestamp>_<uuid6>), and writes the raw buffer to server/uploads/. 3. PDF Service: pdfService.ts calls pdfParse(buffer). If text length > 50 characters, it forwards extracted plain text to Gemini 3.1 Flash-Lite; otherwise, it sends inline base64 PDF data. 4. LLM Service: geminiService.ts calls model.generateContent() with temperature: 0 and responseMimeType: 'application/json'. 5. Schema Validation: normalizerService.ts coerces currencies and sanitizes exclusions. ExtractedPolicyZod.safeParse() validates types. If invalid, a one-shot self-correction retry is dispatched. 6. Persistence: Policy document is saved in MongoDB Atlas with confirmedByUser: false. 7. Frontend Verification: CoverageSummaryPage.jsx displays extracted terms; upon user confirmation, a PUT /api/policy/:id locks the record. 8. Discovery: HospitalDiscoveryPage.jsx sends POST /api/hospitals/search with city, specialty, and procedure. 9. Hospital Service: hospitalService.ts filters the in-memory array of 52,960 hospitals, computes segment-adjusted costs, applies calculatePolicyImpact(), calculates the 4-factor score, sorts descending, and returns JSON in under 120ms.",
        evidence="server/src/controllers/policyController.ts lines 22-96; server/src/services/hospitalService.ts lines 1811-1961.",
        followup="What happens if the Gemini API takes 15 seconds to respond?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="C.2",
        question="Why did you choose a monolithic Express + Vite single-service deployment on Render rather than microservices?",
        ideal_answer="For a 24-hour hackathon and live demonstration environment, operational simplicity, zero latency overhead, and deployment determinism are paramount. By having Express serve both the REST API (/api/*) and the compiled static Vite frontend (/dist) on a single port (5000 / $PORT), we completely eliminated Cross-Origin Resource Sharing (CORS) preflight latencies, cookie/token domain mismatches, and multi-service synchronization failures. Furthermore, Render's free tier provides 512 MB RAM; running separate frontend and backend containers would double memory consumption and exceed free-tier quotas. Our single Node process runs comfortably within 150 MB heap space under --max-old-space-size=450.",
        evidence="DEPLOY.md lines 1-8; render.yaml lines 1-21; server/src/index.ts lines 77-111.",
        followup="How would you refactor this architecture for 100,000 concurrent users in production?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="C.3",
        question="What happens if the backend fails halfway through a policy upload or hospital search?",
        ideal_answer="We built defense-in-depth failure recovery across every layer: (1) If Gemini extraction fails or returns malformed JSON, geminiService.ts catches the error, attempts a fallback model (gemini-3.5-flash-lite), and if that also fails, returns a partial fallback schema (isPartialFallback: true) with status 422. The frontend gracefully switches to manual review mode, allowing the user to enter their sum insured and room rent manually; (2) If MongoDB Atlas connection drops, db.ts catches the failure and immediately boots an embedded, in-process MongoMemoryServer instance, ensuring APIs continue uninterrupted; (3) If hospital cost data is missing for a rare procedure, hospitalService.ts automatically cascades down to specialty average, then city-tier average, and finally marks the estimate unavailable rather than crashing.",
        evidence="server/src/services/geminiService.ts lines 183-198; server/src/config/db.ts lines 20-30; server/src/services/hospitalService.ts lines 860-904.",
        followup="Does the MongoMemoryServer persist data across container restarts on Render?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="C.4",
        question="Where exactly are service boundaries drawn in your backend? Why is pricing logic in hospitalService rather than a separate costService?",
        ideal_answer="Service boundaries are delineated by data domain: (1) geminiService.ts is exclusively responsible for external LLM interaction; (2) normalizerService.ts owns type coercion and string sanitation; (3) networkMatchingService.ts owns insurer alias resolution and empanelment classification; (4) journeyGuidanceEngine.ts manages the care journey state machine; (5) hospitalService.ts serves as the unified hospital catalog and pricing engine. We unified procedure cost estimation and hospital ranking inside hospitalService.ts because hospital pricing in India cannot be divorced from hospital metadata: procedure costs are function of hospital type (private vs. govt), geographic tier (Metro 1 to Town 2), and commercial segment (budget vs. luxury). Decoupling them into separate services would have required redundant object passing across 53,000 iterations during search ranking.",
        evidence="server/src/services/hospitalService.ts lines 919-996; server/src/services/networkMatchingService.ts lines 8-173.",
        followup="Does hospitalService violate the Single Responsibility Principle?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="C.5",
        question="How do you handle dataset loading without causing Node.js out-of-memory crashes on Render 512MB?",
        ideal_answer="In our initial prototype, fs.readFileSync() on the 11MB hospitals.csv followed by splitting on newlines created over 500,000 JavaScript string objects simultaneously, spiking V8 heap usage above 480 MB and triggering SIGKILL on Render. We re-engineered the loader in hospitalService.parseHospitalsFromFile(): (1) We use readline.createInterface() over a streaming fs.createReadStream(), processing one line at a time; (2) We implemented custom string interning via internString(str, STRING_POOL). Because values like city names, state names, specialty titles, and tiers repeat across tens of thousands of rows, interning guarantees only a single pointer is retained in memory for duplicate strings. This reduced heap memory from 480 MB down to under 120 MB.",
        evidence="server/src/services/hospitalService.ts lines 420-430 (internString), lines 500-609 (parseHospitalsFromFile).",
        followup="What is the overhead of the Map lookup in internString during initial parsing?",
        status_tag="SAFE"
    )
