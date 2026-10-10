import { z } from 'zod';

export const ChatHistoryMessageZod = z.object({
  sender: z.enum(['user', 'assistant']),
  text: z.string().min(1, 'Message text cannot be empty').max(3000, 'Message history text exceeds 3000 chars')
});

export const RecommendedHospitalItemZod = z.object({
  name: z.string().max(200),
  locality: z.string().max(200).optional(),
  networkStatus: z.string().max(100).optional(),
  patientPayable: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
  rank: z.union([z.number(), z.string()]).optional(),
  cashless: z.boolean().optional()
});

export const AssistantContextZod = z.object({
  currentView: z.string().max(100).optional(),
  policyId: z.string().max(100).optional(),
  hospitalId: z.string().max(100).optional(),
  claimId: z.string().max(100).optional(),
  scenarioId: z.string().max(100).optional(),
  procedureName: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
  roomCategory: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  mode: z.string().max(100).optional(),
  recommendedHospitals: z.array(RecommendedHospitalItemZod).max(10).optional(),
  guidanceText: z.string().max(2000).optional()
}).optional();

export const AssistantChatRequestZod = z.object({
  message: z.string().trim().min(1, 'Please provide a non-empty question').max(2000, 'Question must not exceed 2000 characters'),
  history: z.array(ChatHistoryMessageZod).max(10, 'History cannot exceed 10 messages').optional().default([]),
  context: AssistantContextZod,
  language: z.enum(['en', 'hi']).optional().default('en')
});

export type AssistantChatRequest = z.infer<typeof AssistantChatRequestZod>;

export interface AssistantChatEvidence {
  snippet?: string | null;
  sectionName?: string | null;
  documentStated?: boolean;
}

export interface AssistantChatResponse {
  answer: string;
  evidence?: AssistantChatEvidence;
  provenance: 'Policy Grounded' | 'Claim Engine' | 'Hospital Directory' | 'Cost Benchmark' | 'Care Guidance' | 'System Assessment';
  confidence: 'High' | 'Medium' | 'Low';
  suggestedQuestions: string[];
  missingInformation?: string[];
  spokenText?: string;
}
