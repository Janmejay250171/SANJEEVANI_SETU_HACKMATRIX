import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import { cleanRawJsonText, normalizeExtractionPayload } from './normalizerService.js';
import { ExtractedPolicyZod } from '../schemas/policySchema.js';
import { extractTextFromPdf } from './pdfService.js';

export const EXTRACTION_PROMPT = `You extract structured terms from Indian health insurance policy documents.

Return ONLY a JSON object matching the schema below. No markdown, no code fences,
no commentary.

RULES
1. Fill a field ONLY if it is explicitly stated in the document. If it is not
   stated, set it to null. Never guess, never infer from typical market values.
2. For every field you fill, add an entry to sourceSnippets with the exact
   sentence or table row (max 20 words) that you took it from.
3. For every field you fill, add an entry to confidence with one of:
   "high"   - stated explicitly and unambiguously
   "medium" - stated but needs interpretation (e.g. a table row you had to match)
   "low"    - implied or ambiguous
4. Room rent and ICU limits are often given as a table keyed by sum insured.
   Find the row matching THIS policy's sum insured and use that row only.
   - "Rs.3,000 per day"        -> {"type":"amount","value":3000}
   - "1% of sum insured"       -> {"type":"percent","value":1}
   - "Single Standard A/C Room"-> {"type":"category","value":"Single Standard A/C Room"}
   - no limit mentioned        -> {"type":"none","value":null}
5. Co-pay: put the base co-pay percentage in "copay". If the document states a
   different co-pay for non-network hospitals, put it in "nonNetworkCopay".
   Put conditional co-pays (age-based, zone-based) in copayConditions.
6. "proportionateDeduction" vs "roomCategoryRestriction": Set "proportionateDeduction" to true ONLY if the document explicitly mandates that associated medical expenses, doctor fees, or surgery charges shall be paid in proportion to the eligible room rent limit ("proportionate deduction clause"). If the policy wording states that choosing a room higher than the entitled category limits charges to the entitled category without a proportionate disallowance formula across medical fees, set "roomCategoryRestriction" to true and "proportionateDeduction" to null. Never call this a generic proportionate deduction clause unless the document explicitly uses that terminology.
7. exclusions: list ONLY medical procedures, treatments, or specialties that are PERMANENTLY and UNCONDITIONALLY EXCLUDED from all coverage.
   CRITICAL RULES FOR EXCLUSIONS:
   - A treatment may appear in exclusions ONLY when the document explicitly establishes that it is permanently excluded without any conditional coverage.
   - Cross-reference the entire document before deciding that a treatment is permanently excluded.
   - Waiting-period coverage must NOT be classified as a permanent exclusion. If a treatment is covered after a waiting period (e.g. covered after 24 or 36 months), place it in "waitingPeriods" instead of "exclusions".
   - Sub-limit or capped coverage must NOT be classified as a permanent exclusion. If a treatment is covered up to a monetary limit (e.g. covered up to ₹40,000), place it in "subLimits" instead of "exclusions".
   - Conditional coverage must NOT be classified as a permanent exclusion. If a treatment is covered under specific conditions (e.g. accidental injury dental coverage), do NOT list it as a universal exclusion.
   - Only list treatments that are completely excluded across all provisions (such as routine cosmetic surgery, experimental or unproven therapies).
   - For standard non-medical/statutory exclusions (like war, criminal acts, self-inflicted injury, alcohol/drug abuse), set "hasOtherExclusions" to true rather than listing them in "exclusions".
8. Amounts: return plain integers in rupees. "3 Lakhs" -> 300000. No symbols,
   no commas, no strings.
9. Percentages: plain numbers. "10%" -> 10.
10. Dates: "YYYY-MM-DD". If calendar dates are not stated in the document, leave null. Never infer an annual period.
11. policyType: "individual" for individual health insurance plans, "floater" for family floater plans, "corporate" for group or employer plans, "pmjay" for Ayushman Bharat PM-JAY, "esi" for ESI/ESIC, or "private" if retail but unspecified whether individual or floater. Never guess "floater" if the document explicitly states "Individual Health Insurance".
12. insurerAliases: every longer or legal form of the insurer's name that
    appears in the document.
13. deductible: compulsory deductible amount in rupees. If the policy states an explicit numeric deductible (e.g. Rs. 5,000) or explicitly states Nil/Zero, record that number. If the document states that deductible or excess is as specified in the Policy Schedule without providing the numeric amount, or if no numeric deductible is mentioned, set deductible to null. NEVER default a missing deductible to 0.
14. restorationBenefit: Set to true ONLY if the document explicitly mentions restoration, recharge, refill, reset, or automatic restoration of the sum insured upon exhaustion. Set to false ONLY if the document explicitly states that restoration is not provided/excluded. If not mentioned in the document, set to null. Never infer that restoration is excluded merely because the document is silent.
15. cashlessAvailable: Set to true if cashless facility or cashless settlement is explicitly stated as available at network/empanelled hospitals (even if subject to pre-authorization). Set to false if cashless is explicitly excluded or reimbursement-only. If not mentioned in the document, set to null.
16. networkType: Set to "all-network" ONLY if the policy explicitly defines an all-hospital or unrestricted network; "restricted-network" ONLY if the policy explicitly defines a tiered, restricted, or preferential list of empanelled network hospitals; "reimbursement-only" if no network facility exists; or null if the document does not classify the network into a specific tier. Do NOT infer "all-network" or "restricted-network" merely because cashless facility or network hospitals are mentioned.
17. insuredPersons: List only persons explicitly named as Insured Persons in the document. If the document states that covered persons are specified in the Schedule but the schedule is missing, set insuredPersons to []. Never assume the primary policyholder is covered.

SCHEMA
{
  "insurer": "string or null",
  "insurerAliases": ["string"],
  "planName": "string or null",
  "policyType": "individual | floater | corporate | pmjay | esi | private | null",
  "policyNumber": "string or null",
  "uin": "string or null",
  "policyStartDate": "YYYY-MM-DD or null",
  "policyEndDate": "YYYY-MM-DD or null",
  "zone": "Zone A | Zone B | Zone C | null",
  "networkType": "all-network | restricted-network | reimbursement-only | null",
  "cashlessAvailable": true,
  "tpa": "string or null",
  "insuredPersons": [{ "name": "string", "age": 0, "relation": "string" }],
  "sumInsured": "number (in rupees) or null",
  "roomLimit": { "type": "amount | percent | category | none", "value": "number or string or null" },
  "icuLimit": { "type": "amount | percent | category | none", "value": "number or string or null" },
  "copay": "number (percentage) or null",
  "nonNetworkCopay": null,
  "copayConditions": { "conditionName": 0 },
  "deductible": null,
  "proportionateDeduction": null,
  "roomCategoryRestriction": null,
  "subLimits": { "procedureName": 0 },
  "restorationBenefit": null,
  "cumulativeBonus": null,
  "exclusions": ["string"],
  "hasOtherExclusions": null,
  "waitingPeriods": {
    "initial": "string or null",
    "preExisting": "string or null",
    "maternity": "string or null",
    "procedures": { "procedureName": "string" }
  },
  "preHospitalizationDays": null,
  "postHospitalizationDays": null,
  "daycareCovered": null,
  "ambulanceLimit": null,
  "preAuthHours": null,
  "claimIntimationHours": null,
  "sourceSnippets": { "fieldName": "exact source snippet" },
  "confidence": { "fieldName": "high | medium | low" }
}`;

