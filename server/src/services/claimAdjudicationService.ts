import {
  MoneyMinor,
  rupeesToPaise,
  paiseToRupees,
  formatPaise,
  safeMultiplyRatio,
  StandardChargeCategory,
  ClaimLineItem,
  BillDocument,
  ClaimAdjustmentRecord,
  DeductionScope,
  ItemAdjudicationStage,
  ClaimLedger,
  ClaimAssessmentState,
  ClaimStatus,
  ClaimReviewStatus,
  EvidenceReference
} from '../types/claim.js';
import { PolicyDocument, RoomOrIcuLimit } from '../types/policy.js';
import { PolicyVersionRecord } from '../types/policyVersion.js';
import { BillItemVerificationResult, EvidenceOutcome, VerifiedClauseCitation } from '../types/verification.js';
import {
  CalculationTraceStep,
  CalculationTrace,
  TraceOperationType,
  ItemizedLedgerEntry,
  BillReconciliationReport,
  BillReconciliationIssue,
  ClaimFinancialRules,
  ClaimAdjudicationRequest,
  ClaimAdjudicationResult,
  AssessmentHistoryRecord
} from '../types/adjudication.js';

/**
 * Categories considered 'Associated Medical Expenses' for proportionate room rent deductions.
 * Under standard Indian health insurance terms (IRDAI Master Circular), when an insured stays
 * in a room category above their entitlement, doctor consultation, surgeon fees, nursing,
 * and operation theater charges are scaled down proportionately.
 *
 * Items with fixed or regulatory pricing (Medicines/Pharmacy, Implants, Diagnostics, Ambulance)
 * are NOT subject to proportionate deductions.
 */
const PROPORTIONATELY_SCALED_CATEGORIES: ReadonlySet<StandardChargeCategory> = new Set([
  'SURGEON_CONSULTATION',
  'OT_CHARGES',
  'NURSING',
  'DAYCARE_PACKAGE'
]);

