/**
 * Procedure & Specialty Normalization Layer (FIN-01 Phase 6)
 * Maps clinical variations and abbreviations to canonical procedures and codes,
 * preserving traceability (source_procedure_name, canonical_procedure_name, procedure_code).
 */

export interface ProcedureNormalizationResult {
  matched: boolean;
  canonical_procedure_id: string;
  source_procedure_name: string;
  canonical_procedure_name: string;
  procedure_code: string;
  canonical_specialty: string;
  nha_package_code?: string;
  confidence: 'high' | 'medium' | 'unmatched';
  clinical_description?: string;
}

interface ProcedureRule {
  canonical_procedure_id: string;
  canonical_procedure_name: string;
  procedure_code: string;
  canonical_specialty: string;
  nha_package_code: string;
  clinical_description: string;
  aliases: string[];
}

export const CANONICAL_PROCEDURES: ProcedureRule[] = [
  {
    canonical_procedure_id: 'ANGIOGRAPHY',
    canonical_procedure_name: 'Angiography',
    procedure_code: 'CAG-DIAG',
    canonical_specialty: 'Cardiology',
    nha_package_code: 'MC001A',
    clinical_description: 'Diagnostic vascular imaging',
    aliases: [
      'angiography',
      'coronary angiography',
      'cag',
      'cardiac angiography',
      'coronary angiogram',
      'angiogram',
      'heart angiogram',
      'diagnostic coronary angiography',
      'diagnostic angiography',
      'ct coronary angiography'
    ]
  },
  {
    canonical_procedure_id: 'ANGIOPLASTY_PTCA_1_DES',
    canonical_procedure_name: 'Angioplasty (PTCA + 1 DES)',
    procedure_code: 'PTCA-1DES',
    canonical_specialty: 'Cardiology',
    nha_package_code: 'MC010A',
    clinical_description: 'Coronary intervention with one drug-eluting stent',
    aliases: [
      'angioplasty',
      'angioplasty (ptca)',
      'angioplasty (ptca + 1 des)',
      'angioplasty ptca',
      'angioplasty ptca 1 des',
      'angioplasty ptca 1des',
      'angioplasty 1 des',
      'ptca',
      'percutaneous transluminal coronary angioplasty',
      'coronary angioplasty',
      'heart stent',
      'coronary stent',
      'stent placement',
      'ptca with stent',
      'ptca + 1 des',
      'ptca 1des'
    ]
  },
  {
    canonical_procedure_id: 'CABG_OFFPUMP',
    canonical_procedure_name: 'Coronary Artery Bypass Grafting (CABG)',
    procedure_code: 'CABG-OFFPUMP',
    canonical_specialty: 'Cardiology',
    nha_package_code: 'MC013A',
    clinical_description: 'Coronary artery bypass graft surgery',
    aliases: [
      'cabg',
      'coronary artery bypass grafting',
      'coronary artery bypass',
      'bypass surgery',
      'heart bypass',
      'coronary bypass',
      'open heart bypass',
      'off-pump cabg'
    ]
  },
  {
    canonical_procedure_id: 'TOTAL_KNEE_REPLACEMENT',
    canonical_procedure_name: 'Total Knee Replacement',
    procedure_code: 'TKR-UNI',
    canonical_specialty: 'Orthopedics',
    nha_package_code: 'SB039A',
    clinical_description: 'Unilateral total knee arthroplasty',
    aliases: [
      'knee replacement',
      'total knee replacement',
      'tkr',
      'total knee arthroplasty',
      'knee arthroplasty',
      'knee surgery',
      'unilateral knee replacement',
      'primary tkr'
    ]
  },
  {
    canonical_procedure_id: 'CATARACT_SURGERY',
    canonical_procedure_name: 'Cataract Surgery',
    procedure_code: 'CAT-PHACO',
    canonical_specialty: 'Ophthalmology',
    nha_package_code: 'SO001A',
    clinical_description: 'Phacoemulsification with intraocular lens',
    aliases: [
      'cataract',
      'cataract surgery',
      'phaco',
      'phacoemulsification',
      'cataract with iol',
      'phaco with foldable iol',
      'eye cataract'
    ]
  },
  {
    canonical_procedure_id: 'LAPAROSCOPIC_CHOLECYSTECTOMY',
    canonical_procedure_name: 'Laparoscopic Cholecystectomy',
    procedure_code: 'LAP-CHOLE',
    canonical_specialty: 'General Surgery',
    nha_package_code: 'S1A11.1',
    clinical_description: 'Minimally invasive gallbladder removal',
    aliases: [
      'cholecystectomy',
      'laparoscopic cholecystectomy',
      'lap chole',
      'gallbladder surgery',
      'gallbladder removal',
      'gall bladder removal',
      'gall stone surgery',
      'gallstone removal'
    ]
  },
  {
    canonical_procedure_id: 'LAPAROSCOPIC_APPENDECTOMY',
    canonical_procedure_name: 'Laparoscopic Appendectomy',
    procedure_code: 'LAP-APPEND',
    canonical_specialty: 'General Surgery',
    nha_package_code: 'SG005A',
    clinical_description: 'Minimally invasive appendix removal',
    aliases: [
      'appendectomy',
      'laparoscopic appendectomy',
      'lap appendectomy',
      'appendix surgery',
      'appendix removal',
      'acute appendicitis surgery'
    ]
  },
  {
    canonical_procedure_id: 'CAESAREAN_SECTION',
    canonical_procedure_name: 'Caesarean Section (C-Section)',
    procedure_code: 'LSCS-DELIV',
    canonical_specialty: 'Obstetrics & Gynecology',
    nha_package_code: 'OG001A',
    clinical_description: 'Lower segment cesarean section delivery',
    aliases: [
      'c-section',
      'c section',
      'caesarean',
      'cesarean',
      'caesarean section',
      'cesarean section',
      'lscs',
      'cesarean delivery',
      'caesarean delivery'
    ]
  },
  {
    canonical_procedure_id: 'INGUINAL_HERNIA_REPAIR',
    canonical_procedure_name: 'Inguinal Hernia Repair',
    procedure_code: 'HERNIA-MESH',
    canonical_specialty: 'General Surgery',
    nha_package_code: 'SG001A',
    clinical_description: 'Hernia repair with prosthetic mesh',
    aliases: [
      'hernia',
      'hernia surgery',
      'hernia repair',
      'inguinal hernia',
      'inguinal hernia repair',
      'mesh hernia repair',
      'laparoscopic hernia'
    ]
  },
  {
    canonical_procedure_id: 'TOTAL_HIP_REPLACEMENT',
    canonical_procedure_name: 'Total Hip Replacement',
    procedure_code: 'THR-UNI',
    canonical_specialty: 'Orthopedics',
    nha_package_code: 'SB040A',
    clinical_description: 'Primary unilateral total hip arthroplasty',
    aliases: [
      'hip replacement',
      'total hip replacement',
      'thr',
      'hip arthroplasty',
      'total hip arthroplasty',
      'primary thr',
      'unilateral hip replacement',
      'unilateral total hip replacement'
    ]
  },
  {
    canonical_procedure_id: 'TURP_BPH',
    canonical_procedure_name: 'Transurethral Resection of the Prostate (TURP)',
    procedure_code: 'TURP-BPH',
    canonical_specialty: 'Urology',
    nha_package_code: 'SU080A',
    clinical_description: 'Endoscopic transurethral resection of prostate for benign prostatic hyperplasia',
    aliases: [
      'turp',
      'transurethral resection of prostate',
      'transurethral resection of the prostate',
      'turp for bph',
      'prostate surgery',
      'prostate resection',
      'bph surgery',
      'transurethral prostatectomy'
    ]
  },
  {
    canonical_procedure_id: 'TYMPANOPLASTY',
    canonical_procedure_name: 'Tympanoplasty',
    procedure_code: 'TYMPANO-TYPE1',
    canonical_specialty: 'ENT',
    nha_package_code: 'SE002A',
    clinical_description: 'Type 1 tympanoplasty for eardrum perforation repair',
    aliases: [
      'tympanoplasty',
      'type 1 tympanoplasty',
      'type-1 tympanoplasty',
      'eardrum surgery',
      'eardrum repair',
      'myringoplasty',
      'ear surgery',
      'tympanic membrane repair'
    ]
  }
];

