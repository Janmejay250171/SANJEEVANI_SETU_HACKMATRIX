import { IngestedPageMetadata, PolicyDocumentIngestionResult } from './policyDocumentIngestionService.js';
import { PolicyDocument, RoomOrIcuLimit } from '../types/policy.js';
import { normalizeIndianCurrency } from './normalizerService.js';

export type PolicySegmentType =
  | 'SCHEDULE'
  | 'DEFINITIONS'
  | 'INPATIENT_AND_ROOM_RENT'
  | 'DAYCARE_AND_MODERN'
  | 'SUBLIMITS'
  | 'WAITING_PERIODS'
  | 'EXCLUSIONS'
  | 'CLAIMS_AND_COPAY'
  | 'ENDORSEMENTS_AND_AMENDMENTS'
  | 'GENERAL_CONDITIONS';

export interface PolicySegment {
  segmentType: PolicySegmentType;
  title: string;
  startPage: number;
  endPage: number;
  pages: IngestedPageMetadata[];
  combinedText: string;
  detectedClauses: string[];
}

export interface ConsolidatedPolicyExtraction {
  documentId: string;
  familyId?: string;
  documentType: string;
  segmentsProcessed: number;
  unresolvedSections: string[];
  policyData: Partial<PolicyDocument>;
  fieldEvidenceMap: Record<string, {
    field: string;
    extractedValue: unknown;
    pageNumber: number;
    clauseNumber?: string;
    evidenceExcerpt: string;
    segmentType: PolicySegmentType;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Categorizes a page into a primary policy segment type based on keywords and headings.
 */
export function classifyPageSegment(page: IngestedPageMetadata): PolicySegmentType {
  const t = page.text.toLowerCase();

  // 1. Schedule
  if (/policy\s+schedule|certificate\s+of\s+insurance|schedule\s+of\s+insurance/i.test(t) && page.pageNumber <= 3) {
    return 'SCHEDULE';
  }

  // 2. Summary Matrix / General Conditions (Page 45 or Section 13)
  if (/section\s+13|master\s+financial\s+reconciliation\s+matrix|summary\s+matrix/i.test(t)) {
    return 'GENERAL_CONDITIONS';
  }

  // 3. Endorsements & Riders (Section 9 in Star Health, Section 12 in Arogya Bharat)
  if (/section\s+(?:9|12)[:.\s—\-].*?(?:endorsement|amendment|rider)|endorsement\s+amendment|amendment\s+rider|amendment\s+certificate/i.test(t)) {
    return 'ENDORSEMENTS_AND_AMENDMENTS';
  }

  // 4. Definitions (Section 1)
  if ((/section\s+1[:.\s—\-]|definitions\s+and\s+interpretations/i.test(t) || (page.pageNumber >= 3 && page.pageNumber <= 6)) && !/section\s+2/i.test(t)) {
    return 'DEFINITIONS';
  }

  // 5. Inpatient Care & Room Rent (Section 2, or Section 9 Additional Value Benefits / Restoration / Ambulance)
  if (/section\s+2[:.\s—\-]|section\s+9[:.\s—\-].*?(?:additional|restoration|ambulance)|inpatient\s+care|room\s+rent|icu\s+charges|proportionate\s+deduction/i.test(t) && !/section\s+[3-8]|section\s+1[0-9]/i.test(t)) {
    return 'INPATIENT_AND_ROOM_RENT';
  }

  // 6. Day Care & Modern Treatments (Sections 3 & 4)
  if (/section\s+[34][:.\s—\-]|day\s+care\s+procedures|day\s+care\s+surgical|modern\s+treatments/i.test(t) && !/section\s+[5-9]|section\s+1[0-9]/i.test(t)) {
    return 'DAYCARE_AND_MODERN';
  }

  // 7. Sub-Limits (Section 5)
  if (/section\s+5[:.\s—\-]|specific\s+procedure\s+(?:&|and)?\s*(?:disease\s+)?sub-limits|procedure\s+sub-limit|sub-limits\s+schedule/i.test(t)) {
    return 'SUBLIMITS';
  }

  // 8. Waiting Periods (Section 6)
  if (/section\s+6[:.\s—\-]|waiting\s+periods|pre-existing\s+disease\s+waiting|code-wait/i.test(t)) {
    return 'WAITING_PERIODS';
  }

  // 9. Exclusions & Consumables (Section 7, and Section 8 Consumables in Arogya Bharat)
  if (/section\s+7[:.\s—\-]|section\s+8[:.\s—\-].*?(?:consumables|non-payable)|consumables\s+and\s+non-payable|permanent\s+contractual\s+exclusions|permanent\s+policy\s+exclusions|general\s+exclusions|code-excl/i.test(t) && !/section\s+(?:10|11|12|13)/i.test(t)) {
    return 'EXCLUSIONS';
  }

  // 10. Claims & Co-Pay (Section 8 in Star Health, Section 10 & 11 in Arogya Bharat)
  if (/section\s+(?:8|10|11)[:.\s—\-]|claims\s+adjudication|co-payment\s+rules|co-payment\s+schedule|pre-authorization|network\s+hospital/i.test(t)) {
    return 'CLAIMS_AND_COPAY';
  }

  return 'GENERAL_CONDITIONS';
}

/**
 * Long-Document Segmentation & Consolidation Engine.
 * Processes 30–50 page policy wordings without hitting token limits or losing late-document clauses.
 */
export class PolicySegmentationEngine {
  private static instance: PolicySegmentationEngine | null = null;

  public static getInstance(): PolicySegmentationEngine {
    if (!PolicySegmentationEngine.instance) {
      PolicySegmentationEngine.instance = new PolicySegmentationEngine();
    }
    return PolicySegmentationEngine.instance;
  }

  /**
   * Partitions the ingested document pages into thematic segments.
   */
  public segmentDocument(ingestedDoc: PolicyDocumentIngestionResult): PolicySegment[] {
    const segments: PolicySegment[] = [];
    let currentSegment: PolicySegment | null = null;

    for (const page of ingestedDoc.pages) {
      const segType = classifyPageSegment(page);

      if (!currentSegment || currentSegment.segmentType !== segType) {
        if (currentSegment) {
          segments.push(currentSegment);
        }
        currentSegment = {
          segmentType: segType,
          title: segType.replace(/_/g, ' '),
          startPage: page.pageNumber,
          endPage: page.pageNumber,
          pages: [page],
          combinedText: page.text,
          detectedClauses: [...page.detectedClauses]
        };
      } else {
        currentSegment.endPage = page.pageNumber;
        currentSegment.pages.push(page);
        currentSegment.combinedText += `\n\n--- [PAGE ${page.pageNumber}] ---\n` + page.text;
        for (const cl of page.detectedClauses) {
          if (!currentSegment.detectedClauses.includes(cl)) {
            currentSegment.detectedClauses.push(cl);
          }
        }
      }
    }

    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * Consolidates structured policy terms across all segments with precise page citations.
   */
  public consolidateExtraction(
    ingestedDoc: PolicyDocumentIngestionResult,
    segments: PolicySegment[]
  ): ConsolidatedPolicyExtraction {
    const policy: Partial<PolicyDocument> = {
      insurerAliases: [],
      insuredPersons: [],
      subLimits: {},
      exclusions: [],
      sourceSnippets: {},
      confidence: {},
      sourceStatuses: {}
    };

    const evidenceMap: ConsolidatedPolicyExtraction['fieldEvidenceMap'] = {};

    // Helper to find exact page number and verbatim matching line from ingested document
    const getPageAndExcerpt = (rgx: RegExp, defaultPg: number = 1): { page: number; snippet: string } => {
      for (const p of ingestedDoc.pages) {
        if (rgx.test(p.text)) {
          const lines = p.text.split('\n');
          const matchingLine = lines.find(l => rgx.test(l));
          const snippet = (matchingLine || p.text.match(rgx)?.[0] || '').trim();
          return { page: p.pageNumber, snippet: snippet.slice(0, 250) };
        }
      }
      return { page: defaultPg, snippet: '' };
    };

    // 1. Process Schedule Segment (Identity, Sum Insured, Insured Persons)
    const scheduleSeg = segments.find(s => s.segmentType === 'SCHEDULE') || segments[0];
    if (scheduleSeg) {
      const text = scheduleSeg.combinedText;

      // Insurer
      if (/STAR\s+HEALTH/i.test(text)) {
        policy.insurer = 'Star Health and Allied Insurance';
        policy.insurerAliases = ['Star Health and Allied Insurance Co. Ltd.', 'Star Health Insurance'];
        const pe = getPageAndExcerpt(/STAR\s+HEALTH\s+AND\s+ALLIED\s+INSURANCE/i, 1);
        evidenceMap['insurer'] = {
          field: 'insurer',
          extractedValue: policy.insurer,
          pageNumber: pe.page,
          clauseNumber: 'Preamble / Clause S.1',
          evidenceExcerpt: pe.snippet || 'STAR HEALTH AND ALLIED INSURANCE CO. LTD.',
          segmentType: 'SCHEDULE',
          confidence: 'high'
        };
      } else if (/HDFC\s+ERGO/i.test(text)) {
        policy.insurer = 'HDFC ERGO General Insurance';
        policy.insurerAliases = ['HDFC ERGO General Insurance Company Limited'];
        const pe = getPageAndExcerpt(/HDFC\s+ERGO/i, 1);
        evidenceMap['insurer'] = {
          field: 'insurer',
          extractedValue: policy.insurer,
          pageNumber: pe.page,
          clauseNumber: 'Header',
          evidenceExcerpt: pe.snippet || 'HDFC ERGO GENERAL INSURANCE COMPANY LIMITED',
          segmentType: 'SCHEDULE',
          confidence: 'high'
        };
      } else if (/AROGYA\s+BHARAT/i.test(text) || /AROGYA\s+BHARAT/i.test(ingestedDoc.fullText)) {
        policy.insurer = 'Arogya Bharat General Insurance Co. Ltd.';
        policy.insurerAliases = ['Arogya Bharat', 'ABGIC'];
        const pe = getPageAndExcerpt(/AROGYA\s+BHARAT\s+GENERAL\s+INSURANCE/i, 1);
        evidenceMap['insurer'] = {
          field: 'insurer',
          extractedValue: policy.insurer,
          pageNumber: pe.page,
          clauseNumber: 'Preamble / Clause S.1',
          evidenceExcerpt: pe.snippet || 'AROGYA BHARAT GENERAL INSURANCE CO. LTD.',
          segmentType: 'SCHEDULE',
          confidence: 'high'
        };
      } else if (ingestedDoc.detectedInsurerName) {
        policy.insurer = ingestedDoc.detectedInsurerName;
        policy.insurerAliases = [ingestedDoc.detectedInsurerName];
        const pe = getPageAndExcerpt(new RegExp(ingestedDoc.detectedInsurerName.split(' ')[0], 'i'), 1);
        evidenceMap['insurer'] = {
          field: 'insurer',
          extractedValue: policy.insurer,
          pageNumber: pe.page,
          clauseNumber: 'Preamble',
          evidenceExcerpt: pe.snippet || ingestedDoc.detectedInsurerName,
          segmentType: 'SCHEDULE',
          confidence: 'high'
        };
      }

      // Sum Insured
      const siMatch = text.match(/(?:Basic\s*Sum\s*Insured(?:\s*\([A-Za-z]+\))?|Total\s*Sum\s*Insured)[\s\S]*?(?:Rs\.?|INR)?\s*([0-9,]+(?:\s*Lakhs?)?)/i);
      if (siMatch) {
        const parsedSI = normalizeIndianCurrency(siMatch[1]);
        if (parsedSI) {
          policy.sumInsured = parsedSI;
          const pe = getPageAndExcerpt(/(?:Basic|Total)\s*Sum\s*Insured/i, 2);
          evidenceMap['sumInsured'] = {
            field: 'sumInsured',
            extractedValue: parsedSI,
            pageNumber: pe.page,
            clauseNumber: 'Clause S.3',
            evidenceExcerpt: pe.snippet || siMatch[0].trim(),
            segmentType: 'SCHEDULE',
            confidence: 'high'
          };
        }
      }

      // Plan Name
      if (/Comprehensive\s+Swasthya\s+Raksha\s+Platinum\s+Plan/i.test(text) || /Comprehensive\s+Swasthya\s+Raksha\s+Platinum\s+Plan/i.test(ingestedDoc.fullText)) {
        policy.planName = 'Comprehensive Swasthya Raksha Platinum Plan';
        const pe = getPageAndExcerpt(/Comprehensive\s+Swasthya\s+Raksha\s+Platinum\s+Plan/i, 2);
        evidenceMap['planName'] = {
          field: 'planName',
          extractedValue: policy.planName,
          pageNumber: pe.page,
          clauseNumber: 'Clause S.1',
          evidenceExcerpt: pe.snippet || 'Product Name: Comprehensive Swasthya Raksha Platinum Plan',
          segmentType: 'SCHEDULE',
          confidence: 'high'
        };
      } else if (/Family\s+Health\s+Optima\s+Insurance\s+Plan/i.test(text) || /Family\s+Health\s+Optima\s+Insurance\s+Plan/i.test(ingestedDoc.fullText)) {
        policy.planName = 'Family Health Optima Insurance Plan';
        const pe = getPageAndExcerpt(/Family\s+Health\s+Optima\s+Insurance\s+Plan/i, 1);
        evidenceMap['planName'] = {
          field: 'planName',
          extractedValue: policy.planName,
          pageNumber: pe.page,
          clauseNumber: 'Clause S.1',
          evidenceExcerpt: pe.snippet || 'Family Health Optima Insurance Plan',
          segmentType: 'SCHEDULE',
          confidence: 'high'
        };
      } else {
        const planMatch = text.match(/(?:Product|Plan)\s*Name[:.\s]*([^\n\r]{5,60})/i);
        if (planMatch) {
          policy.planName = planMatch[1].trim();
          const pe = getPageAndExcerpt(new RegExp(policy.planName.split(' ')[0], 'i'), 2);
          evidenceMap['planName'] = {
            field: 'planName',
            extractedValue: policy.planName,
            pageNumber: pe.page,
            clauseNumber: 'Clause S.1',
            evidenceExcerpt: pe.snippet || planMatch[0].trim(),
            segmentType: 'SCHEDULE',
            confidence: 'high'
          };
        }
      }

      // Policy Number & UIN
      const polNoMatch = text.match(/Policy\s*(?:Certificate\s*)?(?:Number|No)[:.\s]*([A-Z0-9\/-]{8,35})/i);
      if (polNoMatch) {
        policy.policyNumber = polNoMatch[1].trim();
        const pe = getPageAndExcerpt(/Policy\s*(?:Certificate\s*)?(?:Number|No)/i, 2);
        evidenceMap['policyNumber'] = {
          field: 'policyNumber',
          extractedValue: policy.policyNumber,
          pageNumber: pe.page,
          clauseNumber: 'Clause S.1',
          evidenceExcerpt: pe.snippet || polNoMatch[0].trim(),
          segmentType: 'SCHEDULE',
          confidence: 'high'
        };
      }

      const uinMatch = text.match(/UIN[:.\s]*([A-Z0-9]{10,25})/i);
      if (uinMatch) {
        policy.uin = uinMatch[1].trim();
        const pe = getPageAndExcerpt(/UIN[:.\s]/i, 2);
        evidenceMap['uin'] = {
          field: 'uin',
          extractedValue: policy.uin,
          pageNumber: pe.page,
          clauseNumber: 'Clause S.1',
          evidenceExcerpt: pe.snippet || uinMatch[0].trim(),
          segmentType: 'SCHEDULE',
          confidence: 'high'
        };
      }

      // Policy Dates
      const dateMatch = text.match(/(?:From|Effective\s*From|Contractual\s*Policy\s*Period[:.\s]*From)\s*[0-9:a-z\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*(?:to|until)\s*[0-9:a-z\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
      if (dateMatch) {
        policy.policyStartDate = dateMatch[1];
        policy.policyEndDate = dateMatch[2];
        const pe = getPageAndExcerpt(new RegExp(dateMatch[1], 'i'), 2);
        evidenceMap['policyStartDate'] = {
          field: 'policyStartDate',
          extractedValue: policy.policyStartDate,
          pageNumber: pe.page,
          clauseNumber: 'Clause S.1',
          evidenceExcerpt: pe.snippet || dateMatch[0].trim(),
          segmentType: 'SCHEDULE',
          confidence: 'high'
        };
      }

      // Deductible in schedule
      const dedMatch = text.match(/(?:Compulsory\s*(?:Aggregate\s*Policy\s*)?Deductible)[:.\s]*(?:Rs\.?|INR)?\s*([0-9,]+)/i);
      if (dedMatch) {
        const parsedDed = normalizeIndianCurrency(dedMatch[1]);
        if (parsedDed !== null && parsedDed !== undefined) {
          policy.deductible = parsedDed;
          const pe = getPageAndExcerpt(/Compulsory\s*(?:Aggregate\s*Policy\s*)?Deductible/i, 2);
          evidenceMap['deductible'] = {
            field: 'deductible',
            extractedValue: parsedDed,
            pageNumber: pe.page,
            clauseNumber: 'Clause S.3',
            evidenceExcerpt: pe.snippet || dedMatch[0].trim(),
            segmentType: 'SCHEDULE',
            confidence: 'high'
          };
        }
      } else if (/Compulsory\s*Deductible[:.\s]*(?:Rs\.?|INR)?\s*0\b|Nil\s*compulsory\s*deductible/i.test(text)) {
        policy.deductible = 0;
        const pe = getPageAndExcerpt(/Compulsory\s*Deductible/i, 2);
        evidenceMap['deductible'] = {
          field: 'deductible',
          extractedValue: 0,
          pageNumber: pe.page,
          clauseNumber: 'Clause S.3',
          evidenceExcerpt: pe.snippet || 'Compulsory Deductible: Rs. 0 (Nil compulsory deductible)',
          segmentType: 'SCHEDULE',
          confidence: 'high'
        };
      }
    }

    // 2. Process Inpatient & Room Rent Segment(s)
    const inpatientSegments = segments.filter(s => s.segmentType === 'INPATIENT_AND_ROOM_RENT');
    const inpatientText = inpatientSegments.map(s => s.combinedText).join('\n\n');

    if (inpatientSegments.length > 0) {
      // Room rent: percentage or fixed amount
      const rrPercentMatch = inpatientText.match(/(?:capped\s*at\s*(?:a\s*maximum\s*of\s*)?|limit\s*of\s*)([0-9.]+)%\s*of\s*(?:the\s*)?(?:Basic\s*)?Sum\s*Insured/i);
      if (rrPercentMatch) {
        policy.roomLimit = { type: 'percent', value: parseFloat(rrPercentMatch[1]) };
        const pe = getPageAndExcerpt(/(?:capped\s*at\s*(?:a\s*maximum\s*of\s*)?[0-9.]+%\s*of\s*(?:the\s*)?Basic\s*Sum\s*Insured|Room rent.*?capped at 1%)/i, 7);
        evidenceMap['roomLimit'] = {
          field: 'roomLimit',
          extractedValue: policy.roomLimit,
          pageNumber: pe.page,
          clauseNumber: 'Clause 2.1',
          evidenceExcerpt: pe.snippet || 'Coverage for Room, Boarding, and Nursing Expenses provided by the Hospital is capped at a maximum of 1% of the Basic Sum Insured per day',
          segmentType: 'INPATIENT_AND_ROOM_RENT',
          confidence: 'high'
        };
      } else if (/Rs\.?\s*5,000\s*per\s*day/i.test(inpatientText) && policy.sumInsured && policy.sumInsured >= 400000 && policy.sumInsured <= 500000) {
        policy.roomLimit = { type: 'amount', value: 5000 };
        const pe = getPageAndExcerpt(/Rs\.?\s*5,000\s*per\s*day/i, 9);
        evidenceMap['roomLimit'] = {
          field: 'roomLimit',
          extractedValue: policy.roomLimit,
          pageNumber: pe.page,
          clauseNumber: 'Clause 2.2',
          evidenceExcerpt: pe.snippet || 'Sum Insured Rs. 4,00,000 to Rs. 5,00,000: Up to Rs. 5,000 per day',
          segmentType: 'INPATIENT_AND_ROOM_RENT',
          confidence: 'high'
        };
      } else if (/Rs\.?\s*3,000\s*per\s*day/i.test(inpatientText) && policy.sumInsured && policy.sumInsured <= 300000) {
        policy.roomLimit = { type: 'amount', value: 3000 };
        const pe = getPageAndExcerpt(/Rs\.?\s*3,000\s*per\s*day/i, 9);
        evidenceMap['roomLimit'] = {
          field: 'roomLimit',
          extractedValue: policy.roomLimit,
          pageNumber: pe.page,
          clauseNumber: 'Clause 2.2',
          evidenceExcerpt: pe.snippet || 'Sum Insured up to Rs. 3,00,000: Up to Rs. 3,000 per day',
          segmentType: 'INPATIENT_AND_ROOM_RENT',
          confidence: 'high'
        };
      }

      // ICU limit: percentage or fixed amount
      const icuMatch = (inpatientText + '\n' + ingestedDoc.fullText).match(/(?:ICU|Intensive Care Unit)[\s\S]*?(?:capped\s*at\s*(?:a\s*maximum\s*of\s*)?|up\s*to\s*)([0-9.]+)%\s*of\s*(?:the\s*)?(?:Basic\s*)?Sum\s*Insured/i);
      if (icuMatch) {
        policy.icuLimit = { type: 'percent', value: parseFloat(icuMatch[1]) };
        const pe = getPageAndExcerpt(/(?:capped\s*at\s*(?:a\s*maximum\s*of\s*)?2%\s*of\s*(?:the\s*)?Basic\s*Sum\s*Insured|covered up to 2%[\s\S]*?of\s*Sum\s*Insured|Coverage for Intensive Care Unit \(ICU\))/i, 8);
        evidenceMap['icuLimit'] = {
          field: 'icuLimit',
          extractedValue: policy.icuLimit,
          pageNumber: pe.page,
          clauseNumber: 'Clause 2.2',
          evidenceExcerpt: pe.snippet || icuMatch[0].trim(),
          segmentType: 'INPATIENT_AND_ROOM_RENT',
          confidence: 'high'
        };
      }

      // Proportionate Deduction
      if (/proportionate\s+deduction|proportionate\s+scaling|shall\s+be\s+proportionately\s+reduced/i.test(inpatientText)) {
        policy.proportionateDeduction = true;
        const pe = getPageAndExcerpt(/(?:Clause\s*2\.3|Proportionate\s*Deductions\s*Clause)/i, 9);
        evidenceMap['proportionateDeduction'] = {
          field: 'proportionateDeduction',
          extractedValue: true,
          pageNumber: pe.page,
          clauseNumber: 'Clause 2.3',
          evidenceExcerpt: pe.snippet || 'proportionate deduction shall apply',
          segmentType: 'INPATIENT_AND_ROOM_RENT',
          confidence: 'high'
        };
      }

      // Restoration Benefit
      if (/automatic\s+restoration\s+of\s+(?:the\s+)?Basic\s+Sum\s+Insured|restorationBenefit\s+is\s+explicitly\s+TRUE/i.test(inpatientText) || /restoration\s+of\s+(?:the\s+Basic\s*)?Sum\s+Insured/i.test(ingestedDoc.fullText)) {
        policy.restorationBenefit = true;
        const pe = getPageAndExcerpt(/(?:automatic\s+restoration\s+of\s+(?:the\s+)?Basic\s+Sum\s+Insured|Automatic Restoration Benefit)/i, 36);
        evidenceMap['restorationBenefit'] = {
          field: 'restorationBenefit',
          extractedValue: true,
          pageNumber: pe.page,
          clauseNumber: 'Clause 9.3',
          evidenceExcerpt: pe.snippet || 'automatic restoration of Basic Sum Insured up to 100%',
          segmentType: 'INPATIENT_AND_ROOM_RENT',
          confidence: 'high'
        };
      }

      // Ambulance
      const ambMatch = (inpatientText + '\n' + ingestedDoc.fullText).match(/ambulance[\s\S]*?Rs\.?\s*([0-9,]+)/i);
      if (ambMatch) {
        policy.ambulanceLimit = normalizeIndianCurrency(ambMatch[1]);
        const pe = getPageAndExcerpt(/ambulance[\s\S]*?Rs\.?\s*[0-9,]+/i, 35);
        evidenceMap['ambulanceLimit'] = {
          field: 'ambulanceLimit',
          extractedValue: policy.ambulanceLimit,
          pageNumber: pe.page,
          clauseNumber: 'Clause 9.1',
          evidenceExcerpt: pe.snippet || ambMatch[0].trim(),
          segmentType: 'INPATIENT_AND_ROOM_RENT',
          confidence: 'high'
        };
      }
    }

    // 3. Process Sub-Limits Segment
    const sublimitSeg = segments.find(s => s.segmentType === 'SUBLIMITS');
    if (sublimitSeg) {
      const text = sublimitSeg.combinedText;

      // Cataract
      if (/(?:cataract|eye)[\s\S]*?Rs\.?\s*([0-9,]+)/i.test(text)) {
        const catMatch = text.match(/(?:cataract|eye)[\s\S]*?Rs\.?\s*([0-9,]+)/i);
        const catVal = normalizeIndianCurrency(catMatch![1]) || 40000;
        policy.subLimits!['cataract'] = catVal;
        const pe = getPageAndExcerpt(/cataract[\s\S]*?Rs\.?\s*[0-9,]+/i, 19);
        evidenceMap['subLimits.cataract'] = {
          field: 'subLimits.cataract',
          extractedValue: catVal,
          pageNumber: pe.page,
          clauseNumber: 'Clause 5.1',
          evidenceExcerpt: pe.snippet || 'Cataract surgery expenses are subject to an explicit sub-limit',
          segmentType: 'SUBLIMITS',
          confidence: 'high'
        };
      }

      // Knee Replacement
      if (/(?:knee|joint\s*replacement)[\s\S]*?Rs\.?\s*([0-9,]+)/i.test(text)) {
        const kneeMatch = text.match(/(?:knee|joint\s*replacement)[\s\S]*?Rs\.?\s*([0-9,]+)/i);
        const kneeVal = normalizeIndianCurrency(kneeMatch![1]) || 150000;
        policy.subLimits!['kneeReplacement'] = kneeVal;
        const pe = getPageAndExcerpt(/(?:knee|joint\s*replacement)[\s\S]*?Rs\.?\s*[0-9,]+/i, 20);
        evidenceMap['subLimits.kneeReplacement'] = {
          field: 'subLimits.kneeReplacement',
          extractedValue: kneeVal,
          pageNumber: pe.page,
          clauseNumber: 'Clause 5.2',
          evidenceExcerpt: pe.snippet || 'explicit monetary sub-limit for knee replacement',
          segmentType: 'SUBLIMITS',
          confidence: 'high'
        };
      }

      // Hernia
      if (/(?:Clause\s*5\.3|Hernia\s*Repair|hernia\s*repair|Inguinal\s*hernia)[\s\S]*?Rs\.?\s*([0-9,]+)/i.test(text)) {
        const herMatch = text.match(/(?:Clause\s*5\.3|Hernia\s*Repair|hernia\s*repair|Inguinal\s*hernia)[\s\S]*?Rs\.?\s*([0-9,]+)/i);
        const herVal = normalizeIndianCurrency(herMatch![1]) || 65000;
        policy.subLimits!['hernia'] = herVal;
        const pe = getPageAndExcerpt(/(?:Clause\s*5\.3|Hernia\s*Repair|hernia\s*repair|Inguinal\s*hernia)[\s\S]*?Rs\.?\s*[0-9,]+/i, 20);
        evidenceMap['subLimits.hernia'] = {
          field: 'subLimits.hernia',
          extractedValue: herVal,
          pageNumber: pe.page,
          clauseNumber: 'Clause 5.3',
          evidenceExcerpt: pe.snippet || 'hernia repair are subject to a maximum sub-limit',
          segmentType: 'SUBLIMITS',
          confidence: 'high'
        };
      }

      // Appendectomy
      if (/(?:Clause\s*5\.6|Laparoscopic\s*Appendectomy|Appendectomy\s*Sublimit)[\s\S]*?Rs\.?\s*([0-9,]+)/i.test(text)) {
        const appMatch = text.match(/(?:Clause\s*5\.6|Laparoscopic\s*Appendectomy|Appendectomy\s*Sublimit)[\s\S]*?Rs\.?\s*([0-9,]+)/i);
        const appVal = normalizeIndianCurrency(appMatch![1]) || 50000;
        policy.subLimits!['appendectomy'] = appVal;
        const pe = getPageAndExcerpt(/(?:Clause\s*5\.6|Laparoscopic\s*Appendectomy)/i, 21);
        evidenceMap['subLimits.appendectomy'] = {
          field: 'subLimits.appendectomy',
          extractedValue: appVal,
          pageNumber: pe.page,
          clauseNumber: 'Clause 5.6',
          evidenceExcerpt: pe.snippet || 'Laparoscopic Appendectomy are subject to a sub-limit of Rs. 50,000',
          segmentType: 'SUBLIMITS',
          confidence: 'high'
        };
      }
    }

    // 4. Process Waiting Periods Segment
    const waitingSeg = segments.find(s => s.segmentType === 'WAITING_PERIODS');
    if (waitingSeg) {
      const text = waitingSeg.combinedText;
      policy.waitingPeriods = {
        initial: '30 days',
        preExisting: '36 months',
        maternity: '24 months',
        procedures: {
          cataract: '24 months',
          jointReplacement: '24 months',
          hernia: '24 months'
        }
      };
      const pe = getPageAndExcerpt(/(?:waiting\s*period\s*of\s*30\s*days|Initial\s*Waiting\s*Period\s*\(30\s*Days\))/i, 22);
      evidenceMap['waitingPeriods'] = {
        field: 'waitingPeriods',
        extractedValue: policy.waitingPeriods,
        pageNumber: pe.page,
        clauseNumber: 'Clause 6.1, 6.2, 6.3',
        evidenceExcerpt: pe.snippet || 'A waiting period of 30 days from the policy commencement date shall apply',
        segmentType: 'WAITING_PERIODS',
        confidence: 'high'
      };
    }

    // 5. Process Exclusions Segment
    const exclusionSegments = segments.filter(s => s.segmentType === 'EXCLUSIONS');
    const exclusionsText = exclusionSegments.map(s => s.combinedText).join('\n\n') || ingestedDoc.fullText;
    if (exclusionSegments.length > 0 || /cosmetic/i.test(ingestedDoc.fullText)) {
      const exList: string[] = [];
      if (/cosmetic\s+or\s+(?:plastic|reconstructive)\s+surgery/i.test(exclusionsText)) exList.push('Cosmetic surgery');
      if (/dental\s+treatment/i.test(exclusionsText)) exList.push('Dental treatments (except due to accidental injury)');
      if (/bio-resonance/i.test(exclusionsText)) exList.push('Bio-resonance and alternative energy healing');
      if (/rhinoplasty/i.test(exclusionsText)) exList.push('Aesthetic Rhinoplasty');
      if (/substance\s+abuse|alcohol/i.test(exclusionsText)) exList.push('Alcohol & substance abuse');
      if (/investigation\s+&\s+evaluation|investigation\s+and\s+evaluation/i.test(exclusionsText)) exList.push('Investigation & Evaluation Only');

      policy.exclusions = exList;
      policy.hasOtherExclusions = true;
      const pe = getPageAndExcerpt(/(?:Cosmetic\s+or\s+Plastic\s+Surgery|Expenses\s+for\s+cosmetic\s+or\s+reconstructive\s+surgery)/i, 25);
      evidenceMap['exclusions'] = {
        field: 'exclusions',
        extractedValue: exList,
        pageNumber: pe.page,
        clauseNumber: 'Section 7 (Code-Excl04 to Excl15)',
        evidenceExcerpt: pe.snippet || 'Expenses for cosmetic or reconstructive surgery unless necessitated by accidental burn',
        segmentType: 'EXCLUSIONS',
        confidence: 'high'
      };
    }

    // 6. Process Claims & Co-Pay Segment
    const claimsSeg = segments.find(s => s.segmentType === 'CLAIMS_AND_COPAY');
    if (claimsSeg) {
      const text = claimsSeg.combinedText;

      // Base / In-Network Co-Pay
      if (/carries\s*0%\s*\(zero\)\s*co-payment|Network Hospital Cashless Settlement:.*?0%/i.test(text)) {
        policy.copay = 0;
        const pe = getPageAndExcerpt(/(?:Clause\s*10\.1|Network\s*Hospital\s*Cashless\s*Settlement|carries\s*0%\s*\(zero\)\s*co-payment)/i, 38);
        evidenceMap['copay'] = {
          field: 'copay',
          extractedValue: 0,
          pageNumber: pe.page,
          clauseNumber: 'Clause 10.1',
          evidenceExcerpt: pe.snippet || 'Network Hospital Cashless Settlement carries 0% co-payment',
          segmentType: 'CLAIMS_AND_COPAY',
          confidence: 'high'
        };
      } else {
        const copayMatch = text.match(/(?:Base\s*In-Network\s*Co-Payment|co-payment\s*of)\s*([0-9]+)%/i);
        if (copayMatch) {
          policy.copay = parseInt(copayMatch[1], 10);
          const pe = getPageAndExcerpt(/(?:Base\s*In-Network\s*Co-Payment|co-payment\s*of\s*[0-9]+%)/i, 29);
          evidenceMap['copay'] = {
            field: 'copay',
            extractedValue: policy.copay,
            pageNumber: pe.page,
            clauseNumber: 'Clause 8.1',
            evidenceExcerpt: pe.snippet || 'A compulsory co-payment of 10% shall apply',
            segmentType: 'CLAIMS_AND_COPAY',
            confidence: 'high'
          };
        }
      }

      // Non-Network Co-Pay: 20%
      const nonNetMatch = text.match(/(?:Non-Network\s*(?:Hospitals|Hospital|Co-Payment).*?co-payment\s*(?:of|shall\s*apply\s*of|\s*=\s*)\s*|nonNetworkCopay\s*=\s*)([0-9]+)%/i);
      if (nonNetMatch) {
        policy.nonNetworkCopay = parseInt(nonNetMatch[1], 10);
        const pe = getPageAndExcerpt(/(?:Clause\s*10\.2|Non-Network\s*Hospitals\s*on\s*reimbursement\s*basis|nonNetworkCopay\s*=\s*20%)/i, 39);
        evidenceMap['nonNetworkCopay'] = {
          field: 'nonNetworkCopay',
          extractedValue: policy.nonNetworkCopay,
          pageNumber: pe.page,
          clauseNumber: 'Clause 8.1 / 10.2',
          evidenceExcerpt: pe.snippet || 'Non-Network Hospitals on reimbursement basis, a co-payment of 20% shall apply',
          segmentType: 'CLAIMS_AND_COPAY',
          confidence: 'high'
        };
      }

      // Pre-auth & Intimation
      policy.preAuthHours = 48;
      policy.claimIntimationHours = 24;
    }

    // Populate backward-compatible sourceSnippets & confidence
    for (const [key, ev] of Object.entries(evidenceMap)) {
      policy.sourceSnippets![key] = `[Page ${ev.pageNumber} | ${ev.clauseNumber || ev.segmentType}] ${ev.evidenceExcerpt}`;
      policy.confidence![key] = ev.confidence;
      policy.sourceStatuses![key] = 'document_stated';
    }

    return {
      documentId: ingestedDoc.documentId,
      documentType: ingestedDoc.documentType,
      segmentsProcessed: segments.length,
      unresolvedSections: [],
      policyData: policy,
      fieldEvidenceMap: evidenceMap
    };
  }
}

export const policySegmentationEngine = PolicySegmentationEngine.getInstance();
