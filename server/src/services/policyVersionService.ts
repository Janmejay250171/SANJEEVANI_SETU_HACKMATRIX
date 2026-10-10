import {
  PolicyVersionRecord,
  PolicyApplicabilityResult,
  ApplicabilityStatus,
  ApplicabilityCandidateCheck,
  ClauseModification
} from '../types/policyVersion.js';
import { PolicyDocument } from '../types/policy.js';

export interface PolicyApplicabilityQuery {
  familyId: string;
  treatmentDate?: string | null;
  versions: PolicyVersionRecord[];
}

/**
 * Validates ISO date format YYYY-MM-DD.
 */
function isValidIsoDate(dateStr: string | null | undefined): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim());
}

/**
 * Deterministically resolves which policy version and endorsements are legally
 * applicable for a specific hospital admission/treatment date.
 *
 * Enforces strict anti-hallucination rules:
 * 1. Missing dates or unstated terms NEVER default to assumptions.
 * 2. Upload timestamp is NEVER used to supersede contractual effective dates.
 * 3. Overlapping active base policies produce 'conflicting_versions', requiring human adjudication.
 * 4. LLMs are never permitted to guess contractual precedence.
 */
export function resolvePolicyApplicability(
  query: PolicyApplicabilityQuery
): PolicyApplicabilityResult {
  const { familyId, treatmentDate, versions } = query;
  const candidateChecks: ApplicabilityCandidateCheck[] = [];
  const reviewReasons: string[] = [];
  let reviewRequired = false;

  // 1. Validate family and input version availability
  if (!familyId || !versions || versions.length === 0) {
    return {
      status: 'missing_policy',
      treatmentDate: treatmentDate ?? null,
      familyId: familyId || 'UNKNOWN',
      selectedBaseVersion: null,
      applicableAmendments: [],
      mergedPolicySnapshot: null,
      candidateChecks: [],
      reviewRequired: true,
      reviewReasons: [`No policy versions found for policy family '${familyId || 'UNKNOWN'}'`],
      explanation: 'Policy applicability could not be evaluated: no policy records provided for this policy family.'
    };
  }

  // 2. Validate treatment date
  if (!treatmentDate || !isValidIsoDate(treatmentDate)) {
    return {
      status: 'missing_treatment_date',
      treatmentDate: treatmentDate ?? null,
      familyId,
      selectedBaseVersion: null,
      applicableAmendments: [],
      mergedPolicySnapshot: null,
      candidateChecks: [],
      reviewRequired: true,
      reviewReasons: [
        'Treatment date is missing, empty, or not in valid YYYY-MM-DD format. Policy version applicability cannot be determined without treatment date.'
      ],
      explanation: 'Treatment date is missing or invalid. Contractual policy version cannot be evaluated without a verified treatment date.'
    };
  }

  const cleanTreatmentDate = treatmentDate.trim();

  // 3. Filter and partition versions for this policy family
  const familyVersions = versions.filter((v) => {
    if (v.familyId !== familyId) {
      candidateChecks.push({
        versionId: v.versionId,
        documentType: v.documentType,
        effectivePeriod: `${v.effectiveFrom || 'UNSTATED'} to ${v.effectiveTo || 'UNSTATED'}`,
        status: 'REJECTED',
        reason: `Mismatched policy family '${v.familyId}'. Expected '${familyId}'.`
      });
      return false;
    }
    return true;
  });

  if (familyVersions.length === 0) {
    return {
      status: 'missing_policy',
      treatmentDate: cleanTreatmentDate,
      familyId,
      selectedBaseVersion: null,
      applicableAmendments: [],
      mergedPolicySnapshot: null,
      candidateChecks,
      reviewRequired: true,
      reviewReasons: [`No versions match policy family '${familyId}'`],
      explanation: `No policy versions matched family ID '${familyId}'.`
    };
  }

  const baseCandidates = familyVersions.filter(
    (v) => v.documentType === 'BASE_POLICY' || v.documentType === 'RENEWAL'
  );
  const amendmentCandidates = familyVersions.filter(
    (v) =>
      v.documentType === 'AMENDMENT' ||
      v.documentType === 'ENDORSEMENT' ||
      v.documentType === 'SCHEDULE_ATTACHMENT'
  );

  // 4. Evaluate Base Policy Candidates
  const eligibleBaseCandidates: PolicyVersionRecord[] = [];
  let hasUndeterminedBaseDate = false;

  for (const candidate of baseCandidates) {
    const periodStr = `${candidate.effectiveFrom || 'UNSTATED'} to ${candidate.effectiveTo || 'UNSTATED'}`;

    if (!candidate.effectiveFrom || !isValidIsoDate(candidate.effectiveFrom)) {
      hasUndeterminedBaseDate = true;
      candidateChecks.push({
        versionId: candidate.versionId,
        documentType: candidate.documentType,
        effectivePeriod: periodStr,
        status: 'UNDETERMINED',
        reason: 'Base policy has missing or invalid effectiveFrom date in contract terms.'
      });
      reviewReasons.push(
        `Version '${candidate.versionId}' is missing an established effectiveFrom date.`
      );
      continue;
    }

    if (cleanTreatmentDate < candidate.effectiveFrom) {
      candidateChecks.push({
        versionId: candidate.versionId,
        documentType: candidate.documentType,
        effectivePeriod: periodStr,
        status: 'REJECTED',
        reason: `Treatment date ${cleanTreatmentDate} precedes policy effective date ${candidate.effectiveFrom}.`
      });
      continue;
    }

    if (candidate.effectiveTo && isValidIsoDate(candidate.effectiveTo)) {
      if (cleanTreatmentDate > candidate.effectiveTo) {
        candidateChecks.push({
          versionId: candidate.versionId,
          documentType: candidate.documentType,
          effectivePeriod: periodStr,
          status: 'REJECTED',
          reason: `Treatment date ${cleanTreatmentDate} is after policy expiration date ${candidate.effectiveTo}.`
        });
        continue;
      }
    }

    // Passed date checks
    eligibleBaseCandidates.push(candidate);
  }

  let selectedBase: PolicyVersionRecord | null = null;
  let applicabilityStatus: ApplicabilityStatus = 'resolved';

  if (eligibleBaseCandidates.length === 0) {
    if (hasUndeterminedBaseDate) {
      applicabilityStatus = 'ambiguous';
      reviewRequired = true;
      reviewReasons.push('Cannot determine policy applicability due to unstated base policy effective dates.');
    } else {
      applicabilityStatus = 'out_of_coverage_period';
      reviewRequired = true;
      reviewReasons.push(`Treatment date ${cleanTreatmentDate} falls outside the effective dates of all available policy versions.`);
    }
  } else if (eligibleBaseCandidates.length === 1) {
    selectedBase = eligibleBaseCandidates[0];
    candidateChecks.push({
      versionId: selectedBase.versionId,
      documentType: selectedBase.documentType,
      effectivePeriod: `${selectedBase.effectiveFrom} to ${selectedBase.effectiveTo || 'OPEN'}`,
      status: 'ACCEPTED',
      reason: `Treatment date ${cleanTreatmentDate} falls within effective period.`
    });
  } else {
    // Multiple base candidates active on the same treatment date.
    // Check if one explicitly supersedes the other via parentVersionId
    const supersedingCandidates = eligibleBaseCandidates.filter(
      (c) => c.parentVersionId && eligibleBaseCandidates.some((parent) => parent.versionId === c.parentVersionId)
    );

    if (supersedingCandidates.length === 1) {
      selectedBase = supersedingCandidates[0];
      for (const candidate of eligibleBaseCandidates) {
        if (candidate.versionId === selectedBase.versionId) {
          candidateChecks.push({
            versionId: candidate.versionId,
            documentType: candidate.documentType,
            effectivePeriod: `${candidate.effectiveFrom} to ${candidate.effectiveTo || 'OPEN'}`,
            status: 'ACCEPTED',
            reason: `Supersedes parent version '${candidate.parentVersionId}'.`
          });
        } else {
          candidateChecks.push({
            versionId: candidate.versionId,
            documentType: candidate.documentType,
            effectivePeriod: `${candidate.effectiveFrom} to ${candidate.effectiveTo || 'OPEN'}`,
            status: 'SUPERSEDED',
            reason: `Superseded by renewal version '${selectedBase.versionId}'.`
          });
        }
      }
    } else {
      // Unresolved conflict: multiple concurrent active base policies without clear succession
      applicabilityStatus = 'conflicting_versions';
      reviewRequired = true;
      reviewReasons.push(
        `Conflicting base versions detected: multiple versions (${eligibleBaseCandidates.map((c) => c.versionId).join(', ')}) are concurrently active on treatment date ${cleanTreatmentDate}.`
      );
      for (const candidate of eligibleBaseCandidates) {
        candidateChecks.push({
          versionId: candidate.versionId,
          documentType: candidate.documentType,
          effectivePeriod: `${candidate.effectiveFrom} to ${candidate.effectiveTo || 'OPEN'}`,
          status: 'UNDETERMINED',
          reason: 'Conflicting concurrent validity on treatment date.'
        });
      }
    }
  }

  // 5. Evaluate Amendment Candidates
  const applicableAmendments: PolicyVersionRecord[] = [];

  if (selectedBase) {
    for (const amendment of amendmentCandidates) {
      const periodStr = `${amendment.effectiveFrom || 'UNSTATED'} to ${amendment.effectiveTo || 'UNSTATED'}`;

      // Check parent version linkage if defined
      if (amendment.parentVersionId && amendment.parentVersionId !== selectedBase.versionId) {
        candidateChecks.push({
          versionId: amendment.versionId,
          documentType: amendment.documentType,
          effectivePeriod: periodStr,
          status: 'REJECTED',
          reason: `Amendment targets version '${amendment.parentVersionId}', but selected base version is '${selectedBase.versionId}'.`
        });
        continue;
      }

      if (!amendment.effectiveFrom || !isValidIsoDate(amendment.effectiveFrom)) {
        candidateChecks.push({
          versionId: amendment.versionId,
          documentType: amendment.documentType,
          effectivePeriod: periodStr,
          status: 'UNDETERMINED',
          reason: 'Amendment has missing or invalid effectiveFrom date.'
        });
        reviewRequired = true;
        reviewReasons.push(
          `Amendment '${amendment.versionId}' has unstated effective date. Contractual applicability cannot be established.`
        );
        continue;
      }

      if (cleanTreatmentDate < amendment.effectiveFrom) {
        candidateChecks.push({
          versionId: amendment.versionId,
          documentType: amendment.documentType,
          effectivePeriod: periodStr,
          status: 'REJECTED',
          reason: `Treatment date ${cleanTreatmentDate} precedes amendment effective date ${amendment.effectiveFrom}.`
        });
        continue;
      }

      if (amendment.effectiveTo && isValidIsoDate(amendment.effectiveTo)) {
        if (cleanTreatmentDate > amendment.effectiveTo) {
          candidateChecks.push({
            versionId: amendment.versionId,
            documentType: amendment.documentType,
            effectivePeriod: periodStr,
            status: 'REJECTED',
            reason: `Treatment date ${cleanTreatmentDate} is after amendment expiration date ${amendment.effectiveTo}.`
          });
          continue;
        }
      }

      // Amendment is active on treatment date!
      candidateChecks.push({
        versionId: amendment.versionId,
        documentType: amendment.documentType,
        effectivePeriod: periodStr,
        status: 'ACCEPTED',
        reason: `Amendment active on treatment date ${cleanTreatmentDate}.`
      });
      applicableAmendments.push(amendment);
    }
  }

  // 6. Generate Merged Policy Snapshot (if base is selected)
  let mergedPolicySnapshot: PolicyDocument | null = null;
  if (selectedBase) {
    mergedPolicySnapshot = mergePolicyWithAmendments(selectedBase, applicableAmendments);
  }

  // Check extraction status of selected documents
  if (selectedBase && (selectedBase.extractionStatus === 'PARTIAL' || selectedBase.extractionStatus === 'UNRESOLVED')) {
    reviewRequired = true;
    reviewReasons.push(`Selected base policy '${selectedBase.versionId}' has ${selectedBase.extractionStatus} extraction status.`);
  }

  for (const amd of applicableAmendments) {
    if (amd.extractionStatus === 'PARTIAL' || amd.extractionStatus === 'UNRESOLVED') {
      reviewRequired = true;
      reviewReasons.push(`Applicable amendment '${amd.versionId}' has ${amd.extractionStatus} extraction status.`);
    }
  }

  if (selectedBase && reviewRequired && applicabilityStatus === 'resolved') {
    applicabilityStatus = 'review_required';
  }

  const explanation = generateApplicabilityExplanation(
    applicabilityStatus,
    cleanTreatmentDate,
    selectedBase,
    applicableAmendments,
    reviewReasons
  );

  return {
    status: applicabilityStatus,
    treatmentDate: cleanTreatmentDate,
    familyId,
    selectedBaseVersion: selectedBase,
    applicableAmendments,
    mergedPolicySnapshot,
    candidateChecks,
    reviewRequired,
    reviewReasons,
    explanation
  };
}

