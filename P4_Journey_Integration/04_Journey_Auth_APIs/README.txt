================================================================================
PHASE 04: JOURNEY & AUTH CONTROLLERS AND ROUTE APIS CHECKLIST
Folder: P4_Journey_Integration/04_Journey_Auth_APIs/
Owner: Person 4 — Journey Backend, Integration, Testing & Delivery
Git Branch: feature/journey-integration
================================================================================

[X] STATUS: COMPLETED & VERIFIED

1. OBJECTIVE & SCOPE
   Configure, connect, and verify the Express controller endpoints and routing
   architecture for user authentication, profile/hospital book-marking, policy
   linking, and care journey event processing with live impact evaluation.

2. ASSIGNED FILE INVENTORY & INTEGRITY VERIFICATION
   Source Directory: SEHATSURE/
   Target Directory: P4_Journey_Integration/04_Journey_Auth_APIs/

   File                                           Size (B)   SHA-256 (Prefix)  Status
   --------------------------------------------   --------   ----------------  --------
   [X] server/src/controllers/journeyController.ts   10051   4e8b165241        VERIFIED
   [X] server/src/controllers/authController.ts       7860   433475f3f1        VERIFIED
   [X] server/src/routes/journeyRoutes.ts              454   a72c726660        VERIFIED
   [X] server/src/routes/authRoutes.ts                 459   b9a172a18b        VERIFIED

3. API ENDPOINTS & CONTROLLER AUDIT NOTES
   - Journey API Routes (/api/journey):
     * GET  /:id                           -> Retrieve active journey session by patient ID.
     * POST /:id/event                     -> Ingest and evaluate new journey event with GuidanceEngine.
     * PUT  /:id                           -> Persist journey state updates.
     * POST /:id/reset                     -> Reset journey to initial admission state.
     * POST /:id/alerts/:alertId/resolve   -> Mark actionable alert as acknowledged/resolved.
   - Auth API Routes (/api/auth):
     * POST /signup                        -> Register user with password hashing and session tokens.
     * POST /login                         -> Authenticate user credentials.
     * GET  /profile, GET /me              -> Fetch authenticated user profile and saved items.
     * POST /saved-hospitals               -> Toggle bookmarked hospitals in user portfolio.
     * POST /link-policy                   -> Associate insurance policy ID with user account.

4. PHASE REVIEW SIGN-OFF
   - All 4 controller and routing modules verified and synchronized.
   - Phase 4 complete. Ready to proceed to Phase 5.
================================================================================
