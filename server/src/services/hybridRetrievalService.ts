import {
  IndexedPolicyClause,
  ClauseRetrievalQuery,
  CandidateClauseMatch,
  MultiChannelRetrievalResult,
  EvidenceVerificationDecision,
  RetrievalMethod,
  VerificationStatus
} from '../types/retrieval.js';
import { embeddingService } from './embeddingService.js';
import { normalizeRetrievalText } from './clauseIndexingService.js';
import { ApplicabilityStatus } from '../types/policyVersion.js';

export interface RetrievalEngineOptions {
  bm25K1?: number; // BM25 term frequency saturation (default 1.5)
  bm25B?: number;  // BM25 document length normalization (default 0.75)
  rrfK?: number;   // Reciprocal Rank Fusion constant (default 60)
  lexicalWeight?: number; // Weight for lexical rank in RRF (default 1.0)
  semanticWeight?: number; // Weight for semantic rank in RRF (default 1.0)
}

export class HybridRetrievalService {
  private k1: number;
  private b: number;
  private rrfK: number;
  private lexicalWeight: number;
  private semanticWeight: number;

  constructor(options?: RetrievalEngineOptions) {
    this.k1 = options?.bm25K1 ?? 1.5;
    this.b = options?.bm25B ?? 0.75;
    this.rrfK = options?.rrfK ?? 60;
    this.lexicalWeight = options?.lexicalWeight ?? 1.0;
    this.semanticWeight = options?.semanticWeight ?? 1.0;
  }

  // ==========================================================================
  // A. Lexical / Keyword Retrieval (BM25)
  // ==========================================================================