/**
 * Merges base policy terms with chronologically active amendments.
 * Preserves original base values while applying explicit clause overrides.
 */
export function mergePolicyWithAmendments(
  baseVersion: PolicyVersionRecord,
  applicableAmendments: PolicyVersionRecord[]
): PolicyDocument {
  // Deep copy base policy terms
  const merged: PolicyDocument = JSON.parse(JSON.stringify(baseVersion.policyData));

  // Sort amendments chronologically by effectiveFrom date
  const sortedAmendments = [...applicableAmendments].sort((a, b) => {
    const dateA = a.effectiveFrom || '';
    const dateB = b.effectiveFrom || '';
    return dateA.localeCompare(dateB);
  });

  for (const amendment of sortedAmendments) {
    for (const mod of amendment.clauseModifications) {
      applyClauseModification(merged, mod);
    }
  }

  return merged;
}

/**
 * Applies a specific clause delta to a policy document.
 */
function applyClauseModification(policy: PolicyDocument, mod: ClauseModification): void {
  if (!mod.targetPath) return;

  const path = mod.targetPath.trim();

  // Explicit clause overrides based on standard path conventions
  if (path === 'roomLimit.value' || path === 'roomLimit') {
    const num = Number(mod.newClauseText);
    if (!isNaN(num) && policy.roomLimit) {
      policy.roomLimit.value = num;
    }
  } else if (path === 'icuLimit.value' || path === 'icuLimit') {
    const num = Number(mod.newClauseText);
    if (!isNaN(num) && policy.icuLimit) {
      policy.icuLimit.value = num;
    }
  } else if (path === 'copay') {
    const num = Number(mod.newClauseText);
    if (!isNaN(num)) {
      policy.copay = num;
    }
  } else if (path === 'deductible') {
    const num = Number(mod.newClauseText);
    if (!isNaN(num)) {
      policy.deductible = num;
    }
  } else if (path === 'sumInsured') {
    const num = Number(mod.newClauseText);
    if (!isNaN(num)) {
      policy.sumInsured = num;
    }
  } else if (path === 'proportionateDeduction') {
    if (mod.newClauseText.toLowerCase() === 'false' || mod.newClauseText.toLowerCase() === 'no') {
      policy.proportionateDeduction = false;
    } else if (mod.newClauseText.toLowerCase() === 'true' || mod.newClauseText.toLowerCase() === 'yes') {
      policy.proportionateDeduction = true;
    }
  } else if (path.startsWith('subLimits.')) {
    const key = path.replace('subLimits.', '');
    const num = Number(mod.newClauseText);
    if (!isNaN(num)) {
      policy.subLimits = policy.subLimits || {};
      policy.subLimits[key] = num;
    }
  } else if (path === 'exclusions.remove') {
    policy.exclusions = policy.exclusions.filter((e) => e.toLowerCase() !== mod.newClauseText.toLowerCase());
  } else if (path === 'exclusions.add') {
    if (!policy.exclusions.includes(mod.newClauseText)) {
      policy.exclusions.push(mod.newClauseText);
    }
  }
}

function generateApplicabilityExplanation(
  status: ApplicabilityStatus,
  treatmentDate: string,
  selectedBase: PolicyVersionRecord | null,
  amendments: PolicyVersionRecord[],
  reviewReasons: string[]
): string {
  switch (status) {
    case 'resolved':
      return `Treatment date ${treatmentDate} resolved to base policy version '${selectedBase?.versionId}' (${selectedBase?.planName}) with ${amendments.length} active endorsement(s).`;
    case 'review_required':
      return `Policy resolved to '${selectedBase?.versionId}' with ${amendments.length} endorsement(s), but requires human review: ${reviewReasons.join('; ')}`;
    case 'conflicting_versions':
      return `Conflicting versions detected: multiple base policies are concurrently valid on ${treatmentDate}.`;
    case 'out_of_coverage_period':
      return `Treatment date ${treatmentDate} falls outside active contractual coverage windows.`;
    case 'ambiguous':
      return `Policy applicability is ambiguous due to unstated contractual dates or incomplete records.`;
    case 'missing_treatment_date':
      return `Treatment date is missing or invalid.`;
    case 'missing_policy':
      return `No policy documents found for this policy family.`;
    default:
      return `Applicability status: ${status}.`;
  }
}
