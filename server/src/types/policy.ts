export type PolicyType = 'individual' | 'floater' | 'corporate' | 'pmjay' | 'esi' | 'private';
export type NetworkType = 'all-network' | 'restricted-network' | 'reimbursement-only';
export type LimitType = 'amount' | 'percent' | 'category' | 'none';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'assumed';

export type SourceStatus = 'document_stated' | 'not_detected' | 'system_inferred' | 'user_confirmed';

export interface RoomOrIcuLimit {
  type: LimitType;
  value?: number | string | null;
}

export interface InsuredPerson {
  name: string;
  age: number;
  relation: string;
}

export interface WaitingPeriods {
  initial?: string | null;
  preExisting?: string | null;
  maternity?: string | null;
  procedures?: Record<string, string>;
}

export interface PolicyDocument {
  _id: string;
  createdAt: string;
  updatedAt: string;
  confirmedByUser: boolean;

  insurer: string | null;
  insurerAliases: string[];
  planName: string | null;
  policyType: PolicyType | null;
  policyNumber: string | null;
  uin: string | null;
  policyStartDate: string | null;
  policyEndDate: string | null;
  zone: string | null;
  networkType: NetworkType | null;
  cashlessAvailable?: boolean | null;
  tpa: string | null;
  insuredPersons: InsuredPerson[];

  sumInsured: number | null;
  roomLimit: RoomOrIcuLimit | null;
  icuLimit: RoomOrIcuLimit | null;
  copay: number | null;
  nonNetworkCopay: number | null;
  copayConditions: Record<string, number>;
  deductible: number | null;
  proportionateDeduction: boolean | null;
  roomCategoryRestriction?: boolean | null;
  roomCategoryRestrictionNote?: string | null;
  cataractRestriction?: string | null;
  subLimits: Record<string, number>;
  restorationBenefit: boolean | null;
  cumulativeBonus: number | null;

  exclusions: string[];
  hasOtherExclusions: boolean | null;
  waitingPeriods: WaitingPeriods | null;
  preHospitalizationDays: number | null;
  postHospitalizationDays: number | null;
  daycareCovered: boolean | null;
  ambulanceLimit: number | null;
  preAuthHours: number | null;
  claimIntimationHours: number | null;

  sourceSnippets: Record<string, string>;
  confidence: Record<string, ConfidenceLevel>;
  sourceStatuses?: Record<string, SourceStatus>;
  rawTextRef: string | null;
}

export const TIER_1_REQUIRED_FIELDS: (keyof PolicyDocument)[] = [
  'insurer',
  'policyType',
  'sumInsured',
  'roomLimit',
  'copay',
  'deductible',
  'proportionateDeduction'
];
