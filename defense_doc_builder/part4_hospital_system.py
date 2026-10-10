import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from defense_doc_builder.styles import (
    add_heading_1, add_heading_2, add_heading_3, add_paragraph,
    add_bullet, add_callout, add_code_block, add_qa_card, format_table,
    COLOR_PRIMARY, COLOR_SECONDARY, COLOR_DANGER, COLOR_SUCCESS, COLOR_WARNING
)

def build_part4(doc: Document):
    print("   -> Building Part 4: Sections L, M, N, O, P, Q, R, S, T, U, V, W, X...")

    # =========================================================================
    # SECTION L — HOSPITAL / NETWORK LOGIC
    # =========================================================================
    add_heading_1(doc, "SECTION L — Hospital Empanelment & Network Verification Logic")
    add_paragraph(
        doc,
        "This section evaluates how SehatSure establishes hospital network status, matches insurers, avoids false empanelment claims, and handles missing or ambiguous records."
    )

    add_callout(
        doc,
        "🚨 HIGH-PRIORITY ETHICAL & DEFENSE RULE:\n"
        "Never present an unverified hospital as 'Empanelled' or 'Verified Network Hospital'.\n"
        "In server/src/services/networkMatchingService.ts, if a hospital in the dataset has missing or empty insurer information, the engine strictly returns networkStatus: 'unverified' and matchMethod: 'insufficient_data'. The UI displays a warning banner instructing the user to verify tie-ups directly with the hospital TPA desk before admission.",
        title="FALSE EMPANELMENT PREVENTION",
        alert_type="danger"
    )

    add_qa_card(
        doc,
        q_num="L.1",
        question="How does SehatSure verify that a hospital is in an insurer's network? What happens if data is missing?",
        ideal_answer="Network verification is handled authoritatively by getHospitalNetworkStatus() in server/src/services/networkMatchingService.ts. It executes a 3-step check: (1) Exact Normalized Match: Cleans hospital insurers and policy insurer, comparing alphanumeric tokens (e.g. 'hdfc ergo general insurance' === 'hdfc ergo general insurance'); (2) Canonical Alias Matching: If exact match fails, it resolves both against CANONICAL_INSURER_REGISTRY (e.g. matching 'HDFC Health', 'HDFC ERGO', or 'HDFC' to the canonical hdfc_ergo key); (3) Insufficient Data Classification: If a hospital record has an empty insurers list, the engine marks it networkStatus: 'unverified' with matchMethod: 'insufficient_data'. It is never guessed or defaulted to 'verified'.",
        evidence="server/src/services/networkMatchingService.ts lines 229-334; tests/networkMatching.test.ts.",
        followup="What prevents a short token like 'star' from matching a hospital with 'All Star Healthcare'?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="L.2",
        question="Can an unverified hospital ever be marked as cashless eligible in the SehatSure UI?",
        ideal_answer="STRICTLY NO. The frontend in HospitalDiscoveryPage.jsx lines 520-580 and BillBreakdownModal.jsx lines 140-180 checks networkInfo.networkStatus === 'verified'. Only hospitals with 'verified' status receive the green 'Cashless Network Partner' badge and full cashless pre-auth guidance. Unverified facilities receive a yellow warning pill ('Network Status Not Verified') and an explicit banner stating: 'Insurer empanelment records for this hospital are insufficient to confirm network status. Verify tie-up with the hospital insurance desk prior to admission.'",
        evidence="frontend/src/pages/HospitalDiscoveryPage.jsx lines 520-580; server/src/services/hospitalService.ts lines 1630-1636.",
        followup="How does the Care Journey Simulator react if the patient selects an unverified hospital?",
        status_tag="SAFE"
    )

    # =========================================================================
    # SECTION M — SCORING / RANKING ENGINE
    # =========================================================================
    add_heading_1(doc, "SECTION M — Scoring & Ranking Engine Architecture")
    add_paragraph(
        doc,
        "The SehatSure Policy Fit Score is a multi-parameter ranking metric designed to balance financial protection, tariff affordability, clinical relevance, and institutional quality."
    )

    add_heading_2(doc, "M.1 Scoring Formula & Weights")
    add_paragraph(
        doc,
        "The overall SehatSure Policy Fit Score (finalScore) is a weighted linear combination of four sub-scores bounded between 0 and 100:"
    )
    add_bullet(doc, "CoverageFit (50% Weight)", "Measures insurance protection and financial safety. Evaluates claim absorptive ratio (insurerShare / totalCost), room-rent headroom cushion (+4 bonus), sum-insured adequacy, and penalizes non-network status (-35 pts) and proportionate deductions (-15 to -30 pts).")
    add_bullet(doc, "PatientCostFit (25% Weight)", "Measures policy sum-insured-to-hospital-segment alignment and tariff efficiency. Evaluates whether a patient's coverage matches hospital tier (e.g. established vs budget) and applies an efficiency offset (-hospitalVariation * 15) and OOP burden penalty.")
    add_bullet(doc, "HospitalTypeScore (15% Weight)", "Measures institutional trust and empanelment depth. Calculated as 60 + min(35, insurerCount * 3.2), with stature bonuses (+15 for Government teaching facilities, +5 for Established/Premium private networks).")
    add_bullet(doc, "CoPayFit (10% Weight)", "Measures co-payment predictability and clinical capability breadth. Combines base co-pay score (100 for 0% co-pay, 50 for >20% co-pay), clinical department breadth (+1.8 pts per specialty), and specialty name relevance bonus (+10 pts).")

    add_qa_card(
        doc,
        q_num="M.1",
        question="Why does Coverage Fit receive a 50% weight in your scoring model? Why not 25% across all 4 factors?",
        ideal_answer="Because SehatSure is an insurance decision-support platform designed to protect families from catastrophic financial ruin. A hospital with an incredible 5-star rating, luxury suites, and 20 specialties is a financial catastrophe for a family if it is out-of-network and charges ₹12,000/day against a ₹2,500 room cap. In healthcare finance, insurance absorption and out-of-pocket exposure dominate all other considerations. 50% ensures that hospitals that fully honor the patient's insurance without out-of-pocket penalties consistently rise to the top of recommendations.",
        evidence="server/src/services/hospitalService.ts lines 1333-1375; tests/hospitalRanking.test.ts.",
        followup="Can a hospital with 0% coverage ever rank #1 if its rating is 5.0?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="M.2",
        question="Can two hospitals receive the exact same score? How is tie-breaking handled?",
        ideal_answer="While two hospitals can share the same rounded integer finalScore (e.g. 85), hospitalService.ts computes a granular continuous score (granularScore) with one decimal place (e.g. 85.4 vs 84.8). If both share identical granular scores, tie-breaking is strictly resolved by: (1) Verified network status; (2) Specialty name relevance score; (3) Lower estimated patient payable out-of-pocket amount; (4) Higher hospital star rating; (5) Deterministic alphabetical sort by hospital name. This guarantees 100% stable, deterministic ranking without random jitter.",
        evidence="server/src/services/hospitalService.ts lines 1505-1544.",
        followup="What if two hospitals have identical names in the same city?",
        status_tag="SAFE"
    )

    # =========================================================================
    # SECTION N — DATABASE / DATASET QUESTIONS
    # =========================================================================
    add_heading_1(doc, "SECTION N — Database & Dataset Quality Audit")
    add_paragraph(
        doc,
        "This section reviews the source, scale, cleaning, and indexing of the 52,960 hospital records and surgical cost benchmarks."
    )

    add_qa_card(
        doc,
        q_num="N.1",
        question="Where did you get your dataset of 52,000+ hospitals? Can you prove this data is real?",
        ideal_answer="The primary hospital dataset was compiled from public insurer empanelment directories published under IRDAI public disclosure mandates, including ICICI Lombard, Star Health, HDFC ERGO, Niva Bupa, and the Ayushman Bharat PM-JAY national hospital list. Surgical benchmarks are modeled after Central Government Health Scheme (CGHS) package rates and researched private hospital surgical tariffs across 8 geographic tiers. Room tariffs reference audited hospital rate sheets (such as the Apollo Hospital Cost Breakdown guide from FitTour). The exact sources and URLs are fully documented in hospital_dataset_sources_with_costing_engine_updated.pdf.",
        evidence="hospital_dataset_sources_with_costing_engine_updated.pdf lines 1-35; server/cleaning_report.json.",
        followup="How fresh is this empanelment data?",
        status_tag="QUALIFY"
    )

    add_qa_card(
        doc,
        q_num="N.2",
        question="What data cleansing did you perform on the raw hospital dataset? What did you throw away?",
        ideal_answer="The raw dataset contained 54,972 rows with severe OCR errors, concatenated columns, and duplicate addresses. We wrote clean_hospitals_dataset.py, which executed: (1) Removed 1,114 unrecoverable garbage rows (pincode stubs, broken text); (2) Removed 880 duplicate address records by merging their insurer networks; (3) Corrected 9,777 geographic tiers where cities were misclassified (e.g. Chennai, Nashik, Nagpur); (4) Validated 52,978 clean facilities across India. When loaded by hospitalService.ts at server boot, 52,960 valid facilities are indexed; 62 malformed rows lacking valid names/addresses are rejected. A full validation report is generated in server/cleaning_report.json.",
        evidence="server/clean_hospitals_dataset.py lines 1-38; server/cleaning_report.json lines 1-52; server/src/services/hospitalService.ts lines 485-494.",
        followup="How many cities are represented in the cleaned dataset?",
        status_tag="SAFE"
    )

    # =========================================================================
    # SECTION O — SECURITY & PRIVACY QUESTIONS
    # =========================================================================
    add_heading_1(doc, "SECTION O & P — Security & Privacy Architecture")
    add_paragraph(doc, "Health insurance policies contain Protected Health Information (PHI). These questions challenge authentication, data handling, and privacy boundaries:")

    add_qa_card(
        doc,
        q_num="O.1",
        question="How is user authentication implemented? Did you write your own crypto or use a library?",
        ideal_answer="Authentication is implemented in server/src/controllers/authController.ts using Node's native crypto module with enterprise cryptographic standards: (1) Passwords are hashed using crypto.scryptSync(password, salt, 64) with a cryptographically random 16-byte hex salt; (2) Password verification uses crypto.timingSafeEqual() to completely prevent timing attacks; (3) Sessions are managed via 32-byte cryptographically random hex tokens passed via Authorization: Bearer headers; (4) Input validation strictly enforces valid email regex and minimum 6-character passwords.",
        evidence="server/src/controllers/authController.ts lines 6-23, 35-148.",
        followup="Why scrypt instead of bcrypt or Argon2?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="P.1",
        question="What happens to uploaded insurance policies? Are documents stored on disk or sent to external servers?",
        ideal_answer="1. Local Disk Storage: Uploaded policy PDFs are written to server/uploads/ with an unguessable UUID filename (pol_<timestamp>_<uuid6>.pdf). 2. Controlled Access: Files in uploads/ are NOT served statically; access requires GET /api/policy/:id/document, which verifies the policy ID exists in the database. 3. External AI Processing: Text extracted from the PDF is transmitted via encrypted HTTPS TLS 1.3 to the Google Gemini API (Google AI Studio) solely for structured entity extraction. Google does not use API payloads to train foundational models under enterprise API terms. 4. Deletion: When a policy is deleted via DELETE /api/policy/:id, the physical PDF file is unlinked and deleted from disk using fs.unlinkSync().",
        evidence="server/src/controllers/policyController.ts lines 45-48, 260-350.",
        followup="Is SehatSure currently HIPAA or DPDP Act compliant?",
        status_tag="QUALIFY"
    )

    # =========================================================================
    # SECTION Q — FRONTEND ARCHITECTURE
    # =========================================================================
    add_heading_1(doc, "SECTION Q — Frontend Engineering & State Management")
    add_paragraph(doc, "This section evaluates React component hierarchy, state persistence, design system tokens, and accessibility:")

    add_qa_card(
        doc,
        q_num="Q.1",
        question="Why did you use Vanilla CSS instead of Tailwind CSS or a component library like MUI?",
        ideal_answer="We chose pure Vanilla CSS (compiled into frontend/src/index.css, 47 KB) for three key reasons: (1) Maximum Aesthetic Control: Healthcare financial decision support requires bespoke visual hierarchy—custom glassmorphic summary cards, interactive score breakdown dials, and clean bill reconciliation tables—that component libraries make rigid and generic; (2) Zero Runtime CSS Overhead: Vanilla CSS incurs zero JavaScript runtime style evaluation overhead, ensuring instant UI rendering and sub-second page transitions; (3) Clean Dependency Tree: Avoided complex Tailwind PostCSS compilation pipelines, ensuring instant Vite HMR and effortless deployment.",
        evidence="frontend/src/index.css lines 1-2350; frontend/package.json (no Tailwind dependency).",
        followup="README claims Tailwind CSS was used. Why is there a discrepancy between README and package.json?",
        status_tag="CRITICAL"
    )

    add_qa_card(
        doc,
        q_num="Q.2",
        question="How does state persistence work in the frontend? What happens if the user refreshes the page?",
        ideal_answer="In frontend/src/App.jsx lines 23-107, we synchronize active session state to localStorage under the key 'sehatsure_session'. The stored object captures currentView, activePolicy, journeyHospital, journeyProcedure, and journeyRoom. When the user refreshes the page, useState() initializes directly from localStorage. If an active policy exists, the application immediately restores their exact view (Coverage Summary, Hospital Discovery, or Care Journey) without forcing them to re-upload their PDF.",
        evidence="frontend/src/App.jsx lines 23-107.",
        followup="What happens if the data in localStorage becomes corrupted or out of date?",
        status_tag="SAFE"
    )

    # =========================================================================
    # SECTION R — API ARCHITECTURE
    # =========================================================================
    add_heading_1(doc, "SECTION R — REST API Architecture & Endpoints")
    add_paragraph(doc, "Complete audit of all HTTP endpoints exposed by the SehatSure backend:")

    api_headers = ["Method & Route", "Controller Function", "Payload / Query", "Response Status", "Purpose"]
    api_widths = [1.8, 1.4, 1.4, 0.8, 1.6]
    api_rows = [
        ["POST /api/policy/upload", "uploadPolicy", "multipart/form-data (file: PDF)", "200, 415, 422, 500", "Ingests PDF, extracts terms via Gemini, validates Zod, saves policy."],
        ["GET /api/policy/demos", "getDemoPolicies", "None", "200, 500", "Returns list of 4 pre-seeded demo policies."],
        ["POST /api/policy/demo/:key", "createPolicyFromDemo", "URL param :key", "200, 404, 500", "Clones a demo policy into MongoDB for instant demonstration."],
        ["GET /api/policy/:id", "getPolicyById", "URL param :id", "200, 404, 500", "Fetches single policy document by ID."],
        ["PUT /api/policy/:id", "updatePolicy", "JSON partial policy updates", "200, 400, 404, 500", "Validates Tier 1 fields, updates terms, sets confirmedByUser: true."],
        ["GET /api/policy/:id/document", "getPolicyDocument", "URL param :id", "200, 404, 500", "Securely retrieves uploaded PDF file from disk."],
        ["DELETE /api/policy/:id", "deletePolicy", "URL param :id", "200, 404, 500", "Deletes policy from MongoDB, removes file from disk, unlinks user."],
        ["GET /api/hospitals/cities", "getCities", "query ?q=string", "200, 500", "Returns list of indexed cities with hospital counts."],
        ["GET /api/hospitals/taxonomy", "getTaxonomy", "None", "200, 500", "Returns clinical specialties and cascaded procedures."],
        ["POST /api/hospitals/search", "searchHospitals", "JSON: policyId, city, specialty, procedure", "200, 500", "Executes hospital search, cost estimation, ranking, and Policy Fit Score."],
        ["POST /api/hospitals/breakdown", "getHospitalCostBreakdown", "JSON: hospitalName, procedure, roomType", "200, 400, 404, 500", "Returns itemized bill breakdown, policy disallowances, recommendations."],
        ["GET /api/journey/:id", "getJourney", "URL param :id", "200, 404, 500", "Retrieves patient care journey state, alerts, financial snapshot."],
        ["POST /api/journey/:id/event", "processJourneyEvent", "JSON: event, policyId, hospitalName", "200, 400, 500", "Evaluates care journey event, recomputes financial snapshot, emits alerts."],
        ["POST /api/auth/signup", "signup", "JSON: name, email, password, confirmPassword", "201, 400, 409, 500", "Registers new user, creates scrypt hash, issues auth token."],
        ["POST /api/auth/login", "login", "JSON: email, password", "200, 400, 401, 500", "Verifies scrypt password, issues session token."],
        ["GET /api/auth/profile", "getProfile", "Bearer token in Authorization header", "200, 401, 500", "Returns authenticated user profile, saved hospitals, linked policies."],
        ["POST /api/auth/save-hospital", "toggleSaveHospital", "JSON: hospital data", "200, 401, 500", "Bookmarks or unbookmarks hospital for the user."],
        ["GET /api/health", "inline", "None", "200", "Healthcheck endpoint returning service status and timestamp."]
    ]
    tbl_api = doc.add_table(rows=1, cols=5)
    format_table(tbl_api, api_widths, api_headers, api_rows)

    # =========================================================================
    # SECTION S — ERROR / EDGE CASE DEFENSE
    # =========================================================================
    add_heading_1(doc, "SECTION S — Edge Case Attack Round")
    add_paragraph(doc, "Dedicated defense round against edge case scenarios designed to break decision systems:")

    add_qa_card(
        doc,
        q_num="S.1",
        question="EDGE CASE: What happens if an empty, corrupted, or password-protected PDF is uploaded?",
        ideal_answer="Expected & Actual Behavior: In server/src/services/pdfService.ts line 3, pdfParse() throws an exception (e.g. 'Invalid PDF structure' or 'Password required'). The catch block intercepts this error and logs it. geminiService.ts line 155 detects that extractedText is empty and attempts inline base64 transmission. If Gemini also rejects the file, the server catches the exception and returns HTTP 422 with an explicit user-friendly error message: 'Could not parse structured terms from document. Please review and fill in details manually.' The server does NOT crash; the frontend opens manual entry mode.",
        evidence="server/src/services/pdfService.ts lines 3-11; server/src/services/geminiService.ts lines 150-165.",
        followup="Show me the automated test validating this behavior.",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="S.2",
        question="EDGE CASE: What happens if a policy has contradictory clauses (e.g. 'Room rent 1% of SI' on page 3, but 'Single Private Room eligible' on page 14)?",
        ideal_answer="This is common in endorsement riders. Our system resolves contradictions via three mechanisms: (1) Prompt Instruction 4: Orders the model to match specific table schedules over generic prose; (2) Confidence Level Scoring: Ambiguous or conflicting terms are flagged with confidence: 'medium' or 'low'; (3) Coverage Summary Verification: On CoverageSummaryPage.jsx, low-confidence fields are highlighted with amber warning badges and display both conflicting snippets. The user is required to select the authoritative clause during the manual confirmation step before proceeding to search.",
        evidence="server/src/schemas/policySchema.ts lines 93-104; frontend/src/pages/CoverageSummaryPage.jsx lines 340-390.",
        followup="Which clause does the engine pick if the user accepts default values without editing?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="S.3",
        question="EDGE CASE: What happens if the daily room tariff is higher than the entire procedure cost?",
        ideal_answer="This occurs in long-stay medical management (e.g. ICU stay for viral pneumonia). The mathematical engine in calculatePolicyImpact() computes room charges strictly as roomRate * stayDays and procedure charges independently. Proportionate deduction applies allowedRatio = min(1, roomLimitEligiblePerDay / roomRate) only to associated medical expenses (procedure + doctor fees). Room charges themselves are simply capped by roomLimitEligiblePerDay * stayDays; the excess room charges are added to patient payable. No negative numbers or division-by-zero can occur because roomRate is guarded > 0.",
        evidence="server/src/services/hospitalService.ts lines 1155-1203.",
        followup="Can patient payable exceed the total hospital bill?",
        status_tag="SAFE"
    )

    # =========================================================================
    # SECTION T, U, V, W, X — SYSTEM DESIGN & DEFENSE
    # =========================================================================
    add_heading_1(doc, "SECTIONS T to X — System Design, Testing & Technology Choices")

    add_qa_card(
        doc,
        q_num="T.1",
        question="TESTING DEFENSE: Why did 4 of your Vitest test suites time out with 'Hook timed out in 30000ms' during full suite runs?",
        ideal_answer="FINDING DISCLOSED WITH FULL TRANSPARENCY: Vitest runs test files in parallel worker threads by default. 4 test suites (hospitalCleaning, hospitalRanking, networkMatching, specialtyNamePriority) each called beforeAll(async () => await hospitalService.initData()). With multiple threads simultaneously streaming and intern-parsing the 11MB hospitals.csv file from disk, disk I/O contention caused the default 30-second hookTimeout to trip. When run individually (e.g. npx vitest run tests/hospitalRanking.test.ts), all tests pass in under 9 seconds. The fix before demo is setting fileParallelism: false or hookTimeout: 60000 in vitest.config.ts.",
        evidence="server/vitest.config.ts lines 1-8; task-107.log vs task-148.log.",
        followup="What is your total automated test count across the repository?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="U.1",
        question="DEPLOYMENT DEFENSE: How is SehatSure deployed on Render? What happens when memory limits are reached?",
        ideal_answer="SehatSure is deployed as a single Web Service on Render using Node.js 20.18.0. The start command is node --max-old-space-size=450 server/dist/index.js. In Render's 512 MB container, leaving 62 MB for OS buffers and V8 runtime overhead prevents container-level OOM kills. The build command npm run build:render compiles both the TypeScript server (tsc) and React frontend (vite build), allowing Express to host both API and assets on a single dynamic port ($PORT). A dedicated healthcheck route GET /api/health enables zero-downtime health monitoring.",
        evidence="DEPLOY.md lines 1-85; render.yaml lines 1-21; package.json line 16.",
        followup="How long does a cold start take on Render's free tier?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="W.1",
        question="TECHNOLOGY CHOICE: Why MongoDB instead of PostgreSQL or SQLite?",
        ideal_answer="Insurance policy representations are inherently semi-structured and hierarchical: a single policy contains nested arrays of insured persons, polymorphic room limit objects ({ type: 'amount' | 'percent' | 'category', value }), variable sub-limits dictionaries ({ 'Knee Replacement': 150000 }), and arbitrary procedure waiting period mappings. In PostgreSQL, this requires either heavy JSONB columns (negating relational benefits) or complex 8-table relational joins. MongoDB provides native BSON document flexibility, rapid prototyping, and schema enforcement through Mongoose and Zod.",
        evidence="server/src/models/Policy.ts; server/src/types/policy.ts.",
        followup="How do you handle transactional consistency across care journeys?",
        status_tag="SAFE"
    )

    add_qa_card(
        doc,
        q_num="X.1",
        question="ALTERNATIVES: Why not use a vector database with RAG (Retrieval-Augmented Generation) for hospital search?",
        ideal_answer="RAG and vector embeddings are exceptional for semantic search over unstructured clinical notes, but completely inappropriate for mathematical constraint filtering in healthcare finance. Vector distance cannot guarantee that a hospital with ₹4,000 room rent is eliminated when a user has a ₹3,000 cap; vector search produces probabilistic 'close' matches rather than hard mathematical bounds. In healthcare admission, patients need deterministic guarantees: 'Is this hospital empaneled? Yes or No. Does this room exceed my cap? Yes or No.' In-memory B-tree indexes and Maps provide sub-100ms deterministic execution with zero hallucination risk.",
        evidence="server/src/services/hospitalService.ts lines 744-812; README.md lines 128-149.",
        followup="Could embeddings be useful for matching user symptom descriptions to medical specialties?",
        status_tag="SAFE"
    )