const SPECIALTY_ALIASES: Record<string, string> = {
  'orthopedics': 'Orthopedics',
  'orthopaedics': 'Orthopedics',
  'ortho': 'Orthopedics',
  'cardiology': 'Cardiology',
  'cardiac': 'Cardiology',
  'cardiothoracic': 'Cardiology',
  'ophthalmology': 'Ophthalmology',
  'eye': 'Ophthalmology',
  'general surgery': 'General Surgery',
  'surgery': 'General Surgery',
  'gynecology': 'Obstetrics & Gynecology',
  'gynaecology': 'Obstetrics & Gynecology',
  'obstetrics & gynecology': 'Obstetrics & Gynecology',
  'obgyn': 'Obstetrics & Gynecology',
  'ob-gyn': 'Obstetrics & Gynecology',
  'urology': 'Urology',
  'uro': 'Urology',
  'ent': 'ENT',
  'ear nose throat': 'ENT',
  'otorhinolaryngology': 'ENT'
};

export function normalizeSpecialtyName(specialty?: string | null): string {
  if (!specialty || !specialty.trim()) return '';
  const clean = specialty.toLowerCase().trim();
  if (SPECIALTY_ALIASES[clean]) return SPECIALTY_ALIASES[clean];
  for (const [alias, canonical] of Object.entries(SPECIALTY_ALIASES)) {
    if (clean.includes(alias) || alias.includes(clean)) return canonical;
  }
  return specialty.trim();
}

