import { PolicyVersionRecord, ClauseModification } from '../types/policyVersion.js';
import { PolicyDocument } from '../types/policy.js';
import { IndexedPolicyClause, ClauseType } from '../types/retrieval.js';
import { StandardChargeCategory } from '../types/claim.js';

// ============================================================================
// Medical & Insurance Term Expansions for Lexical Normalization
// ============================================================================

const ABBREVIATION_EXPANSIONS: Record<string, string[]> = {
  cabg: ['coronary', 'artery', 'bypass', 'graft', 'heart', 'bypass'],
  ot: ['operation', 'theatre', 'operating', 'room', 'surgical', 'suite'],
  icu: ['intensive', 'care', 'unit', 'critical', 'care'],
  ccu: ['coronary', 'care', 'unit', 'critical', 'care'],
  ppe: ['personal', 'protective', 'equipment', 'consumable', 'gloves', 'mask'],
  tpa: ['third', 'party', 'administrator'],
  si: ['sum', 'insured'],
  ptca: ['percutaneous', 'coronary', 'angioplasty', 'stent'],
  mri: ['magnetic', 'resonance', 'imaging', 'scan', 'diagnostic'],
  ct: ['computed', 'tomography', 'scan', 'radiology'],
  usg: ['ultrasonography', 'ultrasound', 'scan'],
  ivf: ['in', 'vitro', 'fertilization', 'infertility'],
  opd: ['outpatient', 'department', 'consultation'],
  ipd: ['inpatient', 'department', 'hospitalization'],
  tooth: ['dental', 'teeth'],
  teeth: ['dental', 'tooth'],
  root: ['dental', 'canal'],
  canal: ['root', 'dental']
};

export const RETRIEVAL_STOPWORDS = new Set([
  'fee',
  'fees',
  'charge',
  'charges',
  'rate',
  'rates',
  'cost',
  'costs',
  'amount',
  'amounts',
  'tariff',
  'tariffs',
  'per',
  'day',
  'days',
  'item',
  'items',
  'and',
  'or',
  'the',
  'of',
  'for',
  'in',
  'to',
  'a',
  'an',
  'by',
  'with',
  'is',
  'are'
]);

/**
 * Normalizes text for lexical search by lowering case, stripping punctuation,
 * filtering generic billing stopwords, and selectively expanding known medical acronyms.
 */
