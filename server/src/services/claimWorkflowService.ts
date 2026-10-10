import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  MoneyMinor,
  ClaimAssessmentState,
  BillDocument,
  ClaimLineItem,
  ClaimStatus,
  ClaimReviewStatus,
  rupeesToPaise
} from '../types/claim.js';
import { PolicyDocument } from '../types/policy.js';
import {
  PolicyVersionRecord,
  PolicyApplicabilityResult,
  ClauseModification
} from '../types/policyVersion.js';
import { BillItemVerificationResult } from '../types/verification.js';
import {
  ClaimAdjudicationRequest,
  ClaimAdjudicationResult,
  ClaimFinancialRules
} from '../types/adjudication.js';
import {
  CreateClaimRequest,
  UpdateBillItemRequest,
  RegisterAmendmentRequest,
  ReassessClaimRequest,
  AssessmentComparisonResult,
  LineItemComparisonDiff
} from '../types/claimApi.js';
import { resolvePolicyApplicability } from './policyVersionService.js';
import { clauseIndexingService, IRDAI_STATUTORY_NON_PAYABLE_CLAUSES } from './clauseIndexingService.js';
import { HybridRetrievalService } from './hybridRetrievalService.js';
import { evidenceVerificationService } from './evidenceVerificationService.js';
import { claimAdjudicationService } from './claimAdjudicationService.js';
import { billExtractionService } from './billExtractionService.js';
import { ClaimAssessment } from '../models/Claim.js';
import { PolicyVersion } from '../models/PolicyVersion.js';
import { Policy } from '../models/Policy.js';

interface ClaimStateWithHistory extends ClaimAssessmentState {
  userId?: string | null;
  history: ClaimAdjudicationResult[];
  latestAssessment: ClaimAdjudicationResult;
}

export class ClaimWorkflowService {
  private hybridRetrieval: HybridRetrievalService;

  // In-memory fallback caches for claims and policy versions
  private memoryClaims = new Map<string, ClaimStateWithHistory>();
  private memoryVersions = new Map<string, PolicyVersionRecord[]>();
  private idempotencyCache = new Map<string, ClaimAssessmentState>();

  constructor() {
    this.hybridRetrieval = new HybridRetrievalService();
    this.initDefaultPolicyVersions();
  }

  // ==========================================================================
  // 1. Create and Assess Claim Workflow
  // ==========================================================================

  public assessClaim(
    request: CreateClaimRequest,
    userId?: string | null
  ): Promise<ClaimAssessmentState> {
    return this.createClaimAssessment(request, userId);
  }

