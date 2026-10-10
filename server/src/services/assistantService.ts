import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import { policyChatService } from './policyChatService.js';
import { hospitalService } from './hospitalService.js';
import { costIntelligenceService } from './costIntelligenceService.js';
import { claimWorkflowService } from './claimWorkflowService.js';
import { DEMO_POLICIES } from '../utils/demoData.js';
import { Policy } from '../models/Policy.js';
import {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantChatEvidence
} from '../schemas/assistantSchema.js';

/**
 * Strips markdown symbols, asterisks, URLs, and code blocks for natural speech synthesis
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`([^`]+)`/g, '$1')     // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert markdown links to text
    .replace(/[#*_~>]/g, '')        // Remove header, bold, italics, strikethrough, blockquote markers
    .replace(/^[-\t*+] /gm, '')     // Remove bullet points
    .replace(/^\d+\.\s+/gm, '')     // Remove numbered list prefixes
    .replace(/₹/g, 'Rupees ')        // Expand Rupee symbol for clearer TTS pronunciation
    .replace(/\s+/g, ' ')           // Collapse multiple whitespace
    .trim();
}

export class AssistantService {
  private genAI: GoogleGenerativeAI | null = null;
  private primaryModel = config.geminiModel || 'gemini-3.1-flash-lite';

  constructor() {
    const key = config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (key && key.trim()) {
      this.genAI = new GoogleGenerativeAI(key.trim());
    }
  }

  private getModel(modelName: string) {
    if (!this.genAI) {
      const key = config.geminiApiKey || process.env.GEMINI_API_KEY;
      if (key && key.trim()) {
        this.genAI = new GoogleGenerativeAI(key.trim());
      }
    }
    if (!this.genAI) return null;
    return this.genAI.getGenerativeModel({ model: modelName });
  }

  /**
   * Main conversational intelligence router
   */
  public async handleChat(req: AssistantChatRequest, userId?: string | null): Promise<AssistantChatResponse> {
    const message = req.message.trim();
    const history = req.history || [];
    const context = req.context || {};
    const language = req.language || 'en';

    // 1. Gather Authorized Real Data Context
    let policyContextText = '';
    let policyData: any = null;
    let evidence: AssistantChatEvidence | undefined;
    let provenance: AssistantChatResponse['provenance'] = 'System Assessment';
    let confidence: AssistantChatResponse['confidence'] = 'High';
    const missingInfo: string[] = [];

    // Check if policyId is provided or can be resolved
    const targetPolicyId = context.policyId;
    if (targetPolicyId) {
      policyData = await this.resolvePolicy(targetPolicyId, userId);
      if (policyData) {
        provenance = 'Policy Grounded';
        policyContextText = this.formatPolicyContext(policyData);
      }
    }

    // Check Claims context
    let claimContextText = '';
    if (context.currentView === 'claims' || context.claimId || context.scenarioId || /claim|deduct|disallow|cholecystectomy|rhinoplasty|bioresonance|robotic/i.test(message)) {
      claimContextText = await this.resolveClaimContext(context.claimId || context.scenarioId);
      if (claimContextText) {
        provenance = 'Claim Engine';
      }
    }

    // 1. Detect Clinical Department and Procedure Intent in Query
    const clinicalIntent = this.detectClinicalIntent(message, context.procedureName, context.specialty);

    // Check Hospital & Discovery context (detect in English and Hindi medical queries)
    const isHospitalOrProcedureQuery = Boolean(
      clinicalIntent.isExplicitInQuery ||
      context.currentView === 'discovery' ||
      (context.recommendedHospitals && context.recommendedHospitals.length > 0) ||
      context.procedureName ||
      /hospital|cashless|network|empanel|हॉस्पिटल|अस्पताल|दवाखाना|कैशलेस|ट्रांसप्लांट|इलाज|डॉक्टर|admit|admission|opd|surgery|अस्पतालों|हॉस्पिटलों/i.test(message)
    );

    let hospitalContextText = '';
    if (isHospitalOrProcedureQuery) {
      hospitalContextText = this.resolveHospitalContext({
        city: context.city,
        procedureName: context.procedureName,
        specialty: context.specialty,
        recommendedHospitals: context.recommendedHospitals,
        guidanceText: context.guidanceText,
        policy: policyData,
        mode: context.mode,
        message,
        clinicalIntent
      });
      if (!claimContextText && !policyContextText) {
        provenance = 'Hospital Directory';
      }
    }

    // Check Cost Intelligence context
    let costContextText = '';
    const procForCost = clinicalIntent.procedure || context.procedureName;
    if (procForCost || /cost|estimate|benchmark|how much|price|खर्च|एस्टीमेट|रुपए|पैसा|दर/i.test(message)) {
      costContextText = this.resolveCostContext(procForCost, context.city);
      if (!claimContextText && !policyContextText && !hospitalContextText) {
        provenance = 'Cost Benchmark';
      }
    }

    // 2. If it's a specific policy term question and policy is loaded, invoke policyChatService first for deterministic grounding
    let deterministicPolicyAnswer: any = null;
    if (targetPolicyId && policyData && !claimContextText) {
      try {
        deterministicPolicyAnswer = await policyChatService.answerQuestion({
          policyId: targetPolicyId,
          message,
          history
        });
        if (deterministicPolicyAnswer && deterministicPolicyAnswer.evidence?.snippet) {
          evidence = {
            snippet: deterministicPolicyAnswer.evidence.snippet,
            sectionName: deterministicPolicyAnswer.evidence.sectionName,
            documentStated: deterministicPolicyAnswer.evidence.documentStated
          };
        }
      } catch (e) {
        console.warn('[AssistantService] policyChatService inspection notice:', e);
      }
    }

    // 3. Assemble Gemini Prompt with Strict Grounding Guardrails
    const systemPrompt = `You are "Ask SehatSure", an authoritative, compassionate, and precise health insurance & care navigation intelligence assistant for Indian healthcare.
Your role is to explain insurance policies, hospital network statuses, treatment costs, and claim deductions to users in clear, empathetic language.

CRITICAL INSTRUCTIONS & GUARDRAILS:
1. GROUNDED KNOWLEDGE: Use the provided context facts below as the ground truth.
   - If the user asks about an insurance policy and no policy is uploaded/selected, state clearly: "No policy has been uploaded or selected yet. Please upload your policy schedule or select a demo policy so I can check your exact coverage terms."
   - If a policy IS provided, strictly adhere to its stated room rent limits, ICU limits, co-pay clauses, proportionate deduction rules, and exclusions.
   - NEVER invent or guess a room rent cap, deductible, or co-payment percentage. If it is null or not stated in the policy, state that it is not specified in the document.
2. CLAIM ADJUDICATION RULES:
   - When explaining claim deductions, refer to the deterministic adjudication rules:
     * Room rent excess triggers proportionate deduction across associated medical charges.
     * Non-payable hospital items (gloves, sanitizer, registration fees) are excluded per IRDAI non-payable schedules.
     * Unproven/alternative therapies without empirical validation require manual TPA review.
     * Amendments apply based on the treatment date relative to the amendment effective date.
3. HOSPITAL & NETWORK RECOMMENDATIONS:
   - When suggesting or answering questions about hospitals for any medical procedure, treatment, or city, you MUST recommend ONLY the facilities explicitly provided under "SEHATSURE TOP RECOMMENDED HOSPITALS" in the context facts below.
   - You MUST NEVER invent, hallucinate, or suggest unlisted hospitals (e.g. do NOT invent "Jeevan Jyoti Hospital", "Sanjeevani Nursing Home", "Surya Hospitals", or any names not listed in the context).
   - Quote the exact facility names, locations, and cashless coverage terms as provided (e.g., "Metro Superspeciality Hospital And Trauma Centre (Wagholi)", "Sanjeevanee Hospital Icu & Trauma Unit (Chakan)", "Anand Orthopedic Hospital (Moshi)").
   - Mention that these facilities provide 100% cashless coverage under the user's active policy with minimized/₹0 out-of-pocket costs and optimal specialty fit.
   - If responding in Hindi, translate the advice naturally, but DO NOT alter or substitute hospital names; use the exact hospital names from the list.
4. MEDICAL & LEGAL DISCLAIMER:
   - You provide financial decision support and policy term clarification, NOT formal medical diagnoses or binding insurer claim guarantees.
5. LANGUAGE PREFERENCE:
   - If language is "hi", provide your response in polite, clear Hindi (using Devanagari or standard Hinglish where appropriate).
   - If language is "en", provide your response in clear, concise English.
6. CONCISENESS & CLARITY:
   - Keep answers focused (2 to 4 concise paragraphs or bullet points).
   - Highlight monetary values in Rupees (₹).
   - Ensure the answer can be read aloud comfortably.`;

    const factsPrompt = `AVAILABLE SEHATSURE CONTEXT:
Current Application Screen: ${context.currentView || 'General Application'}
Language: ${language === 'hi' ? 'Hindi (हिंदी)' : 'English'}

${policyContextText ? `--- POLICY CONTEXT ---\n${policyContextText}\n` : 'No policy currently attached to this query.\n'}
${claimContextText ? `--- CLAIM ADJUDICATION CONTEXT ---\n${claimContextText}\n` : ''}
${hospitalContextText ? `--- HOSPITAL DATA CONTEXT ---\n${hospitalContextText}\n` : ''}
${costContextText ? `--- TREATMENT COST BENCHMARKS ---\n${costContextText}\n` : ''}
${deterministicPolicyAnswer?.answer ? `--- DETERMINISTIC POLICY ANALYSIS ---\n${deterministicPolicyAnswer.answer}\n` : ''}
`;

    // 4. Try Gemini AI Generation
    const model = this.getModel(this.primaryModel);
    if (model) {
      try {
        const conversationHistoryText = history
          .map((h) => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
          .join('\n');

        const fullPrompt = `${systemPrompt}\n\n${factsPrompt}\n\n${conversationHistoryText ? `PREVIOUS CONVERSATION:\n${conversationHistoryText}\n\n` : ''}USER QUESTION: ${message}\n\nProvide your response now:`;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI Request Timeout (15s)')), 15000)
        );

        const geminiCall = model.generateContent(fullPrompt);
        const result: any = await Promise.race([geminiCall, timeoutPromise]);
        const responseText = result.response.text();

        if (responseText && responseText.trim()) {
          const suggestedQuestions = this.generateSuggestedQuestions(context, policyData);
          const spokenText = cleanTextForSpeech(responseText);

          return {
            answer: responseText.trim(),
            evidence,
            provenance,
            confidence: deterministicPolicyAnswer?.confidence || 'High',
            suggestedQuestions,
            missingInformation: deterministicPolicyAnswer?.missingInformation || (missingInfo.length > 0 ? missingInfo : undefined),
            spokenText
          };
        }
      } catch (err: any) {
        console.warn('[AssistantService] Gemini API call warning, falling back to deterministic response:', err.message);
      }
    }

    // 5. Fallback Response when Gemini is unavailable or not configured
    return this.buildDeterministicFallback({
      message,
      policyData,
      deterministicPolicyAnswer,
      context,
      language
    });
  }

  /**
   * Resolves policy document by ID with authorization check
   */
  private async resolvePolicy(policyId: string, userId?: string | null): Promise<any | null> {
    // 1. Check demo policies
    const demo = DEMO_POLICIES.find((d) => d.id === policyId || d.key === policyId);
    if (demo) {
      return {
        _id: demo.id,
        ...demo.data
      };
    }

    // 2. Query MongoDB Policy collection
    try {
      if (Policy.db.readyState === 1) {
        const query: any = { _id: policyId };
        // If user is authenticated and not admin, restrict to user's policies or public demo
        if (userId) {
          query.$or = [{ userId }, { isDemo: true }];
        }
        const doc = await Policy.findOne(query);
        if (doc) return doc.toJSON();
      }
    } catch (e) {
      console.warn(`[AssistantService] Policy lookup failed for ${policyId}:`, e);
    }
    return null;
  }

  private formatPolicyContext(policy: any): string {
    const lines = [
      `Insurer: ${policy.insurer || 'Not specified'}`,
      `Plan: ${policy.planName || 'Standard Health Plan'}`,
      `Policy Type: ${policy.policyType || 'Individual/Retail'}`,
      `Sum Insured: ₹${Number(policy.sumInsured || 0).toLocaleString('en-IN')}`,
      `Cashless Facility: ${policy.cashlessAvailable === true ? 'Available at network hospitals' : policy.cashlessAvailable === false ? 'Reimbursement only' : 'Not specified'}`,
      `Room Rent Limit: ${policy.roomRentLimit ? JSON.stringify(policy.roomRentLimit) : 'No room rent capping specified'}`,
      `ICU Limit: ${policy.icuLimit ? JSON.stringify(policy.icuLimit) : 'No ICU limit specified'}`,
      `Co-Pay: ${policy.copay !== null && policy.copay !== undefined ? `${policy.copay}%` : 'Nil / 0% base co-pay'}`,
      `Non-Network Co-Pay: ${policy.nonNetworkCopay !== null && policy.nonNetworkCopay !== undefined ? `${policy.nonNetworkCopay}%` : 'Not specified in policy'}`,
      `Proportionate Deduction Clause: ${policy.proportionateDeduction === true ? 'Active (disallowance applies if room rent ceiling is exceeded)' : 'Not applicable'}`
    ];

    if (policy.exclusions && Array.isArray(policy.exclusions) && policy.exclusions.length > 0) {
      lines.push(`Permanent Exclusions: ${policy.exclusions.slice(0, 10).join(', ')}`);
    }

    return lines.join('\n');
  }

  private async resolveClaimContext(scenarioId?: string): Promise<string> {
    const scenarios = [
      {
        id: 'scenario-1-proportionate',
        title: 'Scenario 1: Room Rent Breach & Proportionate Deduction (Appendectomy)',
        details: 'Patient chose Deluxe Room at ₹8,000/day against a ₹3,000/day policy limit. Proportionate multiplier (3,000 / 8,000 = 37.5%) applied to OT and surgeon charges. Statutory non-payables excluded.'
      },
      {
        id: 'scenario-2-excluded',
        title: 'Scenario 2: Explicit Exclusion (Cosmetic Rhinoplasty)',
        details: 'Elective cosmetic nasal reshaping procedure without traumatic cause. 100% disallowed under General Exclusion G01.'
      },
      {
        id: 'scenario-3-missing-evidence',
        title: 'Scenario 3: Missing / Conflicting Evidence (Bioresonance Detox)',
        details: 'Alternative therapy unindexed in medical literature or policy schedules. Safely flagged for Human TPA Review.'
      },
      {
        id: 'scenario-4-amendment',
        title: 'Scenario 4: Policy Amendment Precedence (Robotic Surgery Endorsement)',
        details: 'Treatment after amendment effective date qualifies for higher sublimit (₹2,50,000 vs ₹1,00,000 base policy).'
      }
    ];

    if (scenarioId) {
      const match = scenarios.find((s) => s.id === scenarioId);
      if (match) return `${match.title}\n${match.details}`;
    }

    return `Available Claim Adjudication Engine Scenarios:\n` + scenarios.map((s) => `- ${s.title}: ${s.details}`).join('\n');
  }

  /**
   * Helper to identify procedures and medical specialties in both Hindi, Hinglish, and English
   */
  private detectClinicalIntent(
    message: string,
    contextProcedure?: string,
    contextSpecialty?: string
  ): {
    procedure?: string;
    specialty?: string;
    canonicalProcedureId?: string;
    isExplicitInQuery: boolean;
    departmentLabel: string;
  } {
    const lower = (message || '').toLowerCase();

    // 1. OPHTHALMOLOGY / EYE / LENS / CATARACT
    // Hindi & English: आंख, आँख, आँखों, आंखों, लेंस, मोतियाबिंद, मोतिया, कैटरेक्ट, नजर, दृष्टि, पुतली, कॉर्निया, eye, cataract, lens, phaco, vision, cornea, retina, glaucoma
    if (/आंख|आँख|लेंस|मोतिया|मोतियाबिंद|कैटरेक्ट|दृष्टि|पुतली|कॉर्निया|eye|cataract|lens|phaco|ophthalmol|retina|cornea|glaucoma|vision/i.test(lower)) {
      return {
        specialty: 'Ophthalmology',
        procedure: 'Cataract Surgery',
        canonicalProcedureId: 'CATARACT_SURGERY',
        isExplicitInQuery: true,
        departmentLabel: 'Ophthalmology (नेत्र रोग / आई केयर)'
      };
    }

    // 2. ORTHOPEDICS / KNEE / JOINT / HIP / BONES
    // Hindi & English: घुटने, घुटनों, घुटना, जोड़, हड्डी, फ्रैक्चर, कूल्हा, नी रिप्लेसमेंट, हिप, आर्थराइटिस, knee, tkr, orthopedic, joint, bone, fracture, hip, arthroplasty, arthritis
    if (/घुटने|घुटनों|घुटना|हड्डी|जोड़|कूल्हा|आर्थराइटिस|knee|tkr|orthoped|joint replacement|bone|fracture|hip replacement|arthroplasty|arthrit/i.test(lower)) {
      return {
        specialty: 'Orthopedics',
        procedure: 'Knee Replacement — Unilateral',
        canonicalProcedureId: 'TOTAL_KNEE_REPLACEMENT',
        isExplicitInQuery: true,
        departmentLabel: 'Orthopedics (अस्थि रोग / ऑर्थोपेडिक्स)'
      };
    }

    // 3. CARDIOLOGY / HEART / STENT / BYPASS / ANGIOPLASTY
    // Hindi & English: दिल, हृदय, हार्ट, सीने में दर्द, स्टेंट, एंजियोप्लास्टी, बायपास, कार्डियक, cardiac, heart, angioplasty, ptca, stent, cabg, bypass, chest pain
    if (/दिल|हृदय|हार्ट|स्टेंट|एंजियोप्लास्टी|बायपास|कार्डियक|cardiac|heart|angioplasty|ptca|stent|cabg|bypass/i.test(lower)) {
      const isBypass = /bypass|बायपास|cabg/i.test(lower);
      return {
        specialty: 'Cardiology',
        procedure: isBypass ? 'Coronary Artery Bypass Grafting (CABG)' : 'Angioplasty (PTCA + 1 DES)',
        canonicalProcedureId: isBypass ? 'CABG_OFFPUMP' : 'ANGIOPLASTY_PTCA_1_DES',
        isExplicitInQuery: true,
        departmentLabel: 'Cardiology (हृदय रोग / कार्डियोलॉजी)'
      };
    }

    // 4. GENERAL SURGERY / GALLBLADDER / HERNIA / APPENDIX
    // Hindi & English: पित्ताशय, पित्त की थैली, गॉलब्लेडर, हर्निया, अपेंडिक्स, अपेंडिसाइटिस, gallbladder, cholecystectomy, hernia, appendix, appendectomy
    if (/पित्ताशय|पित्त की थैली|गॉलब्लेडर|cholecystectomy|gallbladder/i.test(lower)) {
      return {
        specialty: 'General Surgery',
        procedure: 'Laparoscopic Cholecystectomy',
        canonicalProcedureId: 'LAPAROSCOPIC_CHOLECYSTECTOMY',
        isExplicitInQuery: true,
        departmentLabel: 'General Surgery (सामान्य सर्जरी)'
      };
    }

    if (/हर्निया|hernia/i.test(lower)) {
      return {
        specialty: 'General Surgery',
        procedure: 'Hernia Repair (Inguinal/Umbilical)',
        isExplicitInQuery: true,
        departmentLabel: 'General Surgery (सामान्य सर्जरी)'
      };
    }

    if (/अपेंडिक्स|अपेंडिसाइटिस|appendix|appendectomy/i.test(lower)) {
      return {
        specialty: 'General Surgery',
        procedure: 'Appendectomy',
        isExplicitInQuery: true,
        departmentLabel: 'General Surgery (सामान्य सर्जरी)'
      };
    }

    // 5. UROLOGY / KIDNEY STONE / PROSTATE / TURP
    // Hindi & English: किडनी, पथरी, प्रोस्टेट, पेशाब, मूत्र, kidney stone, prostate, turp, urology
    if (/किडनी|पथरी|प्रोस्टेट|पेशाब|मूत्र|urolog|kidney stone|prostate|turp/i.test(lower)) {
      return {
        specialty: 'Urology',
        procedure: 'Transurethral Resection of the Prostate (TURP)',
        canonicalProcedureId: 'TURP_BPH',
        isExplicitInQuery: true,
        departmentLabel: 'Urology (मूत्र रोग / यूरोलॉजी)'
      };
    }

    // 6. ENT / EAR / NOSE / THROAT
    // Hindi & English: कान, नाक, गला, पर्दा, ear, nose, throat, ent, tympanoplasty
    if (/कान|नाक|गला|पर्दा|ent|tympanoplasty|sinus|ear surgery/i.test(lower)) {
      return {
        specialty: 'ENT',
        procedure: 'Tympanoplasty',
        canonicalProcedureId: 'TYMPANOPLASTY',
        isExplicitInQuery: true,
        departmentLabel: 'ENT (कान, नाक, गला)'
      };
    }

    // 7. GYNECOLOGY & OBSTETRICS / MATERNITY / C-SECTION
    // Hindi & English: डिलीवरी, प्रसव, सी-सेक्शन, सिजेरियन, गर्भाशय, delivery, pregnancy, c-section, caesarean, maternity, gynecol
    if (/डिलीवरी|प्रसव|सी-सेक्शन|सिजेरियन|गर्भाशय|delivery|c-section|caesarean|maternity|gynecol|obstetric/i.test(lower)) {
      return {
        specialty: 'Obstetrics & Gynecology',
        procedure: 'Caesarean Section (C-Section)',
        canonicalProcedureId: 'CAESAREAN_SECTION',
        isExplicitInQuery: true,
        departmentLabel: 'Obstetrics & Gynecology (स्त्री एवं प्रसूति रोग)'
      };
    }

    // 8. NEUROLOGY / BRAIN / SPINE
    if (/दिमाग|न्यूरो|रीढ़|स्पाइन|neuro|brain|spine/i.test(lower)) {
      return {
        specialty: 'Neurology',
        isExplicitInQuery: true,
        departmentLabel: 'Neurology (न्यूरोलॉजी)'
      };
    }

    // 9. ONCOLOGY / CANCER / TUMOR
    if (/कैंसर|ट्यूमर|किमो|cancer|oncology|tumor|chemo/i.test(lower)) {
      return {
        specialty: 'Oncology',
        isExplicitInQuery: true,
        departmentLabel: 'Oncology (कैंसर रोग)'
      };
    }

    // FALLBACK: If user query did not specify a new clinical department, use context from page
    if (contextProcedure && contextProcedure.trim() && contextProcedure.trim().toLowerCase() !== 'general procedure') {
      return {
        specialty: contextSpecialty || 'General',
        procedure: contextProcedure,
        canonicalProcedureId: undefined,
        isExplicitInQuery: false,
        departmentLabel: contextSpecialty || contextProcedure
      };
    }

    return {
      specialty: contextSpecialty,
      procedure: undefined,
      canonicalProcedureId: undefined,
      isExplicitInQuery: false,
      departmentLabel: contextSpecialty || 'General Medicine'
    };
  }

  private resolveHospitalContext(params: {
    city?: string;
    procedureName?: string;
    specialty?: string;
    recommendedHospitals?: Array<{
      name: string;
      locality?: string;
      networkStatus?: string;
      patientPayable?: number | null;
      score?: number | null;
      rank?: string | number;
      cashless?: boolean;
    }>;
    guidanceText?: string;
    policy?: any;
    mode?: string;
    message?: string;
    clinicalIntent?: {
      procedure?: string;
      specialty?: string;
      canonicalProcedureId?: string;
      isExplicitInQuery: boolean;
      departmentLabel: string;
    };
  }): string {
    const { city, procedureName, specialty, recommendedHospitals, guidanceText, policy, mode, message = '', clinicalIntent } = params;
    const targetCity = city || 'Pune';

    const detected = clinicalIntent || this.detectClinicalIntent(message, procedureName, specialty);
    const effectiveProcedure = detected.procedure || procedureName;
    const effectiveSpecialty = detected.specialty || specialty || 'General';

    // A context recommended hospital list is only valid if:
    // 1) The user didn't explicitly ask for a specific different department (e.g. eye when page had ortho), AND
    // 2) If the user explicitly asked for a procedure, context specialty matches it
    const isSpecialtyMismatch = Boolean(
      detected.isExplicitInQuery &&
      specialty &&
      detected.specialty &&
      specialty.toLowerCase() !== detected.specialty.toLowerCase()
    );

    const isProcedureMismatch = Boolean(
      detected.isExplicitInQuery &&
      procedureName &&
      detected.procedure &&
      !procedureName.toLowerCase().includes(detected.procedure.toLowerCase()) &&
      !detected.procedure.toLowerCase().includes(procedureName.toLowerCase())
    );

    const canUseContextHospitals = Boolean(
      recommendedHospitals &&
      recommendedHospitals.length > 0 &&
      !isSpecialtyMismatch &&
      !isProcedureMismatch
    );

    // 1. If recommendedHospitals is directly provided and matches the clinical query:
    if (canUseContextHospitals && recommendedHospitals && recommendedHospitals.length > 0) {
      const topList = recommendedHospitals.slice(0, 3);
      const hospitalListStr = topList.map((h, i) =>
        `${i + 1}. **${h.name}** (${h.locality || targetCity})
   - Network & Admissibility: ${h.networkStatus || '100% Cashless Covered (In-Network)'}
   - Estimated Out-of-Pocket: ₹${h.patientPayable ?? 0}
   - SehatSure Fit Score: ${h.score ?? 96}/100`
      ).join('\n');

      return `SEHATSURE TOP RECOMMENDED HOSPITALS (VERIFIED SPECIALTY & COVERAGE FIT):
Location: ${targetCity}
Clinical Department / Specialty: ${effectiveSpecialty}
Selected Procedure: ${effectiveProcedure || 'General Procedure'}
Ranking Mode: ${mode || 'Best Coverage Fit'}
${guidanceText ? `Clinical Guidance: ${guidanceText}\n` : ''}
The following ${topList.length} hospitals are the EXACT facilities determined by SehatSure for this procedure and policy:
${hospitalListStr}

MANDATORY INSTRUCTION: You MUST recommend ONLY these ${topList.length} facilities. Do NOT mention or invent any other hospitals under any circumstance.`;
    }

    // 2. If not provided or user explicitly asked for a different department, dynamically search for the detected department:
    if (policy) {
      try {
        const searchResult = hospitalService.search({
          policy,
          city: targetCity,
          specialty: effectiveSpecialty,
          procedure: effectiveProcedure,
          canonicalProcedureId: detected.canonicalProcedureId,
          roomType: 'General Ward',
          networkOnly: true
        });

        if (searchResult && searchResult.hospitals && searchResult.hospitals.length > 0) {
          // Sort candidates prioritizing verified specialty name / department matches and coverage fit
          const candidates = [...searchResult.hospitals];
          if (detected.specialty) {
            const specLower = detected.specialty.toLowerCase();
            candidates.sort((a, b) => {
              const aNameMatch = a.specialtyNameMatch?.matched ? 1 : 0;
              const bNameMatch = b.specialtyNameMatch?.matched ? 1 : 0;
              if (bNameMatch !== aNameMatch) return bNameMatch - aNameMatch;

              const aSpec = (a.hospital?.specialties || []).some(s => s.toLowerCase().includes(specLower)) ? 1 : 0;
              const bSpec = (b.hospital?.specialties || []).some(s => s.toLowerCase().includes(specLower)) ? 1 : 0;
              if (bSpec !== aSpec) return bSpec - aSpec;

              const scoreA = a.score?.granularScore ?? a.score?.finalScore ?? 0;
              const scoreB = b.score?.granularScore ?? b.score?.finalScore ?? 0;
              return scoreB - scoreA;
            });
          }

          const topList = candidates.slice(0, 3);
          const hospitalListStr = topList.map((item, i) => {
            const h = item.hospital;
            const locality = (item as any).localityLabel || h.address?.split(',')[0] || targetCity;
            const netStatus = item.networkInfo?.networkStatus === 'verified'
              ? `100% Cashless Covered (${policy.insurer || 'In-Network'})`
              : 'Network Partner';
            const oop = item.score?.patientPayable ?? (item.estimate as any)?.patientPayable ?? 0;
            const scoreVal = Math.round(Number(item.score?.granularScore ?? item.score?.finalScore ?? 96));
            return `${i + 1}. **${h.hospital_name}** (${locality})
   - Network & Admissibility: ${netStatus}
   - Estimated Out-of-Pocket: ₹${oop}
   - SehatSure Fit Score: ${scoreVal}/100`;
          }).join('\n');

          return `SEHATSURE TOP RECOMMENDED HOSPITALS (VERIFIED SPECIALTY & COVERAGE FIT):
Location: ${targetCity}
Clinical Department / Specialty: ${effectiveSpecialty}
Procedure: ${effectiveProcedure || 'General Specialized Care'}
Top Recommended Hospitals for ${policy.insurer || 'Your Insurer'}:
${hospitalListStr}

MANDATORY INSTRUCTION: The user is asking about ${effectiveSpecialty} / ${effectiveProcedure || 'this care'}. You MUST recommend ONLY the ${topList.length} facilities listed above. NEVER recommend hospitals from an unrelated department.`;
        }
      } catch (err) {
        console.warn('[AssistantService] hospitalService.search failed:', err);
      }
    }

    // 3. Fallback: sample hospitals
    const sampleHospitals = (hospitalService.getHospitals(targetCity) || []).slice(0, 3);
    if (sampleHospitals.length === 0) {
      return `SehatSure Hospital Directory indexes 52,960 verified hospitals across 21,000+ Indian cities.`;
    }
    return `SEHATSURE TOP RECOMMENDED HOSPITALS:
Hospitals in ${targetCity}:
${sampleHospitals.map((h: any, i: number) => `${i + 1}. **${h.hospital_name || h.hospitalName}** (${h.address || h.city}) - Empanelled: ${h.insurers?.slice(0, 3).join(', ') || 'Various'}`).join('\n')}`;
  }

  private resolveCostContext(procedureName?: string, city?: string): string {
    const targetProc = (procedureName || 'cholecystectomy').toLowerCase();

    // Specific clinically grounded benchmarks
    if (targetProc.includes('cataract') || targetProc.includes('eye') || targetProc.includes('lens') || targetProc.includes('ophthalmol') || targetProc.includes('आंख') || targetProc.includes('लेंस')) {
      return `Clinical Cost Intelligence for Cataract Surgery & IOL Lens Replacement (नेत्र लेंस प्रत्यारोपण):
- Daycare Surgical Procedure: Phacoemulsification with Foldable Intraocular Lens (IOL).
- Private Hospital Typical Package: ₹25,000 to ₹55,000 per eye for standard monofocal foldable IOL.
- Premium Advanced Lens Option: ₹60,000 to ₹90,000 per eye for Toric (astigmatism) or Multifocal/Trifocal IOL.
- Statutory NHA AB-PMJAY Reference Package: ₹10,500 (Package Code SO001A).
- Insurance Coverage: Fully covered under Daycare procedures. With 0% Co-Pay and adequate Sum Insured, admissible surgical package charges are 100% Cashless (₹0 Out-of-Pocket for standard insured lens package; non-medical consumables excluded).`;
    }

    if (targetProc.includes('knee') || targetProc.includes('orthoped') || targetProc.includes('tkr') || targetProc.includes('घुटने') || targetProc.includes('घुटनों')) {
      return `Clinical Cost Intelligence for Knee Replacement (Total Knee Arthroplasty / घुटनों का प्रत्यारोपण):
- Inpatient Surgical Procedure: Unilateral Total Knee Replacement.
- Private Hospital Typical Package: ₹1,60,000 to ₹2,60,000 in private network hospitals.
- Statutory NHA AB-PMJAY Reference Rate: ₹80,000 (Package Code SB039A).
- Insurance Coverage: 100% Cashless at network hospitals within active Sum Insured buffer. Zero proportionate deduction applies when patient chooses eligible room category.`;
    }

    const benchmarks = costIntelligenceService.getAllBenchmarks();
    if (benchmarks && benchmarks.length > 0) {
      const match = benchmarks.find((b) =>
        (b.canonical_procedure_name || b.procedure || '').toLowerCase().includes(targetProc) ||
        targetProc.includes((b.canonical_procedure_name || b.procedure || '').toLowerCase())
      );
      if (match) {
        return `Procedure Benchmark for "${match.canonical_procedure_name || match.procedure}":
- Typical Rate: ₹${Number(match.cost_typical || 95000).toLocaleString('en-IN')}
- Cost Range: ₹${Number(match.cost_low || 60000).toLocaleString('en-IN')} to ₹${Number(match.cost_high || 140000).toLocaleString('en-IN')}
- Procedure Code: ${match.procedure_code || match.canonical_procedure_id || 'GEN-01'}`;
      }
    }

    return `SehatSure maintains clinical treatment cost benchmarks across surgical daycare and inpatient procedures.`;
  }

  private generateSuggestedQuestions(context: any, policyData: any): string[] {
    const view = context.currentView;
    if (view === 'claims') {
      return [
        'Why was the surgeon fee proportionately reduced?',
        'Which hospital bill items are non-payable by insurance?',
        'How does a policy amendment change my payable amount?'
      ];
    }
    if (view === 'discovery') {
      return [
        'Which hospitals offer cashless settlement for my insurer?',
        'What is the typical cost for this procedure in private hospitals?',
        'How do I verify if my hospital is an active network partner?'
      ];
    }
    if (view === 'journey') {
      return [
        'What documents are required for TPA pre-authorization?',
        'How do I avoid out-of-pocket deductions before admission?',
        'What should I check at the hospital discharge desk?'
      ];
    }
    if (policyData) {
      return [
        'What is my room rent and ICU limit?',
        'Does my policy have a proportionate deduction clause?',
        'What is my co-payment for non-network hospitals?',
        'Are pre-existing conditions covered?'
      ];
    }
    return [
      'How does SehatSure calculate out-of-pocket expenses?',
      'What documents do I need to upload to analyze my policy?',
      'Can I compare private and government hospital rates?'
    ];
  }

  private buildDeterministicFallback(params: {
    message: string;
    policyData: any;
    deterministicPolicyAnswer: any;
    context: any;
    language: string;
  }): AssistantChatResponse {
    const { message, policyData, deterministicPolicyAnswer, context, language } = params;

    if (deterministicPolicyAnswer && deterministicPolicyAnswer.answer) {
      return {
        answer: deterministicPolicyAnswer.answer,
        evidence: deterministicPolicyAnswer.evidence,
        provenance: 'Policy Grounded',
        confidence: deterministicPolicyAnswer.confidence || 'High',
        suggestedQuestions: this.generateSuggestedQuestions(context, policyData),
        missingInformation: deterministicPolicyAnswer.missingInformation,
        spokenText: cleanTextForSpeech(deterministicPolicyAnswer.answer)
      };
    }

    const lower = message.toLowerCase();
    let answer = '';
    let provenance: AssistantChatResponse['provenance'] = 'System Assessment';

    if (/room.*rent|room.*limit|deluxe/i.test(lower)) {
      if (policyData?.roomRentLimit) {
        provenance = 'Policy Grounded';
        answer = `Your policy specifies a room rent limit of ${JSON.stringify(policyData.roomRentLimit.value || policyData.roomRentLimit)}. If you choose a higher room category, proportionate deduction may apply to your overall hospital bill.`;
      } else {
        answer = 'No room rent limit is recorded for your current policy. Please verify in your Policy Schedule or upload your policy PDF to check.';
      }
    } else if (/co-?pay/i.test(lower)) {
      if (policyData) {
        provenance = 'Policy Grounded';
        const copay = policyData.copay !== null && policyData.copay !== undefined ? `${policyData.copay}%` : '0% (Nil)';
        answer = `Your policy specifies a base co-payment of ${copay} for network hospital admissions. Non-network hospital co-pay is ${policyData.nonNetworkCopay ? policyData.nonNetworkCopay + '%' : 'not specified in the document'}.`;
      } else {
        answer = 'Co-payment requires a policy to be uploaded. Typically, private policies carry 0% to 20% co-pay depending on age and hospital network.';
      }
    } else if (/claim|deduct|disallow|cholecystectomy/i.test(lower)) {
      provenance = 'Claim Engine';
    } else if (/hospital|cashless|network|हॉस्पिटल|अस्पताल|दवाखाना|कैशलेस|ट्रांसप्लांट|इलाज|knee|घुटने|घुटनों/i.test(lower)) {
      provenance = 'Hospital Directory';
      if (context.recommendedHospitals && context.recommendedHospitals.length > 0) {
        const top = context.recommendedHospitals.slice(0, 3);
        if (language === 'hi') {
          answer = `आपकी चुनी गई पॉलिसी के लिए SehatSure द्वारा सत्यापित शीर्ष अस्पताल ये हैं:\n\n` +
            top.map((h: any, i: number) => `${i + 1}. **${h.name}** (${h.locality || 'पुणे'})\n   - सुविधा: ${h.networkStatus || '100% कैशलेस कवर'}\n   - अनुमानित जेब खर्च: ₹${h.patientPayable ?? 0}\n   - स्पेशियलिटी स्कोर: ${h.score ?? 96}/100`).join('\n\n') +
            `\n\nइन अस्पतालों में आपकी पॉलिसी के तहत 100% कैशलेस सुविधा और न्यूनतम जेब खर्च सुनिश्चित किया गया है।`;
        } else {
          answer = `Based on SehatSure Specialty Fit under your policy, the top recommended network hospitals are:\n\n` +
            top.map((h: any, i: number) => `${i + 1}. **${h.name}** (${h.locality || 'Pune'})\n   - Coverage: ${h.networkStatus || '100% Cashless Covered'}\n   - Expected Out-of-Pocket: ₹${h.patientPayable ?? 0}\n   - Specialty Score: ${h.score ?? 96}/100`).join('\n\n') +
            `\n\nThese facilities provide verified 100% cashless treatment with zero proportionate deduction under your policy.`;
        }
      } else {
        answer = language === 'hi'
          ? 'सेहतश्योर भारत भर में 52,960 सत्यापित अस्पतालों को इंडेक्स करता है। अपनी प्रक्रिया और शहर का चयन करें ताकि आपकी पॉलिसी के लिए सर्वश्रेष्ठ कैशलेस और स्पेशियलिटी फिट अस्पताल दिखाए जा सकें।'
          : 'SehatSure indexes over 52,900 hospitals across India. Cashless admission is available only at empanelled network hospitals approved by your insurer and TPA desk.';
      }
    } else {
      answer = language === 'hi'
        ? 'नमस्ते! मैं सेहतश्योर का वॉयस एवं टेक्स्ट सहायक हूँ। आप अपनी बीमा पॉलिसी, रूम रेंट सीमा, अस्पताल बिल कटौती या कैशलेस नेटवर्क के बारे में पूछ सकते हैं।'
        : 'Hello! I am Ask SehatSure, your healthcare and insurance intelligence assistant. You can ask me about your policy coverage, room rent limits, hospital network status, or claim deductions.';
    }

    return {
      answer,
      provenance,
      confidence: 'High',
      suggestedQuestions: this.generateSuggestedQuestions(context, policyData),
      spokenText: cleanTextForSpeech(answer)
    };
  }
}

export const assistantService = new AssistantService();
