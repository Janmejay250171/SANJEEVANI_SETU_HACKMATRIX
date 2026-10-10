import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.resolve(__dirname, '../../tests/fixtures/policies');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

export function generate45PageSyntheticPolicyPdf(): Promise<string> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(outputDir, 'synthetic_comprehensive_health_policy_45_pages.pdf');
    const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: false });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    function addHeaderFooter(pageNum: number, title: string) {
      doc.addPage();
      // Running header
      doc.fontSize(7.5).fillColor('#666666')
        .text('AROGYA BHARAT GENERAL INSURANCE CO. LTD. | UIN: ABGHLIP26099V012627', 40, 18)
        .text(`SECTION: ${title}`, 40, 28, { align: 'right' });
      doc.moveTo(40, 36).lineTo(555, 36).strokeColor('#0b4f6c').lineWidth(0.8).stroke();

      // Top synthetic disclaimer banner
      doc.fontSize(6.5).fillColor('#b71c1c')
        .text('*** SYNTHETIC TEST FIXTURE — NOT A VALID LEGAL CONTRACT — FOR AI EXTRACTION BENCHMARKING ONLY ***', 40, 40, { align: 'center' });

      // Running footer
      doc.moveTo(40, 785).lineTo(555, 785).strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc.fontSize(7.5).fillColor('#666666')
        .text('Arogya Bharat — Comprehensive Swasthya Raksha Platinum Policy Wording', 40, 792)
        .text(`Page ${pageNum} of 45`, 40, 792, { align: 'right' });

      doc.y = 52;
      doc.fillColor('#000000');
    }

    // =========================================================================
    // PAGE 1: TITLE & PREAMBLE
    // =========================================================================
    addHeaderFooter(1, 'TITLE & PREAMBLE');
    doc.fontSize(20).fillColor('#0b4f6c').text('AROGYA BHARAT GENERAL INSURANCE CO. LTD.', { align: 'center' });
    doc.fontSize(9).fillColor('#555555').text('IRDAI Registration No. 991 | Corporate Identity Number: U66030MH2024PLC999821', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(15).fillColor('#1b5e20').text('COMPREHENSIVE SWASTHYA RAKSHA PLATINUM PLAN', { align: 'center', underline: true });
    doc.fontSize(11).fillColor('#333333').text('POLICY CONTRACT WORDING & CLAUSE SCHEDULE (45 PAGES MASTER FIXTURE)', { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('CONTRACTUAL PREAMBLE', { underline: true });
    doc.moveDown(0.4);
    doc.text(
      'WHEREAS the Policyholder designated in the Policy Schedule hereto has applied to AROGYA BHARAT GENERAL INSURANCE COMPANY LIMITED (hereinafter called the "Company") by a written proposal declaration dated as specified in the Schedule, and has paid the premium stated in the Schedule as consideration for this insurance coverage.'
    );
    doc.moveDown(0.6);
    doc.text(
      'NOW THIS POLICY WITNESSETH that subject to the terms, conditions, definitions, exclusions, waiting periods, procedure sub-limits, warranties, endorsements, and riders contained herein or endorsed hereon, the Company agrees that if during the Policy Period stated in the Schedule the Insured Person shall contract any illness or suffer bodily injury through accident necessitating Inpatient Hospitalization or Day Care Treatment at a recognized Hospital or Day Care Centre in India, the Company will indemnify the reasonable, customary and medically necessary expenses incurred, strictly subject to the limits and deductions specified herein.'
    );
    doc.moveDown(1.2);
    doc.fontSize(9.5).fillColor('#0b4f6c').text('MASTER TABLE OF CONTENTS (45 PAGES):', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(8.5).fillColor('#333333');
    doc.text('1. Policy Certificate & Schedule of Benefits ........................................................... Page 2');
    doc.text('2. Section 1: Standard Contractual Definitions & Interpretations .............................. Pages 3–6');
    doc.text('3. Section 2: Inpatient Care, Room Rent & ICU Entitlements ..................................... Pages 7–10');
    doc.text('4. Section 3: Approved Day Care Procedures Schedule (540+ Procedures) .............. Pages 11–14');
    doc.text('5. Section 4: Modern Treatments & Advanced Robotic Procedures .......................... Pages 15–18');
    doc.text('6. Section 5: Specific Disease & Surgical Sub-Limits Schedule ................................. Pages 19–22');
    doc.text('7. Section 6: Waiting Periods, PED Moratorium & Maternity Rules ........................... Pages 23–26');
    doc.text('8. Section 7: Permanent Statutory & Contractual Exclusions .................................... Pages 27–31');
    doc.text('9. Section 8: Consumables & Non-Payable Items Schedule (IRDAI Annexure I) .......... Pages 32–34');
    doc.text('10. Section 9: Additional Value Benefits, Restoration & Ambulance ........................ Pages 35–37');
    doc.text('11. Section 10: Network Hospital Guidelines & Non-Network Co-Payments ............... Pages 38–40');
    doc.text('12. Section 11: Claim Submission Workflow, Audits & Grievance Redressal ............ Pages 41–42');
    doc.text('13. Section 12: Endorsements, Amendments & Special Conditions Rider ................. Pages 43–44');
    doc.text('14. Section 13: Summary Reconciliation Matrix & Clause Cross-References ............. Page 45');

    // =========================================================================
    // PAGE 2: POLICY SCHEDULE
    // =========================================================================
    addHeaderFooter(2, 'POLICY SCHEDULE');
    doc.fontSize(13).fillColor('#0b4f6c').text('SCHEDULE OF INSURANCE — POLICY CERTIFICATE', { underline: true });
    doc.moveDown(0.6);
    doc.fontSize(9.5).fillColor('#000000');
    doc.text('Clause S.1 — Policy Identification & Registration Details:');
    doc.text('• Policy Certificate Number: AB-SWAS-2026-994821');
    doc.text('• Product Name: Comprehensive Swasthya Raksha Platinum Plan');
    doc.text('• Policy Lineage Type: Floater (Family Floater Covering Primary Insured + Spouse + 1 Child)');
    doc.text('• Unique Identification Number (UIN): ABGHLIP26099V012627');
    doc.text('• Contractual Policy Period: From 00:00 hrs of 2026-04-01 to midnight of 2027-03-31');
    doc.text('• Policy Inception Date: 2026-04-01 | Policy Expiry Date: 2027-03-31');
    doc.moveDown(0.6);
    doc.text('Clause S.2 — Insured Persons Schedule:');
    doc.text('1. Aditya Verma | Age: 42 Years | Gender: Male | Relation: Self (Primary Insured)');
    doc.text('2. Pooja Verma | Age: 39 Years | Gender: Female | Relation: Spouse');
    doc.text('3. Arjun Verma | Age: 12 Years | Gender: Male | Relation: Dependent Child');
    doc.moveDown(0.6);
    doc.text('Clause S.3 — Core Financial Limits & Endowments:');
    doc.text('• Basic Sum Insured (SI): Rs. 10,00,000 (Rupees Ten Lakhs Only)');
    doc.text('• Accrued Cumulative Bonus (10%): Rs. 1,00,000 (Rupees One Lakh Only)');
    doc.text('• Total Aggregate Effective Coverage: Rs. 11,00,000');
    doc.text('• Compulsory Aggregate Policy Deductible: Rs. 25,000 (Rupees Twenty-Five Thousand Only)');
    doc.text('• Geographic Entitlement Zone: Tier 1 (Mumbai MMR / Bengaluru / Delhi NCR)');
    doc.text('• Third Party Administrator (TPA): Direct In-house Health Administration Cell');
    doc.moveDown(0.6);
    doc.text('Clause S.4 — Operational Conditions:');
    doc.text('• Cashless Access: Available across all empanelled network hospitals nationwide.');
    doc.text('• Grace Period for Renewal: 30 days from expiry date.');
    doc.text('• Free Look Period: 15 days from date of receipt of physical/electronic policy document.');

    // Helper for generating standard text across pages
    function addTextSection(page: number, header: string, content: { title?: string; paragraphs: string[] }[]) {
      addHeaderFooter(page, header);
      for (const block of content) {
        if (block.title) {
          doc.fontSize(11).fillColor('#0b4f6c').text(block.title, { underline: true });
          doc.moveDown(0.3);
        }
        doc.fontSize(8.5).fillColor('#000000');
        for (const p of block.paragraphs) {
          doc.text(p);
          doc.moveDown(0.4);
        }
        doc.moveDown(0.2);
      }
    }

    // =========================================================================
    // PAGES 3-6: SECTION 1 — DEFINITIONS
    // =========================================================================
    addTextSection(3, 'SECTION 1 — DEFINITIONS', [
      {
        title: 'Section 1.1 — Core Institutional Definitions',
        paragraphs: [
          'Clause D.1 — Accident: An accident means sudden, unforeseen and involuntary event caused by external, violent and visible means.',
          'Clause D.2 — Act of God: Natural cataclysms including earthquakes, floods, and cyclones.',
          'Clause D.3 — Admission: The formal acceptance by a Hospital or Day Care Centre of an Insured Person on an inpatient or day care basis for the purpose of Medically Necessary Treatment.',
          'Clause D.4 — Alternative Treatments / AYUSH: Refers to medical and/or hospitalization treatments given under Ayurveda, Yoga and Naturopathy, Unani, Siddha and Homeopathy systems in recognized government or accredited institutions.'
        ]
      },
      {
        title: 'Section 1.2 — Clinical Treatment Criteria',
        paragraphs: [
          'Clause D.5 — Any one Illness: Means continuous period of illness and includes relapse within 45 days from the date of last consultation with the Hospital/Nursing Home where treatment was taken.',
          'Clause D.6 — Cashless Facility: Means a facility extended by the Insurer to the Insured where the payments, of the costs of treatment undergone by the insured person in accordance with the policy terms and conditions, are directly made to the network provider by the insurer to the extent pre-authorization is approved.'
        ]
      }
    ]);

    addTextSection(4, 'SECTION 1 — DEFINITIONS (CONTD.)', [
      {
        title: 'Section 1.3 — Hospital & Day Care Facilities',
        paragraphs: [
          'Clause D.7 — Hospital: A hospital means any institution established for inpatient care and day care treatment of illness and/or injuries and which has been registered as a hospital with the local authorities under the Clinical Establishments (Registration and Regulation) Act, 2010 or with authorities under the enactments specified under the Schedule of Section 56(1) of the said Act OR complies with all minimum criteria: has qualified nursing staff under its employment round the clock; has at least 10 in-patient beds in towns having a population of less than 10,00,000 and at least 15 in-patient beds in all other places; has qualified medical practitioner(s) in charge round the clock; has a fully equipped operation theatre of its own where surgical operations are carried out; maintains daily medical records and makes these accessible to the insurance company\'s authorized personnel.',
          'Clause D.8 — Day Care Centre: A day care centre means any institution established for day care treatment of illness and/or injuries or a medical setup with a hospital and which has been registered with the local authorities, wherever applicable, and is under the supervision of a registered and qualified medical practitioner.'
        ]
      }
    ]);

    addTextSection(5, 'SECTION 1 — DEFINITIONS (CONTD.)', [
      {
        title: 'Section 1.4 — Financial and Economic Definitions',
        paragraphs: [
          'Clause D.9 — Deductible: A deductible is a cost-sharing requirement under a health insurance policy that provides that the insurer will not be liable for a specified rupee amount in case of indemnity policies and for a specified number of days/hours in case of hospital cash policies which will apply before any benefits are payable by the insurer. A deductible does not reduce the Sum Insured.',
          'Clause D.10 — Co-Payment: A co-payment means a cost sharing requirement under a health insurance policy that provides that the policyholder/insured will bear a specified percentage of the admissible claims amount. A co-payment does not reduce the Sum Insured.',
          'Clause D.11 — Medically Necessary Treatment: Any treatment, tests, medication, or stay in hospital or part of a stay in hospital which is required for the medical management of the illness or injury suffered by the insured; must not exceed the level of care necessary to provide safe, adequate and appropriate medical care in scope, duration, or intensity; must have been recommended by a medical practitioner; must conform to the professional standards widely accepted in international medical practice or by the medical community in India.'
        ]
      }
    ]);

    addTextSection(6, 'SECTION 1 — DEFINITIONS (CONTD.)', [
      {
        title: 'Section 1.5 — Room Rent & Associated Medical Charges',
        paragraphs: [
          'Clause D.12 — Room Rent: Room Rent means the amount charged by a Hospital towards room and boarding expenses and shall include the associated nursing charges, electricity charges, and standard hospital room amenities.',
          'Clause D.13 — Intensive Care Unit (ICU): Intensive Care Unit means an identified section, ward or wing of a hospital which is specially equipped for the continuous monitoring and treatment of patients who are in a critical condition, or require advanced life support facilities and where the level of care and supervision is considerably more sophisticated and intensive than in the general and other wards.',
          'Clause D.14 — Associated Medical Expenses: Means those expenses directly correlated with room category occupancy, including doctor consultation, specialist visits, anesthetist fees, operation theater charges, and nursing administration. Expenses with statutory or fixed pricing (medicines, implants, diagnostic radiology) are excluded from this definition.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 7-10: SECTION 2 — INPATIENT CARE & ROOM RENT
    // =========================================================================
    addTextSection(7, 'SECTION 2 — INPATIENT CARE & ROOM RENT', [
      {
        title: 'Section 2.1 — Room Rent Daily Capping Entitlement',
        paragraphs: [
          'Clause 2.1 — Room Rent Entitlement Grid: Coverage for Room, Boarding, and Nursing Expenses provided by the Hospital is capped at a maximum of 1% of the Basic Sum Insured per day of hospitalization.',
          'Financial Quantification: For the basic Sum Insured of Rs. 10,00,000 stated in Schedule S.3, the maximum eligible room rent allowance is Rs. 10,000 per day (Rupees Ten Thousand per day).',
          'Entitled Room Category: The Insured Person is entitled to occupy a Single Standard AC Room. If the Insured occupies a Deluxe Room, Super Deluxe Room, Suite Room, or higher category whose per-day tariff exceeds Rs. 10,000 per day, the excess daily room rent is strictly non-payable and shall be borne by the Insured Person.',
          'Calculation Formula: Daily Room Excess = Billed Daily Room Rate - Rs. 10,000. Total Room Excess Deduction = Daily Room Excess * Number of Hospitalization Stay Days.'
        ]
      }
    ]);

    addTextSection(8, 'SECTION 2 — INPATIENT CARE & ROOM RENT (CONTD.)', [
      {
        title: 'Section 2.2 — Intensive Care Unit (ICU / ICCU) Entitlement',
        paragraphs: [
          'Clause 2.2 — ICU / ICCU Daily Capping Entitlement: Coverage for Intensive Care Unit (ICU) and Intensive Cardiac Care Unit (ICCU) charges is capped at a maximum of 2% of the Basic Sum Insured per day.',
          'Financial Quantification: For the basic Sum Insured of Rs. 10,00,000, the maximum eligible ICU allowance is Rs. 20,000 per day (Rupees Twenty Thousand per day).',
          'Non-Application of Proportionate Deduction to ICU: While charges exceeding Rs. 20,000 per day are disallowed as excess ICU room charges, the occupation of an ICU room above the limit shall NOT trigger proportionate deductions on surgeon, medical practitioner, or operation theater expenses.'
        ]
      }
    ]);

    addTextSection(9, 'SECTION 2 — INPATIENT CARE & ROOM RENT (CONTD.)', [
      {
        title: 'Section 2.3 — Proportionate Deductions on Associated Medical Expenses',
        paragraphs: [
          'Clause 2.3 — Proportionate Deductions Clause: In the event of the Insured Person electing to occupy a room category where the room rent exceeds the contractual entitlement of 1% of Sum Insured (Rs. 10,000 per day), all Associated Medical Expenses shall be proportionately reduced.',
          'Applicable Formula: Admissible Associated Expense = Billed Expense * (Entitled Room Rate per Day / Actual Occupied Room Rate per Day).',
          'Categories Scaled: The proportionate scaling shall apply exclusively to: (i) Doctor Consultation Fees; (ii) Surgeon & Assistant Surgeon Fees; (iii) Anesthetist Charges; (iv) Operation Theater & Anesthesia Equipment Charges; (v) Nursing Administration Charges; (vi) Package Daycare charges where room rent is bundled.',
          'Categories Exempt from Proportionate Scaling: In accordance with IRDAI Master Circular directives, proportionate deduction shall NEVER apply to: (a) Pharmacy, Formulations and Medicines; (b) Surgical Implants and Prosthetics; (c) Pathology, Radiology and Diagnostic Tests; (d) Emergency Ambulance Charges.'
        ]
      }
    ]);

    addTextSection(10, 'SECTION 2 — INPATIENT CARE & ROOM RENT (CONTD.)', [
      {
        title: 'Section 2.4 & 2.5 — AYUSH and Nursing Care Benefits',
        paragraphs: [
          'Clause 2.4 — AYUSH Inpatient Treatment Coverage: Medical expenses incurred for inpatient treatment taken under Ayurveda, Yoga, Naturopathy, Unani, Siddha, or Homeopathy systems of medicine are covered up to a maximum limit of Rs. 1,00,000 per policy year, provided treatment is undergone in a recognized Government AYUSH Hospital or NABH-accredited AYUSH facility.',
          'Clause 2.5 — Nursing & Attendant Allowances: Qualified nursing care charges administered by registered nurses in the hospital ward are covered within the Room Rent boarding schedule.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 11-14: SECTION 3 — DAY CARE PROCEDURES SCHEDULE
    // =========================================================================
    addTextSection(11, 'SECTION 3 — DAY CARE PROCEDURES', [
      {
        title: 'Section 3.1 — Day Care Inpatient Exemption & Schedule Overview',
        paragraphs: [
          'Clause 3.1 — Day Care Procedure Coverage: The policy covers 540+ medical treatments and surgical operations undertaken under general, local, or spinal anesthesia in a Hospital or Day Care Centre in less than 24 hours of hospitalization, which due to technological advancement do not require conventional overnight admission.',
          'Ophthalmology Day Care Procedures: Cataract surgery with IOL, Trabeculectomy, Vitrectomy, Photocoagulation, Pterygium excision with conjunctival autograft, Corneal foreign body removal.',
          'ENT Day Care Procedures: Tympanoplasty, Stapedectomy, Myringotomy with grommet insertion, Functional Endoscopic Sinus Surgery (FESS), Septoplasty, Tonsillectomy with adenoidectomy.'
        ]
      }
    ]);

    addTextSection(12, 'SECTION 3 — DAY CARE PROCEDURES (CONTD.)', [
      {
        title: 'Section 3.2 — Oncology, Urology & General Surgery Day Care Schedule',
        paragraphs: [
          'Oncology Day Care Procedures: Intravenous Chemotherapy cycles, Radiotherapy sessions, Brachytherapy, Bone marrow biopsy, Liver biopsy under ultrasound guidance.',
          'Urology Day Care Procedures: Extracorporeal Shock Wave Lithotripsy (ESWL), Ureteroscopy (URS), Cystoscopy with DJ stent placement/removal, Transurethral Resection of Bladder Tumor (TURBT).',
          'General Surgery Day Care Procedures: Haemorrhoidectomy, Fissurectomy, Fistulotomy, Hydrocelectomy, Inguinal hernia repair, Excision of lipoma/sebaceous cyst.'
        ]
      }
    ]);

    addTextSection(13, 'SECTION 3 — DAY CARE PROCEDURES (CONTD.)', [
      {
        title: 'Section 3.3 — Gynecology, Orthopedics & Cardiology Day Care',
        paragraphs: [
          'Gynecology Day Care Procedures: Diagnostic Hysteroscopy, Dilatation & Curettage (D&C), Bartholin cyst marsupialization, Polypectomy, Laparoscopic sterilization.',
          'Orthopedics Day Care Procedures: Arthroscopic meniscectomy, Closed reduction of fractures with POP casting, Carpal tunnel release, Trigger finger release, K-wire fixation.',
          'Cardiology Day Care Procedures: Diagnostic Coronary Angiography, Electrophysiological studies, Temporary pacemaker implantation.'
        ]
      }
    ]);

    addTextSection(14, 'SECTION 3 — DAY CARE PROCEDURES (CONTD.)', [
      {
        title: 'Section 3.4 — OPD Treatment Exclusion Caveat',
        paragraphs: [
          'Clause 3.2 — OPD Exclusion Caveat: Treatments and procedures performed in the Outpatient Department (OPD) of a hospital, clinic, or consulting chamber without formal registration as a day care patient are strictly excluded from coverage.',
          'Dental Treatments: Any dental surgery or procedure taken on an outpatient basis is excluded, unless necessitated by accidental bodily injury requiring inpatient hospitalization.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 15-18: SECTION 4 — MODERN TREATMENTS & ADVANCED TECHNOLOGY
    // =========================================================================
    addTextSection(15, 'SECTION 4 — MODERN TREATMENTS', [
      {
        title: 'Section 4.1 — IRDAI Modern Treatments Schedule',
        paragraphs: [
          'Clause 4.1 — Coverage of Modern Treatments: The policy indemnifies expenses incurred towards the following 12 advanced medical treatments, whether taken as an Inpatient or as part of Day Care Treatment in a Hospital:',
          '1. Uterine Artery Embolization and HIFU (High Intensity Focused Ultrasound)',
          '2. Balloon Sinuplasty',
          '3. Deep Brain Stimulation (DBS)',
          '4. Oral Chemotherapy formulations',
          '5. Immunotherapy — Monoclonal Antibody injections given as a targeted cancer therapy'
        ]
      }
    ]);

    addTextSection(16, 'SECTION 4 — MODERN TREATMENTS (CONTD.)', [
      {
        title: 'Section 4.2 — Robotic Surgeries & Stereotactic Radiosurgery',
        paragraphs: [
          '6. Stereotactic Radio Surgeries (SRS / SBRT / Cyberknife / Gamma Knife)',
          '7. Bronchial Thermoplasty',
          '8. Vaporization of the Prostrate (Green laser treatment or Holmium laser enucleation)',
          '9. IONM — (Intra Operative Neuro Monitoring)',
          '10. Stem cell therapy: Hematopoietic stem cells for bone marrow transplant for haematological conditions',
          'Clause 4.2 — Robotic Surgeries Sublimit: Robotic-assisted surgeries and computer-guided operative interventions are covered up to a maximum limit of 50% of the Basic Sum Insured (Rs. 5,00,000 for this policy).'
        ]
      }
    ]);

    addTextSection(17, 'SECTION 4 — MODERN TREATMENTS (CONTD.)', [
      {
        title: 'Section 4.3 — Modern Treatment Settlement Conditions',
        paragraphs: [
          'Clause 4.3 — Pre-Authorization for Advanced Technologies: Any procedure involving Robotic Surgery, Immunotherapy, or Balloon Sinuplasty requires prior approval from the Company’s Medical Advisory Board.',
          'Unproven Technology Exclusion: Procedures utilizing investigational techniques not approved by the National Medical Commission (NMC) or Central Drugs Standard Control Organisation (CDSCO) shall be disallowed under Clause 7.12.'
        ]
      }
    ]);

    addTextSection(18, 'SECTION 4 — MODERN TREATMENTS (CONTD.)', [
      {
        title: 'Section 4.4 — Modern Treatment Billing Standards',
        paragraphs: [
          'Clause 4.4 — Billing Standards for Robotic Equipment: Consumable drapes, instruments, and software licenses billed separately under robotic packages shall be grouped under Operation Theater charges and evaluated subject to the overall modern treatment sub-limits.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 19-22: SECTION 5 — SPECIFIC DISEASE & PROCEDURE SUBLIMITS
    // =========================================================================
    addTextSection(19, 'SECTION 5 — SPECIFIC PROCEDURE SUBLIMITS', [
      {
        title: 'Section 5.1 — Cataract Surgery Procedure Sublimit',
        paragraphs: [
          'Clause 5.1 — Cataract Surgery Sublimit: The Company\'s maximum liability for medical expenses incurred for Cataract Surgery (including Phacoemulsification, monofocal/multifocal Intraocular Lens (IOL), operative and post-operative medications) shall be capped at Rs. 45,000 per eye (Rupees Forty-Five Thousand Only).',
          'Bilateral Cataract: If surgery for both eyes is performed during the policy period, the maximum total claim liability shall not exceed Rs. 90,000 (Rs. 45,000 per eye).',
          'Excess Billed Amount: Any expenditure claimed in excess of Rs. 45,000 per eye shall be disallowed as procedure sublimit breach and shall be borne by the Insured Person.'
        ]
      }
    ]);

    addTextSection(20, 'SECTION 5 — SPECIFIC PROCEDURE SUBLIMITS (CONTD.)', [
      {
        title: 'Section 5.2 & 5.3 — Joint Replacement & Hernia Sublimits',
        paragraphs: [
          'Clause 5.2 — Total Knee Replacement (TKR) Sublimit: The Company\'s liability for Total Knee Replacement or Partial Knee Arthroplasty (including implant cost, surgeon fees, bone cement, OT charges and inpatient physiotherapy) shall be capped at Rs. 1,80,000 per knee (Rupees One Lakh Eighty Thousand Only).',
          'Clause 5.3 — Hernia Repair Procedures Sublimit: Medical expenses incurred for Inguinal, Umbilical, Incisional or Ventral Hernioplasty / Herniorrhaphy shall be capped at a maximum of Rs. 85,000 (Rupees Eighty-Five Thousand Only) per procedure.'
        ]
      }
    ]);

    addTextSection(21, 'SECTION 5 — SPECIFIC PROCEDURE SUBLIMITS (CONTD.)', [
      {
        title: 'Section 5.4, 5.5 & 5.6 — Gall Bladder, Kidney Stone & Appendectomy',
        paragraphs: [
          'Clause 5.4 — Cholecystectomy (Gall Bladder Removal) Sublimit: Total expenses payable for Laparoscopic or Open Cholecystectomy for gall bladder stones or cholecystitis shall be capped at Rs. 95,000 (Rupees Ninety-Five Thousand Only).',
          'Clause 5.5 — Kidney Stone Lithotripsy (ESWL / PCNL / URSL) Sublimit: Total indemnity for endoscopic, percutaneous or extracorporeal shock wave treatment for renal, ureteric or bladder calculi shall be capped at Rs. 60,000 (Rupees Sixty Thousand Only).',
          'Clause 5.6 — Laparoscopic Appendectomy Sublimit: Total expenses payable for Laparoscopic Appendectomy for acute appendicitis shall be capped at Rs. 50,000 (Rupees Fifty Thousand Only).'
        ]
      }
    ]);

    addTextSection(22, 'SECTION 5 — SPECIFIC PROCEDURE SUBLIMITS (CONTD.)', [
      {
        title: 'Section 5.7 — Cumulative Interaction with Sum Insured & Deductibles',
        paragraphs: [
          'Clause 5.7 — Interaction of Sublimits with Aggregate Deductible: Where an Insured Person undergoes a procedure governed by Section 5, the sublimit cap shall be applied FIRST to determine the maximum admissible procedure expense. The aggregate policy deductible (Rs. 25,000) shall then be applied to the admissible sum.',
          'Invariant: In no event shall the total amount indemnified across all sub-limited procedures exceed the available Basic Sum Insured.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 23-26: SECTION 6 — WAITING PERIODS & MORATORIUM
    // =========================================================================
    addTextSection(23, 'SECTION 6 — WAITING PERIODS', [
      {
        title: 'Section 6.1 — Initial 30-Day Waiting Period (Code-Wait01)',
        paragraphs: [
          'Clause 6.1 — Initial Waiting Period (30 Days): Expenses related to the treatment of any illness within 30 days from the first policy commencement date shall be excluded except claims arising from an Accidental Bodily Injury.',
          'Continuous Renewals: This exclusion shall not apply if the Insured Person has continuous coverage for more than 12 months without a break.'
        ]
      }
    ]);

    addTextSection(24, 'SECTION 6 — WAITING PERIODS (CONTD.)', [
      {
        title: 'Section 6.2 — Specified Disease / Procedure 24-Month Waiting Period (Code-Wait02)',
        paragraphs: [
          'Clause 6.2 — Specific 24 Months Waiting Period: Expenses related to the treatment of the following conditions and their complications shall be excluded until the expiry of 24 months of continuous coverage:',
          '1. Benign ENT disorders including sinusitis, tonsillitis, DNS, adenoidectomy;',
          '2. Cataract, Glaucoma, and diseases of the anterior chamber;',
          '3. Hernia of all types, hydrocele, fistula-in-ano, piles, fissures;',
          '4. Benign prostatic hypertrophy (BPH);',
          '5. Gall bladder stones and kidney calculi;',
          '6. Osteoarthritis and osteoporosis unless arising from accidental injury.'
        ]
      }
    ]);

    addTextSection(25, 'SECTION 6 — WAITING PERIODS (CONTD.)', [
      {
        title: 'Section 6.3 — Pre-Existing Diseases 36-Month Waiting Period (Code-Wait03)',
        paragraphs: [
          'Clause 6.3 — Pre-Existing Disease (PED) Waiting Period: Expenses related to the treatment of a Pre-Existing Disease (PED) and its direct complications shall be excluded until the expiry of 36 months of continuous coverage after the date of inception of the first policy with the Company.',
          'PED Definition: Any condition, ailment, injury or disease that is/was diagnosed by a physician within 36 months prior to the effective date of the policy.'
        ]
      }
    ]);

    addTextSection(26, 'SECTION 6 — WAITING PERIODS (CONTD.)', [
      {
        title: 'Section 6.4 — Maternity Waiting Period & Moratorium Clause',
        paragraphs: [
          'Clause 6.4 — Maternity Waiting Period: Medical expenses incurred towards normal delivery or caesarean section shall be excluded until the completion of 24 months of continuous policy coverage.',
          'Clause 6.5 — IRDAI Moratorium Period: After completion of eight continuous policy years under the policy, no look back to be applied and no claim shall be contestable except for proven deliberate fraud.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 27-31: SECTION 7 — PERMANENT EXCLUSIONS
    // =========================================================================
    addTextSection(27, 'SECTION 7 — PERMANENT EXCLUSIONS', [
      {
        title: 'Section 7.1 — Standard Regulatory Exclusions (Code-Excl01 to Excl03)',
        paragraphs: [
          'Clause 7.1 — Pre-Existing Diseases (Code-Excl01): Non-payable until completion of 36 months waiting period under Clause 6.3.',
          'Clause 7.2 — Specified Disease Waiting Period (Code-Excl02): Non-payable until completion of 24 months waiting period under Clause 6.2.',
          'Clause 7.3 — 30-day Waiting Period (Code-Excl03): Non-payable within first 30 days under Clause 6.1.'
        ]
      }
    ]);

    addTextSection(28, 'SECTION 7 — PERMANENT EXCLUSIONS (CONTD.)', [
      {
        title: 'Section 7.2 — Exclusions Code-Excl04 to Excl06',
        paragraphs: [
          'Clause 7.4 — Investigation & Evaluation (Code-Excl04): Expenses related to any admission primarily for diagnostic and evaluation purposes only are excluded. Any diagnostic expenses which are not related or not incidental to the current diagnosis and treatment are excluded.',
          'Clause 7.5 — Rest Cure, Rehabilitation and Respite Care (Code-Excl05): Expenses related to any admission primarily for enforced bed rest and not for receiving active medical treatment.',
          'Clause 7.6 — Obesity / Weight Control (Code-Excl06): Expenses related to the surgical treatment of obesity unless clinical BMI criteria guidelines are strictly met.'
        ]
      }
    ]);

    addTextSection(29, 'SECTION 7 — PERMANENT EXCLUSIONS (CONTD.)', [
      {
        title: 'Section 7.3 — Exclusions Code-Excl07 to Excl09',
        paragraphs: [
          'Clause 7.7 — Cosmetic or Plastic Surgery (Code-Excl07): Expenses for cosmetic or plastic surgery or any treatment to change appearance are strictly excluded, unless reconstructive surgery is medically required as part of treatment arising from burns, cancer, or trauma.',
          'Clause 7.8 — Hazardous or Adventure Sports (Code-Excl08): Expenses related to any treatment necessitated due to participation as a professional in hazardous or adventure sports (scuba diving, mountaineering, motor racing).',
          'Clause 7.9 — Breach of Law (Code-Excl09): Expenses for treatment arising from participation in a criminal or illegal act with criminal intent.'
        ]
      }
    ]);

    addTextSection(30, 'SECTION 7 — PERMANENT EXCLUSIONS (CONTD.)', [
      {
        title: 'Section 7.4 — Exclusions Code-Excl10 to Excl12',
        paragraphs: [
          'Clause 7.10 — Excluded Providers (Code-Excl10): Expenses incurred towards any treatment taken at any hospital or from any medical practitioner who has been blacklisted or de-empanelled by the Company or the General Insurance Council.',
          'Clause 7.11 — Alcohol & Drug Abuse (Code-Excl11): Treatment for alcohol, drug or substance abuse or any addictive condition and consequences thereof.',
          'Clause 7.12 — Unproven Treatments (Code-Excl12): Expenses related to any unproven treatment, services and supplies for which clinical trials lack peer-reviewed validation.'
        ]
      }
    ]);

    addTextSection(31, 'SECTION 7 — PERMANENT EXCLUSIONS (CONTD.)', [
      {
        title: 'Section 7.5 — Exclusions Code-Excl13 to Excl15',
        paragraphs: [
          'Clause 7.13 — Maternity & Childbirth (Code-Excl13): Hospitalization expenses for pregnancy and childbirth unless 24 months waiting period completed.',
          'Clause 7.14 — Sterility and Infertility (Code-Excl14): Assisted Reproduction Services (IVF, IUI, ICSI) and treatments for reversing sterilization.',
          'Clause 7.15 — Refractive Error (Code-Excl15): Expenses related to the treatment for correction of eye sight due to refractive error less than 7.5 dioptres.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 32-34: SECTION 8 — CONSUMABLES & NON-PAYABLE ITEMS
    // =========================================================================
    addTextSection(32, 'SECTION 8 — CONSUMABLES & NON-PAYABLES', [
      {
        title: 'Section 8.1 — Statutory Non-Payable Items (IRDAI Annexure I)',
        paragraphs: [
          'Clause 8.1 — Non-Payable Consumables Schedule: In accordance with IRDAI Master Guidelines on Standardization of Exclusions in Health Insurance Contracts, all expenses incurred towards items listed in Annexure I are strictly non-payable under the policy.',
          'Itemized Disallowed Personal Hygiene Items: Baby food, baby bottles, buds, cotton, sanitary napkins, dental paste and brush, mouthwash, soap, shampoo, talcum powder, hand sanitizer bottles, tissue paper, wet wipes, thermometer.',
          'Itemized Disallowed Administrative Items: Admission kit, admission/discharge summary processing charges, documentation and administrative file charges, registration charges, visitor pass charges, laundry and linen changes.'
        ]
      }
    ]);

    addTextSection(33, 'SECTION 8 — CONSUMABLES & NON-PAYABLES (CONTD.)', [
      {
        title: 'Section 8.2 — Surgical Consumables & PPE Disallowances',
        paragraphs: [
          'Clause 8.2 — Surgical Consumables Disallowed: Disposable examination gloves, sterile gloves, PPE kits, shoe covers, surgical caps, masks, eye drapes, surgeon gown packs, autoclave bags, scalpel blades, needle destroyers, and spillage kits.',
          'Adjudication Rule: When billed in an itemized invoice, these items shall be 100% disallowed at the line-item level under clause reference IRDAI_ANNEXURE_1.'
        ]
      }
    ]);

    addTextSection(34, 'SECTION 8 — CONSUMABLES & NON-PAYABLES (CONTD.)', [
      {
        title: 'Section 8.3 — Patient Care Items & Sundries',
        paragraphs: [
          'Clause 8.3 — Patient Room Sundries: Electric heat pads, ice bags, spirometer, oxygen face mask, nebulizer kit, pulse oximeter probe, diapers, under-pads, crepe bandage, micropore tape, tourniquet.',
          'Disallowance Trace: All such charges shall be recorded as statutory exclusions with transparent patient responsibility.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 35-37: SECTION 9 — ADDITIONAL BENEFITS & VALUE ADDS
    // =========================================================================
    addTextSection(35, 'SECTION 9 — ADDITIONAL VALUE BENEFITS', [
      {
        title: 'Section 9.1 & 9.2 — Ambulance & Cumulative Bonus',
        paragraphs: [
          'Clause 9.1 — Emergency Ambulance Allowance: Up to Rs. 3,000 per hospitalization for road ambulance services to transport the Insured Person to the nearest hospital in an emergency. Air Ambulance expenses covered up to Rs. 2,50,000 per hospitalization within India.',
          'Clause 9.2 — Cumulative Bonus Entitlement: 10% increase in Basic Sum Insured for each claim-free year, up to a maximum of 50% of the Basic Sum Insured. Bonus accrued for this policy: Rs. 1,00,000 (10%).'
        ]
      }
    ]);

    addTextSection(36, 'SECTION 9 — ADDITIONAL VALUE BENEFITS (CONTD.)', [
      {
        title: 'Section 9.3 & 9.4 — Restoration & Pre/Post Hospitalization',
        paragraphs: [
          'Clause 9.3 — Automatic Restoration Benefit: The policy provides 100% restoration of the Basic Sum Insured once in a policy year upon complete exhaustion of Sum Insured and Cumulative Bonus, available for subsequent admissions for unrelated illnesses.',
          'Clause 9.4 — Pre- and Post-Hospitalization Expenses: Medical expenses incurred 60 days immediately prior to hospital admission and 90 days immediately following hospital discharge are covered, provided related to the same condition.'
        ]
      }
    ]);

    addTextSection(37, 'SECTION 9 — ADDITIONAL VALUE BENEFITS (CONTD.)', [
      {
        title: 'Section 9.5 — Health Checkup & Second Medical Opinion',
        paragraphs: [
          'Clause 9.5 — Preventive Annual Health Checkup: Free annual medical health checkup for all insured adult members at empanelled diagnostic centers.',
          'Clause 9.6 — Second Opinion for Major Illnesses: Free electronic second medical opinion from a panel of independent specialist physicians for 11 critical ailments.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 38-40: SECTION 10 — NETWORK & NON-NETWORK CO-PAY
    // =========================================================================
    addTextSection(38, 'SECTION 10 — NETWORK & CO-PAYMENT RULES', [
      {
        title: 'Section 10.1 — Cashless Network Hospital Network',
        paragraphs: [
          'Clause 10.1 — Network Hospital Cashless Settlement: Treatment undertaken at an empanelled Network Hospital carries 0% (zero) co-payment for all standard eligible hospitalization charges.',
          'Network Verification Rule: Insurer verifies empanelment status via real-time Rohini / Registry of Hospitals Network ID. Where hospital status is verified in-network, cashless pre-authorization is issued.'
        ]
      }
    ]);

    addTextSection(39, 'SECTION 10 — NETWORK & CO-PAYMENT RULES (CONTD.)', [
      {
        title: 'Section 10.2 — Non-Network Reimbursement Co-Payment',
        paragraphs: [
          'Clause 10.2 — Non-Network Co-Payment Requirement: In the event of an Insured Person electing to undergo planned medical treatment at a Non-Network Hospital (reimbursement claim), a compulsory Co-Payment of 20% (twenty percent) shall apply on the net admissible claim amount after deductible.',
          'Unverified Status Guardrail: If hospital network status is unverified or unresolved, co-payment cannot be definitively established and the claim shall be flagged for manual verification.'
        ]
      }
    ]);

    addTextSection(40, 'SECTION 10 — NETWORK & CO-PAYMENT RULES (CONTD.)', [
      {
        title: 'Section 10.3 — Non-Network Claim Submission Timelines',
        paragraphs: [
          'Clause 10.3 — Claim Intimation & Submission Deadlines: In non-network reimbursement cases, notice of claim must be given within 48 hours of admission. Final bills and discharge documents must be submitted within 30 days of hospital discharge.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 41-42: SECTION 11 — CLAIMS & GRIEVANCE REDRESSAL
    // =========================================================================
    addTextSection(41, 'SECTION 11 — CLAIMS PROCEDURE', [
      {
        title: 'Section 11.1 — Document Checklist & Settlement SLAs',
        paragraphs: [
          'Clause 11.1 — Mandatory Claim Documentation: (i) Duly completed claim form; (ii) Original hospital final itemized bill with break-up; (iii) Original payment receipt; (iv) Original discharge summary; (v) Pharmacy bills with prescriptions; (vi) Diagnostic reports.',
          'Settlement Timeline: As per IRDAI regulations, claims shall be adjudicated and settled within 30 days of receipt of all complete documents.'
        ]
      }
    ]);

    addTextSection(42, 'SECTION 11 — CLAIMS PROCEDURE (CONTD.)', [
      {
        title: 'Section 11.2 — Grievance Redressal & Insurance Ombudsman',
        paragraphs: [
          'Clause 11.2 — Grievance Redressal Mechanism: In case of dispute regarding claim adjudication, policyholders may contact the Grievance Redressal Officer at grievance@arogyabharat.com.',
          'Clause 11.3 — Insurance Ombudsman: Policyholders may approach the Insurance Ombudsman having jurisdiction in their territorial region under Insurance Ombudsman Rules, 2017.'
        ]
      }
    ]);

    // =========================================================================
    // PAGES 43-44: SECTION 12 — ENDORSEMENTS & AMENDMENTS RIDER
    // =========================================================================
    addTextSection(43, 'SECTION 12 — ENDORSEMENTS & RIDERS', [
      {
        title: 'Section 12.1 — Endorsement Amendment Rider 1 (Effective 2026-10-01)',
        paragraphs: [
          'Endorsement Certificate No.: END-AB-2026-RIDER01 | Document ID: doc_endorsement_q3_pdf',
          'Contractual Effective Date: 2026-10-01 (October 1, 2026) | Supersedes: Clause 5.1 & Clause 10.2 from effective date.',
          'Endorsement Clause E.1 — Enhanced Cataract Sub-Limit: For all hospital admissions and day care surgeries taking place on or after 2026-10-01, the procedure sub-limit for Cataract Surgery (Clause 5.1) is hereby enhanced from Rs. 45,000 per eye to Rs. 60,000 per eye (Rupees Sixty Thousand per eye).',
          'Condition Precedent: Admissions prior to 2026-10-01 shall remain strictly governed by the original Rs. 45,000 limit.'
        ]
      }
    ]);

    addTextSection(44, 'SECTION 12 — ENDORSEMENTS & RIDERS (CONTD.)', [
      {
        title: 'Section 12.2 — Emergency Cardiac Non-Network Copay Waiver',
        paragraphs: [
          'Endorsement Clause E.2 — Non-Network Copay Waiver for Emergency Cardiac Admissions: For emergency admissions involving Acute Coronary Syndrome, Myocardial Infarction, or Cardiogenic Shock on or after 2026-10-01, the 20% Non-Network Co-Payment specified under Clause 10.2 is hereby waived to 0% (zero percent).',
          'All other terms, conditions, deductibles and exclusions of the Master Policy Contract remain unaltered.'
        ]
      }
    ]);

    // =========================================================================
    // PAGE 45: MASTER SUMMARY & RECONCILIATION MATRIX
    // =========================================================================
    addHeaderFooter(45, 'SECTION 13 — SUMMARY MATRIX');
    doc.fontSize(13).fillColor('#0b4f6c').text('ANNEXURE & MASTER FINANCIAL RECONCILIATION MATRIX', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(8.5).fillColor('#000000');
    doc.text('This master schedule consolidates all contractual financial limits, clauses, and cross-references:');
    doc.moveDown(0.6);

    const matrixRows = [
      ['Rule / Feature', 'Contractual Entitlement', 'Governing Clause', 'Page'],
      ['Basic Sum Insured', 'Rs. 10,00,000', 'Clause S.3', 'Page 2'],
      ['Cumulative Bonus', 'Rs. 1,00,000 (10% accrued)', 'Clause S.3 & 9.2', 'Page 2, 35'],
      ['Compulsory Deductible', 'Rs. 25,000 (Aggregate)', 'Clause S.3 & D.9', 'Page 2, 5'],
      ['Room Rent Cap', '1% of SI / day (Rs. 10,000/day)', 'Clause 2.1', 'Page 7'],
      ['ICU / ICCU Cap', '2% of SI / day (Rs. 20,000/day)', 'Clause 2.2', 'Page 8'],
      ['Proportionate Deduction', 'Applies on room breach', 'Clause 2.3', 'Page 9'],
      ['Cataract Sublimit', 'Rs. 45,000 / eye (Rs. 60,000 from Oct 1)', 'Clause 5.1 & E.1', 'Page 19, 43'],
      ['Knee Replacement Sublimit', 'Rs. 1,80,000 / knee', 'Clause 5.2', 'Page 20'],
      ['Hernia Sublimit', 'Rs. 85,000', 'Clause 5.3', 'Page 20'],
      ['Cholecystectomy Sublimit', 'Rs. 95,000', 'Clause 5.4', 'Page 21'],
      ['Kidney Stone Sublimit', 'Rs. 60,000', 'Clause 5.5', 'Page 21'],
      ['Initial Waiting Period', '30 Days', 'Clause 6.1', 'Page 23'],
      ['Specific Illness Waiting', '24 Months', 'Clause 6.2', 'Page 24'],
      ['Pre-Existing Disease Waiting', '36 Months', 'Clause 6.3', 'Page 25'],
      ['Maternity Waiting Period', '24 Months', 'Clause 6.4', 'Page 26'],
      ['Non-Payables Consumables', '100% Excluded (IRDAI Annexure I)', 'Clause 8.1 & 8.2', 'Page 32, 33'],
      ['Ambulance Allowance', 'Rs. 3,000 (Road) / Rs. 2,50,000 (Air)', 'Clause 9.1', 'Page 35'],
      ['Automatic Restoration', '100% SI restored once per year', 'Clause 9.3', 'Page 36'],
      ['In-Network Co-Payment', '0% (Nil)', 'Clause 10.1', 'Page 38'],
      ['Non-Network Co-Payment', '20% (Waived for cardiac from Oct 1)', 'Clause 10.2 & E.2', 'Page 39, 44'],
      ['Endorsement Rider Effective', '2026-10-01', 'Endorsement Rider 1', 'Page 43, 44']
    ];

    doc.fontSize(7.5).fillColor('#333333');
    for (const row of matrixRows) {
      doc.text(`${row[0].padEnd(28)} | ${row[1].padEnd(36)} | ${row[2].padEnd(18)} | ${row[3]}`);
    }

    doc.moveDown(1);
    doc.fontSize(7).fillColor('#b71c1c')
      .text('VERIFICATION CHECKSUM: SHA256-SYNTH-POLICY-45P-AROGYA-BHARAT-BENCHMARK-VALIDATED-V1', { align: 'center' });

    doc.end();
    writeStream.on('finish', () => resolve(filePath));
    writeStream.on('error', reject);
  });
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('generate45PageSyntheticPolicy.ts')) {
  generate45PageSyntheticPolicyPdf()
    .then((fp) => console.log(`[Success] Generated 45-page synthetic policy at: ${fp}`))
    .catch((err) => console.error('[Error] Generating 45-page synthetic policy:', err));
}