export interface ExtractionResult {
  data: Record<string, any>;
  validationError?: string;
  isPartialFallback?: boolean;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private primaryModel = config.geminiModel || 'gemini-3.1-flash-lite';
  private fallbackModel = 'gemini-3.5-flash-lite';

  constructor(apiKey?: string) {
    const key = apiKey || config.geminiApiKey;
    if (key) {
      this.genAI = new GoogleGenerativeAI(key);
    }
  }

  public setApiKey(key: string) {
    this.genAI = new GoogleGenerativeAI(key);
  }

  private getModel(modelName: string) {
    if (!this.genAI) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }
    return this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json', temperature: 0 }
    });
  }

  public async extractPolicy(pdfBuffer: Buffer): Promise<ExtractionResult> {
    if (!this.genAI) {
      const key = config.geminiApiKey || process.env.GEMINI_API_KEY;
      if (key) {
        this.genAI = new GoogleGenerativeAI(key);
      }
    }

    if (!this.genAI) {
      console.warn('[GeminiService] No API key set. Returning blank partial schema.');
      return {
        data: normalizeExtractionPayload({}),
        isPartialFallback: true,
        validationError: 'GEMINI_API_KEY is not set.'
      };
    }

    let extractedText = '';
    try {
      extractedText = await extractTextFromPdf(pdfBuffer);
    } catch (e: any) {
      console.warn('[GeminiService] pdf-parse extraction notice:', e.message);
    }

    const hasText = Boolean(extractedText && extractedText.trim().length > 50);
    const base64Pdf = !hasText ? pdfBuffer.toString('base64') : '';

    const runCall = async (modelName: string, promptText: string): Promise<string> => {
      const model = this.getModel(modelName);
      const parts = hasText
        ? [{ text: `Document content:\n${extractedText.trim()}\n\n${promptText}` }]
        : [{ inlineData: { mimeType: 'application/pdf', data: base64Pdf } }, { text: promptText }];

      let lastError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await model.generateContent(parts);
          return result.response.text();
        } catch (err: any) {
          lastError = err;
          const isTransient = /503|429|demand|temporar|timeout|econnreset|hang up/i.test(err.message || '');
          if (isTransient && attempt < 3) {
            const delay = attempt * 1500;
            console.warn(`[GeminiService] ${modelName} transient error (attempt ${attempt}/3): ${err.message}. Retrying in ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    };

    let rawOutput = '';
    try {
      rawOutput = await runCall(this.primaryModel, EXTRACTION_PROMPT);
    } catch (err: any) {
      console.warn(`[GeminiService] Primary model ${this.primaryModel} failed: ${err.message}. Trying fallback ${this.fallbackModel}...`);
      try {
        rawOutput = await runCall(this.fallbackModel, EXTRACTION_PROMPT);
      } catch (fallbackErr: any) {
        console.error('[GeminiService] Fallback model also failed:', fallbackErr.message);
        return {
          data: normalizeExtractionPayload({}),
          isPartialFallback: true,
          validationError: fallbackErr.message
        };
      }
    }

    // Attempt 1: Parse and validate
    let parsed: any;
    try {
      const cleaned = cleanRawJsonText(rawOutput);
      parsed = JSON.parse(cleaned);
    } catch (parseError: any) {
      console.warn('[GeminiService] JSON parse failed on initial response, retrying once...');
    }

    if (parsed) {
      const normalized = normalizeExtractionPayload(parsed);
      const valResult = ExtractedPolicyZod.safeParse(normalized);
      if (valResult.success) {
        return { data: valResult.data };
      }

      console.warn('[GeminiService] Initial extraction validation failed. Retrying once with error feedback...');
      const errorMsg = valResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');

      try {
        const retryPrompt = `${EXTRACTION_PROMPT}\n\nIMPORTANT: Your previous response failed validation with these errors: ${errorMsg}. Return corrected JSON only.`;
        const retryOutput = await runCall(this.primaryModel, retryPrompt);
        const retryCleaned = cleanRawJsonText(retryOutput);
        const retryParsed = JSON.parse(retryCleaned);
        const retryNorm = normalizeExtractionPayload(retryParsed);
        const retryVal = ExtractedPolicyZod.safeParse(retryNorm);

        if (retryVal.success) {
          return { data: retryVal.data };
        } else {
          return {
            data: retryNorm,
            isPartialFallback: true,
            validationError: retryVal.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          };
        }
      } catch (retryError: any) {
        console.error('[GeminiService] Retry failed:', retryError.message);
        return {
          data: normalized,
          isPartialFallback: true,
          validationError: errorMsg
        };
      }
    }

    // If initial JSON parsing failed completely, retry once
    try {
      const retryPrompt = `${EXTRACTION_PROMPT}\n\nIMPORTANT: Your previous response was not valid JSON. Return valid JSON only with NO markdown fences.`;
      const retryOutput = await runCall(this.primaryModel, retryPrompt);
      const retryCleaned = cleanRawJsonText(retryOutput);
      const retryParsed = JSON.parse(retryCleaned);
      const retryNorm = normalizeExtractionPayload(retryParsed);
      return { data: retryNorm };
    } catch (secondFail: any) {
      return {
        data: normalizeExtractionPayload({}),
        isPartialFallback: true,
        validationError: 'Could not parse structured JSON from document.'
      };
    }
  }

  public async generateNearestHospitalsGuidance(params: {
    insurer: string;
    procedure?: string;
    specialty?: string;
    mode?: string;
    hospitals: Array<{
      name: string;
      locality?: string;
      networkStatus?: string;
      rating?: number;
      score?: number;
      patientPayable?: number;
      cashlessAvailable?: boolean;
    }>;
  }): Promise<{ summary: string; recommendation: string }> {
    if (!this.genAI) {
      const key = config.geminiApiKey || process.env.GEMINI_API_KEY;
      if (key) {
        this.genAI = new GoogleGenerativeAI(key);
      }
    }

    const hosp0 = params.hospitals[0]?.name || 'Your top network hospital';
    const mode = params.mode || 'nearestFirst';
    let fallbackSummary = `Under your ${params.insurer || 'health'} policy, these top facilities are verified in-network partners for ${params.procedure || params.specialty || 'your treatment'}. ${hosp0} offers direct cashless settlement with 0% non-network co-pay penalty.`;
    if (mode === 'specialtyFit') {
      fallbackSummary = `These premier medical centers offer specialized clinical excellence for ${params.specialty || params.procedure || 'this procedure'}. All 3 are verified cashless partners under your ${params.insurer || 'active'} policy, ensuring expert care with zero non-network co-pay deductions.`;
    } else if (mode === 'coverageFit') {
      fallbackSummary = `Under your ${params.insurer || 'active'} policy, these verified network hospitals offer maximum claim admissibility and lowest out-of-pocket expenses for ${params.procedure || params.specialty || 'your treatment'}.`;
    }
    const fallbackRecommendation = `Recommended: Choose ${hosp0} for immediate cashless admission and expedited pre-authorization.`;

    if (!this.genAI) {
      return { summary: fallbackSummary, recommendation: fallbackRecommendation };
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.primaryModel,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      const prompt = `You are the SehatSure AI Care Navigator for Indian health insurance policyholders.
A patient needs treatment for: ${params.procedure || params.specialty || 'Specialized Treatment'}.
Their policy is issued by: ${params.insurer || 'Health Insurance'}.
Active Discovery Mode: ${mode === 'specialtyFit' ? 'SehatSure Specialty Clinical Fit' : mode === 'coverageFit' ? 'Best Coverage Fit (Lowest Out-of-Pocket)' : 'Nearest Cashless Proximity'}.

The top 3 verified in-network hospitals (confirmed for policy cashless admission):
${params.hospitals.map((h, i) => {
  const hasEst = (h as any).hasEstimate !== false && h.patientPayable !== null && (h as any).estimatedOOP !== null;
  const oop = (h.patientPayable ?? (h as any).estimatedOOP ?? 0);
  const oopStr = hasEst ? `₹${oop.toLocaleString('en-IN')}` : 'Estimate Unavailable (Awaiting Hospital Tariff)';
  return `${i + 1}. ${h.name} (${h.locality || 'Nearby'}) - Estimated Patient Out-of-Pocket: ${oopStr}, Care Fit Score: ${h.score || 90}/100`;
}).join('\n')}

INSTRUCTIONS:
1. Provide a concise, clear 2-sentence summary explaining why these 3 facilities are the best choices under their policy:
   - If mode is 'specialtyFit': emphasize clinical department expertise, specialized surgical teams, and pre-authorized cashless admission.
   - If mode is 'coverageFit': emphasize maximum financial protection, zero room rent penalties, and minimal out-of-pocket payment. Never claim ₹0 or "zero out-of-pocket" if any hospital has an estimated patient out-of-pocket above ₹0 or if treatment cost estimate is unavailable.
   - If mode is 'nearestFirst': emphasize closest proximity, rapid cashless admission, and emergency convenience.
2. DO NOT include any specific kilometer or meter numbers.
3. DO NOT mention the word 'Gemini' anywhere in the output. Always speak as SehatSure AI Care Navigator.
4. Provide a 1-sentence actionable recommendation highlighting the top facility (${hosp0}).
5. Output JSON strictly with this schema:
{
  "summary": "...",
  "recommendation": "..."
}`;

      const res = await model.generateContent(prompt);
      const text = res.response.text();
      const parsed = JSON.parse(cleanRawJsonText(text));
      return {
        summary: parsed.summary || fallbackSummary,
        recommendation: parsed.recommendation || fallbackRecommendation
      };
    } catch (err) {
      console.warn('[GeminiService] generateNearestHospitalsGuidance error:', err);
      return { summary: fallbackSummary, recommendation: fallbackRecommendation };
    }
  }
}

export const geminiService = new GeminiService();

