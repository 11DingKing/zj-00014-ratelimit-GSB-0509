import { Policy } from "@prisma/client";
import { policyManager } from "./policyManager";
import { rateLimiterService } from "./rateLimiter";
import { accessLogService } from "./accessLogService";
import {
  CheckRequest,
  CheckResponse,
  PolicyMatchContext,
  PolicyExecutionResult,
} from "../types";

export class CheckService {
  async check(request: CheckRequest): Promise<CheckResponse> {
    const startTime = Date.now();
    const weight = request.weight || 1;

    const context: PolicyMatchContext = {
      consumer: request.consumer,
      api: request.api,
      userId: request.userId,
      ip: request.ip,
      custom: request.custom,
    };

    const whitelisted = await policyManager.isWhitelisted(
      request.api,
      request.consumer,
    );
    if (whitelisted) {
      const latencyMs = Date.now() - startTime;
      await accessLogService.logAccess({
        consumerId: request.consumer,
        api: request.api,
        userId: request.userId,
        ip: request.ip,
        custom: request.custom,
        allowed: true,
        reason: "whitelisted",
        latencyMs,
        weight,
      });

      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        resetAt: Date.now() + 3600000,
        reason: "whitelisted",
      };
    }

    const matchedPolicies = await policyManager.matchPolicies(context);

    if (matchedPolicies.length === 0) {
      const latencyMs = Date.now() - startTime;
      await accessLogService.logAccess({
        consumerId: request.consumer,
        api: request.api,
        userId: request.userId,
        ip: request.ip,
        custom: request.custom,
        allowed: true,
        reason: "no_policy_matched",
        latencyMs,
        weight,
      });

      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        resetAt: Date.now() + 3600000,
      };
    }

    const results: PolicyExecutionResult[] = [];

    for (const policy of matchedPolicies) {
      const result = await rateLimiterService.executePolicy(
        policy,
        context,
        weight,
      );
      results.push(result);
    }

    const finalResult = this.determineFinalResult(results);

    const latencyMs = Date.now() - startTime;

    await accessLogService.logAccess({
      consumerId: request.consumer,
      api: request.api,
      userId: request.userId,
      ip: request.ip,
      custom: request.custom,
      allowed: finalResult.allowed,
      reason: finalResult.reason,
      latencyMs,
      weight,
    });

    return {
      allowed: finalResult.allowed,
      remaining: finalResult.remaining,
      resetAt: finalResult.resetAt,
      reason: finalResult.reason,
    };
  }

  private determineFinalResult(results: PolicyExecutionResult[]): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    reason?: string;
  } {
    const quotaResults = results.filter((r) => r.onlyQuota);
    const rateLimitResults = results.filter((r) => !r.onlyQuota);

    let rateLimitAllowed = true;
    let quotaAllowed = true;

    let minRateLimitRemaining = Number.MAX_SAFE_INTEGER;
    let minQuotaRemaining = Number.MAX_SAFE_INTEGER;

    let earliestRateLimitReset = Number.MAX_SAFE_INTEGER;
    let earliestQuotaReset = Number.MAX_SAFE_INTEGER;

    let rateLimitRejectReason: string | undefined;
    let quotaRejectReason: string | undefined;

    for (const result of rateLimitResults) {
      if (!result.allowed) {
        rateLimitAllowed = false;
        if (!rateLimitRejectReason) {
          rateLimitRejectReason = result.reason;
        }
        if (result.resetAt < earliestRateLimitReset) {
          earliestRateLimitReset = result.resetAt;
        }
      }
      if (result.remaining < minRateLimitRemaining) {
        minRateLimitRemaining = result.remaining;
      }
      if (result.resetAt < earliestRateLimitReset && result.allowed) {
        earliestRateLimitReset = result.resetAt;
      }
    }

    for (const result of quotaResults) {
      if (!result.allowed) {
        quotaAllowed = false;
        if (!quotaRejectReason) {
          quotaRejectReason = result.reason;
        }
        if (result.resetAt < earliestQuotaReset) {
          earliestQuotaReset = result.resetAt;
        }
      }
      if (result.remaining < minQuotaRemaining) {
        minQuotaRemaining = result.remaining;
      }
      if (result.resetAt < earliestQuotaReset && result.allowed) {
        earliestQuotaReset = result.resetAt;
      }
    }

    const allowed = rateLimitAllowed && quotaAllowed;

    const remaining = Math.min(
      rateLimitResults.length > 0
        ? minRateLimitRemaining
        : Number.MAX_SAFE_INTEGER,
      quotaResults.length > 0 ? minQuotaRemaining : Number.MAX_SAFE_INTEGER,
    );

    const resetAt = Math.min(
      rateLimitResults.length > 0
        ? earliestRateLimitReset
        : Number.MAX_SAFE_INTEGER,
      quotaResults.length > 0 ? earliestQuotaReset : Number.MAX_SAFE_INTEGER,
    );

    let reason: string | undefined;
    if (!rateLimitAllowed && rateLimitRejectReason) {
      reason = rateLimitRejectReason;
    } else if (!quotaAllowed && quotaRejectReason) {
      reason = quotaRejectReason;
    }

    return {
      allowed,
      remaining,
      resetAt,
      reason,
    };
  }
}

export const checkService = new CheckService();
