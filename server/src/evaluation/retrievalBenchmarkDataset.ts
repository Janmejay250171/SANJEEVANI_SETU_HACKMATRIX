import { StandardChargeCategory } from '../types/claim.js';

export type BenchmarkQueryType =
  | 'EXACT_MATCH'
  | 'PARAPHRASE_SYNONYM'
  | 'MEDICAL_ABBREVIATION'
  | 'STATUTORY_EXCLUSION'
  | 'CONTRACTUAL_EXCLUSION'
  | 'NUMERICAL_SUBLIMIT'
  | 'PROPORTIONATE_DEDUCTION'
  | 'AMENDMENT_MODIFICATION'
  | 'AMBIGUOUS_DATE_OR_TERM';

export interface RetrievalBenchmarkItem {
  id: string;
  queryType: BenchmarkQueryType;
  billItemDescription: string;
  normalizedDescription?: string;
  category: StandardChargeCategory;
  familyId: string;
  treatmentDate: string;
  expectedRelevantClauseIds: string[];
  expectedEvidenceCategory: 'SUPPORTIVE' | 'ADVERSE_EXCLUSION' | 'CONDITIONAL_LIMIT' | 'CONFLICTING';
  expectedVerificationStatus: 'supported' | 'excluded' | 'conditional' | 'conflicting' | 'insufficient_evidence';
  expectedManualReview: boolean;
  groundTruthExplanation: string;
  isSynthetic: boolean;
}