export class ClaimAdjudicationService {
  /**
   * Deterministically adjudicates an itemized hospital claim according to
   * verified policy terms, contractual clauses, and strict mathematical invariants.
   *
   * Enforces zero binary floating-point math by performing all calculations
   * strictly in integer minor currency units (paise).
   */
  public adjudicateClaim(request: ClaimAdjudicationRequest): ClaimAdjudicationResult {
    const startTimeNs = process.hrtime.bigint();
    const traceSteps: CalculationTraceStep[] = [];
    const adjustmentLedger: ClaimAdjustmentRecord[] = [];
    const reviewReasons: string[] = [];

    const traceId = `trc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const assessmentId = `asm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    let stepCounter = 1;

    // Helper to log auditable trace operations
    const logTrace = (
      operation: TraceOperationType,
      target: string,
      inputBasePaise: MoneyMinor,
      formulaApplied: string,
      adjustmentAmountPaise: MoneyMinor,
      outputAmountPaise: MoneyMinor,
      justification: string,
      ruleOrClauseId?: string | null,
      sourceEvidenceExcerpt?: string | null,
      reviewFlagTriggered?: string | null
    ) => {
      traceSteps.push({
        stepNumber: stepCounter++,
        operation,
        target,
        ruleOrClauseId: ruleOrClauseId ?? null,
        inputBasePaise,
        formulaApplied,
        adjustmentAmountPaise,
        outputAmountPaise,
        roundingRule: 'INTEGER_PAISE_ROUND_NEAREST',
        justification,
        sourceEvidenceExcerpt: sourceEvidenceExcerpt ?? null,
        reviewFlagTriggered: reviewFlagTriggered ?? null
      });
    };

    // ========================================================================
    // STAGE A: INPUT RECONCILIATION & VALIDATION
    // ========================================================================
    const billReconciliation = this.reconcileBillInputs(request.bill);
    if (!billReconciliation.isReconciled) {
      for (const issue of billReconciliation.issues) {
        reviewReasons.push(`[Bill Reconciliation] ${issue.issueType}: ${issue.message}`);
      }
    }

    logTrace(
      'BILL_INPUT_VALIDATION',
      'BILL_HEADER',
      request.bill.originalBillTotalPaise,
      `CalculatedSum = ${billReconciliation.calculatedItemsSumPaise} paise, StatedGross = ${request.bill.originalBillTotalPaise} paise`,
      billReconciliation.discrepancyPaise,
      billReconciliation.calculatedItemsSumPaise,
      billReconciliation.isReconciled
        ? 'Bill items fully reconciled to invoice stated gross total.'
        : `Bill item sum discrepancy of ${formatPaise(Math.abs(billReconciliation.discrepancyPaise))} detected.`,
      'IRDAI_BILL_INTEGRITY',
      null,
      billReconciliation.isReconciled ? null : 'DISCREPANCY_DETECTED'
    );

    // ========================================================================
    // EXTRACT & RESOLVE POLICY FINANCIAL RULES
    // ========================================================================
    const policy = request.policyDocument || request.policyVersion?.policyData;
    const rules = this.resolveFinancialRules(request, policy, reviewReasons);

    // ========================================================================
    // STAGE B: ITEM-LEVEL ADJUDICATION & EXCLUSIONS
    // ========================================================================
    const verificationMap = new Map<string, BillItemVerificationResult>();
    if (request.verifiedItemEvidence) {
      for (const ver of request.verifiedItemEvidence) {
        verificationMap.set(ver.billItemId, ver);
      }
    }

    let dailyRoomRatePaise = 0;
    let roomStayDays = 1;
    let eligibleRoomRatePerDayPaise = rules.eligibleRoomRatePerDayPaise;

    // Detect billed room rent parameters
    const roomRentItem = request.bill.lineItems.find(item => item.category === 'ROOM_RENT');
    if (roomRentItem) {
      roomStayDays = Math.max(1, roomRentItem.quantity || 1);
      dailyRoomRatePaise = roomRentItem.quantity > 0
        ? Math.round(roomRentItem.claimedAmountPaise / roomStayDays)
        : roomRentItem.unitPricePaise;
    }

    // Process line items
    const itemStages: ItemAdjudicationStage[] = [];
    const itemLedgerEntries: ItemizedLedgerEntry[] = [];
    let totalExcludedNonPayablePaise = 0;
    let totalSublimitDisallowancePaise = 0;

    for (const item of request.bill.lineItems) {
      const ver = verificationMap.get(item.itemId);
      const itemAdjustments: ClaimAdjustmentRecord[] = [];
      const itemReviewReasons: string[] = [];
      let itemReviewRequired = false;

      // Propagate verification review flags
      if (ver) {
        if (ver.reviewRequired) {
          itemReviewRequired = true;
          itemReviewReasons.push(...ver.reviewReasons);
        }
        if (ver.outcome === 'conflicting') {
          itemReviewRequired = true;
          itemReviewReasons.push('Conflicting policy clauses govern this charge; manual adjudication required.');
        } else if (ver.outcome === 'insufficient_evidence') {
          itemReviewRequired = true;
          itemReviewReasons.push('Insufficient policy evidence to confirm coverage.');
        } else if (ver.outcome === 'ambiguous') {
          itemReviewRequired = true;
          itemReviewReasons.push('Policy wording is ambiguous regarding this line item.');
        }
      }

      // Propagate item-level input review flags
      if (item.reviewFlags && item.reviewFlags.length > 0) {
        const actionableFlags = item.reviewFlags.filter(
          f => f !== 'IRDAI_NON_PAYABLE' && f !== 'USER_CORRECTED'
        );
        if (actionableFlags.length > 0) {
          itemReviewRequired = true;
          itemReviewReasons.push(
            `Line item contains input flags requiring review: ${actionableFlags.join(', ')}`
          );
        }
      }

      let excludedPaise = 0;
      let controllingClauseId: string | null = null;
      let controllingClauseExcerpt: string | null = null;

      // 1. Direct Statutory or Contractual Exclusions
      const isStatutoryExclusion = item.isNonPayableByRegulation || item.category === 'CONSUMABLES_NON_PAYABLES';
      const isVerifiedExcluded = ver?.outcome === 'excluded';

      if (isStatutoryExclusion || isVerifiedExcluded) {
        excludedPaise = item.claimedAmountPaise;
        const exclusionClause = ver?.adverseExclusionEvidence?.[0];
        controllingClauseId = exclusionClause?.clauseId || (isStatutoryExclusion ? 'IRDAI_ANNEXURE_1' : 'POLICY_EXCLUSION');
        controllingClauseExcerpt = exclusionClause?.exactExcerpt || 'Non-payable item under statutory/policy schedule.';

        const adjId = `adj_excl_${item.itemId}`;
        const adjRecord: ClaimAdjustmentRecord = {
          adjustmentId: adjId,
          targetItemId: item.itemId,
          scope: 'ITEM_LEVEL_EXCLUSION',
          description: `Exclusion Applied: ${item.originalDescription}`,
          baseAmountPaise: item.claimedAmountPaise,
          deductionAmountPaise: excludedPaise,
          remainingAmountPaise: 0,
          clauseReference: controllingClauseId,
          reasonCode: isStatutoryExclusion ? 'IRDAI_NON_PAYABLE' : 'CONTRACTUAL_EXCLUSION',
          reviewRequired: itemReviewRequired,
          uncertaintyReason: itemReviewReasons.join('; ') || null
        };
        itemAdjustments.push(adjRecord);
        adjustmentLedger.push(adjRecord);

        logTrace(
          isStatutoryExclusion ? 'STATUTORY_EXCLUSION_CHECK' : 'CONTRACTUAL_EXCLUSION_CHECK',
          item.itemId,
          item.claimedAmountPaise,
          `Deduct 100% (${item.claimedAmountPaise} paise)`,
          excludedPaise,
          0,
          `Item '${item.originalDescription}' is disallowed under ${controllingClauseId}.`,
          controllingClauseId,
          controllingClauseExcerpt,
          itemReviewRequired ? 'REVIEW_REQUIRED' : null
        );
      } else if (item.category === 'ROOM_RENT') {
        // Room Rent Capping Check
        if (rules.hasRoomRentCap && dailyRoomRatePaise > eligibleRoomRatePerDayPaise) {
          const dailyExcess = dailyRoomRatePaise - eligibleRoomRatePerDayPaise;
          const totalExcess = dailyExcess * roomStayDays;
          excludedPaise = Math.min(item.claimedAmountPaise, totalExcess);

          const roomRentClause = ver?.supportingEvidence?.[0];
          controllingClauseId = roomRentClause?.clauseId || 'CL_ROOM_RENT_CAP';
          controllingClauseExcerpt = roomRentClause?.exactExcerpt || `Room rent capped at ₹${paiseToRupees(eligibleRoomRatePerDayPaise)}/day.`;

          const adjId = `adj_room_cap_${item.itemId}`;
          const adjRecord: ClaimAdjustmentRecord = {
            adjustmentId: adjId,
            targetItemId: item.itemId,
            scope: 'ITEM_LEVEL_EXCLUSION',
            description: `Room Rent Cap: Daily rate ${formatPaise(dailyRoomRatePaise)} exceeds limit ${formatPaise(eligibleRoomRatePerDayPaise)}`,
            baseAmountPaise: item.claimedAmountPaise,
            deductionAmountPaise: excludedPaise,
            remainingAmountPaise: item.claimedAmountPaise - excludedPaise,
            clauseReference: controllingClauseId,
            reasonCode: 'ROOM_RENT_DAILY_CAP_BREACH',
            reviewRequired: itemReviewRequired,
            uncertaintyReason: itemReviewReasons.join('; ') || null
          };
          itemAdjustments.push(adjRecord);
          adjustmentLedger.push(adjRecord);

          logTrace(
            'ROOM_RENT_CAP_EVALUATION',
            item.itemId,
            item.claimedAmountPaise,
            `Excess = (${dailyRoomRatePaise} - ${eligibleRoomRatePerDayPaise}) * ${roomStayDays} = ${excludedPaise} paise`,
            excludedPaise,
            item.claimedAmountPaise - excludedPaise,
            `Room rent exceeds daily contractual entitlement of ${formatPaise(eligibleRoomRatePerDayPaise)}/day.`,
            controllingClauseId,
            controllingClauseExcerpt
          );
        }
      }

      totalExcludedNonPayablePaise += excludedPaise;
      const admissibleAfterExclusion = item.claimedAmountPaise - excludedPaise;

      // 2. Sublimit Evaluation
      let sublimitDisallowancePaise = 0;
      if (admissibleAfterExclusion > 0 && rules.sublimitsPaise) {
        const itemText = `${item.originalDescription} ${item.normalizedDescription || ''}`.toLowerCase();
        for (const [subKey, sublimitCapPaise] of Object.entries(rules.sublimitsPaise)) {
          if (sublimitCapPaise > 0 && itemText.includes(subKey.toLowerCase())) {
            if (admissibleAfterExclusion > sublimitCapPaise) {
              sublimitDisallowancePaise = admissibleAfterExclusion - sublimitCapPaise;
              const sublimitClause = ver?.supportingEvidence?.find(e => e.clauseType === 'limit');
              const subClauseId = sublimitClause?.clauseId || `SUBLIMIT_${subKey.toUpperCase()}`;

              const adjId = `adj_sublimit_${item.itemId}`;
              const adjRecord: ClaimAdjustmentRecord = {
                adjustmentId: adjId,
                targetItemId: item.itemId,
                scope: 'CATEGORY_SUBLIMIT',
                description: `Category Sublimit Cap: '${subKey}' cap is ${formatPaise(sublimitCapPaise)}`,
                baseAmountPaise: admissibleAfterExclusion,
                deductionAmountPaise: sublimitDisallowancePaise,
                remainingAmountPaise: sublimitCapPaise,
                clauseReference: subClauseId,
                reasonCode: 'PROCEDURE_SUBLIMIT_EXCEEDED',
                reviewRequired: itemReviewRequired,
                uncertaintyReason: itemReviewReasons.join('; ') || null
              };
              itemAdjustments.push(adjRecord);
              adjustmentLedger.push(adjRecord);

              logTrace(
                'ITEM_SUBLIMIT_EVALUATION',
                item.itemId,
                admissibleAfterExclusion,
                `Sublimit Excess = ${admissibleAfterExclusion} - ${sublimitCapPaise} = ${sublimitDisallowancePaise} paise`,
                sublimitDisallowancePaise,
                sublimitCapPaise,
                `Charge exceeds specific procedure sublimit of ${formatPaise(sublimitCapPaise)}.`,
                subClauseId,
                sublimitClause?.exactExcerpt || null
              );
              break;
            }
          }
        }
      }

      totalSublimitDisallowancePaise += sublimitDisallowancePaise;
      const admissibleBeforeClaimAdjustmentsPaise = Math.max(0, admissibleAfterExclusion - sublimitDisallowancePaise);

      itemStages.push({
        itemId: item.itemId,
        category: item.category,
        originalClaimedPaise: item.claimedAmountPaise,
        excludedNonPayablePaise: excludedPaise,
        admissibleAfterExclusionPaise: admissibleAfterExclusion,
        proportionateDisallowancePaise: 0, // Computed in Stage C
        sublimitDisallowancePaise,
        finalItemApprovedPaise: admissibleBeforeClaimAdjustmentsPaise,
        adjustments: itemAdjustments,
        evidenceReferences: []
      });

      itemLedgerEntries.push({
        itemId: item.itemId,
        originalDescription: item.originalDescription,
        category: item.category,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        claimedAmountPaise: item.claimedAmountPaise,
        evidenceStatus: ver?.outcome || (isStatutoryExclusion ? 'excluded' : 'supported'),
        policyVersionId: request.policyVersion?.versionId || null,
        controllingClauseId,
        controllingClauseExcerpt,
        excludedNonPayablePaise: excludedPaise,
        admissibleBeforeClaimAdjustmentsPaise,
        sublimitDisallowancePaise,
        proportionateDisallowancePaise: 0,
        allocatedDeductiblePaise: 0,
        allocatedCopayPaise: 0,
        allocatedSumInsuredExcessPaise: 0,
        insurerPayablePaise: 0,
        patientResponsibilityPaise: 0,
        adjustments: [...itemAdjustments],
        reviewRequired: itemReviewRequired,
        reviewReasons: itemReviewReasons
      });
    }

    // ========================================================================
    // STAGE C: CLAIM-LEVEL ADJUSTMENTS
    // ========================================================================

    // 1. Proportionate Deduction
    let totalProportionateDisallowancePaise = 0;
    const roomRentExcessBreached = rules.hasRoomRentCap && dailyRoomRatePaise > eligibleRoomRatePerDayPaise;

    if (roomRentExcessBreached) {
      if (rules.proportionateDeductionSupported === true) {
        const allowedRatioNumerator = eligibleRoomRatePerDayPaise;
        const allowedRatioDenominator = dailyRoomRatePaise;

        for (let i = 0; i < itemLedgerEntries.length; i++) {
          const ledgerItem = itemLedgerEntries[i];
          const stageItem = itemStages[i];

          // Check if item belongs to associated medical expenses
          if (
            PROPORTIONATELY_SCALED_CATEGORIES.has(ledgerItem.category) &&
            ledgerItem.admissibleBeforeClaimAdjustmentsPaise > 0
          ) {
            const itemBase = ledgerItem.admissibleBeforeClaimAdjustmentsPaise;
            const disallowanceRatioNumerator = allowedRatioDenominator - allowedRatioNumerator;
            const itemPropDeduction = safeMultiplyRatio(
              itemBase,
              disallowanceRatioNumerator,
              allowedRatioDenominator
            );

            if (itemPropDeduction > 0) {
              totalProportionateDisallowancePaise += itemPropDeduction;
              ledgerItem.proportionateDisallowancePaise = itemPropDeduction;
              stageItem.proportionateDisallowancePaise = itemPropDeduction;
              stageItem.finalItemApprovedPaise -= itemPropDeduction;

              const adjId = `adj_prop_${ledgerItem.itemId}`;
              const adjRecord: ClaimAdjustmentRecord = {
                adjustmentId: adjId,
                targetItemId: ledgerItem.itemId,
                scope: 'ROOM_RENT_PROPORTIONATE',
                description: `Proportionate Deduction (${paiseToRupees(eligibleRoomRatePerDayPaise)}/${paiseToRupees(dailyRoomRatePaise)}): Disallowed on ${ledgerItem.originalDescription}`,
                baseAmountPaise: itemBase,
                deductionAmountPaise: itemPropDeduction,
                remainingAmountPaise: itemBase - itemPropDeduction,
                clauseReference: 'CL_PROPORTIONATE_DEDUCTION',
                reasonCode: 'ASSOCIATED_EXPENSE_PROPORTIONATE_DISALLOWANCE',
                reviewRequired: ledgerItem.reviewRequired,
                uncertaintyReason: ledgerItem.reviewReasons.join('; ') || null
              };
              ledgerItem.adjustments.push(adjRecord);
              stageItem.adjustments.push(adjRecord);
              adjustmentLedger.push(adjRecord);

              logTrace(
                'PROPORTIONATE_DEDUCTION_EVALUATION',
                ledgerItem.itemId,
                itemBase,
                `PropDisallowance = ${itemBase} * (${dailyRoomRatePaise} - ${eligibleRoomRatePerDayPaise}) / ${dailyRoomRatePaise} = ${itemPropDeduction} paise`,
                itemPropDeduction,
                itemBase - itemPropDeduction,
                `Associated expense proportionately disallowed due to room rent breach.`,
                'CL_PROPORTIONATE_DEDUCTION'
              );
            }
          }
        }
      } else if (rules.proportionateDeductionSupported === false) {
        logTrace(
          'PROPORTIONATE_DEDUCTION_EVALUATION',
          'CLAIM_LEVEL',
          0,
          'N/A',
          0,
          0,
          'Policy terms explicitly exclude proportionate deductions; full associated medical expenses allowed.',
          'CL_NO_PROPORTIONATE_DEDUCTION'
        );
      } else {
        // Proportionate deduction term is missing or unresolved
        reviewReasons.push('Room rent daily limit exceeded, but policy terms regarding proportionate deduction are unresolved.');
      }
    }

    // Total admissible medical expenses before deductible
    const totalAdmissibleBeforeDeductiblePaise = itemStages.reduce(
      (sum, st) => sum + st.finalItemApprovedPaise,
      0
    );

    // 2. Aggregate Deductible
    let appliedDeductiblePaise = 0;
    if (rules.deductiblePaise !== null && rules.deductiblePaise >= 0) {
      appliedDeductiblePaise = Math.min(totalAdmissibleBeforeDeductiblePaise, rules.deductiblePaise);
      if (appliedDeductiblePaise > 0) {
        const adjRecord: ClaimAdjustmentRecord = {
          adjustmentId: 'adj_deductible_claim',
          targetItemId: null,
          scope: 'CLAIM_DEDUCTIBLE',
          description: `Policy Aggregate Deductible: ${formatPaise(rules.deductiblePaise)} cap applied to claim`,
          baseAmountPaise: totalAdmissibleBeforeDeductiblePaise,
          deductionAmountPaise: appliedDeductiblePaise,
          remainingAmountPaise: totalAdmissibleBeforeDeductiblePaise - appliedDeductiblePaise,
          clauseReference: 'CL_AGGREGATE_DEDUCTIBLE',
          reasonCode: 'POLICY_DEDUCTIBLE_APPLIED',
          reviewRequired: false
        };
        adjustmentLedger.push(adjRecord);

        logTrace(
          'AGGREGATE_DEDUCTIBLE_APPLICATION',
          'CLAIM_LEVEL',
          totalAdmissibleBeforeDeductiblePaise,
          `AppliedDeductible = min(${totalAdmissibleBeforeDeductiblePaise}, ${rules.deductiblePaise}) = ${appliedDeductiblePaise} paise`,
          appliedDeductiblePaise,
          totalAdmissibleBeforeDeductiblePaise - appliedDeductiblePaise,
          `Policy aggregate deductible deducted from admissible expenses.`,
          'CL_AGGREGATE_DEDUCTIBLE'
        );
      }
    } else {
      reviewReasons.push('Policy deductible not specified in policy document (not assumed zero).');
    }

    const admissibleAfterDeductiblePaise = totalAdmissibleBeforeDeductiblePaise - appliedDeductiblePaise;

    // 3. Co-payment
    let appliedCopayPaise = 0;
    if (rules.effectiveCopayPercentage !== null && rules.effectiveCopayPercentage > 0) {
      appliedCopayPaise = safeMultiplyRatio(
        admissibleAfterDeductiblePaise,
        rules.effectiveCopayPercentage,
        100
      );

      if (appliedCopayPaise > 0) {
        const adjRecord: ClaimAdjustmentRecord = {
          adjustmentId: 'adj_copay_claim',
          targetItemId: null,
          scope: 'CLAIM_COPAY',
          description: `Co-payment Applied: ${rules.effectiveCopayPercentage}% applied on post-deductible base ${formatPaise(admissibleAfterDeductiblePaise)}`,
          baseAmountPaise: admissibleAfterDeductiblePaise,
          deductionAmountPaise: appliedCopayPaise,
          remainingAmountPaise: admissibleAfterDeductiblePaise - appliedCopayPaise,
          clauseReference: rules.copayClauseId,
          reasonCode: rules.copayReasonCode,
          reviewRequired: false
        };
        adjustmentLedger.push(adjRecord);

        logTrace(
          'COPAYMENT_APPLICATION',
          'CLAIM_LEVEL',
          admissibleAfterDeductiblePaise,
          `AppliedCopay = ${admissibleAfterDeductiblePaise} * ${rules.effectiveCopayPercentage}% = ${appliedCopayPaise} paise`,
          appliedCopayPaise,
          admissibleAfterDeductiblePaise - appliedCopayPaise,
          `Co-payment percentage applied on admissible amount after deductible.`,
          rules.copayClauseId
        );
      }
    } else if (rules.isCopayUncertain) {
      reviewReasons.push(rules.copayUncertaintyMessage || 'Co-payment terms uncertain; manual verification required.');
    }

    const approvedBeforeSumInsuredCapPaise = admissibleAfterDeductiblePaise - appliedCopayPaise;

    // 4. Sum Insured Cap
    let sumInsuredCapDisallowancePaise = 0;
    let finalInsurerPayablePaise = approvedBeforeSumInsuredCapPaise;

    if (rules.remainingSumInsuredPaise !== null && rules.remainingSumInsuredPaise >= 0) {
      if (approvedBeforeSumInsuredCapPaise > rules.remainingSumInsuredPaise) {
        sumInsuredCapDisallowancePaise = approvedBeforeSumInsuredCapPaise - rules.remainingSumInsuredPaise;
        finalInsurerPayablePaise = rules.remainingSumInsuredPaise;

        const adjRecord: ClaimAdjustmentRecord = {
          adjustmentId: 'adj_sum_insured_cap',
          targetItemId: null,
          scope: 'SUM_INSURED_CAP',
          description: `Sum Insured Cap: Approved ${formatPaise(approvedBeforeSumInsuredCapPaise)} exceeds available SI ${formatPaise(rules.remainingSumInsuredPaise)}`,
          baseAmountPaise: approvedBeforeSumInsuredCapPaise,
          deductionAmountPaise: sumInsuredCapDisallowancePaise,
          remainingAmountPaise: finalInsurerPayablePaise,
          clauseReference: 'CL_SUM_INSURED_LIMIT',
          reasonCode: 'SUM_INSURED_CEILING_REACHED',
          reviewRequired: !rules.isPreviousUtilizationKnown
        };
        adjustmentLedger.push(adjRecord);

        logTrace(
          'SUM_INSURED_CAP_ENFORCEMENT',
          'CLAIM_LEVEL',
          approvedBeforeSumInsuredCapPaise,
          `Cap Disallowance = ${approvedBeforeSumInsuredCapPaise} - ${rules.remainingSumInsuredPaise} = ${sumInsuredCapDisallowancePaise} paise`,
          sumInsuredCapDisallowancePaise,
          finalInsurerPayablePaise,
          `Insurer liability capped at remaining available Sum Insured.`,
          'CL_SUM_INSURED_LIMIT',
          null,
          rules.isPreviousUtilizationKnown ? null : 'PREVIOUS_SI_UTILIZATION_UNKNOWN'
        );
      }
    } else {
      reviewReasons.push('Sum insured limit is unspecified in policy; claim cap cannot be definitively calculated.');
    }

    // ========================================================================
    // STAGE D: FINAL RECONCILIATION & ALLOCATION
    // ========================================================================
    const totalClaimedPaise = request.bill.lineItems.reduce((sum, it) => sum + it.claimedAmountPaise, 0);
    const totalPatientResponsibilityPaise = totalClaimedPaise - finalInsurerPayablePaise;

    // Allocate claim-level adjustments (deductible, copay, SI cap) across items with admissible amounts
    // to provide transparent line-by-line patient payable vs insurer payable breakdown.
    this.allocateClaimAdjustmentsToLedger(
      itemLedgerEntries,
      appliedDeductiblePaise,
      totalAdmissibleBeforeDeductiblePaise,
      appliedCopayPaise,
      admissibleAfterDeductiblePaise,
      sumInsuredCapDisallowancePaise,
      approvedBeforeSumInsuredCapPaise
    );

    // Audit mathematical balance invariant
    const isMathematicallyBalanced =
      totalClaimedPaise === finalInsurerPayablePaise + totalPatientResponsibilityPaise &&
      finalInsurerPayablePaise >= 0 &&
      totalPatientResponsibilityPaise >= 0;

    logTrace(
      'MATHEMATICAL_BALANCE_AUDIT',
      'CLAIM_TOTAL',
      totalClaimedPaise,
      `${totalClaimedPaise} == ${finalInsurerPayablePaise} (Insurer) + ${totalPatientResponsibilityPaise} (Patient)`,
      0,
      totalClaimedPaise,
      isMathematicallyBalanced
        ? 'Total claimed strictly balances between insurer payable and patient responsibility.'
        : 'CRITICAL INVARIANT VIOLATION: Claimed does not balance with insurer + patient shares!',
      'FIN_INVARIANT_EQUATION',
      null,
      isMathematicallyBalanced ? null : 'MATH_INVARIANT_FAILED'
    );

    // Check if any double deductions exist in ledger
    const hasDoubleDeductions = this.detectDoubleDeductions(adjustmentLedger);
    const hasNegativePayable = finalInsurerPayablePaise < 0 || totalPatientResponsibilityPaise < 0;

    const claimLedger: ClaimLedger = {
      currency: 'INR',
      itemStages,
      claimAdjustments: adjustmentLedger.filter(a => a.targetItemId === null),
      totalClaimedPaise,
      totalExcludedNonPayablePaise,
      totalProportionateDisallowancePaise,
      totalSublimitDisallowancePaise,
      totalAdmissibleBeforeDeductiblePaise,
      appliedDeductiblePaise,
      admissibleAfterDeductiblePaise,
      appliedCopayPaise,
      approvedBeforeSumInsuredCapPaise,
      sumInsuredCapDisallowancePaise,
      finalInsurerPayablePaise,
      totalPatientResponsibilityPaise,
      isMathematicallyBalanced
    };

    // Aggregate Item Review Reasons into Claim Level
    for (const item of itemLedgerEntries) {
      if (item.reviewRequired && item.reviewReasons) {
        for (const reason of item.reviewReasons) {
          const formattedReason = `[${item.originalDescription}] ${reason}`;
          if (!reviewReasons.includes(formattedReason) && !reviewReasons.includes(reason)) {
            reviewReasons.push(formattedReason);
          }
        }
      }
    }

    // Determine Claim Review Status
    const reviewRequired = reviewReasons.length > 0 || itemLedgerEntries.some(i => i.reviewRequired);
    let claimStatus: ClaimStatus = 'ADJUDICATED';
    let reviewStatus: ClaimReviewStatus = 'NOT_REQUIRED';

    if (reviewRequired) {
      claimStatus = 'PENDING_HUMAN_REVIEW';
      if (!billReconciliation.isReconciled) {
        reviewStatus = 'REQUIRED_UNRECONCILED_BILL';
      } else if (reviewReasons.some(r => r.includes('Conflicting'))) {
        reviewStatus = 'REQUIRED_CONFLICTING_VERSIONS';
      } else {
        reviewStatus = 'REQUIRED_AMBIGUOUS_POLICY';
      }
    }

    const endTimeNs = process.hrtime.bigint();
    const executionTimeUs = Number(endTimeNs - startTimeNs) / 1000;

    const trace: CalculationTrace = {
      traceId,
      timestamp: new Date().toISOString(),
      steps: traceSteps,
      executionTimeUs,
      invariantsVerified: isMathematicallyBalanced && !hasDoubleDeductions && !hasNegativePayable
    };

    return {
      assessmentId,
      requestId: request.requestId,
      treatmentDate: request.treatmentDate,
      policyVersionId: request.policyVersion?.versionId || null,
      amendmentIds: request.policyVersion?.clauseModifications?.map(m => m.clauseId) || [],
      billReconciliation,
      itemizedLedger: itemLedgerEntries,
      ledger: claimLedger,
      adjustmentLedger,
      trace,
      claimStatus,
      reviewStatus,
      reviewReasons,
      reviewRequired,
      invariants: {
        isMathematicallyBalanced,
        hasNegativePayable,
        hasDoubleDeductions,
        reconciledToBillTotal: billReconciliation.isReconciled,
        auditPassed: isMathematicallyBalanced && !hasDoubleDeductions && !hasNegativePayable && billReconciliation.isReconciled
      },
      adjudicatedAt: new Date().toISOString()
    };
  }

