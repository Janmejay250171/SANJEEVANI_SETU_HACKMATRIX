import { StandardChargeCategory } from '../types/claim.js';

export type EvaluationCategory =
  | 'A_EXACT_MATCH'
  | 'B_SEMANTIC_PARAPHRASE'
  | 'C_MEDICAL_ABBREVIATION'
  | 'D_SUPPORTED_TREATMENT'
  | 'E_EXPLICIT_EXCLUSION'
  | 'F_EXCLUSION_WITH_EXCEPTION'
  | 'G_CONDITIONAL_COVERAGE'
  | 'H_MISSING_INSUFFICIENT_EVIDENCE'
  | 'I_CONFLICTING_CLAUSES'
  | 'J_MISLEADING_SEMANTIC_MATCH'
  | 'K_LIMITS_COPAY_DEDUCTIBLE'
  | 'L_POLICY_AMENDMENT_CONFLICT'
  | 'M_PRE_POST_AMENDMENT_DATE'
  | 'N_AMBIGUOUS_CONFLICTING_DATES'
  | 'O_MULTIPLE_ITEMS_MIXED_OUTCOMES';

export interface LabelledBillClauseExample {
  id: string;
  category: EvaluationCategory;
  isSynthetic: boolean;
  policyFamilyId: string;
  policyVersionId?: string;
  treatmentDate: string;
  billItemDescription: string;
  normalizedDescription?: string;
  standardCategory: StandardChargeCategory;
  claimedAmountPaise: number;
  expectedRelevantClauseIds: string[];
  expectedEvidenceCategory: 'SUPPORTIVE' | 'ADVERSE_EXCLUSION' | 'CONDITIONAL_LIMIT' | 'CONFLICTING' | 'INSUFFICIENT';
  expectedVerificationOutcome: 'supported' | 'excluded' | 'conditional' | 'conflicting' | 'insufficient_evidence';
  expectedReviewRequired: boolean;
  expectedExclusionOrExceptionDetails?: string;
  expectedApplicableAmendmentId?: string | null;
  groundTruthNotes: string;
  sourceDocumentRef: string;
  dataSplit: 'train' | 'test' | 'validation';
}

/**
 * 25 Authoritative Labelled Bill-to-Clause Evaluation Examples across categories A through O.
 * Uses synthetic policy fixtures (syn_fam_health_01 / base v1.0 and amendment v1.1).
 * Paraphrases and variations of the same underlying clauses are isolated into the 'test' split to prevent leakage.
 */