export const RETRIEVAL_BENCHMARK_DATASET: RetrievalBenchmarkItem[] = [
  // 1. EXACT MATCHES
  {
    id: 'bm_exact_01',
    queryType: 'EXACT_MATCH',
    billItemDescription: 'Room rent, boarding and nursing expenses up to Rs.3,000 per day',
    category: 'ROOM_RENT',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-03-15',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_room_rent'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Exact contractual phrase matching room rent limit clause.',
    isSynthetic: true
  },
  {
    id: 'bm_exact_02',
    queryType: 'EXACT_MATCH',
    billItemDescription: 'ICU charges up to 2% of sum insured per day',
    category: 'ICU_CHARGES',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-03-15',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_icu_limit'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Exact contractual phrase matching ICU limit clause.',
    isSynthetic: true
  },
  {
    id: 'bm_exact_03',
    queryType: 'EXACT_MATCH',
    billItemDescription: 'A co-payment of 10% applies to each and every admissible claim',
    category: 'MISCELLANEOUS',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-03-15',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_copay'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Exact phrase matching policy co-payment schedule clause.',
    isSynthetic: true
  },

  // 2. PARAPHRASES & SYNONYMS
  {
    id: 'bm_para_01',
    queryType: 'PARAPHRASE_SYNONYM',
    billItemDescription: 'Single patient bed boarding and ward nursing tariff per diem',
    normalizedDescription: 'Room Rent and Nursing Boarding',
    category: 'ROOM_RENT',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-04-10',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_room_rent'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Hospital billing synonym for inpatient room rent charges.',
    isSynthetic: true
  },
  {
    id: 'bm_para_02',
    queryType: 'PARAPHRASE_SYNONYM',
    billItemDescription: 'Critical care monitoring unit per-day stay fee',
    normalizedDescription: 'ICU Critical Care Bed Charges',
    category: 'ICU_CHARGES',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-04-10',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_icu_limit'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Paraphrase for Intensive Care Unit (ICU) bed charges.',
    isSynthetic: true
  },
  {
    id: 'bm_para_03',
    queryType: 'PARAPHRASE_SYNONYM',
    billItemDescription: 'Mandatory patient cost-sharing deduction ten percent',
    category: 'MISCELLANEOUS',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-04-10',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_copay'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Clinical and insurance synonym for co-payment.',
    isSynthetic: true
  },

  // 3. MEDICAL ABBREVIATIONS
  {
    id: 'bm_abbr_01',
    queryType: 'MEDICAL_ABBREVIATION',
    billItemDescription: 'OT equipment sterilization and surgical suite theater charge',
    normalizedDescription: 'Operation Theatre Charges',
    category: 'OT_CHARGES',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-05-12',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_prop_deduction'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'OT abbreviation expanded to operation theatre under associated medical expenses.',
    isSynthetic: true
  },
  {
    id: 'bm_abbr_02',
    queryType: 'MEDICAL_ABBREVIATION',
    billItemDescription: 'CCU / ICU bedside cardiac monitor fee',
    category: 'ICU_CHARGES',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-05-12',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_icu_limit'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'CCU/ICU abbreviation refers to intensive care unit provisions.',
    isSynthetic: true
  },

  // 4. STATUTORY NON-PAYABLE EXCLUSIONS (IRDAI ANNEXURE 1)
  {
    id: 'bm_stat_01',
    queryType: 'STATUTORY_EXCLUSION',
    billItemDescription: 'Surgical examination gloves and alcohol hand sanitizer bottle',
    category: 'CONSUMABLES_NON_PAYABLES',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-05-20',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_irdai_non_payable_consumables_01'],
    expectedEvidenceCategory: 'ADVERSE_EXCLUSION',
    expectedVerificationStatus: 'excluded',
    expectedManualReview: false,
    groundTruthExplanation: 'Gloves and hand sanitizers are non-payable items under IRDAI Annexure 1.',
    isSynthetic: true
  },
  {
    id: 'bm_stat_02',
    queryType: 'STATUTORY_EXCLUSION',
    billItemDescription: 'Hospital admission registration fee and discharge card documentation',
    category: 'CONSUMABLES_NON_PAYABLES',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-05-20',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_irdai_non_payable_admin_charges_02'],
    expectedEvidenceCategory: 'ADVERSE_EXCLUSION',
    expectedVerificationStatus: 'excluded',
    expectedManualReview: false,
    groundTruthExplanation: 'Admission fees and registration charges are non-payable under IRDAI Master Guidelines.',
    isSynthetic: true
  },
  {
    id: 'bm_stat_03',
    queryType: 'STATUTORY_EXCLUSION',
    billItemDescription: 'Patient personal comfort kit, face shield and disposable thermometre',
    category: 'CONSUMABLES_NON_PAYABLES',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-05-20',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_irdai_non_payable_consumables_01'],
    expectedEvidenceCategory: 'ADVERSE_EXCLUSION',
    expectedVerificationStatus: 'excluded',
    expectedManualReview: false,
    groundTruthExplanation: 'Comfort kits and disposable consumables are non-payable under IRDAI Annexure 1.',
    isSynthetic: true
  },

  // 5. CONTRACTUAL PERMANENT EXCLUSIONS
  {
    id: 'bm_excl_01',
    queryType: 'CONTRACTUAL_EXCLUSION',
    billItemDescription: 'Elective cosmetic rhinoplasty and facial aesthetic contouring surgery',
    category: 'SURGEON_CONSULTATION',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-06-01',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_excl_1'],
    expectedEvidenceCategory: 'ADVERSE_EXCLUSION',
    expectedVerificationStatus: 'excluded',
    expectedManualReview: false,
    groundTruthExplanation: 'Cosmetic surgery is permanently excluded under policy clause 1.',
    isSynthetic: true
  },
  {
    id: 'bm_excl_02',
    queryType: 'CONTRACTUAL_EXCLUSION',
    billItemDescription: 'Bariatric weight loss procedure and obesity management treatment',
    category: 'SURGEON_CONSULTATION',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-06-01',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_excl_2'],
    expectedEvidenceCategory: 'ADVERSE_EXCLUSION',
    expectedVerificationStatus: 'excluded',
    expectedManualReview: false,
    groundTruthExplanation: 'Weight loss treatment is permanently excluded under policy terms.',
    isSynthetic: true
  },

  // 6. NUMERICAL SUBLIMITS
  {
    id: 'bm_sub_01',
    queryType: 'NUMERICAL_SUBLIMIT',
    billItemDescription: 'Cataract phacoemulsification surgery with foldable intraocular lens implantation',
    normalizedDescription: 'Cataract Surgery',
    category: 'SURGEON_CONSULTATION',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-06-15',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_sublimit_1'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Cataract is capped at ₹40,000 sublimit per eye.',
    isSynthetic: true
  },

  // 7. PROPORTIONATE DEDUCTIONS
  {
    id: 'bm_prop_01',
    queryType: 'PROPORTIONATE_DEDUCTION',
    billItemDescription: 'Chief Surgeon professional fee and anesthetist charge for deluxe room patient',
    normalizedDescription: 'Surgeon and Specialist Consultation Fees',
    category: 'SURGEON_CONSULTATION',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-06-20',
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_prop_deduction'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Surgeon and specialist fees are associated medical expenses subject to proportionate deduction.',
    isSynthetic: true
  },

  // 8. AMENDMENT MODIFICATIONS (DATE-DEPENDENT PRECEDENCE)
  {
    id: 'bm_amend_pre_01',
    queryType: 'AMENDMENT_MODIFICATION',
    billItemDescription: 'Deluxe private room daily bed charge before amendment took effect',
    category: 'ROOM_RENT',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-05-15', // Pre-amendment (before 2025-07-01)
    expectedRelevantClauseIds: ['syn_ver_base_2025_v1_cl_room_rent'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Treatment date is before amendment effective date (2025-07-01); base clause of ₹5,000 applies.',
    isSynthetic: true
  },
  {
    id: 'bm_amend_post_01',
    queryType: 'AMENDMENT_MODIFICATION',
    billItemDescription: 'Deluxe private room daily bed charge after amendment took effect',
    category: 'ROOM_RENT',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-08-15', // Post-amendment (after 2025-07-01)
    expectedRelevantClauseIds: ['syn_ver_amend_2025_v1.1_mod_cl_amend_room_01'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Treatment date is after amendment effective date (2025-07-01); revised clause of ₹7,500 applies.',
    isSynthetic: true
  },
  {
    id: 'bm_amend_post_02',
    queryType: 'AMENDMENT_MODIFICATION',
    billItemDescription: 'Cataract phacoemulsification surgery post-endorsement revision',
    category: 'SURGEON_CONSULTATION',
    familyId: 'syn_fam_health_01',
    treatmentDate: '2025-08-20', // Post-amendment (after 2025-07-01)
    expectedRelevantClauseIds: ['syn_ver_amend_2025_v1.1_mod_cl_amend_sublimit_cataract'],
    expectedEvidenceCategory: 'CONDITIONAL_LIMIT',
    expectedVerificationStatus: 'conditional',
    expectedManualReview: false,
    groundTruthExplanation: 'Post-endorsement treatment date matches revised cataract sublimit of ₹50,000.',
    isSynthetic: true
  }
];