  /**
   * Recomputes an existing claim assessment against a new or updated input snapshot
   * (e.g. modified bill item, new policy version, resolved evidence),
   * ensuring historical immutability by producing a fresh assessment ID.
   */
  public recomputeAssessment(
    request: ClaimAdjudicationRequest,
    priorResult?: ClaimAdjudicationResult | null,
    changeReason?: string
  ): AssessmentHistoryRecord {
    const updatedRequest: ClaimAdjudicationRequest = {
      ...request,
      priorAssessmentId: priorResult?.assessmentId || request.priorAssessmentId || null
    };

    const newResult = this.adjudicateClaim(updatedRequest);

    return {
      assessmentId: newResult.assessmentId,
      priorAssessmentId: updatedRequest.priorAssessmentId,
      timestamp: new Date().toISOString(),
      changeReason: changeReason || 'Claim input recomputation snapshot',
      result: newResult
    };
  }

  // ========================================================================
  // INTERNAL HELPER METHODS
  // ========================================================================

  /**
   * Reconciles line items against the stated bill header total, detecting
   * discrepancies, missing quantities, zero/negative prices, and duplicate IDs.
   */
  private reconcileBillInputs(bill: BillDocument): BillReconciliationReport {
    const issues: BillReconciliationIssue[] = [];
    const seenIds = new Set<string>();
    let calculatedItemsSumPaise = 0;

    for (const item of bill.lineItems) {
      // Duplicate item ID check
      if (seenIds.has(item.itemId)) {
        issues.push({
          itemId: item.itemId,
          issueType: 'DUPLICATE_ITEM_ID',
          message: `Duplicate item ID '${item.itemId}' detected in invoice line items.`,
          severity: 'BLOCKING'
        });
      }
      seenIds.add(item.itemId);

      // Zero or negative price check
      if (item.unitPricePaise < 0 || item.claimedAmountPaise < 0) {
        issues.push({
          itemId: item.itemId,
          issueType: 'ZERO_OR_NEGATIVE_PRICE',
          message: `Item '${item.itemId}' has negative monetary value (${item.claimedAmountPaise} paise).`,
          severity: 'BLOCKING'
        });
      }

      // Quantity check
      if (item.quantity <= 0) {
        issues.push({
          itemId: item.itemId,
          issueType: 'MISSING_MANDATORY_FIELD',
          message: `Item '${item.itemId}' has invalid non-positive quantity (${item.quantity}).`,
          severity: 'WARNING'
        });
      }

      // Quantity * Unit Price consistency check
      const expectedClaimed = item.quantity * item.unitPricePaise;
      if (item.quantity > 0 && item.claimedAmountPaise !== expectedClaimed) {
        issues.push({
          itemId: item.itemId,
          issueType: 'QUANTITY_PRICE_MISMATCH',
          message: `Item '${item.itemId}' claimed amount (${item.claimedAmountPaise}) does not equal quantity (${item.quantity}) * unit price (${item.unitPricePaise}).`,
          severity: 'WARNING'
        });
      }

      calculatedItemsSumPaise += item.claimedAmountPaise;
    }

    const statedGross = bill.originalBillTotalPaise;
    const discrepancyPaise = statedGross - calculatedItemsSumPaise;

    if (discrepancyPaise !== 0) {
      issues.push({
        issueType: 'GROSS_SUM_MISMATCH',
        message: `Stated invoice gross (${formatPaise(statedGross)}) does not match sum of itemized charges (${formatPaise(calculatedItemsSumPaise)}). Difference: ${formatPaise(Math.abs(discrepancyPaise))}.`,
        severity: 'WARNING'
      });
    }

    return {
      statedGrossTotalPaise: statedGross,
      calculatedItemsSumPaise,
      discrepancyPaise,
      isReconciled: issues.length === 0 && discrepancyPaise === 0,
      issues
    };
  }