  public retrieveLexical(
    queryText: string,
    corpus: IndexedPolicyClause[],
    topK: number = 10
  ): CandidateClauseMatch[] {
    if (!queryText || corpus.length === 0) return [];

    const queryTokens = normalizeRetrievalText(queryText).split(' ').filter((t) => t.length > 1);
    if (queryTokens.length === 0) return [];

    const N = corpus.length;
    const docLengths = corpus.map((c) => c.normalizedText.split(' ').length);
    const avgdl = docLengths.reduce((acc, len) => acc + len, 0) / N;

    // Document frequencies
    const df: Record<string, number> = {};
    for (const q of queryTokens) {
      df[q] = 0;
      for (const clause of corpus) {
        if (clause.normalizedText.includes(q)) {
          df[q]++;
        }
      }
    }

    // Score documents
    const scored: { clause: IndexedPolicyClause; score: number }[] = [];

    for (let i = 0; i < N; i++) {
      const clause = corpus[i];
      const docTokens = clause.normalizedText.split(' ');
      const docLen = docLengths[i];
      let docScore = 0;

      // Frequency map for this document
      const tf: Record<string, number> = {};
      for (const token of docTokens) {
        tf[token] = (tf[token] || 0) + 1;
      }

      for (const q of queryTokens) {
        const count = tf[q] || 0;
        if (count > 0) {
          const docFreq = df[q] || 0;
          const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
          const num = count * (this.k1 + 1);
          const denom = count + this.k1 * (1 - this.b + this.b * (docLen / (avgdl || 1)));
          docScore += idf * (num / denom);
        }
      }

      if (docScore > 0) {
        scored.push({ clause, score: docScore });
      }
    }

    // Sort descending by BM25 score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((item, idx) => ({
      clause: item.clause,
      retrievalMethod: 'KEYWORD_BM25',
      rank: idx + 1,
      score: Number(item.score.toFixed(4)),
      bm25Score: Number(item.score.toFixed(4)),
      applicabilityStatus: 'resolved',
      applicabilityReason: 'Matched lexical query keywords.',
      evidenceCategory: this.categorizeEvidence(item.clause),
      requiresVerification: item.clause.isSegmentationUncertain
    }));
  }

  // ==========================================================================
  // B. Semantic Vector Retrieval
  // ==========================================================================

  public async retrieveSemantic(
    queryText: string,
    corpus: IndexedPolicyClause[],
    topK: number = 10
  ): Promise<CandidateClauseMatch[]> {
    if (!queryText || corpus.length === 0) return [];

    const { vector: queryVector } = await embeddingService.embedText(queryText);

    // Ensure all corpus clauses have precomputed or runtime embeddings
    const scored: { clause: IndexedPolicyClause; score: number }[] = [];

    for (const clause of corpus) {
      let clauseVec = clause.embedding;
      if (!clauseVec) {
        const res = await embeddingService.embedText(clause.normalizedText);
        clauseVec = res.vector;
        clause.embedding = clauseVec;
      }

      const sim = embeddingService.cosineSimilarity(queryVector, clauseVec);
      if (sim >= 0.18) {
        scored.push({ clause, score: sim });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((item, idx) => ({
      clause: item.clause,
      retrievalMethod: 'SEMANTIC_VECTOR',
      rank: idx + 1,
      score: Number(item.score.toFixed(4)),
      vectorScore: Number(item.score.toFixed(4)),
      applicabilityStatus: 'resolved',
      applicabilityReason: 'Matched semantic vector representation.',
      evidenceCategory: this.categorizeEvidence(item.clause),
      requiresVerification: item.clause.isSegmentationUncertain
    }));
  }

  // ==========================================================================
  // C. Hybrid Retrieval & Reciprocal Rank Fusion (RRF)
  // ==========================================================================

  public async retrieveHybrid(
    queryText: string,
    corpus: IndexedPolicyClause[],
    topK: number = 10
  ): Promise<CandidateClauseMatch[]> {
    const lexicalMatches = this.retrieveLexical(queryText, corpus, topK * 2);
    const semanticMatches = await this.retrieveSemantic(queryText, corpus, topK * 2);

    // Clause map collecting reciprocal rank scores
    const rrfScores = new Map<
      string,
      {
        clause: IndexedPolicyClause;
        score: number;
        bm25Score?: number;
        vectorScore?: number;
      }
    >();

    // Add lexical ranks
    lexicalMatches.forEach((match) => {
      const id = match.clause.clauseId;
      const rank = match.rank;
      const rrfComponent = this.lexicalWeight / (this.rrfK + rank);

      rrfScores.set(id, {
        clause: match.clause,
        score: rrfComponent,
        bm25Score: match.bm25Score
      });
    });

    // Add semantic ranks
    semanticMatches.forEach((match) => {
      // If candidate has zero lexical overlap, require solid semantic similarity (>= 0.30)
      // to avoid spurious character-level 3-gram subword collisions (e.g. 'rental' vs 'rent')
      if (match.vectorScore !== undefined && match.vectorScore < 0.30 && !rrfScores.has(match.clause.clauseId)) {
        return;
      }

      const id = match.clause.clauseId;
      const rank = match.rank;
      const rrfComponent = this.semanticWeight / (this.rrfK + rank);

      const existing = rrfScores.get(id);
      if (existing) {
        existing.score += rrfComponent;
        existing.vectorScore = match.vectorScore;
      } else {
        rrfScores.set(id, {
          clause: match.clause,
          score: rrfComponent,
          vectorScore: match.vectorScore
        });
      }
    });

    const merged = Array.from(rrfScores.values()).sort((a, b) => b.score - a.score);

    return merged.slice(0, topK).map((item, idx) => ({
      clause: item.clause,
      retrievalMethod: 'HYBRID_RRF',
      rank: idx + 1,
      score: Number(item.score.toFixed(4)),
      bm25Score: item.bm25Score,
      vectorScore: item.vectorScore,
      applicabilityStatus: 'resolved',
      applicabilityReason: 'Fused reciprocal rank of lexical and semantic matches.',
      evidenceCategory: this.categorizeEvidence(item.clause),
      requiresVerification: item.clause.isSegmentationUncertain
    }));
  }

  // ==========================================================================
  // Multi-Channel Bill Line Item Matching & Adverse Search
  // ==========================================================================

  public async matchBillItem(
    query: ClauseRetrievalQuery,
    corpus: IndexedPolicyClause[],
    method: RetrievalMethod = 'HYBRID_RRF'
  ): Promise<MultiChannelRetrievalResult> {
    const startTime = Date.now();
    const auditNotes: string[] = [];
    const topK = query.topK ?? 5;

    // 1. Filter corpus by version & treatment-date applicability
    const eligibleCorpus = this.filterCorpusByApplicability(query, corpus, auditNotes);

    // 2. Query text formulation (combines original bill line + normalized description)
    const searchText = query.normalizedDescription
      ? `${query.billItemDescription} ${query.normalizedDescription}`
      : query.billItemDescription;

    // 3. Primary Retrieval
    let candidateMatches: CandidateClauseMatch[] = [];
    if (method === 'KEYWORD_BM25') {
      candidateMatches = this.retrieveLexical(searchText, eligibleCorpus, topK * 3);
    } else if (method === 'SEMANTIC_VECTOR') {
      candidateMatches = await this.retrieveSemantic(searchText, eligibleCorpus, topK * 3);
    } else {
      candidateMatches = await this.retrieveHybrid(searchText, eligibleCorpus, topK * 3);
    }

    // 4. Partition candidates into evidence collections
    const supportiveClauses: CandidateClauseMatch[] = [];
    const exclusionClauses: CandidateClauseMatch[] = [];
    const limitClauses: CandidateClauseMatch[] = [];
    const conflictingClauses: CandidateClauseMatch[] = [];

    for (const match of candidateMatches) {
      if (match.clause.clauseType === 'exclusion') {
        exclusionClauses.push(match);
      } else if (
        match.clause.clauseType === 'limit' ||
        match.clause.clauseType === 'proportionate_deduction' ||
        match.clause.clauseType === 'co_payment' ||
        match.clause.clauseType === 'deductible'
      ) {
        limitClauses.push(match);
      } else {
        supportiveClauses.push(match);
      }
    }

    // 5. Deliberate Second-Stage Search for Exclusions (if not already captured)
    if (query.retrieveNegativeEvidence !== false && exclusionClauses.length === 0) {
      const exclusionCorpus = eligibleCorpus.filter((c) => c.clauseType === 'exclusion');
      if (exclusionCorpus.length > 0) {
        const adverseCandidates = this.retrieveLexical(searchText, exclusionCorpus, 3);
        for (const adv of adverseCandidates) {
          // Require significant BM25 content match (score >= 1.0) so isolated words like 'fee' don't trigger false exclusions
          if (adv.score >= 1.0) {
            adv.evidenceCategory = 'ADVERSE_EXCLUSION';
            exclusionClauses.push(adv);
            auditNotes.push(`Second-stage search uncovered adverse exclusion: ${adv.clause.heading}`);
          }
        }
      }
    }

    // 6. Detect conflicting or superseded clauses
    this.detectConflictingEvidence(supportiveClauses, limitClauses, conflictingClauses, auditNotes);

    // 7. Execute Evidence Verification Contract
    const verification = this.evaluateVerificationContract(
      query,
      method,
      supportiveClauses,
      exclusionClauses,
      limitClauses,
      conflictingClauses,
      auditNotes
    );

    const latencyMs = Date.now() - startTime;

    return {
      query,
      retrievalMethod: method,
      supportiveClauses: supportiveClauses.slice(0, topK),
      exclusionClauses: exclusionClauses.slice(0, topK),
      limitClauses: limitClauses.slice(0, topK),
      conflictingClauses: conflictingClauses.slice(0, topK),
      verification,
      auditNotes,
      latencyMs
    };
  }

  // ==========================================================================
  // Helper Methods: Applicability, Conflict Detection, Verification
  // ==========================================================================

  private filterCorpusByApplicability(
    query: ClauseRetrievalQuery,
    corpus: IndexedPolicyClause[],
    auditNotes: string[]
  ): IndexedPolicyClause[] {
    const { familyId, treatmentDate, resolvedVersionId, applicableAmendmentIds } = query;

    return corpus.filter((clause) => {
      // Must match family ID
      if (clause.familyId !== familyId) {
        return false;
      }

      // If resolved base version and amendments were provided by Prompt 2 resolver
      if (resolvedVersionId) {
        const isValidBase = clause.versionId === resolvedVersionId;
        const isValidAmendment =
          applicableAmendmentIds && applicableAmendmentIds.includes(clause.versionId);

        if (!isValidBase && !isValidAmendment) {
          auditNotes.push(
            `Filtered out clause '${clause.clauseId}' belonging to unselected version '${clause.versionId}'.`
          );
          return false;
        }
      }

      // Treatment date bounds check
      if (treatmentDate) {
        if (clause.effectiveFrom && treatmentDate < clause.effectiveFrom) {
          auditNotes.push(
            `Clause '${clause.clauseId}' rejected: treatment date ${treatmentDate} precedes effective date ${clause.effectiveFrom}.`
          );
          return false;
        }
        if (clause.effectiveTo && treatmentDate > clause.effectiveTo) {
          auditNotes.push(
            `Clause '${clause.clauseId}' rejected: treatment date ${treatmentDate} succeeds expiry date ${clause.effectiveTo}.`
          );
          return false;
        }
      }

      return true;
    });
  }

  private categorizeEvidence(
    clause: IndexedPolicyClause
  ): 'SUPPORTIVE' | 'ADVERSE_EXCLUSION' | 'CONDITIONAL_LIMIT' | 'CONFLICTING' {
    if (clause.clauseType === 'exclusion') return 'ADVERSE_EXCLUSION';
    if (
      clause.clauseType === 'limit' ||
      clause.clauseType === 'proportionate_deduction' ||
      clause.clauseType === 'co_payment' ||
      clause.clauseType === 'deductible'
    ) {
      return 'CONDITIONAL_LIMIT';
    }
    return 'SUPPORTIVE';
  }

  private detectConflictingEvidence(
    supportive: CandidateClauseMatch[],
    limits: CandidateClauseMatch[],
    conflicts: CandidateClauseMatch[],
    auditNotes: string[]
  ): void {
    // Genuine conflict occurs when two active candidates from different versions
    // provide contradictory terms or modifications for the same category
    const allRelevant = [...supportive, ...limits].filter((m) => m.score >= 0.05);

    for (let i = 0; i < allRelevant.length; i++) {
      for (let j = i + 1; j < allRelevant.length; j++) {
        const a = allRelevant[i].clause;
        const b = allRelevant[j].clause;

        if (
          a.versionId !== b.versionId &&
          (
            (a.heading.toLowerCase().includes('room rent') && b.heading.toLowerCase().includes('room rent')) ||
            (a.limitValue !== null && b.limitValue !== null && a.limitValue !== b.limitValue &&
             a.applicableCategories.some((cat) => b.applicableCategories.includes(cat)))
          )
        ) {
          if (!conflicts.some((c) => c.clause.clauseId === b.clauseId)) {
            conflicts.push(allRelevant[j]);
            auditNotes.push(`Conflicting terms detected across versions: ${b.clauseId} vs ${a.clauseId}`);
          }
        }
      }
    }
  }

  private getRelevanceThreshold(method: RetrievalMethod): number {
    if (method === 'HYBRID_RRF') return 0.005;
    if (method === 'SEMANTIC_VECTOR') return 0.18;
    return 0.1;
  }

  private evaluateVerificationContract(
    query: ClauseRetrievalQuery,
    method: RetrievalMethod,
    supportive: CandidateClauseMatch[],
    exclusions: CandidateClauseMatch[],
    limits: CandidateClauseMatch[],
    conflicts: CandidateClauseMatch[],
    auditNotes: string[]
  ): EvidenceVerificationDecision {
    const reviewReasons: string[] = [];
    const threshold = this.getRelevanceThreshold(method);

    // Calculate maximum retrieval score across all candidate channels
    const topSuppScore = supportive[0]?.score || 0;
    const topExclScore = exclusions[0]?.score || 0;
    const topLimitScore = limits[0]?.score || 0;
    const maxScore = Math.max(topSuppScore, topExclScore, topLimitScore);

    // 1. If overall evidence is below minimum confidence threshold -> INSUFFICIENT EVIDENCE
    if (maxScore < threshold) {
      return {
        status: 'insufficient_evidence',
        primarySupportiveClause: null,
        primaryExclusionClause: null,
        primaryLimitClause: null,
        conflictingClauses: [],
        manualReviewRequired: true,
        reviewReasons: ['No matching policy clauses found with sufficient retrieval confidence.'],
        verificationSummary: 'Insufficient evidence found in indexed policy terms.'
      };
    }

    // 2. If adverse exclusion found with high score exceeding other candidates -> EXCLUDED
    const isStatutoryConsumable =
      query.category === 'CONSUMABLES_NON_PAYABLES' &&
      exclusions.some(e => e.clause.clauseId.includes('irdai_non_payable'));

    if (
      (exclusions.length > 0 &&
      exclusions[0].score >= threshold &&
      exclusions[0].score >= topLimitScore &&
      exclusions[0].score >= topSuppScore) ||
      isStatutoryConsumable
    ) {
      const topExcl = exclusions[0];
      return {
        status: 'excluded',
        primarySupportiveClause: supportive[0] || null,
        primaryExclusionClause: topExcl,
        primaryLimitClause: limits[0] || null,
        conflictingClauses: conflicts,
        manualReviewRequired: false,
        reviewReasons: [],
        verificationSummary: `Item matches contractual or statutory exclusion: ${topExcl.clause.heading}.`
      };
    }

    // 3. If conflicting active clauses exist across versions -> CONFLICTING
    if (conflicts.length > 0 && conflicts[0].score >= threshold) {
      reviewReasons.push('Conflicting contractual terms or multiple amendment versions detected.');
      return {
        status: 'conflicting',
        primarySupportiveClause: supportive[0] || null,
        primaryExclusionClause: null,
        primaryLimitClause: limits[0] || null,
        conflictingClauses: conflicts,
        manualReviewRequired: true,
        reviewReasons,
        verificationSummary: 'Conflicting terms detected between base contract and endorsements.'
      };
    }

    // 4. If conditional limits / sublimits exist -> CONDITIONAL
    if (limits.length > 0 && limits[0].score >= threshold) {
      const topLimit = limits[0];
      return {
        status: 'conditional',
        primarySupportiveClause: supportive[0] || null,
        primaryExclusionClause: null,
        primaryLimitClause: topLimit,
        conflictingClauses: conflicts,
        manualReviewRequired: false,
        reviewReasons: [],
        verificationSummary: `Item subject to conditional policy limit: ${topLimit.clause.heading}.`
      };
    }

    // 5. If supportive clause found -> SUPPORTED
    if (supportive.length > 0 && supportive[0].score >= threshold) {
      const topSupp = supportive[0];
      return {
        status: 'supported',
        primarySupportiveClause: topSupp,
        primaryExclusionClause: null,
        primaryLimitClause: null,
        conflictingClauses: conflicts,
        manualReviewRequired: topSupp.requiresVerification,
        reviewReasons: topSupp.requiresVerification ? ['Clause segmentation was uncertain'] : [],
        verificationSummary: `Item supported by policy clause: ${topSupp.clause.heading}.`
      };
    }

    // 6. Default fallback
    return {
      status: 'insufficient_evidence',
      primarySupportiveClause: null,
      primaryExclusionClause: null,
      primaryLimitClause: null,
      conflictingClauses: [],
      manualReviewRequired: true,
      reviewReasons: ['No matching policy clauses found with sufficient retrieval confidence.'],
      verificationSummary: 'Insufficient evidence found in indexed policy terms.'
    };
  }
}

export const hybridRetrievalService = new HybridRetrievalService();
