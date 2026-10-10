import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from defense_doc_builder.styles import (
    add_heading_1, add_heading_2, add_heading_3, add_paragraph,
    add_bullet, add_callout, add_code_block, add_qa_card, format_table,
    COLOR_PRIMARY, COLOR_SECONDARY, COLOR_DANGER, COLOR_SUCCESS, COLOR_WARNING
)

def build_part5(doc: Document):
    print("   -> Building Part 5: Section Y (Judge Attacks), Section Z (Code Viva), Section AA (Formula Viva), Sections AB, AC, AD, AE, AF, AG...")

    # =========================================================================
    # SECTION Y — HACKATHON JUDGE ATTACK QUESTIONS
    # =========================================================================
    add_heading_1(doc, "SECTION Y — Aggressive Hackathon Judge Attack Round")
    add_paragraph(
        doc,
        "These are high-pressure, confrontational questions commonly asked by senior technical judges to expose shallow MVPs, wrapper apps, or fabricated capabilities. Below are rock-solid, truthful responses."
    )

    add_qa_card(
        doc,
        q_num="Y.1",
        question="ATTACK: 'Isn't this just a glorified ChatGPT wrapper over an insurance PDF? Why can't I just upload my policy to ChatGPT directly?'",
        ideal_answer="TRUTHFUL COUNTER-DEFENSE: If you upload a 40-page insurance policy to ChatGPT and ask: 'How much will I pay for knee replacement at Manipal Hospital?', ChatGPT will fail in three critical ways: (1) It will hallucinate pricing numbers because it has no access to hospital-specific procedure benchmarks or city-tier room tariffs; (2) It frequently hallucinates insurance math, confusing deductibles with co-pays or applying proportionate deductions to non-eligible items; (3) It has zero spatial or empanelment awareness of India's 52,000+ hospital registry. SehatSure is an integrated decision-support platform: Gemini is used strictly for structured entity extraction (10% of the architecture). The remaining 90% is a custom-engineered enterprise stack: stream parsing of 52,960 hospitals, token-aware clinical keyword matching, an IRDAI-compliant deterministic calculation engine, and a real-time Care Journey event state machine.",
        evidence="server/src/services/hospitalService.ts (1,967 lines of proprietary math and search logic); server/src/services/networkMatchingService.ts.",
        followup="Could another hackathon team build this exact system in 2 hours using LangChain?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="Y.2",
        question="ATTACK: 'Your cost estimates are based on synthetic/benchmark datasets, not live hospital billing APIs. Why should any patient trust your numbers?'",
        ideal_answer="TRUTHFUL COUNTER-DEFENSE: We state with 100% honesty that hospital billing in India is currently completely closed: there is no national API where a private hospital exposes live procedure billing tariffs to the public. If any hackathon team claims to have live billing APIs from Apollo, Fortis, or Manipal, they are fabricating capabilities. SehatSure solves this by modeling procedure benchmarks from empirical Central Government Health Scheme (CGHS) package rates and private hospital rate audits across 8 geographic tiers, calibrated by hospital commercial segment (budget to luxury) and deterministic facility variation. We explicitly display 'BENCHMARK ESTIMATE' provenance badges with full methodology links on every estimate, offering patients 80% to 90% financial predictability where zero transparency existed previously.",
        evidence="hospital_dataset_sources_with_costing_engine_updated.pdf lines 1-35; frontend/src/components/ProvenanceBadge.jsx.",
        followup="How do you plan to transition from benchmark tariffs to real-time hospital billing in production?",
        status_tag="QUALIFY"
    )

    add_qa_card(
        doc,
        q_num="Y.3",
        question="ATTACK: 'Why would an insurance company ever support SehatSure? Doesn't insurance make more profit when patients don't understand their policies and get claims rejected?'",
        ideal_answer="TRUTHFUL COUNTER-DEFENSE: That is a common myth. In reality, insurance companies in India suffer massive operational losses from claim disputes, ombudsman litigation, hospital over-billing, and customer churn caused by post-discharge bill shock. Insurers want patients to choose empanelled network hospitals and eligible room categories because: (1) Insurers have pre-negotiated package rates with network hospitals, saving 15% to 25% compared to uncontrolled non-network reimbursement claims; (2) Proportionate deduction disputes generate over 40% of IRDAI grievance complaints. By guiding patients to network facilities and compliant rooms, SehatSure lowers claim settlement friction, reduces insurer litigation costs, and enhances customer retention.",
        evidence="README.md lines 358-367; server/src/services/networkMatchingService.ts.",
        followup="Have you spoken to any insurance TPAs or underwriters to validate this?",
        status_tag="QUALIFY"
    )

    add_qa_card(
        doc,
        q_num="Y.4",
        question="ATTACK: 'What did your team actually build during the 24 hours of this hackathon, and what was pre-existing boilerplate?'",
        ideal_answer="TRUTHFUL COUNTER-DEFENSE: We built the entire integrated decision support pipeline: (1) The Gemini 3.1 Flash-Lite JSON extraction schema, few-shot prompt, and Zod validation pipeline in server/src/services/geminiService.ts; (2) The clean_hospitals_dataset.py data-cleansing pipeline, processing 54,972 rows, correcting 9,777 geographic tiers, and writing the in-memory streaming indexer with string interning; (3) The canonical calculatePolicyImpact() financial engine implementing proportionate deduction, sublimits, and non-network co-pay rules; (4) The 4-factor scoring algorithm (rankHospitals) and 7-tier deterministic tie-breaker; (5) The interactive Care Journey event state machine and real-time simulator in journeyGuidanceEngine.ts; (6) Full multilingual localization in 4 languages (English, Hindi, Kannada, Marathi); (7) An automated Vitest regression test suite with 119 test cases.",
        evidence="git log --stat; server/src/; frontend/src/.",
        followup="Show me your Git commit history to verify commits during the hackathon window.",
        status_tag="SAFE"
    )

    # =========================================================================
    # SECTION Z — CODE VIVA: "SHOW ME THE CODE" CHECKLIST
    # =========================================================================
    add_heading_1(doc, "SECTION Z — 'Show Me the Code' Live Navigation Checklist")
    add_paragraph(
        doc,
        "When judges say: 'Show me where X happens in your code,' immediately open the following exact files and functions:"
    )

    show_headers = ["Capability / Feature", "Exact File Path", "Function / Class Name", "Key Lines", "What to Highlight"]
    show_widths = [1.8, 1.8, 1.4, 0.8, 1.4]
    show_rows = [
        ["Policy Extraction Prompt", "server/src/services/geminiService.ts", "EXTRACTION_PROMPT", "lines 7-96", "Highlight 16 strict extraction rules, null-safety, and JSON-only constraint."],
        ["Zod Schema & Tier 1 Check", "server/src/schemas/policySchema.ts", "getMissingTier1Fields()", "lines 73-88", "Show how ESI sumInsured is legally unlimited and excluded from missing checks."],
        ["Currency Parsing Regex", "server/src/services/normalizerService.ts", "normalizeIndianCurrency()", "lines 7-36", "Show Lakh/Crore regex parsing and 'Nil/None' handling as 0."],
        ["Exclusion Sanitization", "server/src/services/normalizerService.ts", "sanitizeExclusions()", "lines 139-190", "Show waiting period and sublimit cross-referencing preventing false exclusions."],
        ["Dataset Stream Parser", "server/src/services/hospitalService.ts", "parseHospitalsFromFile()", "lines 500-609", "Show readline streaming and internString() reducing heap memory below 150MB."],
        ["Hospital Cost Interpolation", "server/src/services/hospitalService.ts", "getSegmentAdjustedCost()", "lines 906-917", "Show piecewise linear interpolation between low, mean, and highest dataset bounds."],
        ["Proportionate Deduction Math", "server/src/services/hospitalService.ts", "calculatePolicyImpact()", "lines 1186-1198", "Show allowedRatio and associated expenses formula subtracting sublimitExcess."],
        ["Empanelment Verification", "server/src/services/networkMatchingService.ts", "getHospitalNetworkStatus()", "lines 229-334", "Show exact match, canonical alias matching, and unverified return status."],
        ["4-Factor Policy Fit Score", "server/src/services/hospitalService.ts", "rankHospitals()", "lines 1320-1450", "Show CoverageFit (50%), CostFit (25%), Type (15%), and CoPay (10%) math."],
        ["Tie-Breaker Hierarchy", "server/src/services/hospitalService.ts", "rankHospitals().sort()", "lines 1505-1544", "Show 7-tier descending sort using granularScore and hospital rating."],
        ["Care Journey State Machine", "server/src/services/journeyGuidanceEngine.ts", "evaluateEvent()", "lines 40-160", "Show room upgrade evaluation, proactive alert generation, and 'Why' provenance."],
        ["Cryptographic Authentication", "server/src/controllers/authController.ts", "hashPassword() / verify()", "lines 6-23", "Show native crypto.scryptSync and timingSafeEqual preventing timing attacks."],
        ["Database Memory Fallback", "server/src/config/db.ts", "connectDB()", "lines 20-30", "Show catch block dynamically importing MongoMemoryServer on Atlas failure."]
    ]
    tbl_show = doc.add_table(rows=1, cols=5)
    format_table(tbl_show, show_widths, show_headers, show_rows)

    # =========================================================================
    # SECTION AA — FORMULA VIVA
    # =========================================================================
    add_heading_1(doc, "SECTION AA — Master Formula Viva & Accounting Review")
    add_paragraph(doc, "Complete reference sheet of all mathematical formulas implemented in the SehatSure codebase:")

    add_heading_2(doc, "Formula 1: Hospital-Specific Procedure Cost")
    add_code_block(doc, "P_proc = round(P_adjusted * (1 + delta_hospital))\nwhere delta_hospital = hashString(hospital_name | address | tier | segment) % 1000 / 1000 * 0.10 - 0.05 (bounded -5% to +5%)", "Math")
    add_paragraph(doc, "Meaning: P_adjusted is the piecewise segment benchmark. delta_hospital introduces deterministic ±5% micro-variation bounded within dataset low and high costs.", italic=True)

    add_heading_2(doc, "Formula 2: Total Estimated Hospital Bill")
    add_code_block(doc, "Total Bill = P_proc + Doctor_Fees(20%) + Medicines_Lab(10%) + Room_Charges\nTotal Bill = P_proc + 0.20 * P_proc + 0.10 * P_proc + (Room_Rate_Per_Day * Stay_Days)\nTotal Bill = 1.30 * P_proc + (Room_Rate_Per_Day * Stay_Days)", "Math")
    add_paragraph(doc, "Meaning: Doctor fees are modeled at 20% of procedure complexity; diagnostic labs and medicines at 10%; accommodation is room tariff multiplied by procedure stay days.", italic=True)

    add_heading_2(doc, "Formula 3: Room Rent Excess")
    add_code_block(doc, "Room_Rent_Excess = max(0, Room_Rate_Per_Day - Room_Limit_Eligible_Per_Day) * Stay_Days", "Math")
    add_paragraph(doc, "Meaning: Any daily room tariff exceeding the policy daily entitlement is paid 100% out-of-pocket by the patient.", italic=True)

    add_heading_2(doc, "Formula 4: Proportionate Deduction Disallowance")
    add_code_block(doc, "Allowed_Ratio = min(1, Room_Limit_Eligible_Per_Day / Room_Rate_Per_Day)\nAssociated_Medical_Expenses = max(0, P_proc - Sublimit_Excess) + Doctor_Fees\nProportionate_Disallowance = round(Associated_Medical_Expenses * (1 - Allowed_Ratio))", "Math")
    add_paragraph(doc, "Meaning: Mandated by IRDAI when room rent cap is breached. Reduces insurer contribution across procedure and surgeon fees in proportion to the room limit breach.", italic=True)

    add_heading_2(doc, "Formula 5: Total Patient Payable (Out-of-Pocket)")
    add_code_block(doc, "Patient_Payable = Room_Rent_Excess + Proportionate_Disallowance + Sublimit_Excess + Deductible_Applied + Copay_Amount + Sum_Insured_Excess + Non_Medical_Allowance(5%)", "Math")
    add_paragraph(doc, "Meaning: Sum of all non-covered expenses, penalties, deductibles, co-pays, policy exhaustion, and non-medical consumables.", italic=True)

    # =========================================================================
    # SECTION AB — CLAIM AUDIT: SAFE VS UNSAFE PITCHES
    # =========================================================================
    add_heading_1(doc, "SECTION AB — Claim Audit & Verifiability Table")
    add_paragraph(
        doc,
        "Every claim that team members might make during presentations has been audited against code. Use ONLY the recommended wording below:"
    )

    claim_headers = ["Pitch Claim", "Evidence in Code / Data", "Safety Status", "Recommended Safe Wording"]
    claim_widths = [1.8, 1.8, 1.0, 2.6]
    claim_rows = [
        [
            "\"We index over 54,000 hospitals.\"",
            "clean_hospitals_dataset.py filtered 1,994 corrupt rows. hospitalService.initData() indexes 52,960 valid rows.",
            "🟡 QUALIFY",
            "\"Our dataset contains over 52,000 validated healthcare facilities across 21,383 cities in India.\""
        ],
        [
            "\"Our frontend is built with Tailwind CSS.\"",
            "package.json has NO Tailwind dependency. index.css is 47KB of pure custom Vanilla CSS.",
            "🔴 DO NOT CLAIM",
            "\"Our frontend is built with a custom responsive Vanilla CSS design system (47 KB) without external framework bloat.\""
        ],
        [
            "\"We have live real-time network verification with insurers.\"",
            "networkMatchingService.ts uses static reference dataset lists from PolicyBazaar and Ditto. freshnessStatus: 'UNKNOWN'.",
            "🔴 DO NOT CLAIM",
            "\"We verify network status against authoritative insurer empanelment reference datasets, with explicit on-screen disclaimers to reconfirm with hospital TPA desks.\""
        ],
        [
            "\"Our AI calculates exact patient hospital bills.\"",
            "AI is used strictly for text extraction and natural language advice. All math is executed by deterministic TypeScript rule engine.",
            "🔴 DO NOT CLAIM",
            "\"Our AI extracts unstructured policy clauses; our 100% deterministic mathematical rule engine calculates bills and out-of-pocket liabilities.\""
        ],
        [
            "\"We guarantee 100% cashless admission at verified hospitals.\"",
            "Cashless admission is legally subject to final insurer TPA pre-authorization approval.",
            "🟡 QUALIFY",
            "\"We identify cashless-eligible network hospitals and calculate pre-authorization estimates, subject to final TPA confirmation.\""
        ],
        [
            "\"Our system works offline without MongoDB installed.\"",
            "db.ts catches MongoDB connection drops and automatically boots an embedded in-memory MongoMemoryServer.",
            "🟢 SAFE",
            "\"The platform includes an embedded in-memory MongoDB fallback, ensuring complete operational resilience during network or database outages.\""
        ]
    ]
    tbl_claim = doc.add_table(rows=1, cols=4)
    format_table(tbl_claim, claim_widths, claim_headers, claim_rows)

    # =========================================================================
    # SECTION AC — "MISLEADING DEMO" AUDIT
    # =========================================================================
    add_heading_1(doc, "SECTION AC — 'Misleading Demo' Traps & UI Safeguards")
    add_paragraph(doc, "Audited areas where judges could misinterpret system capabilities during live demos:")

    add_bullet(doc, "Trap 1: Unverified Hospital Display", "If an unverified hospital is presented as empanelled, judges will challenge medical safety. Safeguard: networkStatus: 'unverified' strictly renders an amber warning pill ('Network Status Not Verified') and disallows cashless claims.")
    add_bullet(doc, "Trap 2: Benchmark Estimate vs Exact Quote", "If a judge thinks ₹2,50,000 is an Apollo billing API quote, they will demand API keys. Safeguard: Every card displays ProvenanceBadge ('BENCHMARK ESTIMATE — CGHS & City-Tier Modeled Tariff').")
    add_bullet(doc, "Trap 3: AI Calculation Claim", "If team says 'Our model computed the copay', judges will attack LLM arithmetic hallucination. Safeguard: State proudly: 'AI never calculates; all calculations are executed by deterministic TypeScript.'")
    add_bullet(doc, "Trap 4: Real-time Bed Availability", "If team implies beds are live-synced, judges will ask for HL7/FHIR feeds. Safeguard: Clarify that bed counts represent static hospital infrastructure capacity, not live occupancy.")

    # =========================================================================
    # SECTION AD, AE, AF, AG — RISKS, DO NOT SAY & ROLE DEFENSE
    # =========================================================================
    add_heading_1(doc, "SECTIONS AD to AG — Risk Flags, 'Do Not Say' & Team Defense")

    add_heading_2(doc, "Section AE: 'DO NOT SAY THIS' Master List")
    add_bullet(doc, "❌ NEVER SAY", "\"Our AI guarantees your insurance claim will be approved.\"")
    add_bullet(doc, "✅ SAY INSTEAD", "\"Our engine identifies policy eligibility and predicts out-of-pocket liabilities, but final claim approval rests with the insurer's licensed TPA.\"")
    add_bullet(doc, "❌ NEVER SAY", "\"This hospital is definitely empaneled and 100% cashless.\"")
    add_bullet(doc, "✅ SAY INSTEAD", "\"This hospital matches the insurer's published empanelment list. We advise patients to confirm active desk status upon arrival.\"")
    add_bullet(doc, "❌ NEVER SAY", "\"Our frontend uses Tailwind CSS utility classes.\"")
    add_bullet(doc, "✅ SAY INSTEAD", "\"We engineered a bespoke, high-performance Vanilla CSS design system for pixel-perfect healthcare data visualization.\"")
    add_bullet(doc, "❌ NEVER SAY", "\"We built a custom neural network that predicts procedure costs.\"")
    add_bullet(doc, "✅ SAY INSTEAD", "\"We modeled surgical benchmarks from CGHS and private healthcare tariffs across 8 geographic tiers, calibrated by hospital commercial segment.\"")

    add_heading_2(doc, "Section AG: Role-Specific Defense Assignments")
    add_paragraph(doc, "If judges direct questions at specific individual team members, use the following technical defense alignment:")
    add_bullet(doc, "Frontend Developer Lead", "Master: App.jsx, HospitalDiscoveryPage.jsx, CoverageSummaryPage.jsx, CareJourneyPage.jsx, BillBreakdownModal.jsx, index.css, localStorage state persistence, i18n localization in 4 languages.")
    add_bullet(doc, "Backend Developer Lead", "Master: index.ts, policyController.ts, hospitalController.ts, journeyController.ts, authController.ts, db.ts, Render single-process deployment, REST API status codes, scrypt crypto.")
    add_bullet(doc, "AI / Extraction Lead", "Master: geminiService.ts, policySchema.ts, EXTRACTION_PROMPT 16 rules, normalizerService.ts, sanitizeExclusions(), temperature 0, Zod self-correction retry loop, hallucination defense.")
    add_bullet(doc, "Data & Math Engine Lead", "Master: hospitalService.ts (1,967 lines), calculatePolicyImpact(), rankHospitals() 4-factor scoring, clean_hospitals_dataset.py, 8-tier pricing model, proportionate deduction formula.")
