import { getRedisClient } from '../redis/client';

export class ResetService {
  
  async resetKey(key: string): Promise<boolean> {
    const redis = getRedisClient();
    
    const keys = await redis.keys(`${key}*`);
    
    if (keys.length === 0) {
      return false;
    }
    
    await redis.del(...keys);
    return true;
  }
  
  async resetByPattern(pattern: string): Promise<number> {
    const redis = getRedisClient();
    
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    await redis.del(...keys);
    return keys.length;
  }
  
  async resetPolicy(policyId: string): Promise<number> {
    return this.resetByPattern(`policy:${policyId}:*`);
  }
  
  async resetConsumer(consumerId: string): Promise<number> {
    return this.resetByPattern(`*:${consumerId}:*`);
  }
}

export const resetService = new ResetService();