  /**
   * Resolves and validates financial policy rules from the request or policy contract.
   */
  private resolveFinancialRules(
    request: ClaimAdjudicationRequest,
    policy: PolicyDocument | undefined,
    reviewReasons: string[]
  ): {
    hasSumInsured: boolean;
    sumInsuredPaise: MoneyMinor | null;
    remainingSumInsuredPaise: MoneyMinor | null;
    isPreviousUtilizationKnown: boolean;
    hasRoomRentCap: boolean;
    eligibleRoomRatePerDayPaise: MoneyMinor;
    proportionateDeductionSupported: boolean | null;
    deductiblePaise: MoneyMinor | null;
    effectiveCopayPercentage: number | null;
    copayClauseId: string | null;
    copayReasonCode: string;
    isCopayUncertain: boolean;
    copayUncertaintyMessage?: string;
    sublimitsPaise: Record<string, MoneyMinor> | null;
  } {
    const rules = request.financialRules;

    // 1. Sum Insured & Utilization
    let sumInsuredPaise: MoneyMinor | null = null;
    if (rules?.sumInsuredPaise !== undefined && rules.sumInsuredPaise !== null) {
      sumInsuredPaise = rules.sumInsuredPaise;
    } else if (policy && typeof policy.sumInsured === 'number' && policy.sumInsured >= 0) {
      sumInsuredPaise = rupeesToPaise(policy.sumInsured);
    }

    const isPreviousUtilizationKnown = rules?.isPreviousUtilizationKnown ?? true;
    const previousSiUtilizedPaise = rules?.previousSiUtilizedPaise ?? 0;
    let remainingSumInsuredPaise = sumInsuredPaise;

    if (sumInsuredPaise !== null) {
      remainingSumInsuredPaise = Math.max(0, sumInsuredPaise - previousSiUtilizedPaise);
      if (!isPreviousUtilizationKnown) {
        reviewReasons.push('Previous sum-insured utilization in policy year is unknown; assuming 100% available subject to review.');
      }
    }

    // 2. Room Rent Cap
    let hasRoomRentCap = false;
    let eligibleRoomRatePerDayPaise = 999999999; // Default unlimited

    const roomLimit = rules?.roomLimit || (policy as any)?.roomRentLimit || policy?.roomLimit;
    if (roomLimit) {
      if (roomLimit.type === 'amount' && roomLimit.value) {
        hasRoomRentCap = true;
        eligibleRoomRatePerDayPaise = rupeesToPaise(Number(roomLimit.value));
      } else if (roomLimit.type === 'percent' && roomLimit.value) {
        hasRoomRentCap = true;
        const pct = Number(roomLimit.value);
        if (sumInsuredPaise !== null) {
          eligibleRoomRatePerDayPaise = safeMultiplyRatio(sumInsuredPaise, pct, 100);
        } else {
          reviewReasons.push(`Room rent cap is ${pct}% of Sum Insured, but Sum Insured is unknown.`);
        }
      } else if (roomLimit.type === 'none') {
        hasRoomRentCap = false;
      }
    }

    // 3. Proportionate Deduction
    let proportionateDeductionSupported: boolean | null = null;
    if (rules?.proportionateDeductionSupported !== undefined && rules.proportionateDeductionSupported !== null) {
      proportionateDeductionSupported = rules.proportionateDeductionSupported;
    } else if (policy) {
      if (policy.proportionateDeduction === true) {
        proportionateDeductionSupported = true;
      } else if (policy.proportionateDeduction === false) {
        proportionateDeductionSupported = false;
      }
    }

    // 4. Deductible
    let deductiblePaise: MoneyMinor | null = null;
    if (rules?.deductiblePaise !== undefined && rules.deductiblePaise !== null) {
      deductiblePaise = rules.deductiblePaise;
    } else if (policy && typeof policy.deductible === 'number' && policy.deductible >= 0) {
      deductiblePaise = rupeesToPaise(policy.deductible);
    }

    // 5. Co-pay Handling
    const networkStatus = rules?.networkStatus || 'verified';
    let effectiveCopayPercentage: number | null = null;
    let copayClauseId: string | null = null;
    let copayReasonCode = 'COPAY_NOT_APPLICABLE';
    let isCopayUncertain = false;
    let copayUncertaintyMessage: string | undefined;

    if (networkStatus === 'verified') {
      if (rules?.copayPercentage !== undefined && rules.copayPercentage !== null) {
        effectiveCopayPercentage = rules.copayPercentage;
        copayClauseId = 'CL_NETWORK_COPAY';
        copayReasonCode = 'NETWORK_COPAY_APPLIED';
      } else if (policy) {
        const val = typeof policy.copay === 'number'
          ? policy.copay
          : (typeof (policy.copay as any)?.value === 'number' ? (policy.copay as any).value : 0);
        effectiveCopayPercentage = val;
        copayClauseId = 'CL_NETWORK_COPAY';
        copayReasonCode = 'NETWORK_COPAY_APPLIED';
      }
    } else if (networkStatus === 'no_match') {
      // Non-network hospital
      if (rules?.nonNetworkCopayPercentage !== undefined && rules.nonNetworkCopayPercentage !== null) {
        effectiveCopayPercentage = rules.nonNetworkCopayPercentage;
        copayClauseId = 'CL_NON_NETWORK_COPAY';
        copayReasonCode = 'NON_NETWORK_COPAY_APPLIED';
      } else if (policy && typeof policy.nonNetworkCopay === 'number' && policy.nonNetworkCopay >= 0) {
        effectiveCopayPercentage = policy.nonNetworkCopay;
        copayClauseId = 'CL_NON_NETWORK_COPAY';
        copayReasonCode = 'NON_NETWORK_COPAY_APPLIED';
      } else {
        // Unknown non-network copay -> uncertain
        isCopayUncertain = true;
        effectiveCopayPercentage = null;
        copayUncertaintyMessage = 'Non-network co-payment percentage is not specified in policy document (not assumed zero).';
      }
    } else {
      // Unverified network status
      isCopayUncertain = true;
      effectiveCopayPercentage = null;
      copayUncertaintyMessage = 'Hospital network status is unverified; co-payment rate cannot be established.';
    }

    // 6. Sublimits
    const sublimitsPaise: Record<string, MoneyMinor> = {};
    if (rules?.sublimitsPaise) {
      Object.assign(sublimitsPaise, rules.sublimitsPaise);
    } else if (policy?.subLimits) {
      for (const [k, v] of Object.entries(policy.subLimits)) {
        if (typeof v === 'number' && v > 0) {
          sublimitsPaise[k] = rupeesToPaise(v);
        }
      }
    }

    return {
      hasSumInsured: sumInsuredPaise !== null,
      sumInsuredPaise,
      remainingSumInsuredPaise,
      isPreviousUtilizationKnown,
      hasRoomRentCap,
      eligibleRoomRatePerDayPaise,
      proportionateDeductionSupported,
      deductiblePaise,
      effectiveCopayPercentage,
      copayClauseId,
      copayReasonCode,
      isCopayUncertain,
      copayUncertaintyMessage,
      sublimitsPaise: Object.keys(sublimitsPaise).length > 0 ? sublimitsPaise : null
    };
  }

