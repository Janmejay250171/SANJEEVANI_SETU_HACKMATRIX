================================================================================
PHASE 05: APPLICATION WIRING & SERVER LIFECYCLE CHECKLIST
Folder: P4_Journey_Integration/05_App_Wiring/
Owner: Person 4 — Journey Backend, Integration, Testing & Delivery
Git Branch: feature/journey-integration
================================================================================

[X] STATUS: COMPLETED & VERIFIED

1. OBJECTIVE & SCOPE
   Audit, wire, and verify the main backend server entry point, connecting Express
   middleware, CORS policies, static mock assets, API router mounts, MongoDB
   connection lifecycles, and demo data auto-seeding.

2. ASSIGNED FILE INVENTORY & INTEGRITY VERIFICATION
   Source Directory: SEHATSURE/
   Target Directory: P4_Journey_Integration/05_App_Wiring/

   File                      Size (B)   SHA-256 (Prefix)  Status
   -----------------------   --------   ----------------  --------
   [X] server/src/index.ts       4628   0586f27f5f        VERIFIED

3. SERVER ARCHITECTURE & WIRING AUDIT NOTES
   - Express Server Entrypoint (server/src/index.ts):
     * Configures JSON and URL-encoded body parsers (10MB payload ceiling for PDF OCR).
     * Flexible CORS allowing localhost development, staging, and *.onrender.com production.
     * Route wiring:
         /api/health     -> System liveness & readiness probes
         /api/policy     -> Feature 1: Policy OCR, Gemini extraction, & chat
         /api/hospitals  -> Feature 2 & 3: Hospital discovery & cost engine
         /api/journey    -> Feature 4: Inpatient journey guidance & state machine
         /api/auth       -> Authentication, saved hospitals, & user profiles
     * Safe static route for /mock-policies without exposing private user uploads.
     * Automatic fallback serving built frontend SPA assets if present.
     * Startup lifecycle connects DB, initializes CSV/JSON benchmarks via hospitalService,
       auto-seeds demo policies if collection is empty, and starts listening on 0.0.0.0.

4. PHASE REVIEW SIGN-OFF
   - Main entry point verified and synchronized.
   - Phase 5 complete. Ready to proceed to Phase 6.
================================================================================