export function normalizeRetrievalText(rawText: string): string {
  if (!rawText) return '';
  const cleaned = rawText
    .toLowerCase()
    .replace(/[^\w\s\d₹%.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned.split(' ');
  const expandedTokens: string[] = [];

  for (const token of tokens) {
    if (RETRIEVAL_STOPWORDS.has(token) && !ABBREVIATION_EXPANSIONS[token]) {
      continue;
    }
    expandedTokens.push(token);
    if (ABBREVIATION_EXPANSIONS[token]) {
      expandedTokens.push(...ABBREVIATION_EXPANSIONS[token]);
    }
  }

  return expandedTokens.join(' ');
}

// ============================================================================
// IRDAI Standard Statutory Non-Payables Annexure
// (Statutory list of non-payable items in Indian health insurance)
// ============================================================================

export const IRDAI_STATUTORY_NON_PAYABLE_CLAUSES: Omit<
  IndexedPolicyClause,
  'familyId' | 'versionId' | 'documentId' | 'effectiveFrom' | 'effectiveTo'
>[] = [
  {
    clauseId: 'irdai_non_payable_consumables_01',
    heading: 'IRDAI Master Circular — Non-Payable Items (Annexure 1): Personal Comfort & Consumables',
    section: 'Statutory Annexure 1, Items 1-15',
    exactExcerpt:
      'Items of personal comfort and convenience including gloves (unless specialized surgical in OT), sanitizers, mask, face shield, thermometer, toiletries, diapers, and baby food are non-payable by insurers.',
    pageNumber: 1,
    clauseType: 'exclusion',
    originalText:
      'Gloves, sanitizers, toiletries, face shields, and routine personal protective consumables are classified as non-payable under statutory insurance regulations.',
    normalizedText: normalizeRetrievalText(
      'gloves sanitizer mask face shield thermometer toiletries diapers personal comfort consumable non payable'
    ),
    applicableCategories: ['CONSUMABLES_NON_PAYABLES'],
    limitValue: 0,
    linkedClauseIds: [],
    isSegmentationUncertain: false
  },
  {
    clauseId: 'irdai_non_payable_admin_charges_02',
    heading: 'IRDAI Master Circular — Non-Payable Items (Annexure 1): Administrative & Admission Fees',
    section: 'Statutory Annexure 1, Items 20-32',
    exactExcerpt:
      'Administrative charges, admission fee, registration fee, discharge card fee, medical records photocopying, documentation fee, and surcharge are non-payable.',
    pageNumber: 1,
    clauseType: 'exclusion',
    originalText:
      'Administrative charges, admission fee, registration fee, discharge processing fee, and record maintenance charges cannot be reimbursed.',
    normalizedText: normalizeRetrievalText(
      'admission fee registration administrative documentation discharge card surcharge record maintenance non payable'
    ),
    applicableCategories: ['CONSUMABLES_NON_PAYABLES', 'MISCELLANEOUS'],
    limitValue: 0,
    linkedClauseIds: [],
    isSegmentationUncertain: false
  }
];

// ============================================================================
// Policy Clause Indexing Engine
// ============================================================================

export class ClauseIndexingService {
  /**
   * Converts a PolicyVersionRecord into an authoritative collection of IndexedPolicyClauses.
   */
  public indexPolicyVersion(versionRecord: PolicyVersionRecord): IndexedPolicyClause[] {
    const clauses: IndexedPolicyClause[] = [];
    const policy = versionRecord.policyData;
    const familyId = versionRecord.familyId;
    const versionId = versionRecord.versionId;
    const documentId = versionRecord.documentId;
    const documentHash = versionRecord.contentHashSha256 || null;
    const effectiveFrom = versionRecord.effectiveFrom;
    const effectiveTo = versionRecord.effectiveTo;

    // 0. Inpatient Hospitalization & Surgical Coverage Clause
    if (policy.sumInsured && policy.sumInsured > 0) {
      const siStr = typeof policy.sumInsured === 'number' ? `₹${policy.sumInsured.toLocaleString('en-IN')}` : String(policy.sumInsured);
      const excerpt = policy.sourceSnippets?.inpatientCoverage ||
        `Inpatient hospitalization expenses including surgeon fees, anesthesia, blood, oxygen, operation theatre charges, surgical appliances, nursing, medicines, and medical practitioner consultations for illness or injury covered up to Sum Insured of ${siStr}.`;

      clauses.push({
        clauseId: `${versionId}_cl_inpatient_coverage`,
        familyId,
        versionId,
        documentId,
        documentHash,
        heading: 'Inpatient Hospitalization & Surgical Procedures Coverage',
        section: 'Section 1: Inpatient Medical Care',
        exactExcerpt: excerpt,
        pageNumber: 1,
        clauseType: 'coverage',
        originalText: excerpt,
        normalizedText: normalizeRetrievalText(
          `inpatient hospitalization surgical surgery surgeon consultation operation theatre procedure medical practitioner doctor treatment appendectomy ${siStr} ${excerpt}`
        ),
        applicableCategories: [
          'SURGEON_CONSULTATION',
          'OT_CHARGES',
          'NURSING',
          'MEDICINES_PHARMACY',
          'INVESTIGATIONS_DIAGNOSTICS',
          'IMPLANT_PROSTHETICS'
        ],
        limitValue: policy.sumInsured,
        linkedClauseIds: [],
        effectiveFrom,
        effectiveTo,
        isSegmentationUncertain: false
      });
    }

    // 1. Room Rent & Boarding Clause
    if (policy.roomLimit && policy.roomLimit.value !== null) {
      const valStr = typeof policy.roomLimit.value === 'number' ? `₹${policy.roomLimit.value.toLocaleString('en-IN')}` : String(policy.roomLimit.value);
      const excerpt = policy.sourceSnippets?.roomLimit || `Room rent, boarding and nursing expenses up to ${valStr} per day.`;
      
      clauses.push({
        clauseId: `${versionId}_cl_room_rent`,
        familyId,
        versionId,
        documentId,
        documentHash,
        heading: 'Hospitalization & Room Rent Daily Eligibility Limit',
        section: 'Section 1: Inpatient Hospitalization Limits',
        exactExcerpt: excerpt,
        pageNumber: this.findPageForField(policy, 'roomLimit'),
        clauseType: 'limit',
        originalText: excerpt,
        normalizedText: normalizeRetrievalText(`room rent boarding nursing bed daily charges ${valStr} ${excerpt}`),
        applicableCategories: ['ROOM_RENT', 'NURSING'],
        limitValue: policy.roomLimit.value,
        linkedClauseIds: [`${versionId}_cl_prop_deduction`],
        effectiveFrom,
        effectiveTo,
        isSegmentationUncertain: false
      });
    }

    // 2. ICU Charges Clause
    if (policy.icuLimit && policy.icuLimit.value !== null) {
      const valStr = typeof policy.icuLimit.value === 'number' ? `${policy.icuLimit.value}% of Sum Insured` : String(policy.icuLimit.value);
      const excerpt = policy.sourceSnippets?.icuLimit || `ICU charges up to ${valStr} per day.`;

      clauses.push({
        clauseId: `${versionId}_cl_icu_limit`,
        familyId,
        versionId,
        documentId,
        documentHash,
        heading: 'Intensive Care Unit (ICU) Charges Limit',
        section: 'Section 1: Intensive Care Limits',
        exactExcerpt: excerpt,
        pageNumber: this.findPageForField(policy, 'icuLimit'),
        clauseType: 'limit',
        originalText: excerpt,
        normalizedText: normalizeRetrievalText(`icu intensive care unit charges critical care ${valStr} ${excerpt}`),
        applicableCategories: ['ICU_CHARGES'],
        limitValue: policy.icuLimit.value,
        linkedClauseIds: [],
        effectiveFrom,
        effectiveTo,
        isSegmentationUncertain: false
      });
    }

    // 3. Proportionate Deduction Clause
    if (policy.proportionateDeduction === true) {
      const excerpt = policy.sourceSnippets?.proportionateDeduction ||
        'Associated medical expenses (including doctor fees, OT charges, specialist fees) shall be paid in proportion to eligible room rent if higher room is chosen.';

      clauses.push({
        clauseId: `${versionId}_cl_prop_deduction`,
        familyId,
        versionId,
        documentId,
        documentHash,
        heading: 'Proportionate Deduction on Associated Medical Expenses',
        section: 'Section 2: Room Rent Capping & Associated Charges',
        exactExcerpt: excerpt,
        pageNumber: this.findPageForField(policy, 'proportionateDeduction'),
        clauseType: 'proportionate_deduction',
        originalText: excerpt,
        normalizedText: normalizeRetrievalText(
          `proportionate deduction associated medical expenses surgeon specialist doctor fee ot charges room upgrade tariff penalty ${excerpt}`
        ),
        applicableCategories: ['ROOM_RENT', 'SURGEON_CONSULTATION', 'NURSING', 'OT_CHARGES'],
        limitValue: null,
        linkedClauseIds: [`${versionId}_cl_room_rent`],
        effectiveFrom,
        effectiveTo,
        isSegmentationUncertain: false
      });
    }

    // 4. Co-Payment Schedule
    if (policy.copay !== null && policy.copay !== undefined) {
      const excerpt = policy.sourceSnippets?.copay || `A co-payment of ${policy.copay}% applies to admissible claims.`;

      clauses.push({
        clauseId: `${versionId}_cl_copay`,
        familyId,
        versionId,
        documentId,
        documentHash,
        heading: 'Co-Payment Schedule & Patient Sharing',
        section: 'Section 3: Co-Payment Provisions',
        exactExcerpt: excerpt,
        pageNumber: this.findPageForField(policy, 'copay'),
        clauseType: 'co_payment',
        originalText: excerpt,
        normalizedText: normalizeRetrievalText(`co-payment copay percentage cost sharing patient out of pocket ${policy.copay}% ${excerpt}`),
        applicableCategories: ['MISCELLANEOUS'],
        limitValue: policy.copay,
        linkedClauseIds: [],
        effectiveFrom,
        effectiveTo,
        isSegmentationUncertain: false
      });
    }

    // 5. Compulsory Deductible
    if (policy.deductible !== null && policy.deductible !== undefined && policy.deductible > 0) {
      const excerpt = policy.sourceSnippets?.deductible || `Compulsory deductible of ₹${policy.deductible} applies before insurer payout.`;

      clauses.push({
        clauseId: `${versionId}_cl_deductible`,
        familyId,
        versionId,
        documentId,
        documentHash,
        heading: 'Compulsory Policy Deductible',
        section: 'Section 3: Deductible Terms',
        exactExcerpt: excerpt,
        pageNumber: this.findPageForField(policy, 'deductible'),
        clauseType: 'deductible',
        originalText: excerpt,
        normalizedText: normalizeRetrievalText(`compulsory deductible excess initial threshold ₹${policy.deductible} ${excerpt}`),
        applicableCategories: ['MISCELLANEOUS'],
        limitValue: policy.deductible,
        linkedClauseIds: [],
        effectiveFrom,
        effectiveTo,
        isSegmentationUncertain: false
      });
    }

    // 6. Permanent Exclusions
    if (policy.exclusions && policy.exclusions.length > 0) {
      policy.exclusions.forEach((excl, idx) => {
        const cleanExcl = excl.trim();
        const excerpt = policy.sourceSnippets?.exclusions || `Treatment or procedure permanently excluded: ${cleanExcl}.`;
        const categories = this.inferCategoriesForExclusion(cleanExcl);

        clauses.push({
          clauseId: `${versionId}_cl_excl_${idx + 1}`,
          familyId,
          versionId,
          documentId,
          documentHash,
          heading: `Permanent Contractual Exclusion: ${cleanExcl}`,
          section: 'Section 4: General Exclusions',
          exactExcerpt: excerpt,
          pageNumber: this.findPageForField(policy, 'exclusions'),
          clauseType: 'exclusion',
          originalText: excerpt,
          normalizedText: normalizeRetrievalText(`permanent exclusion permanently excluded not covered disallowed ${cleanExcl} ${excerpt}`),
          applicableCategories: categories,
          limitValue: 0,
          linkedClauseIds: [],
          effectiveFrom,
          effectiveTo,
          isSegmentationUncertain: false
        });
      });
    }

    // 7. Procedure / Category Sub-Limits
    if (policy.subLimits && Object.keys(policy.subLimits).length > 0) {
      Object.entries(policy.subLimits).forEach(([procName, limitAmt], idx) => {
        const excerpt = policy.sourceSnippets?.subLimits || `Sub-limit for ${procName} is capped at ₹${limitAmt.toLocaleString('en-IN')} per policy year.`;

        clauses.push({
          clauseId: `${versionId}_cl_sublimit_${idx + 1}`,
          familyId,
          versionId,
          documentId,
          documentHash,
          heading: `Specific Procedure Sub-Limit: ${procName}`,
          section: 'Section 5: Specific Disease & Procedure Sub-Limits',
          exactExcerpt: excerpt,
          pageNumber: this.findPageForField(policy, 'subLimits'),
          clauseType: 'limit',
          originalText: excerpt,
          normalizedText: normalizeRetrievalText(`sub-limit sublimit capping ceiling maximum procedure cap ${procName} ₹${limitAmt} ${excerpt}`),
          applicableCategories: ['SURGEON_CONSULTATION', 'OT_CHARGES', 'IMPLANT_PROSTHETICS'],
          limitValue: limitAmt,
          linkedClauseIds: [],
          effectiveFrom,
          effectiveTo,
          isSegmentationUncertain: false
        });
      });
    }

    // 8. Specific Clause Modifications (if Amendment or Endorsement)
    if (versionRecord.clauseModifications && versionRecord.clauseModifications.length > 0) {
      versionRecord.clauseModifications.forEach((mod: ClauseModification, idx: number) => {
        const excerpt = mod.newClauseText;
        const heading = mod.clauseTitle || `Endorsement Modification: ${mod.clauseId}`;

        clauses.push({
          clauseId: `${versionId}_mod_${mod.clauseId || idx + 1}`,
          familyId,
          versionId,
          documentId,
          documentHash,
          heading,
          section: 'Endorsement Clause Schedule',
          exactExcerpt: excerpt,
          pageNumber: 1,
          clauseType: this.inferClauseTypeFromPath(mod.targetPath),
          originalText: excerpt,
          normalizedText: normalizeRetrievalText(`${heading} ${mod.description} ${excerpt}`),
          applicableCategories: this.inferCategoriesFromPath(mod.targetPath),
          limitValue: !isNaN(Number(excerpt)) ? Number(excerpt) : null,
          linkedClauseIds: mod.previousClauseText ? [`${versionRecord.parentVersionId}_prev`] : [],
          effectiveFrom,
          effectiveTo,
          isSegmentationUncertain: false
        });
      });
    }

    // 9. Append statutory IRDAI non-payable rules tagged to this policy version
    for (const statClause of IRDAI_STATUTORY_NON_PAYABLE_CLAUSES) {
      clauses.push({
        ...statClause,
        clauseId: `${versionId}_${statClause.clauseId}`,
        familyId,
        versionId,
        documentId,
        documentHash,
        effectiveFrom,
        effectiveTo
      });
    }

    return clauses;
  }

  private findPageForField(policy: PolicyDocument, field: string): number | null {
    // If page is encoded or extracted in snippets, parse it; default 1 if document confirmed
    return 1;
  }

  private inferCategoriesForExclusion(exclText: string): StandardChargeCategory[] {
    const lower = exclText.toLowerCase();
    if (lower.includes('cosmetic') || lower.includes('plastic') || lower.includes('aesthetic')) {
      return ['SURGEON_CONSULTATION', 'OT_CHARGES', 'MISCELLANEOUS'];
    }
    if (lower.includes('dental')) {
      return ['SURGEON_CONSULTATION', 'MISCELLANEOUS'];
    }
    if (lower.includes('weight') || lower.includes('bariatric')) {
      return ['SURGEON_CONSULTATION', 'OT_CHARGES'];
    }
    return ['MISCELLANEOUS'];
  }

  private inferClauseTypeFromPath(targetPath?: string): ClauseType {
    if (!targetPath) return 'coverage';
    if (targetPath.includes('roomLimit') || targetPath.includes('icuLimit') || targetPath.includes('subLimits')) {
      return 'limit';
    }
    if (targetPath.includes('copay')) return 'co_payment';
    if (targetPath.includes('deductible')) return 'deductible';
    if (targetPath.includes('proportionate')) return 'proportionate_deduction';
    if (targetPath.includes('exclusion')) return 'exclusion';
    return 'coverage';
  }

  private inferCategoriesFromPath(targetPath?: string): StandardChargeCategory[] {
    if (!targetPath) return ['MISCELLANEOUS'];
    if (targetPath.includes('roomLimit')) return ['ROOM_RENT', 'NURSING'];
    if (targetPath.includes('icuLimit')) return ['ICU_CHARGES'];
    if (targetPath.includes('subLimits.cataract')) return ['SURGEON_CONSULTATION', 'OT_CHARGES', 'IMPLANT_PROSTHETICS'];
    return ['MISCELLANEOUS'];
  }
}

export const clauseIndexingService = new ClauseIndexingService();
