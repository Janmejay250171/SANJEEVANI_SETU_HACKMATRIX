import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.resolve(__dirname, '../../../mock-policies');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Generates a comprehensive, realistic 32-page health insurance policy wording document:
 * Star Health Family Health Optima Insurance Plan — Policy Contract & Terms (32 Pages)
 * Includes Schedule, Definitions, Room Rent Grid, Daycare Schedule, Sublimits,
 * Waiting Periods, Exclusions, Proportionate Deduction, Co-Pay, and Endorsement.
 */
export function generateFull32PagePolicyPdf(): Promise<string> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(outputDir, 'star_health_optima_full_wording_32pp.pdf');
    const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: false });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    function addHeaderFooter(pageNum: number, title: string) {
      doc.addPage();
      // Running header
      doc.fontSize(8).fillColor('#666666')
        .text('STAR HEALTH AND ALLIED INSURANCE CO. LTD. | UIN: SHAHLIP26046V092526', 40, 20)
        .text(title, 40, 30, { align: 'right' });
      doc.moveTo(40, 38).lineTo(555, 38).strokeColor('#cccccc').stroke();

      // Running footer
      doc.moveTo(40, 785).lineTo(555, 785).strokeColor('#cccccc').stroke();
      doc.fontSize(8).fillColor('#666666')
        .text('Policy Contract Wording — Family Health Optima', 40, 792)
        .text(`Page ${pageNum} of 32`, 40, 792, { align: 'right' });

      doc.y = 50;
      doc.fillColor('#000000');
    }

    // PAGE 1: Cover Page & Contractual Preamble
    addHeaderFooter(1, 'PREAMBLE & TITLE');
    doc.fontSize(22).fillColor('#0b4f6c').text('STAR HEALTH AND ALLIED INSURANCE CO. LTD.', { align: 'center' });
    doc.fontSize(10).fillColor('#555555').text('IRDAI Regn No. 129 | CIN: U66010TN2005PLC056649', { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(16).fillColor('#2E7D5B').text('FAMILY HEALTH OPTIMA INSURANCE PLAN', { align: 'center', underline: true });
    doc.fontSize(12).fillColor('#333333').text('POLICY WORDING AND CONTRACTUAL TERMS (32 PAGES MASTER DOCUMENT)', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(11).fillColor('#000000');
    doc.text('PREAMBLE', { underline: true });
    doc.moveDown(0.5);
    doc.text(
      'WHEREAS the policyholder designated in the Schedule hereto has applied to STAR HEALTH AND ALLIED INSURANCE COMPANY LIMITED (hereinafter called the "Company") by a written proposal and declaration dated as stated in the Schedule, and has paid the premium stated in the Schedule as consideration for this insurance.'
    );
    doc.moveDown(0.8);
    doc.text(
      'NOW THIS POLICY WITNESSETH that subject to the terms, conditions, exclusions, waiting periods, sub-limits, warranties and endorsements contained herein or endorsed hereon, the Company agrees that if during the Policy Period stated in the Schedule the Insured Person shall contract any disease or suffer bodily injury through accident and require inpatient hospitalization or daycare treatment at a Hospital or Day Care Centre in India, the Company will pay the reasonable, customary and medically necessary expenses incurred in respect thereof, subject to the limits and deductions specified herein.'
    );
    doc.moveDown(1.5);
    doc.fontSize(10).fillColor('#444444').text('TABLE OF CONTENTS:', { underline: true });
    doc.moveDown(0.5);
    doc.text('1. Policy Schedule & Product Summary ........................................................... Page 2');
    doc.text('2. Section 1: Standard Definitions & Contractual Rules .................................... Pages 3–8');
    doc.text('3. Section 2: Inpatient Benefits, Room Rent & ICU Entitlement ........................ Pages 9–12');
    doc.text('4. Section 3: Covered Day Care Procedures Schedule ..................................... Pages 13–16');
    doc.text('5. Section 4: Modern & Advanced Treatment Methods .................................... Pages 17–19');
    doc.text('6. Section 5: Specific Disease & Procedure Sub-Limits ................................. Pages 20–21');
    doc.text('7. Section 6: Waiting Periods & Moratorium Rules ....................................... Pages 22–24');
    doc.text('8. Section 7: Permanent & General Policy Exclusions .................................... Pages 25–28');
    doc.text('9. Section 8: Claims, Proportionate Deduction & Co-Payment Rules ............... Pages 29–30');
    doc.text('10. Section 9: Endorsement Amendment & Zone Allocation Rider ................... Pages 31–32');

    // PAGE 2: Policy Schedule & Product Specifications
    addHeaderFooter(2, 'POLICY SCHEDULE');
    doc.fontSize(14).fillColor('#0b4f6c').text('SCHEDULE OF INSURANCE — POLICY CERTIFICATE', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause S.1 — Policy Identification:');
    doc.text('• Policy Number: STAR-FHO-2026-889921');
    doc.text('• Plan Name: Family Health Optima Insurance Plan');
    doc.text('• Policy Type: Floater (Family Floater Covering 1 Primary + 1 Dependent)');
    doc.text('• Unique Identification Number (UIN): SHAHLIP26046V092526');
    doc.text('• Policy Period: From 00:00 hrs of 2026-04-01 to midnight of 2027-03-31');
    doc.text('• Contractual Effective From: 2026-04-01 | Effective To: 2027-03-31');
    doc.moveDown(0.8);
    doc.text('Clause S.2 — Insured Persons:');
    doc.text('1. Rajesh Sharma | Age: 48 Years | Relation: Self (Primary Insured)');
    doc.text('2. Sunita Sharma | Age: 45 Years | Relation: Spouse');
    doc.moveDown(0.8);
    doc.text('Clause S.3 — Core Financial Terms:');
    doc.text('• Basic Sum Insured: Rs. 5,00,000 (Rupees Five Lakhs Only)');
    doc.text('• Cumulative Bonus Accrued: Rs. 50,000 (10% per claim-free renewal)');
    doc.text('• Total Available Cover: Rs. 5,50,000');
    doc.text('• Compulsory Deductible: Rs. 0 (Nil compulsory deductible)');
    doc.text('• Geographic Zone: Zone B (Bengaluru Urban, Tier 1)');
    doc.text('• Third Party Administrator (TPA): In-house Claims Processing Unit (No TPA)');
    doc.text('• Network Type: restricted-network (Empanelled Network Hospitals in IRDAI Registry)');
    doc.text('• Cashless Facility: Available at all Network Hospitals subject to pre-authorization.');

    // PAGES 3 to 8: Section 1 — Definitions (Detailed Contractual Clauses)
    for (let p = 3; p <= 8; p++) {
      addHeaderFooter(p, 'SECTION 1: DEFINITIONS');
      doc.fontSize(12).fillColor('#0b4f6c').text(`SECTION 1: DEFINITIONS AND INTERPRETATIONS (PART ${p - 2})`, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#000000');
      if (p === 3) {
        doc.text('Clause 1.1 — Accident: An accident means sudden, unforeseen and involuntary event caused by external, violent and visible means.');
        doc.moveDown(0.5);
        doc.text('Clause 1.2 — Act of God: Perils of nature including earthquakes, floods, and cyclones.');
        doc.moveDown(0.5);
        doc.text('Clause 1.3 — Admission: Entry of an Insured Person into a hospital for active medical treatment of disease or injury.');
        doc.moveDown(0.5);
        doc.text('Clause 1.4 — Associated Medical Expenses: Means doctor consultation fees, nursing fees, operation theatre charges, anesthetist charges, and surgical consumables directly related to surgical intervention.');
        doc.moveDown(0.5);
        doc.text('Clause 1.5 — Cashless Facility: Means a facility extended by the Insurer to the Insured where the payments of the costs of treatment undergone by the Insured Person in a Network Hospital are directly settled by the Insurer to the Network Hospital.');
        doc.moveDown(0.5);
        doc.text('Clause 1.6 — Co-payment: A cost-sharing requirement under a health insurance policy that provides that the policyholder/insured will bear a specified percentage of the admissible claim amount.');
        doc.moveDown(0.5);
        doc.text('Clause 1.7 — Day Care Centre: Means any institution established for day care treatment of illness and/or injuries or a medical setup with a hospital and which has been registered with local authorities.');
        doc.moveDown(0.5);
        doc.text('Clause 1.8 — Deductible: A cost-sharing requirement under a health insurance policy that provides that the Insurer will not be liable for a specified rupee amount of the covered expenses.');
      } else if (p === 4) {
        doc.text('Clause 1.9 — Domiciliary Hospitalization: Medical treatment for an illness/injury which in normal course would require care and treatment at a hospital but is actually taken while confined at home.');
        doc.moveDown(0.5);
        doc.text('Clause 1.10 — Emergency Care: Management of severe illness or injury which results in symptoms which occur suddenly and unexpectedly, and requires immediate medical attention.');
        doc.moveDown(0.5);
        doc.text('Clause 1.11 — Grace Period: Specified period of 30 days immediately following the premium due date during which a payment can be made to renew or continue a policy in force.');
        doc.moveDown(0.5);
        doc.text('Clause 1.12 — Hospital: Means any institution established for in-patient care and day care treatment of illness and/or injuries and which has been registered as a hospital with local authorities under Clinical Establishments Act.');
        doc.moveDown(0.5);
        doc.text('Clause 1.13 — Intensive Care Unit (ICU): An identified section, ward or wing of a hospital which is under the constant supervision of dedicated medical practitioners and is specially equipped for monitoring of critically ill patients.');
      } else if (p === 5) {
        doc.text('Clause 1.14 — Maternity Expense: Includes medical treatment expenses traceable to childbirth (including complicated deliveries and caesarean section) and expenses towards lawful medical termination of pregnancy.');
        doc.moveDown(0.5);
        doc.text('Clause 1.15 — Medical Advice: Any consultation or advice from a Medical Practitioner including the issuance of any prescription or follow-up prescription.');
        doc.moveDown(0.5);
        doc.text('Clause 1.16 — Medically Necessary: Any treatment, tests, medication, or stay in hospital or part of a stay in hospital which is required for the medical management of the illness or injury.');
        doc.moveDown(0.5);
        doc.text('Clause 1.17 — Network Provider: Means hospitals enlisted by an insurer, TPA or jointly by an Insurer and TPA to provide medical services to an insured by a cashless facility.');
        doc.moveDown(0.5);
        doc.text('Clause 1.18 — Non-Network Hospital: Any hospital, day care centre or other provider that is not part of the network.');
      } else if (p === 6) {
        doc.text('Clause 1.19 — Pre-Existing Disease (PED): Any condition, ailment, injury or disease that is diagnosed by a physician within 36 months prior to the effective date of the policy.');
        doc.moveDown(0.5);
        doc.text('Clause 1.20 — Pre-Hospitalization Medical Expenses: Medical expenses incurred up to 60 days immediately before the Insured Person is hospitalized, provided that such expenses are incurred for the same condition.');
        doc.moveDown(0.5);
        doc.text('Clause 1.21 — Post-Hospitalization Medical Expenses: Medical expenses incurred up to 90 days immediately after the Insured Person is discharged from the hospital, provided that such expenses are incurred for the same condition.');
        doc.moveDown(0.5);
        doc.text('Clause 1.22 — Proportionate Deduction: The reduction applied to associated medical expenses in proportion to the eligible room rent limit when an insured occupies a room costing higher than the eligible limit.');
      } else if (p === 7) {
        doc.text('Clause 1.23 — Qualified Nurse: Means a person who holds a valid registration from the Nursing Council of India or the Nursing Council of any state in India.');
        doc.moveDown(0.5);
        doc.text('Clause 1.24 — Reasonable and Customary Charges: The charges for services or supplies, which are the standard charges for the specific provider and consistent with the prevailing charges in the geographical area.');
        doc.moveDown(0.5);
        doc.text('Clause 1.25 — Renewal: Means the terms on which the contract of insurance can be renewed on mutual consent with a provision of grace period for treating the renewal continuous for the purpose of all waiting periods.');
        doc.moveDown(0.5);
        doc.text('Clause 1.26 — Room Rent: The amount charged by a Hospital towards room and boarding expenses and includes the associated nursing charges.');
        doc.moveDown(0.5);
        doc.text('Clause 1.27 — Sub-limit: A cost sharing requirement under a health insurance policy in which an Insurer would not be liable to pay any amount in excess of the pre-defined limit.');
      } else {
        doc.text('Clause 1.28 — Surgery or Surgical Procedure: Means manual and/or operative procedures required for treatment of an illness or injury, correction of deformities and defects.');
        doc.moveDown(0.5);
        doc.text('Clause 1.29 — Waiting Period: Means a period from the inception date of this policy during which specified illnesses or conditions are not covered.');
        doc.moveDown(0.5);
        doc.text('Clause 1.30 — Moratorium Period: After completion of 60 continuous months of coverage under this policy, no look back to be applied and no policy shall be contestable on ground of non-disclosure.');
      }
    }

    // PAGES 9 to 12: Section 2 — Inpatient Hospitalization, Room Rent & ICU
    addHeaderFooter(9, 'SECTION 2: INPATIENT BENEFITS');
    doc.fontSize(12).fillColor('#0b4f6c').text('SECTION 2: INPATIENT HOSPITALIZATION BENEFITS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause 2.1 — Inpatient Care Coverage:');
    doc.text('The Company shall indemnify Medically Necessary expenses incurred for Inpatient Care up to the Sum Insured of Rs. 5,00,000 specified in the Schedule, provided hospitalization is for a minimum period of 24 consecutive hours.');
    doc.moveDown(0.8);
    doc.text('Clause 2.2 — Room Rent Limits Keyed by Sum Insured (MANDATORY TABLE):');
    doc.moveDown(0.4);
    doc.text('Room rent, boarding, and nursing expenses are subject to the following explicit limits based on the Basic Sum Insured:');
    doc.moveDown(0.3);
    doc.text('• Sum Insured up to Rs. 3,00,000: Up to Rs. 3,000 per day (Amount limit: Rs. 3,000)');
    doc.text('• Sum Insured Rs. 4,00,000 to Rs. 5,00,000: Up to Rs. 5,000 per day (Amount limit: Rs. 5,000)');
    doc.text('• Sum Insured Rs. 10,00,000 and above: Single Standard Private A/C Room (Category limit)');
    doc.moveDown(0.5);
    doc.text('FOR THIS POLICY (Sum Insured Rs. 5,00,000): The eligible room rent is explicitly Rs. 5,000 per day.');
    doc.moveDown(0.8);
    doc.text('Clause 2.3 — Intensive Care Unit (ICU) Limit:');
    doc.text('Expenses incurred for stay in Intensive Care Unit (ICU) / Intensive Cardiac Care Unit (ICCU) are covered up to 2% of Sum Insured per day, amounting to Rs. 10,000 per day for this policy.');

    addHeaderFooter(10, 'SECTION 2: INPATIENT BENEFITS (CONT.)');
    doc.fontSize(12).fillColor('#0b4f6c').text('SECTION 2: INPATIENT HOSPITALIZATION (PART 2)', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause 2.4 — Nursing Charges & Medical Practitioner Fees:');
    doc.text('Fees charged by surgeon, anesthetist, medical practitioner, consultant and specialist are covered subject to reasonable and customary limits.');
    doc.moveDown(0.8);
    doc.text('Clause 2.5 — Anesthesia, Blood, Oxygen, Operation Theatre:');
    doc.text('Anesthesia, blood, oxygen, operation theatre charges, surgical appliances, medicines, drugs, diagnostic tests, and surgical consumables are covered.');
    doc.moveDown(0.8);
    doc.text('Clause 2.6 — Pre-Hospitalization Medical Expenses:');
    doc.text('Pre-hospitalization medical expenses incurred up to 60 days prior to admission are admissible.');
    doc.moveDown(0.8);
    doc.text('Clause 2.7 — Post-Hospitalization Medical Expenses:');
    doc.text('Post-hospitalization medical expenses incurred up to 90 days following discharge are admissible.');

    addHeaderFooter(11, 'SECTION 2: PROPORTIONATE DEDUCTION');
    doc.fontSize(12).fillColor('#0b4f6c').text('SECTION 2: PROPORTIONATE DEDUCTION CLAUSE', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause 2.8 — Mandatory Proportionate Deduction Application:');
    doc.text(
      'If the Insured Person occupies a room with a room rent higher than the entitled limit of Rs. 5,000 per day specified in Clause 2.2, then the associated medical expenses (including nursing charges, surgeon/specialist fees, operation theatre and anesthesia charges) shall be paid in proportion to the eligible room rent limit to the actual room rent occupied. proportionateDeduction is strictly TRUE.'
    );
    doc.moveDown(0.8);
    doc.text('Formula:');
    doc.text('Eligible Associated Expense = Actual Associated Expense * (Eligible Room Rent / Actual Room Rent)');
    doc.moveDown(0.8);
    doc.text('Exceptions to Proportionate Deduction:');
    doc.text('Proportionate deduction shall NOT apply to pharmacy items, standard implants, diagnostic investigation costs outside the surgical suite, and consumables with fixed MRP.');

    addHeaderFooter(12, 'SECTION 2: RESTORATION & BONUS');
    doc.fontSize(12).fillColor('#0b4f6c').text('SECTION 2: RESTORATION BENEFIT & CUMULATIVE BONUS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause 2.9 — Automatic Restoration of Basic Sum Insured:');
    doc.text(
      'The policy provides automatic restoration of Basic Sum Insured up to 100% (Rs. 5,00,000) once during the policy year upon complete exhaustion of the Basic Sum Insured and Cumulative Bonus. Restoration is available for subsequent hospitalizations for unrelated illness/injury. restorationBenefit is explicitly TRUE.'
    );
    doc.moveDown(0.8);
    doc.text('Clause 2.10 — Cumulative Bonus:');
    doc.text('A cumulative bonus of 10% on the basic sum insured is added for every claim-free year, up to a maximum of 100%. Cumulative bonus accrued for this policy: Rs. 50,000.');
    doc.moveDown(0.8);
    doc.text('Clause 2.11 — Road Ambulance Cover:');
    doc.text('Road ambulance expenses are covered up to Rs. 2,000 per hospitalization episode.');

    // PAGES 13 to 16: Section 3 — Day Care Procedures Schedule
    for (let p = 13; p <= 16; p++) {
      addHeaderFooter(p, 'SECTION 3: DAY CARE PROCEDURES');
      doc.fontSize(12).fillColor('#0b4f6c').text(`SECTION 3: DAY CARE PROCEDURES SCHEDULE (PART ${p - 12})`, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#000000');
      doc.text('All medically necessary day care surgical treatments requiring less than 24 hours hospitalization are covered under Clause 3.1.');
      doc.moveDown(0.5);
      if (p === 13) {
        doc.text('1. Cataract Surgery (Phacoemulsification with IOL)');
        doc.text('2. Chalazion surgery, Pterygium excision, Glaucoma filtration surgery');
        doc.text('3. Vitrectomy, Retinal photocoagulation, Trabeculectomy');
        doc.text('4. Tympanoplasty, Stapedectomy, Myringotomy with grommet insertion');
        doc.text('5. Mastoidectomy, Polypectomy, Septoplasty');
      } else if (p === 14) {
        doc.text('6. Tonsillectomy, Adenoidectomy, Direct laryngoscopy');
        doc.text('7. Dialysis (Hemodialysis and Peritoneal Dialysis for acute or chronic renal disease)');
        doc.text('8. Chemotherapy and Radiotherapy for neoplastic disorders');
        doc.text('9. Lithotripsy (ESWL) for kidney/ureteric stones');
        doc.text('10. Hydrocele repair, Varicocele surgery, Orchidopexy');
      } else if (p === 15) {
        doc.text('11. Inguinal Hernia repair, Umbilical hernia repair, Incisional hernia repair');
        doc.text('12. Hemorrhoidectomy, Fissurectomy, Fistulotomy / Fistulectomy');
        doc.text('13. Pilonidal sinus excision, Sebaceous cyst excision, Lipoma excision');
        doc.text('14. Arthroscopic meniscectomy, Diagnostic arthroscopy, Debridement');
        doc.text('15. Closed reduction of fractures, K-wire fixation');
      } else {
        doc.text('16. Dilatation and Curettage (D&C), Hysteroscopy, Cervical cerclage');
        doc.text('17. Endoscopic retrograde cholangiopancreatography (ERCP)');
        doc.text('18. Colonoscopy with polypectomy, Upper GI endoscopy with biopsy');
        doc.text('19. Foreign body removal from cornea, ear, or bronchus');
        doc.text('20. Daycare Covered Status: daycareCovered is explicitly TRUE across all listed procedures.');
      }
    }

    // PAGES 17 to 19: Section 4 — Modern Treatment Methods
    for (let p = 17; p <= 19; p++) {
      addHeaderFooter(p, 'SECTION 4: MODERN TREATMENTS');
      doc.fontSize(12).fillColor('#0b4f6c').text(`SECTION 4: MODERN & ADVANCED TREATMENT METHODS (PART ${p - 16})`, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#000000');
      if (p === 17) {
        doc.text('Clause 4.1 — Uterine Artery Embolization and HIFU: Covered up to 50% of Sum Insured.');
        doc.moveDown(0.5);
        doc.text('Clause 4.2 — Balloon Sinuplasty: Covered up to 50% of Sum Insured.');
        doc.moveDown(0.5);
        doc.text('Clause 4.3 — Deep Brain Stimulation (DBS): Covered up to 50% of Sum Insured.');
        doc.moveDown(0.5);
        doc.text('Clause 4.4 — Oral Chemotherapy: Covered subject to sub-limit of Rs. 1,00,000 per policy period.');
      } else if (p === 18) {
        doc.text('Clause 4.5 — Immunotherapy (Monoclonal Antibodies): Covered up to 50% of Sum Insured.');
        doc.moveDown(0.5);
        doc.text('Clause 4.6 — Intra-vitreal Injections: Covered up to Rs. 50,000 per policy period.');
        doc.moveDown(0.5);
        doc.text('Clause 4.7 — Robotic Surgeries: Covered subject to co-pay of 20% on the robotic console charge and capped at Rs. 2,00,000.');
        doc.moveDown(0.5);
        doc.text('Clause 4.8 — Stereotactic Radio Surgeries: Covered up to 50% of Sum Insured.');
      } else {
        doc.text('Clause 4.9 — Bronchial Thermoplasty: Covered up to 50% of Sum Insured.');
        doc.moveDown(0.5);
        doc.text('Clause 4.10 — Vaporization of Prostate (Green laser/Holmium): Covered up to Rs. 1,50,000.');
        doc.moveDown(0.5);
        doc.text('Clause 4.11 — IONM (Intra Operative Neuro Monitoring): Covered up to Rs. 50,000.');
        doc.moveDown(0.5);
        doc.text('Clause 4.12 — Stem Cell Therapy (Hematopoietic for hematological conditions): Covered up to 50% of Sum Insured.');
      }
    }

    // PAGES 20 to 21: Section 5 — Disease & Procedure Sub-Limits
    addHeaderFooter(20, 'SECTION 5: SUB-LIMITS');
    doc.fontSize(12).fillColor('#0b4f6c').text('SECTION 5: SPECIFIC PROCEDURE & DISEASE SUB-LIMITS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause 5.1 — Cataract Surgery Sub-Limit:');
    doc.text('Cataract surgery expenses are subject to an explicit sub-limit of Rs. 40,000 per eye, and a maximum of Rs. 60,000 per policy period for both eyes. subLimits.cataract = 40000.');
    doc.moveDown(0.8);
    doc.text('Clause 5.2 — Total Knee Replacement Sub-Limit:');
    doc.text('Joint Replacement procedures including Unilateral Total Knee Replacement (TKR) and Total Hip Replacement (THR) are subject to an explicit monetary sub-limit of Rs. 1,50,000 per hospitalization episode. subLimits.kneeReplacement = 150000.');
    doc.moveDown(0.8);
    doc.text('Clause 5.3 — Inguinal & Abdominal Hernia Sub-Limit:');
    doc.text('Expenses for open or laparoscopic hernia repair are subject to a maximum sub-limit of Rs. 65,000. subLimits.hernia = 65000.');

    addHeaderFooter(21, 'SECTION 5: SUB-LIMITS (CONT.)');
    doc.fontSize(12).fillColor('#0b4f6c').text('SECTION 5: SPECIFIC PROCEDURE SUB-LIMITS (PART 2)', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause 5.4 — Laparoscopic Appendectomy Sub-Limit:');
    doc.text('Expenses for Laparoscopic Appendectomy are subject to a sub-limit of Rs. 50,000 per admission. subLimits.appendectomy = 50000.');
    doc.moveDown(0.8);
    doc.text('Clause 5.5 — Renal Stone & Lithotripsy Sub-Limit:');
    doc.text('Endoscopic or laser treatment for urinary stones / lithotripsy is subject to a cap of Rs. 45,000.');
    doc.moveDown(0.8);
    doc.text('Clause 5.6 — Mental Illness Sub-Limit:');
    doc.text('Inpatient treatment for mental illness is covered up to Rs. 1,00,000 per policy period.');

    // PAGES 22 to 24: Section 6 — Waiting Periods
    for (let p = 22; p <= 24; p++) {
      addHeaderFooter(p, 'SECTION 6: WAITING PERIODS');
      doc.fontSize(12).fillColor('#0b4f6c').text(`SECTION 6: WAITING PERIODS SCHEDULE (PART ${p - 21})`, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#000000');
      if (p === 22) {
        doc.text('Clause 6.1 — Initial Waiting Period (Code-Wait01):');
        doc.text('A waiting period of 30 days from the policy commencement date shall apply to all claims, except those arising out of Accidental Injury requiring emergency admission.');
        doc.moveDown(0.8);
        doc.text('Clause 6.2 — Pre-Existing Disease Waiting Period (Code-Wait02):');
        doc.text('Expenses related to the treatment of a Pre-Existing Disease (PED) and its direct complications shall be excluded until the expiry of 36 months (3 years) of continuous coverage after the date of inception of the first policy.');
      } else if (p === 23) {
        doc.text('Clause 6.3 — Specific Illnesses Two-Year Waiting Period (Code-Wait03):');
        doc.text('Expenses related to the treatment of the following specified ailments shall be excluded until the expiry of 24 months (2 years) of continuous coverage:');
        doc.moveDown(0.4);
        doc.text('a) Cataract and eye diseases');
        doc.text('b) Sub-mucous resection, adenoids and tonsillectomy');
        doc.text('c) All types of hernia, hydrocele, rectocele, cystocele');
        doc.text('d) Anal fissure, fistula in ano, hemorrhoids, pilonidal sinus');
        doc.text('e) Benign prostatic hyperplasia (BPH)');
        doc.text('f) Calculi in urinary system, gall bladder and bile duct');
        doc.text('g) Joint Replacement Surgery (unless necessitated by accidental injury)');
      } else {
        doc.text('Clause 6.4 — Maternity Waiting Period (Code-Wait04):');
        doc.text('Medical expenses for maternity treatment or childbirth are subject to a waiting period of 24 months of continuous coverage.');
        doc.moveDown(0.8);
        doc.text('Clause 6.5 — Bariatric Surgery Waiting Period:');
        doc.text('Covered only after 36 months of continuous coverage and subject to BMI > 40 criteria.');
      }
    }

    // PAGES 25 to 28: Section 7 — Permanent & General Policy Exclusions
    for (let p = 25; p <= 28; p++) {
      addHeaderFooter(p, 'SECTION 7: EXCLUSIONS');
      doc.fontSize(12).fillColor('#0b4f6c').text(`SECTION 7: PERMANENT CONTRACTUAL EXCLUSIONS (PART ${p - 24})`, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#000000');
      if (p === 25) {
        doc.text('The Company shall NOT be liable to make any payment for any expenses incurred on account of:');
        doc.moveDown(0.5);
        doc.text('Excl 01 — Investigation & Evaluation (Code-Excl04): Expenses related to diagnostic admission solely for investigation purpose.');
        doc.text('Excl 02 — Rest Cure, Rehabilitation and Respite Care (Code-Excl05): Admissions solely for bed rest.');
        doc.text('Excl 03 — Obesity / Weight Control (Code-Excl06): Surgical treatment of obesity except meeting strict IRDAI clinical guidelines.');
        doc.text('Excl 04 — Change-of-Gender Treatments (Code-Excl07): Expenses related to gender transformation.');
        doc.text('Excl 05 — Cosmetic or Plastic Surgery (Code-Excl08): Expenses for cosmetic or reconstructive surgery unless necessitated by accidental burn or trauma.');
      } else if (p === 26) {
        doc.text('Excl 06 — Hazardous or Adventure Sports (Code-Excl09): Treatment resulting from competitive professional sports.');
        doc.text('Excl 07 — Breach of Law (Code-Excl10): Expenses incurred for treatment directly arising from criminal intent.');
        doc.text('Excl 08 — Substance Abuse & Addiction (Code-Excl12): Treatment for alcoholism, drug abuse, or solvent addiction.');
        doc.text('Excl 09 — Unproven or Experimental Treatments (Code-Excl16): Therapies lacking established medical efficacy.');
        doc.text('Excl 10 — Dental Treatment & Dental Surgery: Cosmetic or routine dental surgeries are permanently excluded, EXCEPT when hospitalization is necessitated due to accidental facial injury.');
      } else if (p === 27) {
        doc.text('Excl 11 — Bio-resonance and Alternative Energy Healing: Bio-resonance diagnostic scans, magnetic frequency therapy, crystal healing are permanently excluded.');
        doc.text('Excl 12 — Rhinoplasty: Aesthetic nasal reshaping is permanently excluded unless required following traumatic facial fracture.');
        doc.text('Excl 13 — Refractive Eye Errors: Spectacles, contact lenses, and LASIK/PRK surgeries for correction of refractive error < 7.5 dioptres.');
        doc.text('Excl 14 — Infertility and Assisted Reproduction (Code-Excl17): IVF, IUI, ICSI, and fertility workups.');
        doc.text('Excl 15 — Circumcision: Unless medically necessary for treatment of phimosis.');
      } else {
        doc.text('Excl 16 — War and Nuclear Perils (Code-Excl02): Injuries resulting from nuclear contamination or declared war.');
        doc.text('Excl 17 — Self-Inflicted Injuries: Intentional self-harm or attempted suicide.');
        doc.text('Excl 18 — Statutory Non-Payable Consumables: Items specified under IRDAI Guidelines Annexure I (luxuries, toiletries, administrative charges).');
        doc.text('Excl 19 — Domiciliary Dental Care.');
        doc.text('Excl 20 — General Exclusions Summary: hasOtherExclusions is TRUE.');
      }
    }

    // PAGES 29 to 30: Section 8 — Claims, Proportionate Deduction & Co-Payment
    addHeaderFooter(29, 'SECTION 8: CLAIMS & CO-PAY');
    doc.fontSize(12).fillColor('#0b4f6c').text('SECTION 8: CLAIMS ADJUDICATION & CO-PAYMENT SCHEDULE', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause 8.1 — Co-Payment Rules:');
    doc.text('• Base In-Network Co-Payment: A compulsory co-payment of 10% shall apply to each and every admissible claim under this policy. copay = 10%.');
    doc.text('• Non-Network Co-Payment: For treatments availed in Non-Network Hospitals on reimbursement basis, a co-payment of 20% shall apply. nonNetworkCopay = 20%.');
    doc.text('• Senior Citizen Co-Payment: An additional 10% co-payment applies if the insured is aged above 65 years at the date of admission.');
    doc.moveDown(0.8);
    doc.text('Clause 8.2 — Pre-Authorization & Intimation Timelines:');
    doc.text('• Planned Hospitalization: Pre-authorization request must be submitted at least 48 hours prior to admission.');
    doc.text('• Emergency Hospitalization: Claim intimation must be given within 24 hours of hospital admission.');
    doc.moveDown(0.8);
    doc.text('Clause 8.3 — Claim Documentation Submission:');
    doc.text('Final itemized hospital bill, discharge summary, pharmacy receipts, and investigation reports must be submitted within 30 days from discharge date.');

    addHeaderFooter(30, 'SECTION 8: CLAIMS (CONT.)');
    doc.fontSize(12).fillColor('#0b4f6c').text('SECTION 8: GRIEVANCE REDRESSAL & JURISDICTION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause 8.4 — Grievance Redressal Mechanism:');
    doc.text('In case of grievance, the Insured Person may contact the Grievance Redressal Officer at gro@starhealth.in or call toll-free 1800 425 2255.');
    doc.moveDown(0.8);
    doc.text('Clause 8.5 — Insurance Ombudsman:');
    doc.text('If the grievance is not resolved within 30 days, the insured may approach the Insurance Ombudsman having jurisdiction over the insured’s address.');
    doc.moveDown(0.8);
    doc.text('Clause 8.6 — Arbitration Clause:');
    doc.text('Any dispute regarding quantum of claim shall be referred to arbitration in accordance with the Arbitration and Conciliation Act, 1996.');

    // PAGES 31 to 32: Section 9 — Endorsement Amendment & Zone Allocation Rider
    addHeaderFooter(31, 'SECTION 9: ENDORSEMENTS');
    doc.fontSize(12).fillColor('#0b4f6c').text('SECTION 9: POLICY ENDORSEMENTS & AMENDMENT RIDERS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause 9.1 — Endorsement Reference: END-STAR-2026-001 (Zone Alignment Amendment)');
    doc.text('• Effective Date of Amendment: 2026-07-01');
    doc.text('• Prior Clause Superseded: Modifies Clause S.3 and Section 8.1 Geographic Zone rules.');
    doc.moveDown(0.5);
    doc.text(
      'AMENDMENT TERMS: With effect from 2026-07-01, the Insured Person having primary residence in Bengaluru is confirmed under Zone B. If treatment is availed in Zone A (Mumbai/Delhi NCR), an additional 10% co-payment shall apply, unless emergency accidental hospitalization occurs.'
    );
    doc.moveDown(0.8);
    doc.text('Clause 9.2 — Endorsement Reference: END-STAR-2026-002 (Cataract Sub-limit Enhancement)');
    doc.text('• Effective Date of Amendment: 2026-09-01');
    doc.text('• Prior Clause Superseded: Enhances Clause 5.1 Cataract Limit from Rs. 40,000 to Rs. 50,000 per eye upon payment of additional endorsement premium.');

    addHeaderFooter(32, 'SECTION 9: SIGNATURE & EXECUTION');
    doc.fontSize(12).fillColor('#0b4f6c').text('SECTION 9: EXECUTION & AUTHENTICATION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Clause 9.3 — Official Signatures & Seal:');
    doc.text('IN WITNESS WHEREOF, the Company has caused this Policy to be executed by its authorized signatory at Chennai on this 1st day of April, 2026.');
    doc.moveDown(1.5);
    doc.text('For and on behalf of STAR HEALTH AND ALLIED INSURANCE CO. LTD.');
    doc.moveDown(2);
    doc.text('Authorized Signatory: [Digital Signature Verified - IRDAI Registered]');
    doc.text('Date of Issue: 2026-04-01 | Place: Chennai, Tamil Nadu');
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#777777').text('END OF 32-PAGE MASTER POLICY CONTRACT WORDING', { align: 'center' });

    doc.end();
    writeStream.on('finish', () => resolve(filePath));
    writeStream.on('error', reject);
  });
}

/**
 * Generates an Endorsement Amendment Document (2 pages) representing a contractual amendment.
 */
export function generatePolicyEndorsementPdf(): Promise<string> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(outputDir, 'star_health_endorsement_amendment_2pp.pdf');
    const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: false });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Page 1
    doc.addPage();
    doc.fontSize(18).fillColor('#0b4f6c').text('STAR HEALTH AND ALLIED INSURANCE CO. LTD.', { align: 'center' });
    doc.fontSize(13).fillColor('#2E7D5B').text('POLICY ENDORSEMENT SCHEDULE — AMENDMENT CERTIFICATE', { align: 'center', underline: true });
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#000000');
    doc.text('Endorsement Number: END-STAR-2026-002');
    doc.text('Associated Base Policy: STAR-FHO-2026-889921');
    doc.text('Family ID: FAM-STAR-FHO-2026');
    doc.text('Insured: Rajesh Sharma & Family');
    doc.text('Effective Date of Endorsement: 2026-09-01 (Contractual Effective From: 2026-09-01)');
    doc.text('Document Type: ENDORSEMENT');
    doc.text('Amendment Scope: MODIFIES_SPECIFIC_CLAUSES');
    doc.moveDown(1);
    doc.fontSize(12).fillColor('#0b4f6c').text('CLAUSE MODIFICATION DETAILS:');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('1. Modification to Clause 5.1 (Cataract Surgery Sub-limit):');
    doc.text('   • Previous Stated Limit: Rs. 40,000 per eye');
    doc.text('   • NEW AMENDED LIMIT: Rs. 50,000 per eye (subLimits.cataract = 50000)');
    doc.text('   • Reason: Endorsement rider premium paid to enhance ophthalmic coverage.');
    doc.moveDown(1);
    doc.text('2. Modification to Section 8.1 (Co-payment for Senior Citizen):');
    doc.text('   • Previous Stated: 10% co-payment for aged above 65.');
    doc.text('   • NEW AMENDED: Senior citizen co-payment waived completely upon medical underwriting check.');

    // Page 2
    doc.addPage();
    doc.fontSize(12).fillColor('#0b4f6c').text('TERMS & CONDITIONS OF ENDORSEMENT', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    doc.text('1. All other terms, conditions, waiting periods and exclusions of the Base Policy STAR-FHO-2026-889921 remain unaltered.');
    doc.text('2. This endorsement forms an integral part of the policy contract and must be read in conjunction with the Base Policy wording.');
    doc.text('3. In the event of any conflict between this endorsement and the Base Policy wording, the terms of this endorsement shall prevail for all claims occurring on or after 2026-09-01.');
    doc.moveDown(2);
    doc.text('Signed for and on behalf of STAR HEALTH AND ALLIED INSURANCE CO. LTD.');
    doc.moveDown(1.5);
    doc.text('Authorized Underwriter: [Verified]');
    doc.text('Date of Endorsement Issuance: 2026-08-28');

    doc.end();
    writeStream.on('finish', () => resolve(filePath));
    writeStream.on('error', reject);
  });
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('generateFullPolicyPdfs.ts')) {
  Promise.all([generateFull32PagePolicyPdf(), generatePolicyEndorsementPdf()]).then(([p1, p2]) => {
    console.log(`Generated: ${p1}`);
    console.log(`Generated: ${p2}`);
  });
}