  public async createClaimAssessment(
    request: CreateClaimRequest,
    userId?: string | null
  ): Promise<ClaimAssessmentState> {
    // Idempotency check
    if (request.clientRequestId && this.idempotencyCache.has(request.clientRequestId)) {
      return this.idempotencyCache.get(request.clientRequestId)!;
    }

    const claimId = request.claimId || `clm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const treatmentDate = request.treatmentDate;
    const policyFamilyId = request.policyFamilyId;

    // Ingest and validate bill
    const bill: BillDocument = billExtractionService.ingestStructuredBill(request.bill);

    // 1. Resolve Policy Lineage & Applicability
    const versions = await this.getVersionsForFamily(policyFamilyId);
    let applicability: PolicyApplicabilityResult;

    if (versions.length > 0) {
      applicability = resolvePolicyApplicability({
        familyId: policyFamilyId,
        treatmentDate,
        versions
      });
    } else {
      // Check legacy Policy model or create synthetic fallback base version
      const legacyPolicy = await this.findLegacyPolicy(request.policyId || policyFamilyId);
      if (legacyPolicy) {
        const syntheticBase = this.convertLegacyToVersion(legacyPolicy, policyFamilyId);
        applicability = resolvePolicyApplicability({
          familyId: policyFamilyId,
          treatmentDate,
          versions: [syntheticBase]
        });
      } else {
        applicability = resolvePolicyApplicability({
          familyId: policyFamilyId,
          treatmentDate,
          versions: []
        });
      }
    }

    // 2. Clause Retrieval & Verification
    const verifiedItemEvidence: BillItemVerificationResult[] = [];
    const corpus = this.buildClauseCorpus(applicability);

    for (const item of bill.lineItems) {
      const retrievalResult = await this.hybridRetrieval.matchBillItem(
        {
          billItemDescription: item.originalDescription,
          familyId: policyFamilyId,
          treatmentDate,
          resolvedVersionId: applicability.selectedBaseVersion?.versionId ?? null,
          applicableAmendmentIds: applicability.applicableAmendments.map(a => a.versionId),
          category: item.category,
          topK: 5
        },
        corpus
      );

      const verificationResult = await evidenceVerificationService.verifyBillItemEvidence({
        billItemId: item.itemId,
        originalDescription: item.originalDescription,
        normalizedDescription: item.normalizedDescription,
        category: item.category,
        claimedAmountPaise: item.claimedAmountPaise,
        treatmentDate,
        familyId: policyFamilyId,
        retrievedEvidence: retrievalResult
      });

      verifiedItemEvidence.push(verificationResult);
    }

    // 3. Deterministic Financial Claim Adjudication
    const policyVersionRecord = applicability.selectedBaseVersion;
    const policyDocument = applicability.mergedPolicySnapshot || policyVersionRecord?.policyData;

    const adjudicationRequest: ClaimAdjudicationRequest = {
      requestId: `req_${claimId}_initial`,
      bill,
      treatmentDate,
      policyVersion: policyVersionRecord,
      policyDocument,
      verifiedItemEvidence,
      financialRules: request.financialRules
    };

    const adjudicationResult = claimAdjudicationService.adjudicateClaim(adjudicationRequest);

    // 4. Construct Final Claim Assessment State
    const claimState: ClaimStateWithHistory = {
      claimId,
      policyFamilyId,
      selectedPolicyVersionId: policyVersionRecord?.versionId || null,
      applicableAmendmentIds: applicability.applicableAmendments.map(a => a.versionId),
      treatmentDate,
      bill,
      status: adjudicationResult.claimStatus,
      reviewStatus: adjudicationResult.reviewStatus,
      reviewReasons: adjudicationResult.reviewReasons,
      ledger: adjudicationResult.ledger,
      traceId: adjudicationResult.trace.traceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: userId || null,
      history: [adjudicationResult],
      latestAssessment: adjudicationResult,
      verifiedItemEvidence
    } as any;

    await this.persistClaim(claimState);

    if (request.clientRequestId) {
      this.idempotencyCache.set(request.clientRequestId, claimState);
    }

    return claimState;
  }

  // ==========================================================================
  // 2. Retrieve Claim & Detailed Artifacts
  // ==========================================================================

  public async getClaim(claimId: string, userId?: string | null): Promise<ClaimStateWithHistory | null> {
    if (this.memoryClaims.has(claimId)) {
      const claim = this.memoryClaims.get(claimId)!;
      if (userId && claim.userId && claim.userId !== userId) {
        throw new Error('ACCESS_DENIED: You are not authorized to access this claim record.');
      }
      return claim;
    }

    if (mongoose.connection.readyState === 1) {
      const doc = await ClaimAssessment.findById(claimId).lean();
      if (doc) {
        return doc as any;
      }
    }

    return null;
  }

  // ==========================================================================
  // 3. Human Bill Item Correction (Non-Mutating Before/After)
  // ==========================================================================

  public async updateBillItem(
    claimId: string,
    itemId: string,
    update: UpdateBillItemRequest,
    userId?: string | null
  ): Promise<ClaimAssessmentState> {
    const claim = await this.getClaim(claimId, userId);
    if (!claim) {
      throw new Error(`CLAIM_NOT_FOUND: Claim '${claimId}' does not exist.`);
    }

    const itemIndex = claim.bill.lineItems.findIndex(it => it.itemId === itemId);
    if (itemIndex === -1) {
      throw new Error(`ITEM_NOT_FOUND: Line item '${itemId}' does not exist in claim bill.`);
    }

    const originalItem = claim.bill.lineItems[itemIndex];

    // Clone line items to prevent in-place mutation of previous snapshots
    const updatedLineItems = [...claim.bill.lineItems];
    const newQuantity = update.quantity !== undefined ? update.quantity : originalItem.quantity;
    const newUnitPrice = update.unitPricePaise !== undefined
      ? update.unitPricePaise
      : (update as any).unitPriceRupees !== undefined
        ? rupeesToPaise((update as any).unitPriceRupees)
        : originalItem.unitPricePaise;
    const newClaimed = update.claimedAmountPaise !== undefined
      ? update.claimedAmountPaise
      : (update as any).claimedAmountRupees !== undefined
        ? rupeesToPaise((update as any).claimedAmountRupees)
        : newQuantity * newUnitPrice;

    const updatedItem: ClaimLineItem = {
      ...originalItem,
      originalDescription: update.originalDescription || originalItem.originalDescription,
      category: update.category || originalItem.category,
      quantity: newQuantity,
      unitPricePaise: newUnitPrice,
      claimedAmountPaise: newClaimed,
      isNonPayableByRegulation: update.isNonPayableByRegulation !== undefined
        ? update.isNonPayableByRegulation
        : originalItem.isNonPayableByRegulation,
      classificationStatus: 'MANUAL_USER_OVERRIDE',
      reviewFlags: [
        ...originalItem.reviewFlags.filter(f => f !== 'USER_CORRECTED'),
        'USER_CORRECTED'
      ],
      provenance: {
        ...originalItem.provenance,
        sourceType: 'MANUAL_ENTRY',
        rawExtractedText: `${originalItem.provenance.rawExtractedText} [CORRECTED: ${update.correctionReason}]`,
        extractedTimestamp: new Date().toISOString(),
        confidenceScore: 1.0
      }
    };

    updatedLineItems[itemIndex] = updatedItem;

    const newCalculatedTotal = updatedLineItems.reduce((sum, it) => sum + it.claimedAmountPaise, 0);
    const newDiff = claim.bill.originalBillTotalPaise - newCalculatedTotal;

    const updatedBill: BillDocument = {
      ...claim.bill,
      lineItems: updatedLineItems,
      calculatedItemsTotalPaise: newCalculatedTotal,
      reconciliationDifferencePaise: newDiff,
      reconciliationStatus: newDiff === 0 ? 'RECONCILED' : 'DISCREPANCY'
    };

    claim.bill = updatedBill;
    claim.updatedAt = new Date().toISOString();

    await this.persistClaim(claim);
    return claim;
  }

  // ==========================================================================
  // 4. Policy Amendment Registration
  // ==========================================================================

  public async registerAmendment(
    familyId: string,
    amendment: RegisterAmendmentRequest,
    _userId?: string | null
  ): Promise<PolicyVersionRecord> {
    const versionRecord: PolicyVersionRecord = {
      familyId,
      versionId: amendment.amendmentId,
      versionNumber: amendment.versionNumber,
      documentType: 'AMENDMENT',
      amendmentScope: amendment.amendmentScope || 'MODIFIES_SPECIFIC_CLAUSES',
      insurerName: 'Policy Insurer',
      planName: 'Endorsement / Amendment',
      documentId: `doc_${amendment.amendmentId}`,
      effectiveFrom: amendment.effectiveFrom,
      effectiveTo: amendment.effectiveTo || null,
      uploadTimestamp: new Date().toISOString(),
      extractedTimestamp: new Date().toISOString(),
      extractionStatus: 'VERIFIED',
      clauseModifications: amendment.clauseModifications,
      policyData: (amendment.policyDataUpdates as any) || {},
      unresolvedQuestions: []
    };

    // Store in version cache
    const existing = await this.getVersionsForFamily(familyId);
    existing.push(versionRecord);
    this.memoryVersions.set(familyId, existing);

    if (mongoose.connection.readyState === 1) {
      await PolicyVersion.findOneAndUpdate(
        { _id: versionRecord.versionId },
        { ...versionRecord, _id: versionRecord.versionId },
        { upsert: true }
      );
    }

    return versionRecord;
  }

  // ==========================================================================
  // 5. Reassess Claim and Before/After Comparison
  // ==========================================================================

  public async reassessClaim(
    claimId: string,
    request: ReassessClaimRequest,
    userId?: string | null
  ): Promise<{
    current: ClaimAssessmentState;
    comparison: AssessmentComparisonResult;
  }> {
    const claim = await this.getClaim(claimId, userId);
    if (!claim) {
      throw new Error(`CLAIM_NOT_FOUND: Claim '${claimId}' does not exist.`);
    }

    const priorAssessment = claim.latestAssessment;
    const treatmentDate = request.treatmentDate || claim.treatmentDate || new Date().toISOString().substring(0, 10);
    const familyId = claim.policyFamilyId;

    // Re-resolve applicability with updated treatment date or amendments
    const versions = await this.getVersionsForFamily(familyId);
    const applicability = resolvePolicyApplicability({
      familyId,
      treatmentDate,
      versions
    });

    // Re-retrieve and verify evidence
    const corpus = this.buildClauseCorpus(applicability);
    const verifiedItemEvidence: BillItemVerificationResult[] = [];

    for (const item of claim.bill.lineItems) {
      const retrievalResult = await this.hybridRetrieval.matchBillItem(
        {
          billItemDescription: item.originalDescription,
          familyId,
          treatmentDate,
          resolvedVersionId: applicability.selectedBaseVersion?.versionId ?? null,
          applicableAmendmentIds: applicability.applicableAmendments.map(a => a.versionId),
          category: item.category,
          topK: 5
        },
        corpus
      );

      const verificationResult = await evidenceVerificationService.verifyBillItemEvidence({
        billItemId: item.itemId,
        originalDescription: item.originalDescription,
        normalizedDescription: item.normalizedDescription,
        category: item.category,
        claimedAmountPaise: item.claimedAmountPaise,
        treatmentDate,
        familyId,
        retrievedEvidence: retrievalResult
      });

      verifiedItemEvidence.push(verificationResult);
    }

    // Recompute adjudication
    const policyVersionRecord = applicability.selectedBaseVersion;
    const policyDocument = applicability.mergedPolicySnapshot || policyVersionRecord?.policyData;

    const adjudicationRequest: ClaimAdjudicationRequest = {
      requestId: `req_${claimId}_reassess_${Date.now()}`,
      bill: claim.bill,
      treatmentDate,
      policyVersion: policyVersionRecord,
      policyDocument,
      verifiedItemEvidence,
      financialRules: request.financialRules,
      priorAssessmentId: priorAssessment.assessmentId
    };

    const recomputedResult = claimAdjudicationService.adjudicateClaim(adjudicationRequest);

    // Update claim state without mutating prior assessment snapshot
    claim.history.push(recomputedResult);
    claim.latestAssessment = recomputedResult;
    claim.treatmentDate = treatmentDate;
    claim.selectedPolicyVersionId = policyVersionRecord?.versionId || null;
    claim.applicableAmendmentIds = applicability.applicableAmendments.map(a => a.versionId);
    claim.status = recomputedResult.claimStatus;
    claim.reviewStatus = recomputedResult.reviewStatus;
    claim.reviewReasons = recomputedResult.reviewReasons;
    claim.ledger = recomputedResult.ledger;
    claim.traceId = recomputedResult.trace.traceId;
    (claim as any).verifiedItemEvidence = verifiedItemEvidence;
    claim.updatedAt = new Date().toISOString();

    await this.persistClaim(claim);

    // Compute comparison
    const comparison = this.compareAssessments(claim, priorAssessment, recomputedResult, request.reassessmentReason);

    return {
      current: claim,
      comparison
    };
  }

  // ==========================================================================
  // 6. Before / After Assessment Comparison
  // ==========================================================================

  public compareAssessments(claimId: string): Promise<AssessmentComparisonResult>;
  public compareAssessments(
    claim: ClaimAssessmentState,
    prior?: ClaimAdjudicationResult,
    current?: ClaimAdjudicationResult,
    reason?: string
  ): AssessmentComparisonResult;
  public compareAssessments(
    claimOrClaimId: ClaimAssessmentState | string,
    prior?: ClaimAdjudicationResult,
    current?: ClaimAdjudicationResult,
    reason?: string
  ): AssessmentComparisonResult | Promise<AssessmentComparisonResult> {
    if (typeof claimOrClaimId === 'string') {
      return this.compareClaimAssessments(claimOrClaimId);
    }
    const claim = claimOrClaimId;
    const resolvedPrior = prior || ((claim as any).history?.length > 1
      ? (claim as any).history[(claim as any).history.length - 2]
      : (claim as any).latestAssessment);
    const resolvedCurrent = current || (claim as any).latestAssessment;

    const priorLedger = resolvedPrior.ledger;
    const currentLedger = resolvedCurrent.ledger;

    // Line item differences
    const lineItemDiffs: LineItemComparisonDiff[] = [];
    for (const curItem of resolvedCurrent.itemizedLedger) {
      const priorItem = (resolvedPrior.itemizedLedger as any[]).find((p: any) => p.itemId === curItem.itemId);
      const priorClaimed = priorItem?.claimedAmountPaise ?? 0;
      const priorPayable = priorItem?.insurerPayablePaise ?? 0;
      const priorPatient = priorItem?.patientResponsibilityPaise ?? 0;

      const claimedDiff = curItem.claimedAmountPaise - priorClaimed;
      const payableDiff = curItem.insurerPayablePaise - priorPayable;

      if (claimedDiff !== 0 || payableDiff !== 0 || !priorItem) {
        lineItemDiffs.push({
          itemId: curItem.itemId,
          description: curItem.originalDescription,
          priorClaimedPaise: priorClaimed,
          currentClaimedPaise: curItem.claimedAmountPaise,
          priorInsurerPayablePaise: priorPayable,
          currentInsurerPayablePaise: curItem.insurerPayablePaise,
          priorPatientResponsibilityPaise: priorPatient,
          currentPatientResponsibilityPaise: curItem.patientResponsibilityPaise,
          differenceSummary: `Claimed delta: ${claimedDiff / 100} INR, Insurer delta: ${payableDiff / 100} INR`
        });
      }
    }

    // Review reason diffs
    const priorReasonsSet = new Set(resolvedPrior.reviewReasons);
    const currentReasonsSet = new Set(resolvedCurrent.reviewReasons);

    const newReviewReasons = (resolvedCurrent.reviewReasons as string[]).filter((r: string) => !priorReasonsSet.has(r));
    const resolvedReviewReasons = (resolvedPrior.reviewReasons as string[]).filter((r: string) => !currentReasonsSet.has(r));

    return {
      claimId: claim.claimId,
      priorAssessmentId: resolvedPrior.assessmentId,
      currentAssessmentId: resolvedCurrent.assessmentId,
      comparedAt: new Date().toISOString(),
      treatmentDateChanged: resolvedPrior.treatmentDate !== resolvedCurrent.treatmentDate,
      priorTreatmentDate: resolvedPrior.treatmentDate,
      currentTreatmentDate: resolvedCurrent.treatmentDate,
      policyVersionChanged: resolvedPrior.policyVersionId !== resolvedCurrent.policyVersionId,
      priorPolicyVersionId: resolvedPrior.policyVersionId,
      currentPolicyVersionId: resolvedCurrent.policyVersionId,
      totalClaimedDeltaPaise: currentLedger.totalClaimedPaise - priorLedger.totalClaimedPaise,
      claimedTotalDeltaPaise: currentLedger.totalClaimedPaise - priorLedger.totalClaimedPaise,
      insurerPayableDeltaPaise: currentLedger.finalInsurerPayablePaise - priorLedger.finalInsurerPayablePaise,
      patientResponsibilityDeltaPaise: currentLedger.totalPatientResponsibilityPaise - priorLedger.totalPatientResponsibilityPaise,
      excludedNonPayableDeltaPaise: currentLedger.totalExcludedNonPayablePaise - priorLedger.totalExcludedNonPayablePaise,
      proportionateDisallowanceDeltaPaise: currentLedger.totalProportionateDisallowancePaise - priorLedger.totalProportionateDisallowancePaise,
      sublimitDisallowanceDeltaPaise: currentLedger.totalSublimitDisallowancePaise - priorLedger.totalSublimitDisallowancePaise,
      deductibleDeltaPaise: currentLedger.appliedDeductiblePaise - priorLedger.appliedDeductiblePaise,
      copayDeltaPaise: currentLedger.appliedCopayPaise - priorLedger.appliedCopayPaise,
      priorSummary: {
        claimedPaise: priorLedger.totalClaimedPaise,
        insurerPayablePaise: priorLedger.finalInsurerPayablePaise,
        patientResponsibilityPaise: priorLedger.totalPatientResponsibilityPaise,
        reviewRequired: resolvedPrior.reviewRequired
      },
      currentSummary: {
        claimedPaise: currentLedger.totalClaimedPaise,
        insurerPayablePaise: currentLedger.finalInsurerPayablePaise,
        patientResponsibilityPaise: currentLedger.totalPatientResponsibilityPaise,
        reviewRequired: resolvedCurrent.reviewRequired
      },
      lineItemDiffs,
      lineItemDifferences: lineItemDiffs,
      reviewStatusChanged: resolvedPrior.reviewStatus !== resolvedCurrent.reviewStatus,
      priorReviewStatus: resolvedPrior.reviewStatus,
      currentReviewStatus: resolvedCurrent.reviewStatus,
      newReviewReasons,
      resolvedReviewReasons,
      changeSummary: reason || 'Claim assessment recomputation comparison'
    } as any as AssessmentComparisonResult;
  }

  // ==========================================================================
  // Internal Helpers & Caching
  // ==========================================================================

  private async persistClaim(claim: ClaimStateWithHistory): Promise<void> {
    this.memoryClaims.set(claim.claimId, claim);
    if (mongoose.connection.readyState === 1) {
      try {
        await ClaimAssessment.findOneAndUpdate(
          { _id: claim.claimId },
          { ...claim, _id: claim.claimId },
          { upsert: true }
        );
      } catch (err) {
        console.warn(`[ClaimWorkflow] Mongo save skipped: ${(err as any).message}`);
      }
    }
  }

  private async getVersionsForFamily(familyId: string): Promise<PolicyVersionRecord[]> {
    if (this.memoryVersions.has(familyId)) {
      return this.memoryVersions.get(familyId)!;
    }

    if (mongoose.connection.readyState === 1) {
      const records = await PolicyVersion.find({ familyId }).lean();
      if (records.length > 0) {
        this.memoryVersions.set(familyId, records as any);
        return records as any;
      }
    }

    return [];
  }

  private async findLegacyPolicy(policyId: string): Promise<PolicyDocument | null> {
    if (mongoose.connection.readyState === 1) {
      const pol = await Policy.findById(policyId).lean();
      if (pol) return pol as any;
    }
    return null;
  }

  private convertLegacyToVersion(policy: PolicyDocument, familyId: string): PolicyVersionRecord {
    return {
      familyId,
      versionId: `${familyId}_base_v1.0`,
      versionNumber: '1.0',
      documentType: 'BASE_POLICY',
      insurerName: policy.insurer || 'Health Insurer',
      planName: policy.planName || 'Base Plan',
      documentId: `doc_${policy._id || familyId}`,
      effectiveFrom: policy.policyStartDate || '2020-01-01',
      effectiveTo: policy.policyEndDate || '2030-12-31',
      uploadTimestamp: new Date().toISOString(),
      extractedTimestamp: new Date().toISOString(),
      extractionStatus: 'VERIFIED',
      clauseModifications: [],
      policyData: policy,
      unresolvedQuestions: []
    };
  }

  private buildClauseCorpus(applicability: PolicyApplicabilityResult): any[] {
    const corpus: any[] = [...IRDAI_STATUTORY_NON_PAYABLE_CLAUSES];
    if (applicability.selectedBaseVersion) {
      const baseClauses = clauseIndexingService.indexPolicyVersion(applicability.selectedBaseVersion);
      corpus.push(...baseClauses);
    }
    for (const amendment of applicability.applicableAmendments) {
      const amendmentClauses = clauseIndexingService.indexPolicyVersion(amendment);
      corpus.push(...amendmentClauses);
    }
    return corpus;
  }

  private initDefaultPolicyVersions(): void {
    // Seed standard Star Health and HDFC ERGO demo policy lineages
    const starBase: PolicyVersionRecord = {
      familyId: 'fam_star_optima',
      versionId: 'ver_star_optima_v1.0_2024',
      versionNumber: '1.0',
      documentType: 'BASE_POLICY',
      insurerName: 'Star Health and Allied Insurance',
      planName: 'Family Health Optima',
      documentId: 'doc_star_optima_v1',
      effectiveFrom: '2024-01-01',
      effectiveTo: '2024-12-31',
      uploadTimestamp: '2024-01-01T00:00:00Z',
      extractedTimestamp: '2024-01-01T00:00:00Z',
      extractionStatus: 'VERIFIED',
      clauseModifications: [],
      policyData: {
        _id: 'pol_demo_star_v1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        confirmedByUser: true,
        insurer: 'Star Health and Allied Insurance',
        insurerAliases: ['Star Health'],
        planName: 'Family Health Optima',
        policyType: 'individual',
        policyNumber: 'POL-STAR-2024-01',
        uin: 'SHAHLIP21023V022021',
        policyStartDate: '2024-01-01',
        policyEndDate: '2024-12-31',
        zone: 'Zone 1',
        networkType: 'all-network',
        cashlessAvailable: true,
        tpa: null,
        insuredPersons: [],
        sumInsured: 500000,
        roomLimit: { type: 'amount', value: 5000 },
        icuLimit: { type: 'none' },
        copay: 0,
        nonNetworkCopay: null,
        copayConditions: {},
        deductible: 0,
        proportionateDeduction: true,
        subLimits: { cataract: 40000 },
        restorationBenefit: true,
        cumulativeBonus: 0
      } as any,
      unresolvedQuestions: []
    };

    const starAmendment2025: PolicyVersionRecord = {
      familyId: 'fam_star_optima',
      versionId: 'ver_star_optima_v1.1_2025_amend',
      versionNumber: '1.1',
      documentType: 'AMENDMENT',
      parentVersionId: 'ver_star_optima_v1.0_2024',
      amendmentScope: 'MODIFIES_SPECIFIC_CLAUSES',
      insurerName: 'Star Health and Allied Insurance',
      planName: 'Family Health Optima Endorsement 2025',
      documentId: 'doc_star_optima_v1.1',
      effectiveFrom: '2025-01-01',
      effectiveTo: '2025-12-31',
      uploadTimestamp: '2025-01-01T00:00:00Z',
      extractedTimestamp: '2025-01-01T00:00:00Z',
      extractionStatus: 'VERIFIED',
      clauseModifications: [
        {
          clauseId: 'cl_star_room_rent_2025',
          clauseTitle: 'Room Rent Daily Enhancement',
          changeType: 'MODIFIED',
          targetPath: 'roomLimit.value',
          previousClauseText: 'Room Rent capped at ₹5,000 per day',
          newClauseText: 'Room Rent capped at ₹6,500 per day',
          description: 'Enhanced room tariff limit to ₹6,500'
        }
      ],
      policyData: {
        roomLimit: { type: 'amount', value: 6500 }
      } as any,
      unresolvedQuestions: []
    };

    this.memoryVersions.set('fam_star_optima', [starBase, starAmendment2025]);

    // Synthetic Evaluation Policy Family (syn_fam_health_01)
    const synBase: PolicyVersionRecord = {
      familyId: 'syn_fam_health_01',
      versionId: 'syn_ver_base_2025_v1',
      versionNumber: '1.0',
      documentType: 'BASE_POLICY',
      insurerName: 'Synthetic Health Assurance Ltd',
      planName: 'Synthetic Comprehensive Health Shield',
      documentId: 'doc_synthetic_base_v1',
      effectiveFrom: '2025-01-01',
      effectiveTo: '2025-12-31',
      uploadTimestamp: '2025-01-01T00:00:00Z',
      extractedTimestamp: '2025-01-01T00:00:00Z',
      extractionStatus: 'VERIFIED',
      clauseModifications: [],
      policyData: {
        _id: 'doc_synthetic_base_v1',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        confirmedByUser: true,
        insurer: 'Synthetic Health Assurance Ltd',
        insurerAliases: ['Synthetic Health'],
        planName: 'Synthetic Comprehensive Health Shield',
        policyType: 'individual',
        policyNumber: 'SYN-2025-001',
        uin: 'SYN-HLT-2025-V1',
        policyStartDate: '2025-01-01',
        policyEndDate: '2025-12-31',
        zone: 'Tier 1',
        networkType: 'all-network',
        cashlessAvailable: true,
        tpa: null,
        insuredPersons: [],
        sumInsured: 500000,
        roomLimit: { type: 'amount', value: 5000 },
        icuLimit: { type: 'amount', value: 10000 },
        copay: 10,
        nonNetworkCopay: 20,
        copayConditions: {},
        deductible: 0,
        proportionateDeduction: true,
        roomCategoryRestriction: false,
        subLimits: { cataract: 40000 },
        restorationBenefit: true,
        cumulativeBonus: 50000,
        exclusions: ['Cosmetic surgery', 'Weight loss treatment', 'Unproven procedures'],
        hasOtherExclusions: true,
        sourceSnippets: {
          inpatientCoverage: 'Inpatient hospitalization expenses including surgeon fees, anesthesia, blood, oxygen, operation theatre charges, surgical appliances, and medical practitioner consultations covered up to Sum Insured of Rs.5,00,000.',
          roomLimit: 'Room rent, boarding and nursing expenses up to Rs.5,000 per day',
          icuLimit: 'ICU charges up to Rs.10,000 per day',
          copay: 'A co-payment of 10% applies to each and every admissible claim',
          proportionateDeduction: 'Associated medical expenses shall be paid in proportion to the eligible room rent limit',
          subLimits: 'Sub-limit for cataract surgery is capped at Rs.40,000 per eye',
          exclusions: 'Elective cosmetic surgery, aesthetic contouring, weight loss treatment, and unproven procedures are permanently excluded'
        }
      } as any,
      unresolvedQuestions: []
    };

    const synAmendment: PolicyVersionRecord = {
      familyId: 'syn_fam_health_01',
      versionId: 'syn_ver_amend_2025_v1.1',
      versionNumber: '1.1',
      documentType: 'AMENDMENT',
      parentVersionId: 'syn_ver_base_2025_v1',
      amendmentScope: 'MODIFIES_SPECIFIC_CLAUSES',
      insurerName: 'Synthetic Health Assurance Ltd',
      planName: 'Synthetic Comprehensive Health Shield - Endorsement A',
      documentId: 'doc_synthetic_amend_v1.1',
      effectiveFrom: '2025-07-01',
      effectiveTo: '2025-12-31',
      uploadTimestamp: '2025-06-25T14:30:00Z',
      extractedTimestamp: '2025-06-25T14:35:00Z',
      extractionStatus: 'VERIFIED',
      clauseModifications: [
        {
          clauseId: 'cl_amend_room_01',
          clauseTitle: 'Enhanced Room Rent Daily Cap',
          changeType: 'MODIFIED',
          targetPath: 'roomLimit.value',
          previousClauseText: 'Room rent, boarding and nursing expenses up to Rs.5,000 per day',
          newClauseText: 'Room rent, boarding and nursing expenses up to Rs.7,500 per day',
          description: 'Increases eligible daily room tariff from ₹5,000 to ₹7,500'
        }
      ],
      policyData: {
        roomLimit: { type: 'amount', value: 7500 }
      } as any,
      unresolvedQuestions: []
    };

    this.memoryVersions.set('syn_fam_health_01', [synBase, synAmendment]);
  }

  public async compareClaimAssessments(claimId: string): Promise<AssessmentComparisonResult> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new Error(`Claim not found: ${claimId}`);
    }
    const prior = claim.history.length > 1 ? claim.history[claim.history.length - 2] : claim.history[0] || claim.latestAssessment;
    const current = claim.latestAssessment;
    return this.compareAssessments(claim, prior, current) as AssessmentComparisonResult;
  }
}

export const claimWorkflowService = new ClaimWorkflowService();
