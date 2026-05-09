import { getPrismaClient } from '../prisma/client';
import { MetricsResponse, UsageResponse, UsageDataPoint } from '../types';

export class MetricsService {
  
  async getMetrics(): Promise<MetricsResponse> {
    const prisma = getPrismaClient();
    const oneMinuteAgo = new Date(Date.now() - 60000);
    
    const logs = await prisma.accessLog.findMany({
      where: {
        createdAt: {
          gte: oneMinuteAgo
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    if (logs.length === 0) {
      return {
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        qps: 0,
        rejectionRate: 0,
        totalRequests: 0,
        rejectedRequests: 0
      };
    }
    
    const latencies = logs.map(log => log.latencyMs).sort((a, b) => a - b);
    const totalRequests = logs.length;
    const rejectedRequests = logs.filter(log => !log.allowed).length;
    
    const p50 = this.percentile(latencies, 50);
    const p95 = this.percentile(latencies, 95);
    const p99 = this.percentile(latencies, 99);
    
    const timeSpanMs = (logs[logs.length - 1].createdAt.getTime() - logs[0].createdAt.getTime()) || 60000;
    const qps = totalRequests / (timeSpanMs / 1000);
    const rejectionRate = totalRequests > 0 ? rejectedRequests / totalRequests : 0;
    
    return {
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      qps: Math.round(qps * 100) / 100,
      rejectionRate: Math.round(rejectionRate * 10000) / 10000,
      totalRequests,
      rejectedRequests
    };
  }
  
  async getUsage(consumer: string, days: number = 7): Promise<UsageResponse> {
    const prisma = getPrismaClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const logs = await prisma.accessLog.findMany({
      where: {
        consumerId: consumer,
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    const dataMap: Map<string, UsageDataPoint> = new Map();
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      dataMap.set(dateStr, {
        date: dateStr,
        totalRequests: 0,
        allowedRequests: 0,
        rejectedRequests: 0
      });
    }
    
    for (const log of logs) {
      const dateStr = log.createdAt.toISOString().split('T')[0];
      const dataPoint = dataMap.get(dateStr);
      if (dataPoint) {
        dataPoint.totalRequests++;
        if (log.allowed) {
          dataPoint.allowedRequests++;
        } else {
          dataPoint.rejectedRequests++;
        }
      }
    }
    
    const data = Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      consumer,
      days,
      data
    };
  }
  
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }
}

export const metricsService = new MetricsService();
