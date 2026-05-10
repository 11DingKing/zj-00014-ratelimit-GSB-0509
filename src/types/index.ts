import { StrategyType, QuotaType } from "@prisma/client";

export interface CheckRequest {
  consumer: string;
  api: string;
  userId?: string;
  ip?: string;
  custom?: string;
  weight?: number;
}

export interface CheckResponse {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  reason?: string;
}

export interface PolicyMatchContext {
  consumer: string;
  api: string;
  userId?: string;
  ip?: string;
  custom?: string;
}

export interface PolicyExecutionResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  reason: string;
  policyId: string;
  onlyQuota: boolean;
}

export interface AccessLogEntry {
  consumerId: string;
  api: string;
  userId?: string;
  ip?: string;
  custom?: string;
  allowed: boolean;
  reason?: string;
  latencyMs: number;
  weight: number;
}

export interface MetricsResponse {
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  qps: number;
  rejectionRate: number;
  totalRequests: number;
  rejectedRequests: number;
}

export interface UsageDataPoint {
  date: string;
  totalRequests: number;
  allowedRequests: number;
  rejectedRequests: number;
}

export interface UsageResponse {
  consumer: string;
  days: number;
  data: UsageDataPoint[];
}

export interface WhitelistEntry {
  id: string;
  resource: string;
  subject: string;
  reason?: string;
  createdAt: Date;
}

export interface WhitelistCheckResult {
  whitelisted: boolean;
  reason?: string;
}
