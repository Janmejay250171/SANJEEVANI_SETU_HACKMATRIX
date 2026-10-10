import {
  BillItemVerificationContext,
  BillItemVerificationResult,
  EvidenceOutcome,
  PrecedenceRole,
  VerifiedClauseCitation,
  VerificationConfidence
} from '../types/verification.js';
import { StandardChargeCategory } from '../types/claim.js';
import { CandidateClauseMatch, MultiChannelRetrievalResult } from '../types/retrieval.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';

// ============================================================================
// Keywords & Heuristics for Exception Identification
// ============================================================================

const ACCIDENTAL_INJURY_KEYWORDS = [
  'accident',
  'accidental',
  'trauma',
  'road traffic accident',
  'rta',
  'injury',
  'fracture',
  'fall injury',
  'emergency trauma'
];

const BURN_TRAUMA_KEYWORDS = [
  'burn',
  'burns',
  'trauma',
  'reconstruction',
  'post-burn',
  'facial trauma',
  'acid burn'
];

export class EvidenceVerificationService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor(apiKey?: string | null) {
    const key = apiKey !== undefined ? apiKey : (config.geminiApiKey || process.env.GEMINI_API_KEY);
    if (key && key.trim() !== '') {
      try {
        this.genAI = new GoogleGenerativeAI(key.trim());
      } catch {
        this.genAI = null;
      }
    }
  }

  /**
   * Authoritative deterministic evidence verification for a bill item.
   * Evaluates retrieved clauses, detects exclusions/exceptions, resolves contractual
   * precedence, checks citation integrity, and identifies review triggers.
   */
  public async verifyBillItemEvidence(
    context: BillItemVerificationContext
  ): Promise<BillItemVerificationResult> {
    const auditTrace: string[] = [];
    const reviewReasons: string[] = [];
    const missingFacts: string[] = [];
    const conditionalRequirements: string[] = [];
    let manualReviewRequired = false;
    let citationIntegrityVerified = true;

    const {
      billItemId,
      originalDescription,
      normalizedDescription,
      category,
      clinicalDiagnosis,
      billedRoomTariffPaise,
      treatmentDate,
      retrievedEvidence
    } = context;

    auditTrace.push(`Starting verification for bill item '${billItemId}' (${originalDescription}).`);

    // 1. Verify Citation Integrity against retrieved evidence
    const allRetrievedMatches: CandidateClauseMatch[] = [
      ...retrievedEvidence.supportiveClauses,
      ...retrievedEvidence.exclusionClauses,
      ...retrievedEvidence.limitClauses,
      ...retrievedEvidence.conflictingClauses
    ];

    if (allRetrievedMatches.length === 0) {
      auditTrace.push('No candidate clauses present in retrieved evidence.');
      return {
        billItemId,
        proposedInterpretation: `No policy coverage or exclusion terms found for '${originalDescription}'.`,
        outcome: 'insufficient_evidence',
        supportingEvidence: [],
        adverseExclusionEvidence: [],
        conflictingEvidence: [],
        conditionalRequirements: [],
        missingFacts: ['Indexed policy terms do not contain provisions matching this hospital charge.'],
        reviewRequired: true,
        reviewReasons: ['Insufficient policy evidence retrieved to adjudicate this charge.'],
        confidence: {
          level: 'LOW',
          explanation: 'No relevant policy clauses identified in corpus.'
        },
        explanation: 'Insufficient evidence: No matching policy clauses were retrieved for this item.',
        citationIntegrityVerified: true,
        auditTrace
      };
    }

    // 2. Classify and verify candidate citations
    const verifiedSupportive: VerifiedClauseCitation[] = [];
    const verifiedExclusions: VerifiedClauseCitation[] = [];
    const verifiedConflicts: VerifiedClauseCitation[] = [];
    const verifiedLimits: VerifiedClauseCitation[] = [];

    for (const match of allRetrievedMatches) {
      // Validate citation integrity: clauseId and exactExcerpt must exist
      if (!match.clause.clauseId || !match.clause.exactExcerpt) {
        citationIntegrityVerified = false;
        auditTrace.push(`Citation integrity failure: Clause '${match.clause.clauseId}' has missing excerpt.`);
      }

      const citation = this.createVerifiedCitation(match, 'SECONDARY', 'Retrieved candidate clause');

      if (match.clause.clauseType === 'exclusion') {
        verifiedExclusions.push(citation);
      } else if (
        match.clause.clauseType === 'limit' ||
        match.clause.clauseType === 'proportionate_deduction' ||
        match.clause.clauseType === 'co_payment' ||
        match.clause.clauseType === 'deductible'
      ) {
        verifiedLimits.push(citation);
      } else {
        const categoryApplies = !match.clause.applicableCategories ||
          match.clause.applicableCategories.length === 0 ||
          match.clause.applicableCategories.includes(category);
        const hasRelevance = (match.bm25Score !== undefined && match.bm25Score > 0) ||
          (match.vectorScore !== undefined && match.vectorScore >= 0.30);

        if (categoryApplies && hasRelevance) {
          verifiedSupportive.push(citation);
        } else {
          citation.precedenceRole = 'NOT_APPLICABLE';
          citation.precedenceReason = 'Coverage clause does not apply to this clinical charge category or lacks sufficient relevance.';
        }
      }
    }

    // 3. Evaluate Exclusion & Exception Logic
    let controllingExclusion: VerifiedClauseCitation | null = null;
    let exceptionApplied = false;

    // Filter exclusions to only those that actually apply to this bill item
    const applicableExclusions = verifiedExclusions.filter((excl) =>
      this.doesExclusionApplyToItem(excl, originalDescription, category)
    );

    // Mark non-applicable exclusions
    for (const excl of verifiedExclusions) {
      if (!applicableExclusions.includes(excl)) {
        excl.precedenceRole = 'NOT_APPLICABLE';
        excl.precedenceReason = 'Exclusion clause retrieved but not applicable to this clinical charge category.';
      }
    }

    if (applicableExclusions.length > 0) {
      const topExcl = applicableExclusions[0];
      const exclText = topExcl.exactExcerpt.toLowerCase();
      const normDesc = (normalizedDescription || originalDescription).toLowerCase();

      // Check Statutory Non-Payable Items (IRDAI Annexure 1)
      if (topExcl.clauseId.includes('irdai_non_payable')) {
        controllingExclusion = topExcl;
        topExcl.precedenceRole = 'CONTROLLING';
        topExcl.precedenceReason = 'Statutory IRDAI Annexure 1 non-payable item schedule overrides all general coverage provisions.';
        auditTrace.push(`Statutory non-payable exclusion applied: ${topExcl.heading}`);
      }
      // Check Dental Exclusion & Accidental Injury Exception
      else if (topExcl.heading.toLowerCase().includes('dental') || normDesc.includes('dental') || normDesc.includes('tooth') || normDesc.includes('root canal')) {
        const hasAccidentFact = this.matchesAnyKeyword(clinicalDiagnosis, ACCIDENTAL_INJURY_KEYWORDS);

        if (hasAccidentFact) {
          exceptionApplied = true;
          topExcl.precedenceRole = 'EXCEPTION_APPLIED';
          topExcl.precedenceReason = 'Contractual exception applied: Dental coverage restored due to documented accidental injury / trauma.';
          auditTrace.push('Dental exclusion waived: Accidental injury exception confirmed.');
        } else if (clinicalDiagnosis && clinicalDiagnosis.trim().length > 0) {
          // Explicit non-accidental dental
          controllingExclusion = topExcl;
          topExcl.precedenceRole = 'CONTROLLING';
          topExcl.precedenceReason = 'Permanent contractual exclusion: Routine or non-accidental dental treatment is excluded.';
          auditTrace.push('Permanent dental exclusion applied: Diagnosis does not involve accidental trauma.');
        } else {
          // Missing clinical facts
          topExcl.precedenceRole = 'UNRESOLVED';
          missingFacts.push('Clinical diagnosis / trauma documentation required to verify whether accidental dental exception applies.');
          manualReviewRequired = true;
          reviewReasons.push('Dental charge retrieved an exclusion with a conditional accidental injury exception, but accident facts are unstated.');
          auditTrace.push('Dental exception status undetermined: Missing trauma documentation.');
        }
      }
      // Check Cosmetic Surgery & Trauma Reconstructive Exception
      else if (topExcl.heading.toLowerCase().includes('cosmetic') || normDesc.includes('cosmetic') || normDesc.includes('rhinoplasty') || normDesc.includes('tightening')) {
        const hasBurnTrauma = this.matchesAnyKeyword(clinicalDiagnosis, BURN_TRAUMA_KEYWORDS);
        const isElectiveAesthetic =
          normDesc.includes('elective') ||
          normDesc.includes('cosmetic') ||
          normDesc.includes('aesthetic') ||
          normDesc.includes('reshaping') ||
          normDesc.includes('tightening');

        if (hasBurnTrauma) {
          exceptionApplied = true;
          topExcl.precedenceRole = 'EXCEPTION_APPLIED';
          topExcl.precedenceReason = 'Contractual exception applied: Cosmetic reconstructive surgery covered following trauma or severe burns.';
          auditTrace.push('Cosmetic exclusion waived: Post-trauma reconstructive exception confirmed.');
        } else if (isElectiveAesthetic || (clinicalDiagnosis && clinicalDiagnosis.trim().length > 0)) {
          controllingExclusion = topExcl;
          topExcl.precedenceRole = 'CONTROLLING';
          topExcl.precedenceReason = 'Permanent contractual exclusion: Elective cosmetic surgery and aesthetic contouring are permanently excluded.';
          auditTrace.push('Cosmetic surgery excluded: Elective aesthetic procedure.');
        } else {
          topExcl.precedenceRole = 'UNRESOLVED';
          missingFacts.push('Medical records required to establish whether cosmetic procedure is reconstructive due to burns or trauma.');
          manualReviewRequired = true;
          reviewReasons.push('Cosmetic exclusion retrieved with reconstructive exception, but trauma history is unstated.');
          auditTrace.push('Cosmetic reconstructive exception undetermined: Missing trauma history.');
        }
      }
      // General Contractual Exclusion (e.g. Weight loss / Bariatric / Unproven)
      else {
        controllingExclusion = topExcl;
        topExcl.precedenceRole = 'CONTROLLING';
        topExcl.precedenceReason = 'Permanent contractual exclusion explicitly disallows this procedure.';
        auditTrace.push(`Contractual exclusion applied: ${topExcl.heading}`);
      }
    }

    // 4. Evaluate Conflicting Precedence & Amendment Supersession
    const allCandidates = [...verifiedSupportive, ...verifiedLimits];

    for (let i = 0; i < allCandidates.length; i++) {
      for (let j = i + 1; j < allCandidates.length; j++) {
        const c1 = allCandidates[i];
        const c2 = allCandidates[j];

        // Check if one clause is an amendment modifying the other base clause
        if (c1.versionId !== c2.versionId) {
          const isRoomRentConflict =
            c1.heading.toLowerCase().includes('room rent') && c2.heading.toLowerCase().includes('room rent');
          const isSublimitConflict =
            c1.heading.toLowerCase().includes('sub-limit') && c2.heading.toLowerCase().includes('sub-limit');

          if (isRoomRentConflict || isSublimitConflict) {
            const isC2Amendment =
              c2.clauseId.includes('mod_') || c2.heading.includes('Endorsement') || c2.versionId.includes('amend');
            const isC1Amendment =
              c1.clauseId.includes('mod_') || c1.heading.includes('Endorsement') || c1.versionId.includes('amend');

            if (isC2Amendment && !isC1Amendment) {
              const effectiveDate = c2.effectiveFrom || '2025-07-01';
              if (treatmentDate >= effectiveDate) {
                c2.precedenceRole = 'CONTROLLING';
                c2.precedenceReason = `Active endorsement version '${c2.versionId}' supersedes base policy clause on treatment date ${treatmentDate}.`;
                c1.precedenceRole = 'SUPERSEDED';
                c1.precedenceReason = `Superseded by active endorsement '${c2.versionId}'.`;
                verifiedConflicts.push(c1);
                auditTrace.push(`Amendment '${c2.clauseId}' supersedes base clause '${c1.clauseId}'.`);
              } else {
                c1.precedenceRole = 'CONTROLLING';
                c1.precedenceReason = `Base policy controls; endorsement effective date ${effectiveDate} is after treatment date ${treatmentDate}.`;
                c2.precedenceRole = 'SUPERSEDED';
                c2.precedenceReason = `Endorsement not yet active on treatment date ${treatmentDate}.`;
                verifiedConflicts.push(c2);
                auditTrace.push(`Base clause '${c1.clauseId}' controls over future endorsement '${c2.clauseId}'.`);
              }
            } else if (isC1Amendment && !isC2Amendment) {
              const effectiveDate = c1.effectiveFrom || '2025-07-01';
              if (treatmentDate >= effectiveDate) {
                c1.precedenceRole = 'CONTROLLING';
                c1.precedenceReason = `Active endorsement version '${c1.versionId}' supersedes base policy clause on treatment date ${treatmentDate}.`;
                c2.precedenceRole = 'SUPERSEDED';
                c2.precedenceReason = `Superseded by active endorsement '${c1.versionId}'.`;
                verifiedConflicts.push(c2);
                auditTrace.push(`Amendment '${c1.clauseId}' supersedes base clause '${c2.clauseId}'.`);
              } else {
                c2.precedenceRole = 'CONTROLLING';
                c2.precedenceReason = `Base policy controls; endorsement effective date ${effectiveDate} is after treatment date ${treatmentDate}.`;
                c1.precedenceRole = 'SUPERSEDED';
                c1.precedenceReason = `Endorsement not yet active on treatment date ${treatmentDate}.`;
                verifiedConflicts.push(c1);
                auditTrace.push(`Base clause '${c2.clauseId}' controls over future endorsement '${c1.clauseId}'.`);
              }
            } else {
              // Two concurrent base versions with conflicting terms without clear succession
              c1.precedenceRole = 'UNRESOLVED';
              c2.precedenceRole = 'UNRESOLVED';
              verifiedConflicts.push(c1, c2);
              manualReviewRequired = true;
              reviewReasons.push(`Conflicting contractual terms detected across versions ${c1.versionId} and ${c2.versionId}.`);
              auditTrace.push(`Unresolved conflicting clauses: ${c1.clauseId} vs ${c2.clauseId}`);
            }
          }
        }
      }
    }

    // 5. Evaluate Specific Procedure Sublimit vs General Limits
    const sublimitMatches = verifiedLimits.filter((l) => l.heading.toLowerCase().includes('sub-limit'));
    const generalRoomMatch = verifiedLimits.find((l) => l.heading.toLowerCase().includes('room rent'));

    for (const sublimitMatch of sublimitMatches) {
      if (this.doesSublimitApplyToItem(sublimitMatch, originalDescription, clinicalDiagnosis)) {
        sublimitMatch.precedenceRole = 'CONTROLLING';
        sublimitMatch.precedenceReason = 'Specific disease / procedure sublimit overrides general inpatient limits.';
        if (generalRoomMatch) {
          generalRoomMatch.precedenceRole = 'SECONDARY';
          generalRoomMatch.precedenceReason = 'Secondary general limit subservient to procedure sublimit.';
        }
        conditionalRequirements.push(`Procedure subject to specific sublimit cap: ${sublimitMatch.heading}`);
        auditTrace.push(`Procedure sublimit takes precedence: ${sublimitMatch.heading}`);
      } else {
        sublimitMatch.precedenceRole = 'NOT_APPLICABLE';
        sublimitMatch.precedenceReason = 'Procedure sublimit does not apply to this clinical charge.';
      }
    }

    // 6. Check Room Rent Daily Limit & Proportionate Disallowance Condition
    if (
      category === 'ROOM_RENT' ||
      originalDescription.toLowerCase().includes('room rent') ||
      originalDescription.toLowerCase().includes('bed boarding') ||
      originalDescription.toLowerCase().includes('bed charges')
    ) {
      const activeRoomClause = verifiedLimits.find(
        (l) =>
          l.heading.toLowerCase().includes('room rent') &&
          l.precedenceRole !== 'SUPERSEDED' &&
          l.precedenceRole !== 'NOT_APPLICABLE'
      );

      if (activeRoomClause) {
        if (activeRoomClause.precedenceRole !== 'CONTROLLING') {
          activeRoomClause.precedenceRole = 'CONTROLLING';
        }
        conditionalRequirements.push(`Room rent daily cap governed by clause: ${activeRoomClause.heading}`);

        if (billedRoomTariffPaise && billedRoomTariffPaise > 0) {
          // Determine active daily limit: check if endorsement raised limit to 7500
          const dailyLimitPaise =
            activeRoomClause.exactExcerpt.includes('7,500') ||
            activeRoomClause.exactExcerpt.includes('7500') ||
            activeRoomClause.clauseId.includes('amend_room')
              ? 750000
              : 500000;

          if (billedRoomTariffPaise > dailyLimitPaise) {
            conditionalRequirements.push(
              'Billed room tariff exceeds eligible room cap; proportionate deduction applies to associated medical fees.'
            );
          }
        }
      }
    }

    // 7. Synthesize Verification Outcome
    let outcome: EvidenceOutcome = 'supported';
    let proposedInterpretation = '';

    if (!citationIntegrityVerified) {
      outcome = 'review_required';
      manualReviewRequired = true;
      reviewReasons.push('Citation integrity check failed: Retrieved evidence cited nonexistent or incomplete source excerpts.');
      proposedInterpretation = 'Adjudication halted: Source evidence verification failed citation integrity audit.';
    } else if (controllingExclusion) {
      outcome = 'excluded';
      proposedInterpretation = `Charge is disallowed under contractual/statutory exclusion: ${controllingExclusion.heading}.`;
      // All supportive clauses become secondary to controlling exclusion
      verifiedSupportive.forEach((s) => {
        s.precedenceRole = 'SECONDARY';
        s.precedenceReason = 'General coverage clause overridden by specific exclusion.';
      });
    } else if (verifiedConflicts.some((c) => c.precedenceRole === 'UNRESOLVED')) {
      outcome = 'conflicting';
      manualReviewRequired = true;
      reviewReasons.push('Conflicting contractual terms detected across policy versions without deterministic resolution.');
      proposedInterpretation = 'Unresolved conflict between multiple policy versions requires human underwriting review.';
    } else if (missingFacts.length > 0) {
      outcome = 'conditional';
      manualReviewRequired = true;
      proposedInterpretation = `Conditional coverage: Interpretation depends on missing facts: ${missingFacts.join('; ')}.`;
    } else if (conditionalRequirements.length > 0) {
      outcome = 'conditional';
      proposedInterpretation = `Charge is admissible subject to contractual limits and conditions: ${conditionalRequirements.join('; ')}.`;
    } else if (exceptionApplied) {
      outcome = 'supported';
      proposedInterpretation = 'Charge is covered: Documented clinical trauma satisfies contractual exception to exclusion.';
    } else if (verifiedSupportive.length > 0) {
      outcome = 'supported';
      const topSupp = verifiedSupportive[0];
      topSupp.precedenceRole = 'CONTROLLING';
      topSupp.precedenceReason = 'Direct policy coverage clause establishes admissibility.';
      proposedInterpretation = `Charge is covered under policy terms: ${topSupp.heading}.`;
    } else {
      outcome = 'insufficient_evidence';
      manualReviewRequired = true;
      reviewReasons.push('No matching policy clauses found with sufficient retrieval confidence.');
      proposedInterpretation = 'Insufficient evidence found in policy contract to support coverage.';
    }

    // 8. Confidence Assessment
    const confidenceLevel: VerificationConfidence = this.determineConfidence(
      outcome,
      manualReviewRequired,
      citationIntegrityVerified,
      allRetrievedMatches
    );

    const explanation = this.generateVerificationExplanation(
      outcome,
      originalDescription,
      controllingExclusion,
      verifiedSupportive[0] || null,
      conditionalRequirements,
      missingFacts,
      reviewReasons
    );

    auditTrace.push(`Completed verification. Outcome: '${outcome}', Review Required: ${manualReviewRequired}.`);

    return {
      billItemId,
      proposedInterpretation,
      outcome,
      supportingEvidence: [...verifiedSupportive, ...verifiedLimits],
      adverseExclusionEvidence: verifiedExclusions,
      conflictingEvidence: verifiedConflicts,
      conditionalRequirements,
      missingFacts,
      reviewRequired: manualReviewRequired,
      reviewReasons,
      confidence: {
        level: confidenceLevel,
        explanation: `Confidence evaluated as ${confidenceLevel} based on evidence specificity and conflict resolution.`,
        calibratedScore: confidenceLevel === 'HIGH' ? 0.95 : confidenceLevel === 'MEDIUM' ? 0.75 : 0.4
      },
      explanation,
      citationIntegrityVerified,
      auditTrace
    };
  }

  /**
   * Optional AI-assisted verification with strict schema validation and citation integrity guardrails.
   * If AI returns invalid citations or fails, gracefully falls back to deterministic verification.
   */
  public async verifyWithAiGuardrails(
    context: BillItemVerificationContext
  ): Promise<BillItemVerificationResult> {
    // 1. Run deterministic verification baseline first
    const deterministicResult = await this.verifyBillItemEvidence(context);

    // If Gemini is not configured, safely return deterministic baseline
    if (!this.genAI) {
      return deterministicResult;
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: config.geminiModel || 'gemini-3.8-flash' });

      const prompt = `You are an insurance policy evidence verifier for Indian health insurance claims.
Evaluate whether the retrieved policy evidence supports or excludes the hospital bill item.

BILL ITEM:
- Description: "${context.originalDescription}"
- Category: "${context.category}"
- Claimed Amount: ₹${(context.claimedAmountPaise / 100).toFixed(2)}
- Clinical Diagnosis: "${context.clinicalDiagnosis || 'Not specified'}"
- Treatment Date: "${context.treatmentDate}"

RETRIEVED POLICY EVIDENCE:
${context.retrievedEvidence.supportiveClauses
  .concat(context.retrievedEvidence.limitClauses)
  .concat(context.retrievedEvidence.exclusionClauses)
  .map(
    (m) => `[Clause ID: ${m.clause.clauseId}]
