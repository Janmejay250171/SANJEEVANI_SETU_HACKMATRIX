import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';

export interface EmbeddingResult {
  vector: number[];
  provider: 'gemini-text-embedding-004' | 'deterministic-local-ngram';
}

/**
 * Calculates cosine similarity between two normalized float vectors.
 * Returns value between -1.0 and 1.0 (clamped to 0.0 to 1.0 for search relevance).
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, sim));
}

/**
 * Deterministic local subword/n-gram hashing vectorizer.
 * Provides reliable, offline semantic and morphological embeddings without external network calls.
 * Dimension: 128 float features with L2 unit normalization.
 */
export class DeterministicLocalEmbeddingProvider {
  private dimension = 128;

  public embed(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    if (!text || text.trim().length === 0) return vector;

    const stopWords = new Set([
      'fee',
      'fees',
      'charge',
      'charges',
      'rate',
      'rates',
      'cost',
      'costs',
      'amount',
      'amounts',
      'per',
      'day',
      'days',
      'and',
      'or',
      'the',
      'of',
      'for',
      'in',
      'to',
      'a',
      'an'
    ]);

    const tokens = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);

    for (const token of tokens) {
      if (stopWords.has(token)) continue;
      // 1. Whole word feature
      const wordHash = this.fnv1a(token);
      const wordIdx = Math.abs(wordHash) % this.dimension;
      const wordSign = wordHash & 1 ? 1 : -1;
      vector[wordIdx] += 2.0 * wordSign;

      // 2. Character 3-gram subwords for morphological stem matching
      // (e.g. 'cataract' matches 'cataracts', 'phacoemulsification' matches 'phaco')
      if (token.length >= 3) {
        for (let i = 0; i <= token.length - 3; i++) {
          const gram = token.substring(i, i + 3);
          const gramHash = this.fnv1a(gram);
          const gramIdx = Math.abs(gramHash) % this.dimension;
          const gramSign = gramHash & 1 ? 1 : -1;
          vector[gramIdx] += 0.5 * gramSign;
        }
      }
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      norm += vector[i] * vector[i];
    }

    if (norm > 0) {
      const sqrtNorm = Math.sqrt(norm);
      for (let i = 0; i < this.dimension; i++) {
        vector[i] = vector[i] / sqrtNorm;
      }
    }

    return vector;
  }

  private fnv1a(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash;
  }
}

/**
 * Unified Embedding Service supporting both remote Gemini embeddings
 * and automatic, offline deterministic fallback.
 */
export class EmbeddingService {
  private genAI: GoogleGenerativeAI | null = null;
  private localProvider = new DeterministicLocalEmbeddingProvider();
  private embeddingModelName = 'text-embedding-004';
  private remoteTimeoutMs = 3000;
  private allowRemote = true;

  constructor() {
    const key = config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (key && key.trim() !== '') {
      try {
        this.genAI = new GoogleGenerativeAI(key.trim());
      } catch {
        this.genAI = null;
      }
    }
  }

  /**
   * For testing or offline environments, toggle remote API usage.
   */
  public setAllowRemote(allow: boolean): void {
    this.allowRemote = allow;
  }

  public isRemoteConfigured(): boolean {
    return this.allowRemote && this.genAI !== null;
  }

  /**
   * Embeds a query or clause text with graceful offline fallback.
   */
  public async embedText(text: string): Promise<EmbeddingResult> {
    if (!this.allowRemote || !this.genAI) {
      return {
        vector: this.localProvider.embed(text),
        provider: 'deterministic-local-ngram'
      };
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.embeddingModelName });

      // Timeout wrapper to protect API latency
      const embedPromise = model.embedContent(text);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Embedding request timed out')), this.remoteTimeoutMs)
      );

      const res: any = await Promise.race([embedPromise, timeoutPromise]);
      if (res && res.embedding && Array.isArray(res.embedding.values)) {
        return {
          vector: res.embedding.values,
          provider: 'gemini-text-embedding-004'
        };
      }
    } catch {
      // Graceful fallback to deterministic local provider on rate-limit, timeout, or network error
    }

    return {
      vector: this.localProvider.embed(text),
      provider: 'deterministic-local-ngram'
    };
  }

  /**
   * Batch embeds multiple texts.
   */
  public async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return Promise.all(texts.map((t) => this.embedText(t)));
  }

  public cosineSimilarity(vecA: number[], vecB: number[]): number {
    return calculateCosineSimilarity(vecA, vecB);
  }
}

export const embeddingService = new EmbeddingService();
