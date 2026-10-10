================================================================================
PHASE 06: SYSTEM TESTS & EVALUATION SUITE CHECKLIST
Folder: P4_Journey_Integration/06_System_Tests_Evaluation/
Owner: Person 4 — Journey Backend, Integration, Testing & Delivery
Git Brand: feature/journey-integration
================================================================================

[X] STATUS: COMPLETED & VERIFIED

1. OBJECTIVE & SCOPE
   Gather, verify, and maintain the regression test suites, demo seeding scripts,
   PDF fixture generators, API validation scripts, and comprehensive ML/system
   evaluation runners that establish verification benchmarks for SehatSure /
   Sanjeevani Setu.

2. ASSIGNED FILE INVENTORY & INTEGRITY VERIFICATION
   Source Directory: SEHATSURE/
   Target Directory: P4_Journey_Integration/06_System_Tests_Evaluation/

   File                                            Size (B)   SHA-256 (Prefix)  Status
   ---------------------------------------------   --------   ----------------  --------
   [X] scripts/run_ml_and_report_evaluation.py        60839   81eb0d57ee        VERIFIED
   [X] scripts/test_api_responses.mjs                  1804   779fd5b69a        VERIFIED
   [X] server/src/scripts/generatePdfs.ts             11812   d75eb2c7c2        VERIFIED
   [X] server/src/scripts/runSystemEvaluation.ts      45037   bba20ccafc        VERIFIED
   [X] server/src/scripts/seedDemos.ts                 1019   3b4e698ef4        VERIFIED
   [X] server/tests/auditRegression.test.ts           20356   1c161c256a        VERIFIED
   [X] server/tests/demoPipeline.test.ts               5955   8c7df69e0e        VERIFIED
   [X] server/tests/journeyGuidance.test.ts            6201   c673d85120        VERIFIED

3. TEST & EVALUATION MODULE AUDIT NOTES
   - run_ml_and_report_evaluation.py (60KB):
     * Evaluates ML cost driver predictions against empirical hospital cost benchmarks.
     * Computes MAE, RMSE, and boundary adherence across Tier-1/Tier-2/Tier-3 cities.
     * Generates evaluation summary reports and metamorphic test outputs.
   - test_api_responses.mjs:
     * Integration sanity tester verifying HTTP status, payload JSON schema, and latency.
   - server/src/scripts/generatePdfs.ts:
     * Generates synthetic PDF insurance policy contracts for repeatable demo OCR runs.
   - server/src/scripts/runSystemEvaluation.ts (45KB):
     * Exhaustive end-to-end evaluation script exercising all 4 system pillars:
       Policy Extraction, Network Matching, Cost Estimation, and Journey Guidance.
   - server/src/scripts/seedDemos.ts:
     * Populates MongoDB with standard demo policies and patient journey scenarios.
   - server/tests/auditRegression.test.ts:
     * Regression test preventing regressions in data provenance tagging and audit compliance.
   - server/tests/demoPipeline.test.ts:
     * End-to-end flow test verifying full patient journey execution from admission to discharge.
   - server/tests/journeyGuidance.test.ts:
     * Tests JourneyGuidanceEngine for proportionate deductions, room rent cap breaches,
       and alert generation.

4. PHASE REVIEW SIGN-OFF
   - All 8 evaluation and test assets verified and synchronized.
   - Python compilation check: PASS (clean syntax).
   - Phase 6 complete. Ready to proceed to Phase 7.
================================================================================
