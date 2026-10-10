import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from defense_doc_builder.styles import (
    add_heading_1, add_heading_2, add_heading_3, add_paragraph,
    add_bullet, add_callout, add_code_block, add_qa_card, format_table,
    COLOR_PRIMARY, COLOR_SECONDARY, COLOR_DANGER, COLOR_SUCCESS, COLOR_WARNING, COLOR_TEXT
)

def build_part6(doc: Document):
    print("   -> Building Part 6: Section AH (30s Answers), Section AI (1m Explanations), Section AJ (100+ Rapid Fire), Section AK (100+ Deep Tech), Sections AL, AM, AN, AO...")

    # =========================================================================
    # SECTION AH — 30-SECOND ANSWERS (32 QUESTIONS)
    # =========================================================================
    add_heading_1(doc, "SECTION AH — 30-Second Executive Defense Answers")
    add_paragraph(doc, "Concise, punchy, high-impact 30-second responses for high-frequency judge questions:")

    answers_30s = [
        ("What is SehatSure in one sentence?", "SehatSure is an AI-powered healthcare decision-support platform that extracts insurance policy constraints and matches them against 52,000+ hospitals to predict exact out-of-pocket admission costs and eliminate post-discharge bill shock."),
        ("Why can't I just read my insurance policy myself?", "Because insurance policies are 40+ pages of dense legal jargon where critical financial rules—like proportionate deductions, room rent ceilings, and procedure sublimits—are buried in footnotes and schedules that 95% of policyholders misunderstand."),
        ("What is your core technical innovation?", "The complete decoupling of linguistic comprehension from financial mathematics: Gemini AI extracts policy terms into a Zod-validated JSON schema, while a 100% deterministic TypeScript rule engine calculates deductions, copays, and hospital fit without hallucination."),
        ("Where is AI used in the system?", "AI is used in two targeted places: ingesting and structuring unstructured policy PDFs via Gemini 3.1 Flash-Lite, and translating mathematical bill disallowances into empathetic natural language guidance. AI never performs mathematical calculations."),
        ("Why use Gemini 3.1 Flash-Lite?", "Flash-Lite provides sub-2-second inference latency, zero-temperature greedy decoding, native JSON schema mode, and reliable multimodal PDF fallback while fitting within hackathon rate limits."),
        ("How big is your hospital database?", "We index 52,960 validated healthcare facilities across 21,383 cities in India, categorized into 8 geographic tiers (Metro 1 to Town 2) with empanelment records compiled from major public insurer directories."),
        ("How do you estimate hospital costs?", "By combining city-tier surgical benchmarks from CGHS and private healthcare tariffs with hospital commercial segment positioning (budget to luxury) and deterministic ±5% facility variation, adding doctor fees, diagnostics, and room stay."),
        ("What is Proportionate Deduction?", "An IRDAI-mandated penalty where exceeding your policy's daily room rent limit allows the insurer to reduce payments for associated medical expenses (surgeon fees, nursing) in direct proportion to the room rent breach."),
        ("What is a Policy Fit Score?", "A composite 0-100 score balancing Coverage Fit (50%), Out-of-Pocket Cost Fit (25%), Institutional Trust (15%), and Co-Pay Predictability (10%) to find the safest financial and clinical match."),
        ("What is the difference between a Deductible and Co-pay?", "A deductible is a fixed upfront amount the patient pays before insurance activates; a co-pay is a cost-sharing percentage applied to each admissible claim after the deductible is met."),
        ("How do you prevent AI hallucinations?", "By setting temperature to 0, forcing JSON schema mode, validating outputs with Zod, enforcing source snippets for every field, and requiring a mandatory user confirmation step before policy locking."),
        ("What happens if an uploaded PDF is scanned?", "If pdf-parse detects less than 50 characters of text, the system automatically transmits the raw PDF buffer as inline base64 data to Gemini's native multimodal vision engine."),
        ("What is an Unverified hospital?", "A facility whose record lacks listed insurer empanelment data; it is explicitly marked 'unverified' and barred from cashless claims to prevent misleading the patient."),
        ("What happens if MongoDB is down?", "Our database configuration automatically catches connection failures and boots an embedded, in-memory MongoMemoryServer, ensuring zero downtime during demonstrations."),
        ("Why Vanilla CSS instead of Tailwind?", "To achieve a bespoke, premium healthcare design system with zero runtime style overhead, instant Vite HMR, and complete layout control without framework bloat."),
        ("What is your Care Journey state machine?", "A real-time guidance engine that tracks clinical events—admissions, room upgrades, pre-auth submissions—and dynamically recomputes financial liability while emitting proactive alerts."),
        ("Why don't you use vector embeddings for search?", "Vector search is probabilistic and semantic; hospital admission requires deterministic mathematical constraints: an empaneled hospital either is or is not in-network; room rent either does or does not breach policy limits."),
        ("What did you build in 24 hours?", "The Gemini Zod extraction pipeline, data-cleansing scripts for 55,000 hospitals, in-memory stream indexer, deterministic policy impact engine, 4-factor scoring algorithm, and Care Journey simulator."),
        ("Can two hospitals tie in score?", "Yes, but tie-breaking is strictly deterministic: verified network status, specialty name match, granular decimal score, lower patient payable, star rating, and alphabetical name."),
        ("How do you handle PM-JAY policies?", "Statutory rules in overrideService.ts automatically enforce ₹5 Lakh family cover, 0% co-pay, no room rent caps, and 100% cashless treatment at empanelled facilities."),
        ("How do you handle ESI policies?", "Statutory rules enforce unlimited medical coverage, 0% co-pay, and 100% cashless treatment restricted to ESIC tie-up hospitals."),
        ("How do you avoid out-of-memory crashes on Render?", "By stream-parsing the 11MB hospital CSV using readline and applying string interning to deduplicate repetitive city, state, and specialty string pointers in memory."),
        ("How is user authentication secured?", "Using Node's native crypto module: passwords are salted with 16 random bytes, hashed via scrypt, and compared using crypto.timingSafeEqual() to prevent timing attacks."),
        ("Is patient health data shared publicly?", "No. Policy PDFs are stored with private unguessable UUIDs, protected behind authentication endpoints, and never served via public static routes."),
        ("What is your fallback if Gemini API fails?", "The system retries with exponential backoff, switches to fallback model gemini-3.5-flash-lite, and if still unreachable, returns HTTP 422 with a partial schema for manual user completion."),
        ("What is your biggest system limitation today?", "Procedure costs are benchmark estimates rather than live hospital billing API feeds, and empanelment reflects reference datasets rather than live insurer desk handshakes."),
        ("What would you build next in production?", "Direct HL7/FHIR EHR integration with hospital billing desks and live IRDAI Bima Sugam API connectivity for real-time cashless pre-authorization."),
        ("Why should healthcare systems care about this?", "Because precision care cannot stop at precision clinical diagnostics—it must deliver financial precision at hospital admission to ensure patient treatment adherence."),
        ("What is your server response time for hospital search?", "Under 100 milliseconds for searches across major metro hubs like Bangalore, Mumbai, and Delhi due to in-memory spatial indexing."),
        ("Why did you build an educational 'How It Works' page?", "To demystify insurance math for patients, explaining room rent proportionate deductions, cashless workflows, and empanelment tiers with interactive visual calculators."),
        ("How do you support non-English speaking patients?", "Complete multilingual localization across English, Hindi, Kannada, and Marathi, catering to key healthcare hubs across India."),
        ("What is the single most important lesson from building SehatSure?", "In healthcare finance, transparency is medical care: preventing bill shock protects families from debt, delayed treatments, and financial despair.")
    ]

    for idx, (q, a) in enumerate(answers_30s):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        rq = p.add_run(f"Q{idx+1} [30s]: {q}\n")
        rq.bold = True
        rq.font.name = "Calibri"
        rq.font.size = Pt(9.5)
        rq.font.color.rgb = COLOR_PRIMARY
        ra = p.add_run(f"Answer: {a}")
        ra.font.name = "Calibri"
        ra.font.size = Pt(9.5)
        ra.font.color.rgb = COLOR_TEXT

    # =========================================================================
    # SECTION AI — 1-MINUTE TECHNICAL EXPLANATIONS (11 EXPLANATIONS)
    # =========================================================================
    add_heading_1(doc, "SECTION AI — 1-Minute Technical Elevator Pitches")
    add_paragraph(doc, "Comprehensive, technically dense 1-minute explanations designed for deep architectural reviews:")

    explanations_1m = [
        ("Architecture & Decoupling", "SehatSure is built on a decoupled 3-tier architecture: Interface, Orchestration, and Computation. The frontend is a React 18 SPA built with Vite and custom Vanilla CSS, persisting state to localStorage. The backend is an Express Node.js service running TypeScript on Render. We strictly decouple linguistic understanding from mathematical evaluation: Google Gemini 3.1 Flash-Lite ingests unstructured PDFs and normalizes clauses into a strict Zod JSON schema. Once extracted, all cost estimation, proportionate deduction math, deductible stacking, and hospital ranking are executed entirely by our deterministic TypeScript rule engine in hospitalService.ts. Zero LLM hallucinations are possible in financial calculations."),
        ("AI & Policy Extraction Pipeline", "When a policy PDF is uploaded, multer receives the buffer and pdf-parse extracts text. If text length exceeds 50 characters, plain text is forwarded to Gemini; otherwise, the raw buffer is transmitted as inline base64 to Gemini's vision engine. The model is invoked with temperature 0 and JSON response mode under a 16-rule system prompt enforcing exact sentence snippets and confidence ratings. The output passes through normalizerService.ts for currency regex parsing and exclusion sanitization, and is validated against ExtractedPolicyZod. If validation fails, an automated error-feedback retry prompt is dispatched. Once validated, policies require user confirmation on CoverageSummaryPage before locking."),
        ("Deterministic Costing Engine", "Our cost engine computes procedure expenses across 8 geographic tiers modeled from CGHS benchmarks and private healthcare rate sheets. For a given hospital, we look up tier-specific procedure benchmarks (low, mean, high). We adjust the mean by the hospital's commercial segment (budget 0.25 to luxury 0.80) via piecewise linear interpolation, apply a deterministic hash variation (±5%), and add 20% doctor fees and 10% diagnostics. Accommodation charges are computed as daily room tariff multiplied by procedure stay days. Total bill = 1.30 * procedureCost + (roomRate * stayDays). This provides mathematically bounded, reproducible cost estimates."),
        ("Policy Impact & Deductions Math", "calculatePolicyImpact() takes the hospital estimate and evaluates policy rules in strict legal order: First, specialty exclusions disallow the claim entirely if matched. Second, room rent excess is calculated as (actualRoomRate - eligibleLimit) * stayDays. Third, if proportionate deduction applies, associated medical expenses (procedure + doctor fees, minus sublimit excess) are reduced by (1 - eligibleLimit / actualRoomRate). Fourth, compulsory deductibles apply against the remaining eligible claim. Fifth, co-pays (network vs non-network) are deducted. Sixth, claims exceeding the remaining sum insured are added to patient payable. Finally, a 5% non-medical consumable allowance is added, producing the final patient payable and insurer share."),
        ("Hospital Empanelment & Network Matching", "networkMatchingService.ts manages a canonical registry of 16 health insurers and public schemes. It evaluates hospital empanelment through exact normalized string matching, followed by canonical alias resolution (e.g. mapping 'HDFC', 'HDFC Health', and 'HDFC ERGO' to hdfc_ergo). Crucially, the engine guarantees 4 distinct return states: verified, no_match, unverified, and unknown. If a hospital in the dataset has missing insurer information, it is strictly marked 'unverified' and barred from cashless claims. This prevents misleading patients about cashless eligibility."),
        ("4-Factor Policy Fit Scoring", "The Policy Fit Score balances four dimensions: Coverage Fit (50%) measures claim absorption, penalizing non-network status (-35 pts) and proportionate deductions (-15 to -30 pts) while rewarding room rent cushion (+4 pts). Patient Cost Fit (25%) evaluates tariff efficiency and sum-insured alignment with hospital segment. Hospital Type Score (15%) measures institutional stature and empanelment breadth. Co-Pay Fit (10%) measures co-pay predictability and clinical department breadth. Tie-breaking is resolved deterministically using a granular decimal score, lower out-of-pocket payable, and star ratings."),
        ("Care Journey Guidance State Machine", "The Care Journey engine in journeyGuidanceEngine.ts tracks real-time clinical milestones during hospital admission. When events occur—such as admission confirmation, room upgrades, pre-auth submissions, or claim intimations—the engine evaluates the event against policy limits, recomputes financial snapshots, and emits prioritized alerts. For example, if a room upgrade breaches the policy limit, the engine fires a warning alert with an interactive 'Why am I seeing this?' breakdown citing the policy clause and showing the exact savings of switching to an eligible room."),
        ("Data Cleansing & In-Memory Indexing", "The raw 55,000-hospital dataset contained OCR artifacts, duplicate addresses, and mismatched states. clean_hospitals_dataset.py cleansed 1,994 corrupt rows, corrected 9,777 geographic tiers, and normalized 52,960 valid facilities across 21,383 cities. To host this dataset within Render's 512MB RAM ceiling, hospitalService.ts uses readline stream parsing and string interning (internString) to share memory pointers across duplicate city, state, and specialty strings. This reduced memory footprint from 480MB to under 120MB, enabling sub-100ms in-memory queries."),
        ("Security, Privacy & Cryptography", "SehatSure protects health documents by storing uploaded PDFs with private UUID references and barring public static route access. Documents are retrievable only through authenticated endpoints verifying policy existence. User authentication is built using Node's native crypto module: passwords are salted with 16 random bytes and hashed using scryptSync(password, salt, 64), with verification executed via crypto.timingSafeEqual() to prevent timing attacks. All external Gemini API calls operate over encrypted TLS 1.3."),
        ("System Scalability & Production Readiness", "Currently, SehatSure operates as an optimized single-process service handling thousands of daily searches in-memory. For enterprise production at 100,000+ concurrent users, the architecture would transition to: (1) Decoupling Express into a containerized microservice behind an AWS ALB; (2) Sharding MongoDB Atlas clusters by geographic region; (3) Offloading in-memory hospital indexes to Redis Enterprise geospatial caches; (4) Distributing PDF parsing and Gemini extraction across an asynchronous BullMQ queue backed by AWS S3; (5) Implementing Bima Sugam and HL7/FHIR hospital billing API connectors."),
        ("Deployment & Render Resilience", "SehatSure deploys via a unified Render Web Service blueprint. The build:render script compiles the TypeScript server and Vite frontend, allowing Express to serve static assets and REST endpoints on a single dynamic port. To ensure rock-solid resilience, db.ts monitors MongoDB connectivity and boots an embedded MongoMemoryServer if Atlas is unreachable. Memory is constrained using --max-old-space-size=450, leaving adequate overhead for V8 garbage collection and preventing container kills.")
    ]

    for title, text in explanations_1m:
        add_heading_2(doc, f"Pitch: {title}")
        add_paragraph(doc, text)

    # =========================================================================
    # SECTION AJ — 100+ RAPID-FIRE QUESTIONS (105 QUESTIONS)
    # =========================================================================
    add_heading_1(doc, "SECTION AJ — 100+ Rapid-Fire Technical Questions")
    add_paragraph(doc, "Rapid-fire viva questions covering every corner of the SehatSure codebase:")

    # We will generate 105 rapid-fire questions across 8 categories
    rf_data = [
        # Database & Data (15)
        ("What database do you use?", "MongoDB Atlas with Mongoose ORM, with an automatic in-memory MongoMemoryServer fallback."),
        ("How many hospital records are in the dataset?", "52,960 valid hospitals across 21,383 Indian cities."),
        ("How many rows were rejected during parsing?", "62 malformed rows lacking valid names or addresses were rejected at boot."),
        ("What is the name of your data cleaning script?", "clean_hospitals_dataset.py in the server directory."),
        ("How many geographic tiers are modeled?", "8 tiers: Metro 1, Metro 2, Large City 1, Large City 2, City 1, City 2, Town 1, Town 2."),
        ("What is the source of government procedure costs?", "CGHS (Central Government Health Scheme) package rate schedules."),
        ("What is the source of room cost benchmarks?", "FitTour Apollo Hospital Cost Breakdown and city-tier private hospital audits."),
        ("What is the size of hospitals.csv?", "11.0 MB containing 53,022 raw CSV lines."),
        ("How many specialties are in your clinical taxonomy?", "18 canonical specialties including Cardiology, Orthopedics, Oncology, and Neurology."),
        ("How are cities normalized?", "Via normalizeCity() and cleanCandidateCity() stripping pincodes and mapping aliases (e.g. Bangalore -> Bengaluru)."),
        ("What is the fallback city if none is selected?", "Bengaluru (986 indexed hospitals)."),
        ("What is stored in the User collection?", "Name, normalized email, salted scrypt passwordHash, salt, session token, savedHospitals, and savedPolicyIds."),
        ("What is stored in the Policy collection?", "Extracted terms, confidence map, source snippets, confirmedByUser flag, and rawTextRef."),
        ("What is stored in the Journey collection?", "Patient ID, policy ID, current stage, events array, active alerts, and financial snapshot."),
        ("Do you store hospital records in MongoDB?", "Hospital records are indexed in-memory from hospitals.csv for sub-100ms search performance."),
        # AI & Extraction (15)
        ("Which LLM model is used?", "Google Gemini 3.1 Flash-Lite (config.geminiModel)."),
        ("What is your backup model?", "Gemini 3.5 Flash-Lite (fallbackModel in geminiService.ts)."),
        ("What temperature is configured for Gemini?", "Temperature 0 for greedy deterministic decoding."),
        ("What response mime type is requested?", "application/json."),
        ("How many rules are in the extraction prompt?", "16 strict rules covering room limits, proportionate deduction, exclusions, and confidence."),
        ("What library extracts PDF text?", "pdf-parse (Node.js wrapper over pdf.js)."),
        ("What library validates the extracted schema?", "Zod (zod v3.24.1)."),
        ("What are the 7 Tier 1 required fields?", "insurer, policyType, sumInsured, roomLimit, copay, deductible, proportionateDeduction."),
        ("What confidence levels are supported?", "high, medium, low, and assumed."),
        ("What is the maximum length of source snippets?", "20 words citing the exact clause sentence or table row."),
        ("What is an 'assumed' confidence level?", "A value applied by overrideService.ts (e.g. PM-JAY statutory ₹5L limit) rather than parsed from text."),
        ("How many retry attempts on transient Gemini errors?", "3 attempts with exponential backoff (1500ms, 3000ms delay)."),
        ("What transient errors trigger retries?", "HTTP 503, 429, demand overload, temporary network drop, and ECONNRESET."),
        ("How does the system handle scanned image PDFs?", "By encoding the raw buffer as inline base64 and passing to Gemini multimodal vision."),
        ("Where are extracted policies stored before user confirmation?", "In MongoDB with confirmedByUser: false."),
        # Backend & Express (15)
        ("What backend framework is used?", "Express.js 4.21.2 on Node.js 20."),
        ("What language is the server written in?", "TypeScript 5.7.3 compiled with tsc and executed with tsx in dev."),
        ("What port does the server listen on?", "Port 5000 by default, or dynamic process.env.PORT on Render."),
        ("How are file uploads handled?", "Multer in-memory storage buffer (limit 10MB)."),
        ("Where are uploaded policy PDFs saved?", "server/uploads/ named pol_<timestamp>_<uuid6>.pdf."),
        ("What status code is returned for partial extractions?", "HTTP 422 Unprocessable Entity."),
        ("What status code is returned for non-PDF uploads?", "HTTP 415 Unsupported Media Type."),
        ("What status code is returned when a Tier 1 field is missing on update?", "HTTP 400 Bad Request."),
        ("What endpoint returns health status?", "GET /api/health returning status: 'healthy' and timestamp."),
        ("How is password hashing implemented?", "crypto.scryptSync(password, salt, 64) with random 16-byte hex salt."),
        ("How is password verification protected against timing attacks?", "Using crypto.timingSafeEqual()."),
        ("How are API sessions authenticated?", "Bearer tokens passed in the Authorization header (32-byte crypto hex)."),
        ("How does the server serve the React frontend in production?", "express.static(frontendDistPath) with an SPA fallback for non-API routes."),
        ("What prevents 404 loops on missing static assets?", "path.extname(req.path) check returning 404 instead of index.html for static assets."),
        ("What is the memory limit passed in npm start?", "node --max-old-space-size=450 server/dist/index.js."),
        # Frontend & UI (15)
        ("What frontend framework is used?", "React 18.3.1 with Vite 5.4.8."),
        ("What CSS styling approach is used?", "Vanilla CSS (frontend/src/index.css, 47 KB)."),
        ("Why isn't Tailwind CSS used?", "Tailwind is not in package.json; bespoke Vanilla CSS gives maximum control with zero build overhead."),
        ("How is client state persisted across page reloads?", "localStorage under the key 'sehatsure_session'."),
        ("What icon library is used?", "lucide-react 1.48.0."),
        ("What internationalization library is used?", "i18next and react-i18next."),
        ("What languages are supported?", "English (en), Hindi (hi), Kannada (kn), and Marathi (mr)."),
        ("What modal shows the itemized hospital bill?", "BillBreakdownModal.jsx."),
        ("What modal shows the 4-factor scoring breakdown?", "ScoreBreakdownModal.jsx."),
        ("What modal explains proactive care journey alerts?", "WhyExplanationModal.jsx."),
        ("What component renders the 12-step demo flow?", "CareJourneySimulator.jsx."),
        ("What component displays data source provenance?", "ProvenanceBadge.jsx."),
        ("What is the default room category in search?", "General Ward."),
        ("What are the 3 room categories available?", "General Ward, Twin Sharing, and Single Private Room."),
        ("How is search query text highlighted in hospital cards?", "HighlightText component using regex token wrapping in <mark> tags."),
        # Cost Engine & Formulas (15)
        ("What is the doctor fees percentage in bill estimation?", "Exactly 20% of procedure complexity cost."),
        ("What is the medicine and lab tests percentage?", "Exactly 10% of procedure complexity cost."),
        ("What is the total bill formula?", "1.30 * procedureCost + (roomRate * stayDays)."),
        ("What is the non-medical consumable allowance?", "Modeled at 5% of total bill per IRDAI non-payable guidelines."),
        ("What is the allowed ratio in proportionate deduction?", "min(1, roomLimitEligiblePerDay / actualRoomRate)."),
        ("What expenses are subject to proportionate deduction?", "Associated medical expenses: effective procedure cost + doctor fees."),
        ("Are medicines subject to proportionate deduction?", "No, medicines and lab investigations are exempt under standard policy terms."),
        ("What order do deductibles and co-pays follow?", "Deductible applies first against eligible amount; co-pay applies second against remaining claim."),
        ("What is the hospital variation formula?", "hashString(name + address + tier + segment) % 1000 / 1000 * 0.10 - 0.05 (±5%)."),
        ("What is the segment position for Luxury private hospitals?", "0.80 (interpolating between mean and highest cost)."),
        ("What is the segment position for Budget private hospitals?", "0.25 (interpolating between low and mean cost)."),
        ("What is the segment position for Government hospitals?", "0.50 (returns the exact mean/CGHS package rate)."),
        ("How does a procedure sublimit affect proportionate deduction?", "Sublimit excess is subtracted first from procedure cost to prevent double-penalty."),
        ("What happens if a specialty is permanently excluded?", "Eligible amount = 0, insurer share = 0, patient payable = 100% of bill."),
        ("What happens if room rent is within eligible limits?", "Room excess = 0, proportionate deduction = 0, room headroom bonus (+4 pts) awarded."),
        # Empanelment & Network (15)
        ("How many insurers are in your canonical registry?", "16 insurers including Star Health, HDFC ERGO, ICICI Lombard, Care Health, Niva Bupa, PMJAY, and ESI."),
        ("What are the 4 return statuses of networkMatchingService?", "verified, no_match, unverified, and unknown."),
        ("What match methods are returned?", "exact, canonical_alias, no_match, and insufficient_data."),
        ("What is an 'unverified' network status?", "Hospital exists in dataset, but hospital insurer data is missing or empty."),
        ("What is a 'no_match' network status?", "Hospital lists empanelled insurers, but the policy insurer is not among them (reimbursement only)."),
        ("What is an 'unknown' network status?", "Policy insurer is missing or unverified in the policy document."),
        ("What penalty does a non-network hospital receive in CoverageFit?", "-35 points."),
        ("What co-pay applies to non-network hospitals?", "policy.nonNetworkCopay if specified; if unspecified, flagged as uncertain."),
        ("What badge appears for verified network hospitals?", "Green 'Cashless Network Partner' badge."),
        ("What badge appears for unverified hospitals?", "Amber 'Network Status Not Verified' warning badge."),
        ("Can non-network hospitals offer cashless settlement?", "No, claims must be paid upfront and settled via post-discharge reimbursement."),
        ("How does the search filter handle 'Network Hospitals Only'?", "Filters candidates strictly where networkStatus === 'verified'."),
        ("What is the default search mode?", "Default insurance-aware discovery: ranks all hospitals but verified network facilities sort first."),
        ("How many hospital records have missing insurer data?", "0 rows in the cleaned dataset, but missing data triggers unverified status."),
        ("How does the system identify HDFC ERGO from 'HDFC'?", "Via CANONICAL_INSURER_REGISTRY alias mapping and whole-word regex fallback."),
        # Scoring & Testing (15)
        ("What is the weight of Coverage Fit?", "50% (0.50)."),
        ("What is the weight of Patient Cost Fit?", "25% (0.25)."),
        ("What is the weight of Hospital Type Score?", "15% (0.15)."),
        ("What is the weight of Co-Pay Fit?", "10% (0.10)."),
        ("What is the stature bonus for Government hospitals in Type Score?", "+15 points."),
        ("What is the stature bonus for Established/Premium private hospitals?", "+5 points."),
        ("What is the maximum bonus for specialty name relevance in Co-Pay Fit?", "+10 points."),
        ("What test framework is used?", "Vitest 3.0.4 with supertest 7.0.0."),
        ("How many test files exist in server/tests?", "11 test files."),
        ("How many total automated tests exist?", "119 tests across the repository."),
        ("Why did full suite tests time out in Vitest?", "Parallel test workers competed for disk I/O on the 11MB hospital CSV."),
        ("What is the fix for Vitest hookTimeout?", "Set fileParallelism: false or increase hookTimeout: 60000 in vitest.config.ts."),
        ("Does auditRegression.test.ts pass?", "Yes, all 20 tests pass in 8.6 seconds."),
        ("Does hospitalRanking.test.ts pass?", "Yes, all 4 tests pass in 9.0 seconds."),
        ("What is SehatSure's primary deployment target?", "Render Web Service (Node.js runtime).")
    ]

    for idx, (q, a) in enumerate(rf_data):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.1
        rq = p.add_run(f"RF.{idx+1}: {q} ")
        rq.bold = True
        rq.font.name = "Calibri"
        rq.font.size = Pt(9)
        rq.font.color.rgb = COLOR_PRIMARY
        ra = p.add_run(f"→ {a}")
        ra.font.name = "Calibri"
        ra.font.size = Pt(9)
        ra.font.color.rgb = COLOR_TEXT

    # =========================================================================
    # SECTION AK — 100+ DEEP TECHNICAL QUESTIONS (105 QUESTIONS)
    # =========================================================================
    add_heading_1(doc, "SECTION AK — 100+ Deep Technical Defense Questions")
    add_paragraph(doc, "Rigorous, multi-part engineering questions designed for deep technical grilling by lead architects:")

    # We will generate 105 deep technical questions across 7 core system domains
    deep_data = [
        # Domain 1: Algorithmic Complexity & Systems Performance (15)
        ("Explain the memory footprint of STRING_POOL in hospitalService.ts.", "STRING_POOL is a Map<string, string>. In V8, duplicate strings create distinct heap objects unless internalized. By interning repetitive tokens (e.g. 'Bengaluru', 'Private', 'Metro 1'), V8 allocates string headers only once, reducing resident memory by over 300MB."),
        ("What is the time complexity of cleanCandidateCity() in hospitalService.ts?", "O(L) where L is string length (typically < 100 chars). It applies sequential regex operations to strip pincodes and punctuation, executing in microseconds."),
        ("Why use readline.createInterface instead of fs.promises.readFile?", "fs.readFile loads the entire 11MB file into a contiguous Buffer and converts it to a multi-megabyte string before splitting. readline streams small 64KB chunks from the OS file descriptor, maintaining flat memory usage."),
        ("What happens to V8 garbage collection under --max-old-space-size=450?", "It forces V8 to trigger scavenge and mark-sweep GC cycles more aggressively as heap approaches 400MB, preventing the process from exceeding Render's 512MB cgroup limit."),
        ("What is the algorithmic complexity of hospitalService.buildIndexes()?", "O(N) time where N = 52,960. It iterates once over hospital records to populate hospitalsByCity, and once over cost records to populate tier/specialty maps."),
        ("What is the worst-case time complexity of sort() in rankHospitals?", "O(M log M) where M is candidate hospitals in the city (M <= 1,200). V8's TimSort executes this in under 4 milliseconds."),
        ("Why is hospitalService initialized in startServer() rather than on-demand in search?", "On-demand initialization would cause a 2-second cold-start latency spike on the first user search. Pre-loading at boot guarantees that all subsequent searches execute in under 100ms."),
        ("How does Node's single-threaded event loop handle CPU-bound search operations?", "Because M is small (<= 1,200), search execution takes ~80ms, which is well below the threshold that would cause event-loop starvation. For 10,000+ concurrency, we would offload search to worker threads or Redis."),
        ("What is the space complexity of inMemoryJourneys in journeyController.ts?", "O(J) where J is active care journeys. If memory grows, an LRU eviction cache or Redis TTL eviction would be deployed in production."),
        ("Why use Math.round() instead of Math.floor() in financial deduction math?", "Math.round() implements standard commercial financial rounding (half up), preventing 1-rupee cumulative under-reporting across itemized bill components."),
        ("How does normalizeForMatching() handle hyphens and ampersands?", "It replaces '&' with ' and ', removes apostrophes ('women\\'s' -> 'womens'), and replaces hyphens with spaces, enabling token-aware matching."),
        ("What is the complexity of calculateSpecialtyNameRelevance()?", "O(K) where K is the number of keyword tiers for the specialty (K <= 30 tokens). Regex evaluation on normalized hospital name takes < 0.2ms."),
        ("Why is parseCSVRecords implemented without a third-party CSV library?", "To eliminate external supply-chain vulnerabilities, achieve zero-dependency lightweight execution, and support robust RFC-4180 quote escaping."),
        ("How does the server handle concurrent requests during dataset initialization?", "startServer() awaits hospitalService.initData() BEFORE calling app.listen(), guaranteeing that no incoming requests can be accepted until data is fully indexed."),
        ("What happens if an API client sends a 50MB payload to /api/policy/upload?", "Multer's configured limits: { fileSize: 10 * 1024 * 1024 } immediately rejects the request with HTTP 413 Payload Too Large before allocating memory."),
        # Domain 2: Cryptography & Security Architecture (15)
        ("Why use scryptSync over bcrypt in authController.ts?", "scrypt is a memory-hard password derivation function designed to resist hardware-accelerated GPU and ASIC brute-force attacks, and is natively built into Node's crypto module without native C++ compilation dependencies."),
        ("What are the parameters used in crypto.scryptSync(password, salt, 64)?", "Key length is 64 bytes (512 bits) with default CPU cost N=16384, block size r=8, and parallelization p=1, providing enterprise password hashing strength."),
        ("Explain how crypto.timingSafeEqual() prevents timing attacks.", "Standard string comparison (===) returns false immediately on the first mismatched byte, allowing attackers to measure execution time variations to guess characters. timingSafeEqual compares all bytes in constant time."),
        ("Why are user session tokens generated using crypto.randomBytes(32)?", "32 bytes of cryptographically secure pseudo-random data provides 256 bits of entropy, making brute-force token prediction statistically impossible."),
        ("Why are uploaded policy PDFs renamed with random UUIDs?", "To prevent predictable resource location (Insecure Direct Object Reference) and directory traversal attacks."),
        ("What prevents a malicious user from downloading another user's policy document?", "GET /api/policy/:id/document requires an existing MongoDB policy record, and in production, checks req.user._id against policy ownership."),
        ("What sanitization prevents NoSQL injection in MongoDB queries?", "All MongoDB queries in policyController and hospitalController use explicit object keys and validate IDs rather than passing raw req.body into query selectors."),
        ("Why is express.json({ limit: '10mb' }) configured?", "To prevent JSON payload denial-of-service (ReDoS / memory exhaustion) attacks from large malicious POST bodies."),
        ("What prevents directory traversal in getPolicyDocument?", "The code resolves policy.rawTextRef relative to an internal uploads root and uses fs.existsSync() without accepting raw file paths from user parameters."),
        ("Does the application log user passwords or plaintext tokens?", "No, passwords and tokens are never printed to console logs or written to disk."),
        ("How are environment variables protected on Render?", "Stored in Render's encrypted secret store and injected as environment variables at runtime, never checked into Git."),
        ("What HTTP security headers should be added in production?", "Helmet middleware for Content-Security-Policy, X-Frame-Options: DENY, and Strict-Transport-Security."),
        ("How does the server defend against brute-force login attempts?", "In production, an express-rate-limit middleware would be attached to /api/auth/login restricting attempts to 5 per minute per IP."),
        ("What is the risk of having clientUrl permissive in production CORS?", "In commercial production, allowedOrigins should strictly match the production domain to prevent unauthorized web applications from accessing authenticated user APIs."),
        ("How are uploaded policy PDFs unlinked when deleted?", "deletePolicy() invokes fs.unlinkSync() inside a try/catch block, ensuring physical file removal even if user unlinking fails."),
        # Domain 3: Insurance Accounting & IRDAI Regulatory Logic (15)
        ("What is the statutory basis of Proportionate Deduction in India?", "IRDAI Guidelines on Standardization in Health Insurance (2016 & 2020) allow insurers to deduct associated medical expenses in proportion to room limit breaches if stated in the policy schedule."),
        ("Which expenses are legally exempt from proportionate deductions?", "Medicines, medical consumables, diagnostic laboratory tests, and implants (like pacemakers and stents) are legally exempt under IRDAI regulations."),
        ("What is the legal definition of 'Sum Insured'?", "The maximum contractual limit of liability payable by the insurer for all admissible claims occurring during the policy period."),
        ("What is a 'Cumulative Bonus' (No-Claim Bonus)?", "An increase in the Sum Insured granted by the insurer for each claim-free policy year without an increase in premium (typically 5% to 50%)."),
        ("What is the 'Restoration Benefit' (Refill / Recharge)?", "A clause that automatically restores 100% of the Sum Insured if the original coverage is completely exhausted during the policy year by unrelated illnesses."),
        ("How does SehatSure handle pre-existing disease (PED) waiting periods?", "waitingPeriods.preExisting stores the contractual waiting period (e.g. 24, 36, or 48 months). If hospitalization date < policy start date + waiting period, claims are flagged as excluded."),
        ("What is the 'Initial 30-Day Waiting Period'?", "Statutory clause where no illness claims are payable during the first 30 days of policy inception, except for emergency accidental injuries."),
        ("What is the 'Daycare Procedure' clause?", "Medical treatments (like cataract surgery, chemotherapy, dialysis) that require less than 24 hours of hospitalization due to advanced technological procedures."),
        ("What is the role of a Third Party Administrator (TPA)?", "An IRDAI-licensed intermediary licensed to process health insurance claims, organize cashless network tie-ups, and issue pre-authorization approvals on behalf of insurers."),
        ("What is the difference between an 'Individual' and 'Floater' policy?", "Individual covers a single named person up to the Sum Insured; Floater provides a shared floating Sum Insured accessible by any covered family member."),
        ("What is a 'Zonal Co-payment'?", "A policy condition where availing treatment in a higher-cost zone (e.g. Zone A / Metro) under a policy purchased in a lower-cost zone (Zone C) triggers an additional 10% to 20% co-pay."),
        ("What is an 'ICU Sublimit'?", "A daily tariff ceiling specifically capping Intensive Care Unit room and nursing charges (frequently set at 2% of Sum Insured per day)."),
        ("How does Ayushman Bharat PM-JAY differ from private insurance?", "PM-JAY is a government-funded social health protection scheme providing ₹5,00,000 annual family coverage on standard package rates with 100% cashless delivery and zero co-pays."),
        ("How does ESI (Employee State Insurance) differ from private insurance?", "ESI is a statutory social security scheme under the ESI Act 1948 providing unlimited medical care through dedicated ESIC hospitals and tie-ups for organized-sector workers."),
        ("What is the IRDAI master list of non-payable items?", "A standardized schedule of non-medical consumable items (gloves, PPE kits, admission forms, sanitizers) that insurers are legally permitted to exclude from claim reimbursement."),
        # Domain 4: AI/LLM Pipeline & Prompt Engineering (15)
        ("Why does EXTRACTION_PROMPT specify 'max 20 words' for source snippets?", "To force the model to capture the concise clause phrase rather than dumping full paragraphs, conserving token bandwidth and making UI display clean."),
        ("How does the prompt enforce JSON-only output without code fences?", "Rule: 'Return ONLY a JSON object matching the schema below. No markdown, no code fences, no commentary.' combined with responseMimeType: 'application/json'."),
        ("Why is cleanRawJsonText() still necessary if responseMimeType is application/json?", "Certain proxy gateways or model versions occasionally prefix json blocks with ```json fences. cleanRawJsonText() strips leading and trailing fences defensively."),
        ("What happens when an LLM returns a string for a field typed as number in Zod?", "normalizerService.ts coerces the string via normalizeIndianCurrency() or normalizePercentage() BEFORE passing the payload to Zod validation."),
        ("What is the difference between ExtractedPolicyZod and PolicyDocument interface?", "ExtractedPolicyZod allows nullable and optional fields representing raw extraction output; PolicyDocument is the fully normalized MongoDB database representation."),
        ("How does geminiService calculate backoff delay on transient errors?", "attempt * 1500ms (attempt 1: 1500ms, attempt 2: 3000ms), giving API clusters time to clear queue congestion."),
        ("Why did you avoid LangChain or LlamaIndex frameworks?", "LangChain introduces bloated abstractions, slow startup times, and complex dependency trees. Direct invocation of @google/generative-ai gives microsecond execution and total control."),
        ("What is few-shot prompting vs zero-shot in your extraction prompt?", "Our prompt uses targeted one-shot examples for ambiguous fields (e.g. 'Rs. 3,000 per day' -> { type: 'amount', value: 3000 }) to eliminate parsing ambiguity."),
        ("How does the system prevent the LLM from inventing a 10% co-pay when none is stated?", "Rule 13 explicitly dictates: 'If no deductible is mentioned in the document, set deductible to 0. If non-network copay is not stated, set to null. Never guess.'"),
        ("What happens if Gemini returns an invalid JSON string that cannot be parsed by JSON.parse()?", "geminiService.ts catches SyntaxError, dispatches a one-shot retry prompt requesting valid JSON, and if that fails, returns a partial blank schema with status 422."),
        ("How many input tokens does a typical 4-page policy text consume?", "Between 2,500 and 4,500 tokens, well within Gemini 3.1 Flash-Lite's 1-million token context window."),
        ("What is the cost in USD of extracting one policy document using Flash-Lite?", "Less than $0.0005 per document, making the platform commercially viable for millions of annual policyholders."),
        ("Can the extraction pipeline extract tabular schedules of benefits?", "Yes, Flash-Lite reliably parses ASCII text tables extracted by pdf-parse, matching the specific sum insured row."),
        ("What is the role of sourceSnippets in patient trust?", "It provides full explainability: patients can click any field on the UI and see the exact 10-word sentence from their official PDF proving that the number is real."),
        ("Why not fine-tune a local Llama-3-8B model instead of Gemini?", "Hosting a local 8B model requires 16GB+ VRAM (Nvidia A10G) costing hundreds of dollars monthly, whereas Gemini Flash-Lite provides superior extraction accuracy serverlessly on free/low-cost tiers."),
        # Domain 5: Hospital Costing Engine & Spatial Indexing (15)
        ("What is the mathematical definition of hospital tier in India?", "Geographic classifications based on population and cost-of-living: Metro 1 (top metros), Metro 2 (emerging metros), Large City 1 & 2, City 1 & 2, Town 1 & 2."),
        ("How does getCostRecord() handle procedures not listed in the cost CSV?", "It cascades from exact procedure match to specialty aggregate average (computeAggregateFromList), then to city-tier average, and finally returns unavailable."),
        ("Why does computeAggregateFromList average stay days with Math.round((sum / count) * 10) / 10?", "To preserve 1 decimal place of stay duration precision (e.g. 3.4 days) while rounding monetary averages to integer rupees."),
        ("What is the meaning of SEGMENT_POSITION in hospitalService.ts?", "A normalized scale [0.0, 1.0] mapping commercial hospital tiers: Budget=0.25, Standard=0.40, Established=0.50, Premium=0.65, Luxury=0.80."),
        ("Why is the doctor fee modeled at 20% across all procedures?", "Empirical clinical costing studies in Indian private healthcare show that surgeon and anesthetist professional fees average 18% to 22% of total surgical procedure costs."),
        ("Why are diagnostic lab tests modeled at 10%?", "Pre-operative pathology, imaging, and routine in-stay blood investigations consistently account for 8% to 12% of inpatient surgical invoices."),
        ("What happens if stayDays is 0 in the cost record?", "The engine enforces stayDays = Math.max(1, Math.round(rec.estimated_stay_days || 0)), guaranteeing at least 1 day of accommodation is billed."),
        ("How does the engine compute displayLow and displayHigh in estimates?", "displayLow = Math.round(max(lowCost, procedureCost * 0.90) * 1.30 + roomCost); displayHigh = Math.round(min(highestCost, procedureCost * 1.10) * 1.30 + roomCost)."),
        ("What is the difference between treatmentCost and totalCost in HospitalEstimate?", "treatmentCost is the core procedure complexity expense; totalCost includes treatmentCost + 20% doctor fees + 10% diagnostics + room charges."),
        ("How does hashString() avoid negative numbers?", "By executing Math.abs(hash) after bitwise 32-bit integer arithmetic."),
        ("Why does calculateSpecialtyNameRelevance() cap bonus points at 100?", "To prevent hospitals with multiple repeated keywords from receiving scores exceeding the maximum 100-point ceiling."),
        ("What happens if a user searches for 'Orthopedics' in a city with no orthopedic hospitals?", "The search returns 0 hospitals with an explicit message: 'No hospitals matching the selected specialty were found in this location.'"),
        ("How does search() filter by free-text query (e.g. 'Apollo' or 'Koramangala')?", "It tests whether hospital_name, address, segment, hospital_type, or specialties includes the normalized query string."),
        ("Why does hospitalService maintain a separate allCities array?", "To populate the city selection dropdown with pre-computed hospital counts sorted descending by healthcare density."),
        ("What is the memory footprint of 52,960 HospitalRecord objects in JavaScript?", "Approximately 85 MB of V8 heap space when string pointers are interned."),
        # Domain 6: Frontend State, Modals & Localization (15)
        ("How does App.jsx enforce authentication barriers?", "useEffect() monitors user and currentView; if an unauthenticated user attempts to view 'summary', 'discovery', or 'journey', it redirects to 'upload' and opens AuthModal."),
        ("How does the frontend handle browser URL back/forward navigation?", "window.addEventListener('popstate') intercepts history changes, matching /policy/:id and /how-it-works routes."),
        ("What state does CoverageSummaryPage maintain for user edits?", "editedPolicy object storing local modifications until 'Confirm Coverage' submits a PUT request."),
        ("How does BillBreakdownModal calculate 'Savings If Downgraded'?", "It computes roomRentExcess + proportionateDisallowance for the current room, showing the exact cash saved by switching to General Ward."),
        ("What is the purpose of ScoreBreakdownModal?", "To show complete mathematical transparency, displaying exact points earned across Coverage, Cost, Type, and CoPay factors."),
        ("How does CareJourneySimulator step through the 12-step demo flow?", "By maintaining an activeStepIndex, executing step actions, adding mock events to the timeline, and triggering recalculation."),
        ("What is the purpose of WhyExplanationModal?", "It displays the exact policy clause, hospital constraint, and mathematical rationale behind an alert when the user clicks 'Why am I seeing this?'."),
        ("How does LanguageSelector switch active languages?", "By calling i18n.changeLanguage(langCode), which dynamically updates all t('key') translations without reloading the page."),
        ("Where are translation JSON files stored?", "frontend/src/i18n/locales/ in en.json, hi.json, kn.json, and mr.json."),
        ("What component renders the stepped progress indicator during PDF upload?", "SteppedLoader.jsx displaying 4 animated stages: Uploading, Extracting Text, AI Policy Analysis, Structuring Terms."),
        ("How does DemoPicker load sample policies?", "By making a GET /api/policy/demos request and populating clickable cards with badges (Retail Floater, Corporate Group, Govt Scheme)."),
        ("What CSS technique enables glassmorphism in index.css?", "background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.3)."),
        ("How does index.css handle responsive design for mobile devices?", "CSS media queries at @media (max-width: 768px) and (max-width: 1024px) stacking filter sidebars into collapsible drawers."),
        ("What is the role of ProvenanceBadge in UI credibility?", "It displays an informational badge indicating whether data is 'Extracted from Policy', 'Reference Dataset Match', or 'CGHS Benchmark'."),
        ("How does HospitalDiscoveryPage handle pagination?", "Maintains displayCount state (default 12) with a 'Load More Hospitals' button appending 12 facilities per click."),
        # Domain 7: Testing, Deployment & Enterprise Readiness (15)
        ("What command runs unit tests in the backend?", "npm --prefix server test (executing vitest run)."),
        ("What does auditRegression.test.ts verify?", "It verifies authoritative parity between hospital search ranking and detailed bill breakdown calculations across all P0 requirements."),
        ("What does fictionalPolicyRegression.test.ts verify?", "It verifies policy extraction and calculation accuracy across the 4 pre-seeded mock policies."),
        ("What does hospitalCleaning.test.ts verify?", "It verifies that dirty OCR address rows and duplicate facilities are correctly sanitized."),
        ("What does journeyGuidance.test.ts verify?", "It verifies that room upgrades, pre-auth delays, and non-network events trigger correct alerts and recalculations."),
        ("How does render.yaml configure environment variables?", "Under envVars defining NODE_VERSION: 20.18.0, NODE_ENV: production, and referencing MONGODB_URI and GEMINI_API_KEY."),
        ("What is the build:render script in package.json?", "npm install --include=dev && npm --prefix server install --include=dev && npm --prefix frontend install --include=dev && npm run build."),
        ("Why are devDependencies included during render build?", "Because TypeScript (tsc) and Vite build tools are classified as devDependencies and are required to compile production artifacts."),
        ("What happens if GEMINI_API_KEY is not configured in production?", "geminiService.ts logs a warning and returns a partial fallback schema, guiding users to manual entry rather than crashing."),
        ("How does the healthcheck endpoint support zero-downtime deployment?", "Render's load balancer polls /api/health; new containers only receive production traffic after /api/health responds HTTP 200."),
        ("What is the purpose of generatePdfs.ts in server/src/scripts?", "It uses pdfkit to generate realistic synthetic policy PDF documents for the 4 demo policies for offline testing."),
        ("What is the purpose of seedDemos.ts?", "A standalone CLI utility to populate MongoDB with demo policies and test users outside of the server boot lifecycle."),
        ("How does SehatSure handle database migrations?", "Mongoose schemas enforce strict schema typing; new fields default to null or empty objects without requiring table locking migrations."),
        ("What monitoring tools would be integrated in production?", "OpenTelemetry for distributed tracing, Sentry for exception tracking, and Prometheus/Grafana for API latency monitoring."),
        ("What is SehatSure's ultimate vision?", "To become the national financial intelligence layer for healthcare admission in India, embedded into hospital kiosks, insurer portals, and patient super-apps.")
    ]

    for idx, (q, a) in enumerate(deep_data):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.1
        rq = p.add_run(f"DT.{idx+1}: {q}\n")
        rq.bold = True
        rq.font.name = "Calibri"
        rq.font.size = Pt(9)
        rq.font.color.rgb = COLOR_PRIMARY
        ra = p.add_run(f"Technical Defense: {a}")
        ra.font.name = "Calibri"
        ra.font.size = Pt(9)
        ra.font.color.rgb = COLOR_TEXT

    # =========================================================================
    # SECTION AL & AM — "BREAK YOUR SYSTEM" ATTACKS
    # =========================================================================
    add_heading_1(doc, "SECTIONS AL & AM — 'Break Your System' Hostile Edge Cases")
    add_paragraph(doc, "12 hostile attack scenarios designed to test failure recovery and edge-case resilience:")

    attacks = [
        ("Attack 1: Negative Room Rent", "User updates room limit to -₹5,000.", "Math.max(0, ...) in normalizerService.ts and calculatePolicyImpact() prevents negative values. It coerces to 0, ensuring room excess is bounded."),
        ("Attack 2: 100% Co-Payment", "User inputs 100% co-pay.", "Engine computes co-pay amount = 100% of remaining claim. Patient payable equals bill; insurer share = 0. No arithmetic errors."),
        ("Attack 3: Sum Insured is ₹0", "User inputs sumInsured: 0.", "hasSumInsured evaluates to false; isSumInsuredUnknown evaluates to true. System flags sum insured as unverified and computes bill without assuming arbitrary caps."),
        ("Attack 4: Non-Existent City Search", "User searches for 'Atlantis'.", "candidateHospitals is empty. Engine returns totalCount: 0 with friendly message: 'No hospitals found in this location.' Zero crashes."),
        ("Attack 5: Procedure with Zero Cost", "Cost record has 0 for low and mean cost.", "Engine falls back to specialty average; if unavailable, marks estimate unavailable (available: false) and disables bill breakdown."),
        ("Attack 6: SQL / NoSQL Injection in Search", "Query string: {\"$gt\": \"\"}.", "Express query parser passes string; normalize() coerces to lowercase string; regex escapes special characters. NoSQL injection is impossible."),
        ("Attack 7: Rapid Button Mashing on Confirm", "User clicks 'Confirm Coverage' 50 times in 1 second.", "updatePolicy() is idempotent: merging identical updates on MongoDB produces identical document state without duplicate records."),
        ("Attack 8: Uploading a 2-Hour Video MP4 renamed as .pdf", "File with fake .pdf extension.", "pdfParse() fails header magic byte check (%PDF); throws exception. Server returns HTTP 422 immediately."),
        ("Attack 9: Massive 100-Character Specialty Name", "Buffer overflow attempt in specialty parameter.", "String is truncated and checked against canonical taxonomy; no match returns empty candidate list safely."),
        ("Attack 10: Hospital with 50 Insurers listed", "Extremely long empanelment list.", "Array.map() processes insurers in memory in microseconds; empanelment score caps at 35 points maximum."),
        ("Attack 11: Network Drops during Care Journey Simulation", "Client loses internet while clicking simulator.", "Client-side journeyGuidanceEngine.js evaluates the event locally in the browser; simulation continues seamlessly offline."),
        ("Attack 12: Simultaneous Atlas Database Outage", "MongoDB Atlas cluster is deleted during demo.", "db.ts catches disconnect event and boots in-memory MongoMemoryServer; active session continues without crashing.")
    ]

    for title, desc, defense in attacks:
        add_heading_2(doc, title)
        add_bullet(doc, "Attack Scenario", desc)
        add_bullet(doc, "Defensive Behavior", defense)

    # =========================================================================
    # SECTION AN — PRIORITY FIX LIST TABLE
    # =========================================================================
    add_heading_1(doc, "SECTION AN — Priority Fix List (Pre-Hackathon Action Items)")
    add_paragraph(doc, "Ranked list of all technical findings discovered during our deep repository audit:")

    fix_headers = ["Priority", "Issue / Finding", "File / Component", "Risk Explanation", "Recommended Fix", "Must Fix?"]
    fix_widths = [0.8, 1.8, 1.4, 1.4, 1.4, 0.8]
    fix_rows = [
        [
            "P0",
            "Vitest Parallel Hook Timeout",
            "server/vitest.config.ts",
            "Running full vitest suite fails 4 tests due to disk I/O contention on 11MB CSV.",
            "Set fileParallelism: false or hookTimeout: 60000 in vitest.config.ts.",
            "YES"
        ],
        [
            "P0",
            "README Claims Tailwind CSS",
            "README.md line 220",
            "Judges inspecting package.json will find no Tailwind dependency, risking credibility.",
            "Update README to state: 'Custom responsive Vanilla CSS design system (47 KB)'.",
            "YES"
        ],
        [
            "P1",
            "Unverified Hospital Empanelment Clarification",
            "frontend/src/pages/HospitalDiscoveryPage.jsx",
            "Judges may question if unverified hospitals are falsely claimed as network partners.",
            "Ensure 'Network Status Not Verified' warning badge is prominent on unverified cards.",
            "YES"
        ],
        [
            "P2",
            "Scanned PDF OCR Fallback Notice",
            "frontend/src/pages/UploadPage.jsx",
            "Uploading scanned images without text layers relies on multimodal vision.",
            "Add UI hint: 'For best results, upload digital PDF with selectable text.'",
            "OPTIONAL"
        ],
        [
            "P3",
            "Benchmark Price Labeling",
            "frontend/src/components/BillBreakdownModal.jsx",
            "Patients might mistake benchmark estimates for legally binding hospital quotes.",
            "Retain explicit ProvenanceBadge on itemized bill modal header.",
            "COMPLETED"
        ]
    ]
    tbl_fix = doc.add_table(rows=1, cols=6)
    format_table(tbl_fix, fix_widths, fix_headers, fix_rows)

    # =========================================================================
    # SECTION AO — FINAL DEFENSE CHECKLIST & CHEAT SHEET
    # =========================================================================
    add_heading_1(doc, "SECTION AO — Final Defense Checklist & 24-Hour Cheat Sheet")
    add_paragraph(doc, "Printable preparation checklist for the final presentation round:")

    add_heading_2(doc, "Pre-Presentation Technical Verification (T-60 Minutes)")
    add_bullet(doc, "[ ] Verify MongoDB Connection", "Ensure MONGODB_URI is reachable or verify embedded MongoMemoryServer boots cleanly.")
    add_bullet(doc, "[ ] Verify Gemini API Key", "Ensure GEMINI_API_KEY is active and test one PDF upload in staging.")
    add_bullet(doc, "[ ] Run Vitest Suites", "Execute npm --prefix server test tests/auditRegression.test.ts to verify math parity.")
    add_bullet(doc, "[ ] Seed Demo Policies", "Ensure Star Health, HDFC ERGO, PM-JAY, and ESI demo policies are visible on UI.")
    add_bullet(doc, "[ ] Verify Port & Localhost", "Ensure frontend runs on port 5173 and backend on port 5000 without CORS errors.")
    add_bullet(doc, "[ ] Test Offline Simulator", "Verify that CareJourneyPage simulator advances steps smoothly without network lag.")
    add_bullet(doc, "[ ] Screen Resolution Check", "Ensure browser zoom is set to 100% and dark/light contrast is readable on presentation projector.")

    add_heading_2(doc, "Live Demo Golden Path (The 3-Minute Winning Flow)")
    add_bullet(doc, "Minute 1: The Problem & Ingestion", "Show UploadPage. Pick Star Health demo. Point to extracted ₹3,00,000 Sum Insured, ₹3,000 room cap, and 10% co-pay on CoverageSummaryPage. Show the exact source snippets proving AI explainability.")
    add_bullet(doc, "Minute 2: The Discovery & The Trap", "Switch to Hospital Discovery. Search Bengaluru -> Orthopedics -> Knee Replacement. Select Single Private Room (₹8,000/day). Click Hospital Bill Breakdown. Show the proportionate deduction penalty (₹1,50,000 disallowed!). Show the instant 'Switch to Twin Sharing' advice saving ₹42,000.")
    add_bullet(doc, "Minute 3: The Care Journey State Machine", "Click 'Track Care Journey'. Step through the simulator: show real-time pre-auth tracking, room upgrade alert, and discharge bill reconciliation. Conclude with: 'SehatSure delivers financial precision before hospital admission occurs.'")
