import { StandardChargeCategory } from '../types/claim.js';
import { EvidenceOutcome, PrecedenceRole } from '../types/verification.js';

export interface VerificationBenchmarkItem {
  id: string;
  name: string;
  billItemDescription: string;
  category: StandardChargeCategory;
  claimedAmountPaise: number;
  clinicalDiagnosis?: string | null;
  billedRoomTariffPaise?: number | null;
  treatmentDate: string;
  familyId: string;
  expectedOutcome: EvidenceOutcome;
  expectedControllingClauseId?: string;
  expectedPrecedenceRole?: PrecedenceRole;
  expectedReviewRequired: boolean;
  expectedMissingFactsCount: number;
  expectedCitationVerified: boolean;
  notes: string;
  isSynthetic: boolean;
}

export const VERIFICATION_BENCHMARK_DATASET: VerificationBenchmarkItem[] = [
  // 1. Clearly supported base charge
  {
    id: 'ver_case_01_supported_base',
    name: 'Standard Inpatient Room Rent within Policy Limit',
    billItemDescription: 'Single Standard AC Room Bed Charges (2 Days)',
    category: 'ROOM_RENT',
    claimedAmountPaise: 1000000, // ₹10,000 (₹5,000/day)
    billedRoomTariffPaise: 500000, // ₹5,000/day (within limit)
    treatmentDate: '2025-04-10',
    familyId: 'syn_fam_health_01',
    expectedOutcome: 'conditional', // Governed by room daily limit condition
    expectedControllingClauseId: 'syn_ver_base_2025_v1_cl_room_rent',
    expectedPrecedenceRole: 'CONTROLLING',
    expectedReviewRequired: false,
    expectedMissingFactsCount: 0,
    expectedCitationVerified: true,
    notes: 'Standard room rent charge within policy daily limit; verified by base room rent clause.',
    isSynthetic: true
  },

  // 2. Explicitly excluded statutory non-payable item
  {
    id: 'ver_case_02_excluded_statutory',
    name: 'Surgical Gloves and PPE Consumables (IRDAI Annexure 1)',
    billItemDescription: 'Disposable Surgical Gloves and Antiseptic Hand Sanitizer',
    category: 'CONSUMABLES_NON_PAYABLES',
    claimedAmountPaise: 125000,
    treatmentDate: '2025-04-10',
    familyId: 'syn_fam_health_01',
    expectedOutcome: 'excluded',
    expectedControllingClauseId: 'syn_ver_base_2025_v1_irdai_non_payable_consumables_01',
    expectedPrecedenceRole: 'CONTROLLING',
    expectedReviewRequired: false,
    expectedMissingFactsCount: 0,
    expectedCitationVerified: true,
    notes: 'Statutory non-payable consumables under IRDAI Master Guidelines Annexure 1.',
    isSynthetic: true
  },

  // 3. Contractual permanent exclusion without exception
  {
    id: 'ver_case_03_excluded_cosmetic',
    name: 'Elective Cosmetic Rhinoplasty (Aesthetic Surgery)',
    billItemDescription: 'Aesthetic Rhinoplasty and Facial Cosmetic Reshaping',
    category: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 7500000,
    clinicalDiagnosis: 'Elective aesthetic enhancement',
    treatmentDate: '2025-04-10',
    familyId: 'syn_fam_health_01',
    expectedOutcome: 'excluded',
    expectedControllingClauseId: 'syn_ver_base_2025_v1_cl_excl_1',
    expectedPrecedenceRole: 'CONTROLLING',
    expectedReviewRequired: false,
    expectedMissingFactsCount: 0,
    expectedCitationVerified: true,
    notes: 'Elective cosmetic surgery is permanently excluded under policy terms.',
    isSynthetic: true
  },

  // 4. Exclusion with explicit exception RESTORED by facts
  {
    id: 'ver_case_04_exception_restored_dental',
    name: 'Inpatient Dental Surgery Necessitated by Accidental Trauma',
    billItemDescription: 'Emergency Inpatient Dental Fracture Surgery and Maxillofacial Repair',
    category: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 4500000,
    clinicalDiagnosis: 'Road traffic accident trauma with fractured jaw',
    treatmentDate: '2025-04-10',
    familyId: 'syn_fam_health_01',
    expectedOutcome: 'supported',
    expectedPrecedenceRole: 'EXCEPTION_APPLIED',
    expectedReviewRequired: false,
    expectedMissingFactsCount: 0,
    expectedCitationVerified: true,
    notes: 'Dental treatment is covered because accidental injury trauma exception was verified.',
    isSynthetic: true
  },

  // 5. Exclusion with potentially applicable exception but MISSING FACTS
  {
    id: 'ver_case_05_exception_missing_facts',
    name: 'Dental Treatment without Stated Clinical Etiology',
    billItemDescription: 'Root Canal Therapy and Tooth Extraction',
    category: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 2500000,
    clinicalDiagnosis: null, // Unstated
    treatmentDate: '2025-04-10',
    familyId: 'syn_fam_health_01',
    expectedOutcome: 'conditional',
    expectedReviewRequired: true,
    expectedMissingFactsCount: 1,
    expectedCitationVerified: true,
    notes: 'Missing facts trigger review: Cannot determine whether accidental trauma exception applies.',
    isSynthetic: true
  },

  // 6. Conditional coverage: Room tariff exceeds daily cap
  {
    id: 'ver_case_06_conditional_room_tariff',
    name: 'Upgraded Deluxe Room Exceeding Daily Limit',
    billItemDescription: 'Deluxe Suite Room Rent (3 Days)',
    category: 'ROOM_RENT',
    claimedAmountPaise: 2400000, // ₹24,000 total
    billedRoomTariffPaise: 800000, // ₹8,000/day (exceeds ₹5,000 cap)
    treatmentDate: '2025-04-10',
    familyId: 'syn_fam_health_01',
    expectedOutcome: 'conditional',
    expectedControllingClauseId: 'syn_ver_base_2025_v1_cl_room_rent',
    expectedPrecedenceRole: 'CONTROLLING',
    expectedReviewRequired: false,
    expectedMissingFactsCount: 0,
    expectedCitationVerified: true,
    notes: 'Room tariff exceeds policy daily limit; triggers proportionate disallowance condition.',
    isSynthetic: true
  },

  // 7. Applicable amendment superseding base policy clause
  {
    id: 'ver_case_07_amendment_superseding',
    name: 'Post-Amendment Admission: Endorsement Controls Room Cap',
    billItemDescription: 'Private Room Bed Boarding Charges (July 2025 Endorsement)',
    category: 'ROOM_RENT',
    claimedAmountPaise: 1500000,
    billedRoomTariffPaise: 750000, // ₹7,500/day
    treatmentDate: '2025-08-15', // Post July 1st amendment effective date
    familyId: 'syn_fam_health_01',
    expectedOutcome: 'conditional',
    expectedControllingClauseId: 'syn_ver_amend_2025_v1.1_mod_cl_amend_room_01',
    expectedPrecedenceRole: 'CONTROLLING',
    expectedReviewRequired: false,
    expectedMissingFactsCount: 0,
    expectedCitationVerified: true,
    notes: 'Post-amendment treatment date: Endorsement raising room limit to ₹7,500 supersedes base policy.',
    isSynthetic: true
  },

  // 8. Amendment not applicable to treatment date (pre-amendment admission)
  {
    id: 'ver_case_08_amendment_not_active',
    name: 'Pre-Amendment Admission: Base Policy Controls',
    billItemDescription: 'Private Room Bed Boarding Charges (May 2025 Admission)',
    category: 'ROOM_RENT',
    claimedAmountPaise: 1000000,
    billedRoomTariffPaise: 500000, // ₹5,000/day
    treatmentDate: '2025-05-15', // Pre July 1st amendment
    familyId: 'syn_fam_health_01',
    expectedOutcome: 'conditional',
    expectedControllingClauseId: 'syn_ver_base_2025_v1_cl_room_rent',
    expectedPrecedenceRole: 'CONTROLLING',
    expectedReviewRequired: false,
    expectedMissingFactsCount: 0,
    expectedCitationVerified: true,
    notes: 'Pre-amendment admission: Base policy ₹5,000 cap controls; amendment is not yet in effect.',
    isSynthetic: true
  },

  // 9. Specific procedure sublimit overriding general limits
  {
    id: 'ver_case_09_sublimit_controlling',
    name: 'Cataract Phacoemulsification Governed by Disease Sublimit',
    billItemDescription: 'Cataract Surgery with Foldable Intraocular Lens (IOL)',
    category: 'SURGEON_CONSULTATION',
    claimedAmountPaise: 4500000,
    clinicalDiagnosis: 'Senile Cataract Left Eye',
    treatmentDate: '2025-05-15',
    familyId: 'syn_fam_health_01',
    expectedOutcome: 'conditional',
    expectedControllingClauseId: 'syn_ver_base_2025_v1_cl_sublimit_1',
    expectedPrecedenceRole: 'CONTROLLING',
    expectedReviewRequired: false,
    expectedMissingFactsCount: 0,
    expectedCitationVerified: true,
    notes: 'Cataract specific sublimit of ₹40,000 overrides general surgical benefits.',
    isSynthetic: true
  },

  // 10. Insufficient evidence / unrelated billing line
  {
    id: 'ver_case_10_insufficient_evidence',
    name: 'Unrelated Non-Medical Rental Item',
    billItemDescription: 'Space Telemetry and Obscure Equipment Rental XYZ-99',
    category: 'MISCELLANEOUS',
    claimedAmountPaise: 500000,
    treatmentDate: '2025-05-15',
    familyId: 'syn_fam_health_01',
    expectedOutcome: 'insufficient_evidence',
    expectedReviewRequired: true,
    expectedMissingFactsCount: 1,
    expectedCitationVerified: true,
    notes: 'Item has no matching provisions in policy; triggers insufficient evidence and review.',
    isSynthetic: true
  }
];