Heading: ${m.clause.heading}
Excerpt: "${m.clause.exactExcerpt}"
Type: ${m.clause.clauseType}`
  )
  .join('\n\n')}

INSTRUCTIONS:
1. Return ONLY a JSON object with:
   - outcome: "supported" | "excluded" | "conditional" | "ambiguous" | "conflicting" | "insufficient_evidence" | "review_required"
   - citedClauseId: string (MUST match one of the Clause IDs above!)
   - explanation: string
2. CRITICAL ANTI-HALLUCINATION RULE: You must cite ONLY Clause IDs listed above. Never invent clause IDs or cite unsupplied evidence.`;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI verification call timed out')), 4000)
      );
      const aiResponse = (await Promise.race([model.generateContent(prompt), timeoutPromise])) as any;
      const text = aiResponse.response.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Verify citation integrity: citedClauseId MUST exist in retrieved evidence!
      const allRetrievedIds = [
        ...context.retrievedEvidence.supportiveClauses,
        ...context.retrievedEvidence.limitClauses,
        ...context.retrievedEvidence.exclusionClauses,
        ...context.retrievedEvidence.conflictingClauses
      ].map((m) => m.clause.clauseId);

      if (parsed.citedClauseId && !allRetrievedIds.includes(parsed.citedClauseId)) {
        // Hallucination detected! Intercept and reject AI response
        deterministicResult.citationIntegrityVerified = false;
        deterministicResult.reviewRequired = true;
        deterministicResult.reviewReasons.push(
          `AI hallucinated invalid clause ID '${parsed.citedClauseId}' not present in source index.`
        );
        deterministicResult.auditTrace.push('AI citation integrity guardrail intercepted hallucinated clause citation.');
        return deterministicResult;
      }

      // Valid AI response
      deterministicResult.explanation += ` [AI Verification: ${parsed.explanation}]`;
      return deterministicResult;
    } catch {
      // Safe fallback on any AI network, rate-limit, or parse failure
      return deterministicResult;
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private createVerifiedCitation(
    match: CandidateClauseMatch,
    precedenceRole: PrecedenceRole,
    precedenceReason: string
  ): VerifiedClauseCitation {
    return {
      clauseId: match.clause.clauseId,
      versionId: match.clause.versionId,
      documentId: match.clause.documentId,
      heading: match.clause.heading,
      section: match.clause.section,
      exactExcerpt: match.clause.exactExcerpt,
      pageNumber: match.clause.pageNumber,
      clauseType: match.clause.clauseType,
      precedenceRole,
      precedenceReason,
      retrievalScore: match.score,
      citationVerified: Boolean(match.clause.clauseId && match.clause.exactExcerpt),
      effectiveFrom: match.clause.effectiveFrom,
      effectiveTo: match.clause.effectiveTo
    };
  }

  private doesExclusionApplyToItem(
    excl: VerifiedClauseCitation,
    itemDesc: string,
    category: StandardChargeCategory
  ): boolean {
    const desc = itemDesc.toLowerCase();
    const exclHeading = excl.heading.toLowerCase();
    const exclExcerpt = excl.exactExcerpt.toLowerCase();

    // 1. Statutory IRDAI Consumables
    if (
      excl.clauseId.includes('irdai_non_payable_consumables') ||
      exclHeading.includes('personal comfort') ||
      exclExcerpt.includes('gloves')
    ) {
      if (category === 'CONSUMABLES_NON_PAYABLES') return true;
      const consumableWords = [
        'glove', 'gloves', 'sanitizer', 'mask', 'face shield', 'ppe',
        'thermometer', 'toiletries', 'diaper', 'baby food', 'consumable'
      ];
      return consumableWords.some((w) => desc.includes(w));
    }

    // 2. Statutory IRDAI Administrative & Admission Fees
    if (
      excl.clauseId.includes('irdai_non_payable_admin') ||
      exclHeading.includes('administrative & admission') ||
      exclExcerpt.includes('admission fee')
    ) {
      const adminWords = [
        'admission fee', 'registration fee', 'discharge fee', 'surcharge',
        'documentation fee', 'photocopying', 'administrative charge', 'admin fee', 'record fee'
      ];
      return adminWords.some((w) => desc.includes(w));
    }

    // 3. Cosmetic / Aesthetic Surgery
    if (exclHeading.includes('cosmetic')) {
      const cosmeticWords = [
        'cosmetic', 'rhinoplasty', 'aesthetic', 'botox', 'liposuction',
        'plastic surgery', 'reshaping', 'facelift', 'tightening', 'glue'
      ];
      return cosmeticWords.some((w) => desc.includes(w));
    }

    // 4. Dental Treatment
    if (exclHeading.includes('dental')) {
      const dentalWords = [
        'dental', 'tooth', 'teeth', 'root canal', 'denture',
        'extraction', 'maxillofacial', 'oral surgery'
      ];
      return dentalWords.some((w) => desc.includes(w));
    }

    // 5. Weight Loss / Bariatric
    if (exclHeading.includes('weight loss') || exclHeading.includes('bariatric')) {
      const bariatricWords = ['bariatric', 'weight loss', 'obesity', 'gastric bypass'];
      return bariatricWords.some((w) => desc.includes(w));
    }

    // 6. Unproven / Experimental
    if (exclHeading.includes('unproven') || exclHeading.includes('experimental')) {
      const unprovenWords = ['unproven', 'experimental', 'investigational'];
      return unprovenWords.some((w) => desc.includes(w));
    }

    return false;
  }

  private doesSublimitApplyToItem(
    sublimitCitation: VerifiedClauseCitation,
    itemDesc: string,
    clinicalDiagnosis?: string | null
  ): boolean {
    const text = `${itemDesc} ${clinicalDiagnosis || ''}`.toLowerCase();
    const heading = sublimitCitation.heading.toLowerCase();
    const excerpt = sublimitCitation.exactExcerpt.toLowerCase();

    if (heading.includes('cataract') || excerpt.includes('cataract')) {
      return text.includes('cataract') || text.includes('lens') || text.includes('iol') || text.includes('phaco');
    }
    if (heading.includes('knee') || excerpt.includes('knee')) {
      return text.includes('knee');
    }
    if (heading.includes('hernia') || excerpt.includes('hernia')) {
      return text.includes('hernia');
    }
    return false;
  }

  private matchesAnyKeyword(text: string | null | undefined, keywords: string[]): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  }

  private determineConfidence(
    outcome: EvidenceOutcome,
    manualReviewRequired: boolean,
    citationIntegrityVerified: boolean,
    allRetrieved: CandidateClauseMatch[]
  ): VerificationConfidence {
    if (!citationIntegrityVerified || manualReviewRequired) return 'LOW';
    if (outcome === 'insufficient_evidence') return 'LOW';
    if (allRetrieved.length > 0 && allRetrieved[0].score >= 0.02) return 'HIGH';
    return 'MEDIUM';
  }

  private generateVerificationExplanation(
    outcome: EvidenceOutcome,
    billDesc: string,
    topExcl: VerifiedClauseCitation | null,
    topSupp: VerifiedClauseCitation | null,
    conditions: string[],
    missingFacts: string[],
    reviewReasons: string[]
  ): string {
    switch (outcome) {
      case 'excluded':
        return `Charge for '${billDesc}' is excluded under ${topExcl?.heading || 'policy exclusions'}.`;
      case 'supported':
        return `Charge for '${billDesc}' is supported by policy clause: ${topSupp?.heading}.`;
      case 'conditional':
        return `Charge for '${billDesc}' is subject to policy conditions: ${conditions.join('; ')}.`;
      case 'conflicting':
        return `Charge for '${billDesc}' has conflicting contractual terms across policy versions. Human review required.`;
      case 'insufficient_evidence':
        return `Insufficient policy evidence found to adjudicate '${billDesc}'.`;
      case 'review_required':
        return `Human underwriting review required: ${reviewReasons.join('; ')}.`;
      default:
        return `Verification outcome: ${outcome}.`;
    }
  }
}

export const evidenceVerificationService = new EvidenceVerificationService();
