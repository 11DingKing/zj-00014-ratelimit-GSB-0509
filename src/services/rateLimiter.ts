import { Policy, StrategyType } from '@prisma/client';
import { getRedisClient, getScripts } from '../redis/client';
import { PolicyExecutionResult, PolicyMatchContext } from '../types';
import { policyManager } from './policyManager';

export class RateLimiterService {
  
  async executePolicy(
    policy: Policy,
    context: PolicyMatchContext,
    weight: number
  ): Promise<PolicyExecutionResult> {
    const key = policyManager.generatePolicyKey(policy, context);
    
    switch (policy.strategyType) {
      case StrategyType.FIXED_WINDOW:
        return this.executeFixedWindow(policy, key, weight);
        
      case StrategyType.SLIDING_WINDOW:
        return this.executeSlidingWindow(policy, key, weight);
        
      case StrategyType.TOKEN_BUCKET:
        return this.executeTokenBucket(policy, key, weight);
        
      case StrategyType.LEAKY_BUCKET:
        return this.executeLeakyBucket(policy, key, weight);
        
      case StrategyType.MONTHLY_QUOTA:
        return this.executeMonthlyQuota(policy, key, weight);
        
      case StrategyType.DAILY_QUOTA:
        return this.executeDailyQuota(policy, key, weight);
        
      default:
        return {
          allowed: true,
          remaining: policy.limit,
          resetAt: Date.now() + 60000,
          reason: 'unknown_strategy',
          policyId: policy.id,
          onlyQuota: policy.onlyQuota
        };
    }
  }
  
  private async executeFixedWindow(
    policy: Policy,
    key: string,
    weight: number
  ): Promise<PolicyExecutionResult> {
    const redis = getRedisClient();
    const scripts = getScripts();
    
    const result = await redis.eval(
      scripts.fixedWindow,
      1,
      key,
      policy.windowSizeMs || 60000,
      policy.limit,
      weight
    ) as [number, number, number];
    
    const allowed = result[0] === 1;
    
    return {
      allowed,
      remaining: result[1],
      resetAt: result[2],
      reason: allowed ? '' : 'fixed_window_exceeded',
      policyId: policy.id,
      onlyQuota: policy.onlyQuota
    };
  }
  
  private async executeSlidingWindow(
    policy: Policy,
    key: string,
    weight: number
  ): Promise<PolicyExecutionResult> {
    const redis = getRedisClient();
    const scripts = getScripts();
    
    const result = await redis.eval(
      scripts.slidingWindow,
      1,
      key,
      policy.windowSizeMs || 60000,
      policy.limit,
      weight
    ) as [number, number, number];
    
    const allowed = result[0] === 1;
    
    return {
      allowed,
      remaining: result[1],
      resetAt: result[2],
      reason: allowed ? '' : 'sliding_window_exceeded',
      policyId: policy.id,
      onlyQuota: policy.onlyQuota
    };
  }
  
  private async executeTokenBucket(
    policy: Policy,
    key: string,
    weight: number
  ): Promise<PolicyExecutionResult> {
    const redis = getRedisClient();
    const scripts = getScripts();
    
    const result = await redis.eval(
      scripts.tokenBucket,
      1,
      key,
      policy.capacity || policy.limit,
      policy.refillRatePerMs || (policy.limit / 60000),
      weight
    ) as [number, number, number];
    
    const allowed = result[0] === 1;
    
    return {
      allowed,
      remaining: result[1],
      resetAt: result[2],
      reason: allowed ? '' : 'token_bucket_empty',
      policyId: policy.id,
      onlyQuota: policy.onlyQuota
    };
  }
  
  private async executeLeakyBucket(
    policy: Policy,
    key: string,
    weight: number
  ): Promise<PolicyExecutionResult> {
    const redis = getRedisClient();
    const scripts = getScripts();
    
    const result = await redis.eval(
      scripts.leakyBucket,
      1,
      key,
      policy.burst || policy.limit,
      policy.leakRatePerMs || (policy.limit / 60000),
      weight
    ) as [number, number, number];
    
    const allowed = result[0] === 1;
    
    return {
      allowed,
      remaining: result[1],
      resetAt: result[2],
      reason: allowed ? '' : 'leaky_bucket_full',
      policyId: policy.id,
      onlyQuota: policy.onlyQuota
    };
  }
  
  private async executeMonthlyQuota(
    policy: Policy,
    key: string,
    weight: number
  ): Promise<PolicyExecutionResult> {
    const redis = getRedisClient();
    const scripts = getScripts();
    
    const result = await redis.eval(
      scripts.monthlyQuota,
      1,
      key,
      policy.quotaLimit || policy.limit,
      weight,
      Date.now()
    ) as [number, number, number];
    
    const allowed = result[0] === 1;
    
    return {
      allowed,
      remaining: result[1],
      resetAt: result[2],
      reason: allowed ? '' : 'monthly_quota_exceeded',
      policyId: policy.id,
      onlyQuota: policy.onlyQuota
    };
  }
  
  private async executeDailyQuota(
    policy: Policy,
    key: string,
    weight: number
  ): Promise<PolicyExecutionResult> {
    const redis = getRedisClient();
    const scripts = getScripts();
    
    const result = await redis.eval(
      scripts.dailyQuota,
      1,
      key,
      policy.quotaLimit || policy.limit,
      weight,
      Date.now()
    ) as [number, number, number];
    
    const allowed = result[0] === 1;
    
    return {
      allowed,
      remaining: result[1],
      resetAt: result[2],
      reason: allowed ? '' : 'daily_quota_exceeded',
      policyId: policy.id,
      onlyQuota: policy.onlyQuota
    };
  }
}

export const rateLimiterService = new RateLimiterService();
