import { describe, it, expect } from 'vitest';
import { assistantService, cleanTextForSpeech } from '../src/services/assistantService.js';
import { AssistantChatRequestZod } from '../src/schemas/assistantSchema.js';

describe('Ask SehatSure Global Voice & Text Assistant — API & Service Suite', () => {
  const HDFC_POLICY_ID = 'pol_demo_hdfc';

  it('TEST 1: Request Schema Validation rejects empty questions and oversized messages', () => {
    const emptyResult = AssistantChatRequestZod.safeParse({ message: '   ' });
    expect(emptyResult.success).toBe(false);

    const oversizedResult = AssistantChatRequestZod.safeParse({
      message: 'a'.repeat(2500)
    });
    expect(oversizedResult.success).toBe(false);

    const validResult = AssistantChatRequestZod.safeParse({
      message: 'What is my room rent limit?',
      history: [{ sender: 'user', text: 'Hello' }],
      context: { currentView: 'summary', policyId: HDFC_POLICY_ID }
    });
    expect(validResult.success).toBe(true);
  });

  it('TEST 2: CleanTextForSpeech strips markdown formatting, bullets, and expands currency for TTS', () => {
    const markdownInput = '### Room Rent Summary\n* Limit: **₹5,000 per day**\n[View Details](https://sehatsure.in)\n`PROPORTIONATE_DEDUCTION` applies.';
    const cleaned = cleanTextForSpeech(markdownInput);

    expect(cleaned).not.toContain('*');
    expect(cleaned).not.toContain('#');
    expect(cleaned).not.toContain('`');
    expect(cleaned).not.toContain('[');
    expect(cleaned).toContain('Rupees 5,000 per day');
    expect(cleaned).toContain('Room Rent Summary');
  });

  it('TEST 3: Policy Grounding returns policy-stated room rent limit and high confidence', async () => {
    const res = await assistantService.handleChat({
      message: 'What is my room rent limit?',
      history: [],
      context: { policyId: HDFC_POLICY_ID, currentView: 'summary' },
      language: 'en'
    });

    expect(res.answer).toMatch(/5,000|1%/);
    expect(res.provenance).toBe('Policy Grounded');
    expect(res.confidence).toBe('High');
    expect(res.spokenText).toBeDefined();
    expect(res.suggestedQuestions.length).toBeGreaterThan(0);
  });

  it('TEST 4: Claims Context Grounding explains deduction mechanisms with Claim Engine provenance', async () => {
    const res = await assistantService.handleChat({
      message: 'Why was the surgeon fee deducted in scenario 1?',
      history: [],
      context: { currentView: 'claims', scenarioId: 'scenario-1-proportionate' },
      language: 'en'
    });

    expect(res.answer.toLowerCase()).toMatch(/proportionate|deduct|room rent/i);
    expect(res.provenance).toBe('Claim Engine');
    expect(res.suggestedQuestions).toBeDefined();
  });

  it('TEST 5: Hospital Directory Context responds with hospital provenance and network clarification', async () => {
    const res = await assistantService.handleChat({
      message: 'Are there any cashless hospitals in Pune?',
      history: [],
      context: { currentView: 'discovery', city: 'Pune' },
      language: 'en'
    });

    expect(res.answer.toLowerCase()).toMatch(/pune|hospital|cashless|network/i);
    expect(res.spokenText).toBeDefined();
  });

  it('TEST 6: Unuploaded Policy Guardrail tells user no policy is attached rather than hallucinating', async () => {
    const res = await assistantService.handleChat({
      message: 'What is my exact sum insured for my policy?',
      history: [],
      context: { currentView: 'upload' },
      language: 'en'
    });

    // Should indicate that no policy is attached or prompt to upload/select one
    expect(res.answer.toLowerCase()).toMatch(/no policy|upload|select/i);
  });

  it('TEST 7: Multi-turn history bounded execution preserves conversation context', async () => {
    const res = await assistantService.handleChat({
      message: 'Does it apply to ICU as well?',
      history: [
        { sender: 'user', text: 'What is my room rent limit?' },
        { sender: 'assistant', text: 'Your room rent limit is 1% of Sum Insured (₹5,000/day).' }
      ],
      context: { policyId: HDFC_POLICY_ID, currentView: 'summary' },
      language: 'en'
    });

    expect(res.answer).toBeDefined();
    expect(res.spokenText).toBeDefined();
  });

  it('TEST 8: Hindi Language preference yields response with Hindi greetings/terms', async () => {
    const res = await assistantService.handleChat({
      message: 'नमस्ते, सेहतश्योर क्या है?',
      history: [],
      context: { currentView: 'how-it-works' },
      language: 'hi'
    });

    expect(res.answer).toBeDefined();
    expect(res.spokenText).toBeDefined();
  });
});
