import { describe, it, expect } from 'vitest';
import { policyChatService } from '../src/services/policyChatService.js';

describe('Ask SehatSure — Policy-Grounded Conversational Assistant Test Suite', () => {
  const HDFC_POLICY_ID = 'pol_demo_hdfc';

  it('TEST 1: "What is my sum insured?" returns ₹5,00,000 with evidence & provenance', async () => {
    const res = await policyChatService.answerQuestion({
      policyId: HDFC_POLICY_ID,
      message: 'What is my sum insured?'
    });

    expect(res.answer).toMatch(/5,00,000/);
    expect(res.evidence).toBeDefined();
    expect(res.evidence.snippet).toBeDefined();
    expect(res.provenance).toBe('Document-Stated');
    expect(res.confidence).toBe('High');
  });

  it('TEST 2: "What is my room rent limit?" returns 1% of Sum Insured (₹5,000/day)', async () => {
    const res = await policyChatService.answerQuestion({
      policyId: HDFC_POLICY_ID,
      message: 'What is my room rent limit?'
    });

    expect(res.answer).toMatch(/1%/);
    expect(res.answer).toMatch(/5,000/);
    expect(res.evidence).toBeDefined();
    expect(res.evidence.snippet).toMatch(/room rent/i);
    expect(res.confidence).toBe('High');
  });

  it('TEST 3: "Do I have a co-payment?" correctly explains network-hospital co-payment (0% / Nil)', async () => {
    const res = await policyChatService.answerQuestion({
      policyId: HDFC_POLICY_ID,
      message: 'Do I have a co-payment?'
    });

    expect(res.answer.toLowerCase()).toMatch(/0%|nil/);
    expect(res.answer.toLowerCase()).toMatch(/network/);
    expect(res.evidence).toBeDefined();
    expect(res.confidence).toBe('High');
  });

  it('TEST 4 (CRITICAL ANTI-HALLUCINATION): "What is my non-network co-payment?" must NOT say 0% and explicitly return "Not specified in the uploaded policy"', async () => {
    const res = await policyChatService.answerQuestion({
      policyId: HDFC_POLICY_ID,
      message: 'What is my non-network co-payment?'
    });

    // Must NOT say that non-network copay is 0%
    expect(res.answer).toMatch(/Not specified in the uploaded policy/i);
    expect(res.answer).toMatch(/cannot assume that the network rate applies/i);
    expect(res.missingInformation).toBeDefined();
    expect(res.missingInformation?.length).toBeGreaterThan(0);
    expect(res.confidence).toBe('High');
  });

  it('TEST 5: "Can you estimate my out-of-pocket cost?" clearly identifies missing information', async () => {
    const res = await policyChatService.answerQuestion({
      policyId: HDFC_POLICY_ID,
      message: 'Can you estimate my out-of-pocket cost?'
    });

    expect(res.missingInformation).toBeDefined();
    expect(res.missingInformation?.some((m) => m.toLowerCase().includes('procedure') || m.toLowerCase().includes('treatment'))).toBe(true);
    expect(res.missingInformation?.some((m) => m.toLowerCase().includes('hospital'))).toBe(true);
  });

  it('TEST 6: "Does my policy cover knee replacement?" grounds in policy exclusions and general benefits', async () => {
    const res = await policyChatService.answerQuestion({
      policyId: HDFC_POLICY_ID,
      message: 'Does my policy cover knee replacement?'
    });

    expect(res.answer.toLowerCase()).toMatch(/covered/i);
    expect(res.answer.toLowerCase()).toMatch(/not.*excluded/i);
    expect(res.evidence).toBeDefined();
  });

  it('TEST 7 (DYNAMIC RE-CALCULATION): "What if I choose a ₹7,000/day room?" calculates excess & proportionate deduction', async () => {
    const res = await policyChatService.answerQuestion({
      policyId: HDFC_POLICY_ID,
      message: 'What if I choose a ₹7,000/day room?'
    });

    expect(res.answer).toMatch(/7,000/);
    expect(res.answer).toMatch(/5,000/);
    expect(res.answer.toLowerCase()).toMatch(/proportionate deduction/);
    expect(res.costEstimate).toBeDefined();
  });

  it('TEST 8 (DYNAMIC RE-CALCULATION): "What if the hospital is non-network?" flags cashless unavailability and unspecified co-pay', async () => {
    const res = await policyChatService.answerQuestion({
      policyId: HDFC_POLICY_ID,
      message: 'What if the hospital is non-network?'
    });

    expect(res.answer.toLowerCase()).toMatch(/cashless/);
    expect(res.answer.toLowerCase()).toMatch(/reimbursement/);
    expect(res.answer).toMatch(/Not specified/i);
  });

  it('TEST 9 (FIN-01 CHATBOT PROVENANCE): "How much does Cataract surgery cost?" returns deterministic benchmark & provenance', async () => {
    const res = await policyChatService.answerQuestion({
      policyId: HDFC_POLICY_ID,
      message: 'How much does Cataract surgery cost under my policy?'
    });

    expect(res.answer).toMatch(/Cataract/i);
    expect(res.answer).toMatch(/₹10,500/);
    expect(res.costEstimate).toBeDefined();
    expect(res.costEstimate?.procedureName).toMatch(/Cataract/i);
    expect(res.costEstimate?.treatmentCostRange).toContain('₹10,500');
  });

  it('TEST 10 (FIN-01 CHATBOT REFUSAL): "What is the cost of EEG?" strictly refuses to guess and cites 0 procedure matches', async () => {
    const res = await policyChatService.answerQuestion({
      policyId: HDFC_POLICY_ID,
      message: 'What is the cost of EEG?'
    });

    expect(res.answer).toMatch(/NO RELIABLE COST BENCHMARK/i);
    expect(res.answer).toMatch(/0 hospitals have verified/i);
    expect(res.answer).toMatch(/SehatSure will not substitute another procedure's cost/i);
    expect(res.costEstimate).toBeUndefined();
    expect(res.confidence).toBe('Low');
  });
});