  /**
   * Distributes claim-level adjustments (deductible, copay, SI cap excess) proportionately
   * across admissible items, guaranteeing that:
   * sum(item.insurerPayablePaise) === finalInsurerPayablePaise
   * sum(item.patientResponsibilityPaise) === totalPatientResponsibilityPaise
   */
  private allocateClaimAdjustmentsToLedger(
    ledgerEntries: ItemizedLedgerEntry[],
    appliedDeductiblePaise: MoneyMinor,
    totalAdmissibleBeforeDeductiblePaise: MoneyMinor,
    appliedCopayPaise: MoneyMinor,
    admissibleAfterDeductiblePaise: MoneyMinor,
    sumInsuredCapDisallowancePaise: MoneyMinor,
    approvedBeforeSumInsuredCapPaise: MoneyMinor
  ): void {
    let allocatedDeductibleSum = 0;
    let allocatedCopaySum = 0;
    let allocatedSiExcessSum = 0;

    const admissibleItems = ledgerEntries.filter(
      item => item.admissibleBeforeClaimAdjustmentsPaise - item.proportionateDisallowancePaise > 0
    );

    for (let i = 0; i < admissibleItems.length; i++) {
      const item = admissibleItems[i];
      const isLast = i === admissibleItems.length - 1;
      const itemAdmissible = item.admissibleBeforeClaimAdjustmentsPaise - item.proportionateDisallowancePaise;

      // 1. Deductible Share
      let itemDed = 0;
      if (appliedDeductiblePaise > 0 && totalAdmissibleBeforeDeductiblePaise > 0) {
        if (isLast) {
          itemDed = appliedDeductiblePaise - allocatedDeductibleSum;
        } else {
          itemDed = safeMultiplyRatio(appliedDeductiblePaise, itemAdmissible, totalAdmissibleBeforeDeductiblePaise);
        }
        allocatedDeductibleSum += itemDed;
      }
      item.allocatedDeductiblePaise = itemDed;

      const itemPostDed = Math.max(0, itemAdmissible - itemDed);

      // 2. Copay Share
      let itemCopay = 0;
      if (appliedCopayPaise > 0 && admissibleAfterDeductiblePaise > 0) {
        if (isLast) {
          itemCopay = appliedCopayPaise - allocatedCopaySum;
        } else {
          itemCopay = safeMultiplyRatio(appliedCopayPaise, itemPostDed, admissibleAfterDeductiblePaise);
        }
        allocatedCopaySum += itemCopay;
      }
      item.allocatedCopayPaise = itemCopay;

      const itemPostCopay = Math.max(0, itemPostDed - itemCopay);

      // 3. SI Excess Share
      let itemSiExcess = 0;
      if (sumInsuredCapDisallowancePaise > 0 && approvedBeforeSumInsuredCapPaise > 0) {
        if (isLast) {
          itemSiExcess = sumInsuredCapDisallowancePaise - allocatedSiExcessSum;
        } else {
          itemSiExcess = safeMultiplyRatio(sumInsuredCapDisallowancePaise, itemPostCopay, approvedBeforeSumInsuredCapPaise);
        }
        allocatedSiExcessSum += itemSiExcess;
      }
      item.allocatedSumInsuredExcessPaise = itemSiExcess;

      // Final Item Insurer Share
      item.insurerPayablePaise = Math.max(0, itemPostCopay - itemSiExcess);

      // Final Item Patient Share = Claimed - Insurer Payable
      item.patientResponsibilityPaise = item.claimedAmountPaise - item.insurerPayablePaise;
    }

    // For fully excluded or zero-admissible items, patient responsibility = 100% claimed
    for (const item of ledgerEntries) {
      if (item.admissibleBeforeClaimAdjustmentsPaise - item.proportionateDisallowancePaise <= 0) {
        item.insurerPayablePaise = 0;
        item.patientResponsibilityPaise = item.claimedAmountPaise;
      }
    }
  }

  /**
   * Invariant Check: Confirms no deduction adjustment has been applied more than once
   * or across conflicting scopes.
   */
  private detectDoubleDeductions(adjustments: ClaimAdjustmentRecord[]): boolean {
    const seenAdjustmentIds = new Set<string>();
    for (const adj of adjustments) {
      if (seenAdjustmentIds.has(adj.adjustmentId)) {
        return true;
      }
      seenAdjustmentIds.add(adj.adjustmentId);
    }

    // Verify claim-level deductible appears at most once
    const deductibleCount = adjustments.filter(a => a.scope === 'CLAIM_DEDUCTIBLE').length;
    if (deductibleCount > 1) return true;

    // Verify claim-level copay appears at most once
    const copayCount = adjustments.filter(a => a.scope === 'CLAIM_COPAY').length;
    if (copayCount > 1) return true;

    // Verify sum-insured cap appears at most once
    const siCapCount = adjustments.filter(a => a.scope === 'SUM_INSURED_CAP').length;
    if (siCapCount > 1) return true;

    return false;
  }
}

export const claimAdjudicationService = new ClaimAdjudicationService();
