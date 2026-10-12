import { describe, it, expect } from 'vitest';
// @ts-ignore
import {
  deduplicateRepeatedPhrases,
  cleanAndCorrectSpeechText,
  mergeFinalAndInterim,
  sanitizeSpeechText
} from '../../frontend/src/services/speechService.js';

describe('Voice Assistant STT Pipeline & Deduplication Test Suite', () => {
  it('TEST 1: Deduplicates repeated words in user speech', () => {
    const raw = 'what what is is my my room room rent';
    const clean = deduplicateRepeatedPhrases(raw);
    expect(clean).toBe('what is my room rent');
  });

  it('TEST 2: Deduplicates repeated multi-word phrases (e.g. repeated sentence halves)', () => {
    const raw = 'what is my room rent what is my room rent';
    const clean = deduplicateRepeatedPhrases(raw);
    expect(clean).toBe('what is my room rent');
  });

  it('TEST 3: Deduplicates triply repeated phrases from rapid speech or continuous mic loops', () => {
    const raw = 'can I claim this can I claim this can I claim this';
    const clean = deduplicateRepeatedPhrases(raw);
    expect(clean).toBe('can I claim this');
  });

  it('TEST 4: Seamlessly merges final and interim results with partial overlap without duplication', () => {
    const finalChunk = 'what is my';
    const interimChunk = 'my room rent';
    const merged = mergeFinalAndInterim(finalChunk, interimChunk);
    expect(merged).toBe('what is my room rent');
  });

  it('TEST 5: Merges final and interim when interim contains complete final prefix', () => {
    const finalChunk = 'what is my room';
    const interimChunk = 'what is my room rent limit';
    const merged = mergeFinalAndInterim(finalChunk, interimChunk);
    expect(merged).toBe('what is my room rent limit');
  });

  it('TEST 6: Handles pause between phrases without repeating prior final sentence', () => {
    const sessionFinal = 'Tell me about cataract surgery.';
    const nextPhrase = 'What is the copay?';
    const merged = mergeFinalAndInterim(sessionFinal, nextPhrase);
    expect(merged).toBe('Tell me about cataract surgery. What is the copay?');
  });

  it('TEST 7: Applies healthcare domain phonetic corrections while removing duplicates', () => {
    const raw = 'see hat sure see hat sure what is my some insured and cope pay';
    const clean = cleanAndCorrectSpeechText(raw);
    expect(clean).toBe('SehatSure what is my sum insured and copay');
  });

  it('TEST 8: Corrects TPA, ICU, Ayushman Bharat, and PM-JAY phonetic slips', () => {
    const raw = 'is tea pee a required for ayush man bharat and p m j a y';
    const clean = cleanAndCorrectSpeechText(raw);
    expect(clean).toBe('is TPA required for Ayushman Bharat and PM-JAY');
  });

  it('TEST 9: Hindi speech support: deduplicates repeated Hindi words and phrases correctly', () => {
    const rawHindi = 'क्या मेरा क्लेम पास होगा क्या मेरा क्लेम पास होगा';
    const cleanHindi = cleanAndCorrectSpeechText(rawHindi);
    expect(cleanHindi).toBe('क्या मेरा क्लेम पास होगा');
  });

  it('TEST 10: Hindi speech support: removes repeated adjacent Hindi tokens', () => {
    const rawHindi = 'मेरा मेरा बीमा बीमा कितना है';
    const cleanHindi = deduplicateRepeatedPhrases(rawHindi);
    expect(cleanHindi).toBe('मेरा बीमा कितना है');
  });

  it('TEST 11: Sanitize text for TTS output removes markdown and converts currency symbol', () => {
    const markdownText = 'Your sum insured is **₹5,00,000** with `1%` room rent limit.';
    const sanitized = sanitizeSpeechText(markdownText);
    expect(sanitized).toBe('Your sum insured is Rupees 5,00,000 with 1% room rent limit.');
  });

  it('TEST 12: In-flight submission lock simulation prevents duplicate concurrent backend calls', () => {
    let callCount = 0;
    let isSubmitting = false;
    let lastSubmittedText = '';
    let lastSubmitTime = 0;

    const mockSubmit = (text: string) => {
      const now = Date.now();
      if (isSubmitting) return false;
      if (text === lastSubmittedText && now - lastSubmitTime < 2000) return false;

      isSubmitting = true;
      lastSubmittedText = text;
      lastSubmitTime = now;
      callCount++;
      return true;
    };

    // First call succeeds
    const call1 = mockSubmit('What is my sum insured?');
    expect(call1).toBe(true);
    expect(callCount).toBe(1);

    // Concurrent call while in-flight is rejected
    const call2 = mockSubmit('What is my sum insured?');
    expect(call2).toBe(false);
    expect(callCount).toBe(1);

    // Reset lock simulating request completion
    isSubmitting = false;

    // Immediate duplicate call within window is still rejected
    const call3 = mockSubmit('What is my sum insured?');
    expect(call3).toBe(false);
    expect(callCount).toBe(1);

    // Different question succeeds
    const call4 = mockSubmit('What is my room rent?');
    expect(call4).toBe(true);
    expect(callCount).toBe(2);
  });
});