export const LABELLED_BILL_CLAUSE_DATASET: LabelledBillClauseExample[] = [
  // --------------------------------------------------------------------------
  // A. EXACT WORDING MATCHES
  // --------------------------------------------------------------------------
  {
    id: 'lbl_exact_01',
    category: 'A_EXACT_MATCH',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-10',
    billItemDescription: 'Room rent, boarding and nursing expenses up to Rs.3,000 per day',
    normalizedDescription: 'Room Rent and Nursing Expenses',
    standardCategory: 'ROOM_RENT',
    claimedAmountPaise: 900000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_room_rent'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    groundTruthNotes: 'Verbatim clause quotation for inpatient room rent ceiling from Section 1.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },
  {
    id: 'lbl_exact_02',
    category: 'A_EXACT_MATCH',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-10',
    billItemDescription: 'ICU charges up to 2% of sum insured per day',
    normalizedDescription: 'Intensive Care Unit Daily Charge',
    standardCategory: 'ICU_CHARGES',
    claimedAmountPaise: 2000000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_icu_limit'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    groundTruthNotes: 'Verbatim contractual clause for ICU accommodation ceiling.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // B. SEMANTIC PARAPHRASES AND SYNONYMS
  // --------------------------------------------------------------------------
  {
    id: 'lbl_para_01',
    category: 'B_SEMANTIC_PARAPHRASE',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-12',
    billItemDescription: 'Single patient bed boarding and ward nursing tariff per diem',
    normalizedDescription: 'Room Rent and Nursing Boarding',
    standardCategory: 'ROOM_RENT',
    claimedAmountPaise: 1500000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_room_rent'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    groundTruthNotes: 'Semantic paraphrase of room rent clause using clinical hospital tariff phrasing.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },
  {
    id: 'lbl_para_02',
    category: 'B_SEMANTIC_PARAPHRASE',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-12',
    billItemDescription: 'Critical care monitoring unit per-day stay fee',
    normalizedDescription: 'ICU Critical Care Bed Charges',
    standardCategory: 'ICU_CHARGES',
    claimedAmountPaise: 2500000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_icu_limit'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    groundTruthNotes: 'Hospital terminology paraphrase for ICU daily limit.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // C. MEDICAL ABBREVIATIONS AND ALTERNATE NAMES
  // --------------------------------------------------------------------------
  {
    id: 'lbl_abbr_01',
    category: 'C_MEDICAL_ABBREVIATION',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-15',
    billItemDescription: 'OT anesthesia equipment, gases and surgical theatre consumables',
    normalizedDescription: 'Operation Theatre and Anesthesia Charges',
    standardCategory: 'OT_CHARGES',
    claimedAmountPaise: 3500000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_prop_deduction'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    groundTruthNotes: 'Abbreviation "OT" matches Operation Theatre in Section 2 proportionate deduction clauses.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },
  {
    id: 'lbl_abbr_02',
    category: 'C_MEDICAL_ABBREVIATION',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-15',
    billItemDescription: 'TKR knee prosthesis implant and surgical alignment instrument fee',
    normalizedDescription: 'Total Knee Replacement Surgery',
    standardCategory: 'IMPLANT_PROSTHETICS',
    claimedAmountPaise: 18000000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_sublimit_knee'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    groundTruthNotes: 'Abbreviation "TKR" represents Total Knee Replacement covered under procedure sublimit.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // D. SUPPORTED TREATMENT ITEMS
  // --------------------------------------------------------------------------
  {
    id: 'lbl_supp_01',
    category: 'D_SUPPORTED_TREATMENT',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-18',
    billItemDescription: 'Emergency laparoscopic appendectomy surgical procedure',
    normalizedDescription: 'Emergency Inpatient Appendectomy',
    standardCategory: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 4500000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_daycare_inpatient'],
    expectedEvidenceCategory: 'SUPPORTIVE',
    expectedVerificationOutcome: 'supported',
    expectedReviewRequired: false,
    groundTruthNotes: 'Directly admissible acute emergency surgical inpatient procedure with no applicable sublimits.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // E. EXPLICIT EXCLUSIONS
  // --------------------------------------------------------------------------
  {
    id: 'lbl_excl_01',
    category: 'E_EXPLICIT_EXCLUSION',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-20',
    billItemDescription: 'Elective cosmetic rhinoplasty and facial contouring surgery',
    normalizedDescription: 'Cosmetic Rhinoplasty',
    standardCategory: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 7500000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_excl_1'],
    expectedEvidenceCategory: 'ADVERSE_EXCLUSION',
    expectedVerificationOutcome: 'excluded',
    expectedReviewRequired: false,
    expectedExclusionOrExceptionDetails: 'Permanent exclusion of elective aesthetic/cosmetic surgeries.',
    groundTruthNotes: 'Section 4 permanently excludes aesthetic surgeries without accidental injury trauma.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },
  {
    id: 'lbl_excl_02',
    category: 'E_EXPLICIT_EXCLUSION',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-20',
    billItemDescription: 'Disposable surgical gloves and personal sanitizing wipes',
    normalizedDescription: 'Surgical Consumables',
    standardCategory: 'CONSUMABLES_NON_PAYABLES',
    claimedAmountPaise: 150000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_irdai_non_payable_consumables_01'],
    expectedEvidenceCategory: 'ADVERSE_EXCLUSION',
    expectedVerificationOutcome: 'excluded',
    expectedReviewRequired: false,
    expectedExclusionOrExceptionDetails: 'IRDAI non-payable list Item 1 & 14.',
    groundTruthNotes: 'Statutory regulatory non-payable consumables excluded from insurer payment.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // F. EXCLUSIONS WITH EXCEPTIONS
  // --------------------------------------------------------------------------
  {
    id: 'lbl_excl_exc_01',
    category: 'F_EXCLUSION_WITH_EXCEPTION',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-22',
    billItemDescription: 'Emergency inpatient dental fracture surgery following road traffic accident',
    normalizedDescription: 'Accidental Dental Maxillofacial Surgery',
    standardCategory: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 4000000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_excl_dental'],
    expectedEvidenceCategory: 'SUPPORTIVE',
    expectedVerificationOutcome: 'supported',
    expectedReviewRequired: false,
    expectedExclusionOrExceptionDetails: 'Dental exclusion contains express exception for accidental injury trauma requiring inpatient stay.',
    groundTruthNotes: 'General dental exclusion is overridden because accidental trauma exception is proven.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // G. CONDITIONAL COVERAGE REQUIRING ADDITIONAL FACTS
  // --------------------------------------------------------------------------
  {
    id: 'lbl_cond_01',
    category: 'G_CONDITIONAL_COVERAGE',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-25',
    billItemDescription: 'Root canal therapy and molar crown installation',
    normalizedDescription: 'Dental Root Canal Therapy',
    standardCategory: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 2500000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_excl_dental'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: true,
    expectedExclusionOrExceptionDetails: 'Missing proof of accidental injury trauma.',
    groundTruthNotes: 'Dental treatment is conditionally excluded unless accidental trauma clinical diagnosis is verified.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // H. MISSING OR INSUFFICIENT EVIDENCE
  // --------------------------------------------------------------------------
  {
    id: 'lbl_miss_01',
    category: 'H_MISSING_INSUFFICIENT_EVIDENCE',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-04-28',
    billItemDescription: 'Extraterrestrial telemetry bio-resonance calibration session',
    normalizedDescription: 'Unverified Alternative Energy Therapy',
    standardCategory: 'MISCELLANEOUS',
    claimedAmountPaise: 5000000,
    expectedRelevantClauseIds: [],
    expectedEvidenceCategory: 'INSUFFICIENT',
    expectedVerificationOutcome: 'insufficient_evidence',
    expectedReviewRequired: true,
    groundTruthNotes: 'Obscure medical charge with zero matching policy clauses; system must flag for review rather than fabricate coverage.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // I. CONFLICTING POLICY CLAUSES
  // --------------------------------------------------------------------------
  {
    id: 'lbl_conf_01',
    category: 'I_CONFLICTING_CLAUSES',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-05-02',
    billItemDescription: 'Robotic radical prostatectomy advanced technology charge',
    normalizedDescription: 'Robotic Prostate Surgery',
    standardCategory: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 12000000,
    expectedRelevantClauseIds: [
      'syn_ver_base_2025_v1_cl_daycare_inpatient',
      'syn_ver_base_2025_v1_cl_excl_unproven'
    ],
    expectedEvidenceCategory: 'CONFLICTING',
    expectedVerificationOutcome: 'conflicting',
    expectedReviewRequired: true,
    groundTruthNotes: 'Covered under general modern treatment clause but challenged by unproven/robotic technology exclusion clause; requires manual adjudication.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // J. MISLEADING SEMANTIC MATCHES (ADVERSARIAL DISTRACTORS)
  // --------------------------------------------------------------------------
  {
    id: 'lbl_distract_01',
    category: 'J_MISLEADING_SEMANTIC_MATCH',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-05-05',
    billItemDescription: 'Wellness spa membership and cardiovascular fitness center subscription',
    normalizedDescription: 'Outpatient Wellness Membership',
    standardCategory: 'MISCELLANEOUS',
    claimedAmountPaise: 3000000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_excl_wellness'],
    expectedEvidenceCategory: 'ADVERSE_EXCLUSION',
    expectedVerificationOutcome: 'excluded',
    expectedReviewRequired: false,
    groundTruthNotes: 'Contains cardiovascular/wellness keywords but is non-medical fitness facility expense, which is excluded.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // K. DEDUCTIBLES, CO-PAYMENTS, SUBLIMITS AND ROOM-RENT RULES
  // --------------------------------------------------------------------------
  {
    id: 'lbl_limits_01',
    category: 'K_LIMITS_COPAY_DEDUCTIBLE',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-05-10',
    billItemDescription: 'Cataract phacoemulsification surgery with intraocular lens',
    normalizedDescription: 'Cataract Surgery',
    standardCategory: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 6500000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_sublimit_1'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    groundTruthNotes: 'Cataract surgery is capped at contractual sublimit of ₹40,000.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },
  {
    id: 'lbl_limits_02',
    category: 'K_LIMITS_COPAY_DEDUCTIBLE',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-05-10',
    billItemDescription: 'Base contractual co-payment of 10% applies to admissible claim',
    normalizedDescription: 'Co-Payment Schedule',
    standardCategory: 'MISCELLANEOUS',
    claimedAmountPaise: 0,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_copay'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    groundTruthNotes: 'Section 3 sets a 10% co-payment across all admissible claims.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // L. ORIGINAL POLICY VERSUS AMENDMENT CONFLICTS
  // --------------------------------------------------------------------------
  {
    id: 'lbl_amend_conf_01',
    category: 'L_POLICY_AMENDMENT_CONFLICT',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_amend_2025_v1.1',
    treatmentDate: '2025-08-15',
    billItemDescription: 'Private single room accommodation daily charge post-amendment',
    normalizedDescription: 'Room Rent',
    standardCategory: 'ROOM_RENT',
    claimedAmountPaise: 1500000,
    expectedRelevantClauseIds: ['syn_ver_amend_2025_v1.1_mod_cl_amend_room_01'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    expectedApplicableAmendmentId: 'syn_ver_amend_2025_v1.1',
    groundTruthNotes: 'Amendment v1.1 overrides base v1.0 room rent limit from ₹5,000 to ₹7,500.',
    sourceDocumentRef: '/storage/synthetic_amendment_v1_1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // M. TREATMENT DATES BEFORE AND AFTER AN ESTABLISHED EFFECTIVE DATE
  // --------------------------------------------------------------------------
  {
    id: 'lbl_date_pre_01',
    category: 'M_PRE_POST_AMENDMENT_DATE',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-05-15', // Pre-effective date (< 2025-07-01)
    billItemDescription: 'Single room bed charge before amendment effective date',
    normalizedDescription: 'Room Rent Base Limit',
    standardCategory: 'ROOM_RENT',
    claimedAmountPaise: 1000000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_room_rent'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    expectedApplicableAmendmentId: null,
    groundTruthNotes: 'Treatment on 2025-05-15 is before amendment effective date (2025-07-01); base policy v1.0 governs.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },
  {
    id: 'lbl_date_post_01',
    category: 'M_PRE_POST_AMENDMENT_DATE',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_amend_2025_v1.1',
    treatmentDate: '2025-08-20', // Post-effective date (>= 2025-07-01)
    billItemDescription: 'Single room bed charge after amendment effective date',
    normalizedDescription: 'Room Rent Amended Limit',
    standardCategory: 'ROOM_RENT',
    claimedAmountPaise: 1000000,
    expectedRelevantClauseIds: ['syn_ver_amend_2025_v1.1_mod_cl_amend_room_01'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationOutcome: 'conditional',
    expectedReviewRequired: false,
    expectedApplicableAmendmentId: 'syn_ver_amend_2025_v1.1',
    groundTruthNotes: 'Treatment on 2025-08-20 is after amendment effective date (2025-07-01); amendment v1.1 governs.',
    sourceDocumentRef: '/storage/synthetic_amendment_v1_1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // N. AMBIGUOUS OR CONFLICTING EFFECTIVE DATES
  // --------------------------------------------------------------------------
  {
    id: 'lbl_ambig_date_01',
    category: 'N_AMBIGUOUS_CONFLICTING_DATES',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    treatmentDate: '2026-06-15', // Outside all known policy schedules
    billItemDescription: 'Out-of-schedule hospitalization bed charge',
    normalizedDescription: 'Expired Policy Inpatient Stay',
    standardCategory: 'ROOM_RENT',
    claimedAmountPaise: 1200000,
    expectedRelevantClauseIds: [],
    expectedEvidenceCategory: 'INSUFFICIENT',
    expectedVerificationOutcome: 'insufficient_evidence',
    expectedReviewRequired: true,
    groundTruthNotes: 'Treatment date falls after policy end date (2025-12-31); applicability is unresolved, review required.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },

  // --------------------------------------------------------------------------
  // O. MULTIPLE BILL ITEMS WITH DIFFERENT COVERAGE OUTCOMES
  // --------------------------------------------------------------------------
  {
    id: 'lbl_multi_mixed_01',
    category: 'O_MULTIPLE_ITEMS_MIXED_OUTCOMES',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-06-10',
    billItemDescription: 'Surgeon professional fee for inpatient cholecystectomy',
    normalizedDescription: 'Surgeon Fee',
    standardCategory: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 3000000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_daycare_inpatient'],
    expectedEvidenceCategory: 'SUPPORTIVE',
    expectedVerificationOutcome: 'supported',
    expectedReviewRequired: false,
    groundTruthNotes: 'Admissible core surgeon fee in mixed invoice.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  },
  {
    id: 'lbl_multi_mixed_02',
    category: 'O_MULTIPLE_ITEMS_MIXED_OUTCOMES',
    isSynthetic: true,
    policyFamilyId: 'syn_fam_health_01',
    policyVersionId: 'syn_ver_base_2025_v1',
    treatmentDate: '2025-06-10',
    billItemDescription: 'Cosmetic skin closure aesthetic glue ampoules',
    normalizedDescription: 'Aesthetic Consumables',
    standardCategory: 'CONSUMABLES_NON_PAYABLES',
    claimedAmountPaise: 500000,
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_excl_1'],
    expectedEvidenceCategory: 'ADVERSE_EXCLUSION',
    expectedVerificationOutcome: 'excluded',
    expectedReviewRequired: false,
    groundTruthNotes: 'Non-admissible cosmetic addition in mixed invoice.',
    sourceDocumentRef: '/storage/synthetic_policy_v1.pdf',
    dataSplit: 'test'
  }
];