export function normalizeProcedure(
  procedure?: string | null,
  specialtyHint?: string | null,
  canonicalProcedureId?: string | null
): ProcedureNormalizationResult {
  const sourceName = (procedure || '').trim();

  // 1. If explicit canonicalProcedureId is provided, resolve directly to authoritative rule
  if (canonicalProcedureId && canonicalProcedureId.trim()) {
    const targetId = canonicalProcedureId.trim().toUpperCase();
    const rule = CANONICAL_PROCEDURES.find(r => r.canonical_procedure_id === targetId);
    if (rule) {
      return {
        matched: true,
        canonical_procedure_id: rule.canonical_procedure_id,
        source_procedure_name: sourceName || rule.canonical_procedure_name,
        canonical_procedure_name: rule.canonical_procedure_name,
        procedure_code: rule.procedure_code,
        canonical_specialty: rule.canonical_specialty,
        nha_package_code: rule.nha_package_code,
        clinical_description: rule.clinical_description,
        confidence: 'high'
      };
    }
  }

  if (!sourceName) {
    return {
      matched: false,
      canonical_procedure_id: 'UNSELECTED',
      source_procedure_name: '',
      canonical_procedure_name: '',
      procedure_code: '',
      canonical_specialty: normalizeSpecialtyName(specialtyHint),
      confidence: 'unmatched'
    };
  }

  const clean = sourceName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const canonicalSpec = normalizeSpecialtyName(specialtyHint);

  // 2. Exact Canonical ID or exact alias match
  for (const rule of CANONICAL_PROCEDURES) {
    if (clean === rule.canonical_procedure_id.toLowerCase().replace(/_/g, ' ')) {
      return {
        matched: true,
        canonical_procedure_id: rule.canonical_procedure_id,
        source_procedure_name: sourceName,
        canonical_procedure_name: rule.canonical_procedure_name,
        procedure_code: rule.procedure_code,
        canonical_specialty: rule.canonical_specialty,
        nha_package_code: rule.nha_package_code,
        clinical_description: rule.clinical_description,
        confidence: 'high'
      };
    }

    for (const alias of rule.aliases) {
      if (clean === alias) {
        return {
          matched: true,
          canonical_procedure_id: rule.canonical_procedure_id,
          source_procedure_name: sourceName,
          canonical_procedure_name: rule.canonical_procedure_name,
          procedure_code: rule.procedure_code,
          canonical_specialty: rule.canonical_specialty,
          nha_package_code: rule.nha_package_code,
          clinical_description: rule.clinical_description,
          confidence: 'high'
        };
      }
    }
  }

  // 3. Token inclusion check (with strict clinical safety boundaries)
  for (const rule of CANONICAL_PROCEDURES) {
    // CRITICAL MEDICAL GUARD: Never cross-match Angiography and Angioplasty
    if (rule.canonical_procedure_id === 'ANGIOPLASTY_PTCA_1_DES' && clean.includes('angiograph')) {
      continue;
    }
    if (rule.canonical_procedure_id === 'ANGIOGRAPHY' && (clean.includes('angioplast') || clean.includes('stent') || clean.includes('ptca'))) {
      continue;
    }

    for (const alias of rule.aliases) {
      if (clean.includes(alias) || alias.includes(clean)) {
        return {
          matched: true,
          canonical_procedure_id: rule.canonical_procedure_id,
          source_procedure_name: sourceName,
          canonical_procedure_name: rule.canonical_procedure_name,
          procedure_code: rule.procedure_code,
          canonical_specialty: rule.canonical_specialty,
          nha_package_code: rule.nha_package_code,
          clinical_description: rule.clinical_description,
          confidence: 'medium'
        };
      }
    }
  }

  return {
    matched: false,
    canonical_procedure_id: 'UNMATCHED',
    source_procedure_name: sourceName,
    canonical_procedure_name: sourceName,
    procedure_code: '',
    canonical_specialty: canonicalSpec,
    confidence: 'unmatched'
  };
}
