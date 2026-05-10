import { PrismaClient, Policy, StrategyType, Whitelist } from "@prisma/client";
import { getPrismaClient } from "../prisma/client";
import { getRedisClient, getPubSubRedisClient } from "../redis/client";
import { config } from "../config";
import { PolicyMatchContext } from "../types";

interface CachedPolicies {
  policies: Policy[];
  timestamp: number;
}

let cachedPolicies: CachedPolicies | null = null;

export class PolicyManager {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
    this.setupPolicyUpdateListener();
  }

  private setupPolicyUpdateListener(): void {
    const pubSub = getPubSubRedisClient();
    pubSub.subscribe(config.policyUpdateChannel, (err) => {
      if (err) {
        console.error("Failed to subscribe to policy updates:", err);
      }
    });

    pubSub.on("message", (channel, message) => {
      if (channel === config.policyUpdateChannel) {
        console.log("Policy update received, clearing cache");
        cachedPolicies = null;
      }
    });
  }

  async getPolicies(): Promise<Policy[]> {
    const now = Date.now();

    if (
      cachedPolicies &&
      now - cachedPolicies.timestamp < config.policyCacheTtl
    ) {
      return cachedPolicies.policies;
    }

    const policies = await this.prisma.policy.findMany({
      where: {
        enabled: true,
      },
    });

    cachedPolicies = {
      policies,
      timestamp: now,
    };

    return policies;
  }

  async getPolicyById(id: string): Promise<Policy | null> {
    return this.prisma.policy.findUnique({
      where: { id },
    });
  }

  async createPolicy(
    data: Omit<Policy, "id" | "createdAt" | "updatedAt">,
  ): Promise<Policy> {
    const policy = await this.prisma.policy.create({
      data,
    });

    await this.notifyPolicyUpdate();
    return policy;
  }

  async updatePolicy(
    id: string,
    data: Partial<Omit<Policy, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Policy> {
    const policy = await this.prisma.policy.update({
      where: { id },
      data,
    });

    await this.notifyPolicyUpdate();
    return policy;
  }

  async deletePolicy(id: string): Promise<void> {
    await this.prisma.policy.delete({
      where: { id },
    });

    await this.notifyPolicyUpdate();
  }

  async notifyPolicyUpdate(): Promise<void> {
    const redis = getRedisClient();
    await redis.publish(config.policyUpdateChannel, "update");
    cachedPolicies = null;
  }

  async matchPolicies(context: PolicyMatchContext): Promise<Policy[]> {
    const policies = await this.getPolicies();

    const matchedPolicies: Policy[] = [];

    for (const policy of policies) {
      if (this.matchesPolicy(policy, context)) {
        matchedPolicies.push(policy);
      }
    }

    return matchedPolicies;
  }

  private matchesPolicy(policy: Policy, context: PolicyMatchContext): boolean {
    if (policy.matchConsumer && policy.consumerId) {
      if (context.consumer !== policy.consumerId) {
        return false;
      }
    }

    if (policy.matchApi && policy.apiPattern) {
      if (!this.matchesPattern(policy.apiPattern, context.api)) {
        return false;
      }
    }

    if (policy.matchUserId && policy.userIdPattern) {
      if (
        !context.userId ||
        !this.matchesPattern(policy.userIdPattern, context.userId)
      ) {
        return false;
      }
    }

    if (policy.matchIp && policy.ipPattern) {
      if (!context.ip || !this.matchesPattern(policy.ipPattern, context.ip)) {
        return false;
      }
    }

    if (policy.matchCustom && policy.customKey) {
      if (!context.custom || context.custom !== policy.customKey) {
        return false;
      }
    }

    return true;
  }

  private matchesPattern(pattern: string, value: string): boolean {
    if (pattern.includes("*")) {
      const regexPattern = pattern.replace(/\*/g, ".*");
      const regex = new RegExp("^" + regexPattern + "$");
      return regex.test(value);
    }
    return pattern === value;
  }

  generatePolicyKey(policy: Policy, context: PolicyMatchContext): string {
    const parts: string[] = ["policy", policy.id];

    if (policy.matchConsumer) {
      parts.push(context.consumer);
    }

    if (policy.matchApi) {
      parts.push(context.api);
    }

    if (policy.matchUserId && context.userId) {
      parts.push(context.userId);
    }

    if (policy.matchIp && context.ip) {
      parts.push(context.ip);
    }

    if (policy.matchCustom && context.custom) {
      parts.push(context.custom);
    }

    return parts.join(":");
  }

  private whitelistCacheKey(resource: string, subject: string): string {
    return `whitelist:${resource}:${subject}`;
  }

  async checkWhitelist(resource: string, subject: string): Promise<boolean> {
    const redis = getRedisClient();
    const exactKey = this.whitelistCacheKey(resource, subject);
    const wildcardKey = this.whitelistCacheKey(resource, "*");

    const [exactHit, wildcardHit] = await redis.mget(exactKey, wildcardKey);

    if (exactHit === "1") return true;
    if (wildcardHit === "1") return true;
    if (exactHit === "0" && wildcardHit === "0") return false;

    const prisma = this.prisma;
    const entries = await prisma.whitelist.findMany({
      where: {
        resource,
        subject: { in: [subject, "*"] },
      },
    });

    const exactEntry = entries.find((e) => e.subject === subject);
    const wildcardEntry = entries.find((e) => e.subject === "*");

    const ttlSeconds = 60;

    if (exactEntry) {
      await redis.setex(exactKey, ttlSeconds, "1");
      return true;
    } else {
      await redis.setex(exactKey, ttlSeconds, "0");
    }

    if (wildcardEntry) {
      await redis.setex(wildcardKey, ttlSeconds, "1");
      return true;
    } else {
      await redis.setex(wildcardKey, ttlSeconds, "0");
    }

    return false;
  }

  async addWhitelist(data: {
    resource: string;
    subject: string;
    reason?: string;
  }): Promise<Whitelist> {
    const entry = await this.prisma.whitelist.create({
      data: {
        resource: data.resource,
        subject: data.subject,
        reason: data.reason,
      },
    });

    await this.invalidateWhitelistCache(data.resource, data.subject);
    return entry;
  }

  async deleteWhitelist(id: string): Promise<void> {
    const entry = await this.prisma.whitelist.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new Error("Whitelist entry not found");
    }

    await this.prisma.whitelist.delete({
      where: { id },
    });

    await this.invalidateWhitelistCache(entry.resource, entry.subject);
  }

  async getWhitelistEntries(resource?: string): Promise<Whitelist[]> {
    const where: any = {};
    if (resource) {
      where.resource = resource;
    }
    return this.prisma.whitelist.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getWhitelistById(id: string): Promise<Whitelist | null> {
    return this.prisma.whitelist.findUnique({
      where: { id },
    });
  }

  async invalidateWhitelistCache(
    resource: string,
    subject: string,
  ): Promise<void> {
    const redis = getRedisClient();
    const keysToDelete = [
      this.whitelistCacheKey(resource, subject),
      this.whitelistCacheKey(resource, "*"),
    ];
    await redis.del(...keysToDelete);
  }
}

export const policyManager = new PolicyManager();
