import Redis from 'ioredis';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

let redis: Redis | null = null;
let pubSubRedis: Redis | null = null;

interface Scripts {
  fixedWindow: string;
  slidingWindow: string;
  tokenBucket: string;
  leakyBucket: string;
  monthlyQuota: string;
  dailyQuota: string;
}

let scripts: Scripts | null = null;

function loadScripts(): Scripts {
  if (scripts) return scripts;
  
  const scriptsDir = path.join(__dirname, 'scripts');
  
  scripts = {
    fixedWindow: fs.readFileSync(path.join(scriptsDir, 'fixed_window.lua'), 'utf8'),
    slidingWindow: fs.readFileSync(path.join(scriptsDir, 'sliding_window.lua'), 'utf8'),
    tokenBucket: fs.readFileSync(path.join(scriptsDir, 'token_bucket.lua'), 'utf8'),
    leakyBucket: fs.readFileSync(path.join(scriptsDir, 'leaky_bucket.lua'), 'utf8'),
    monthlyQuota: fs.readFileSync(path.join(scriptsDir, 'monthly_quota.lua'), 'utf8'),
    dailyQuota: fs.readFileSync(path.join(scriptsDir, 'daily_quota.lua'), 'utf8')
  };
  
  return scripts;
}

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true
    });
  }
  return redis;
}

export function getPubSubRedisClient(): Redis {
  if (!pubSubRedis) {
    pubSubRedis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      lazyConnect: false
    });
  }
  return pubSubRedis;
}

export function getScripts(): Scripts {
  return loadScripts();
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
  if (pubSubRedis) {
    await pubSubRedis.quit();
    pubSubRedis = null;
  }
}
