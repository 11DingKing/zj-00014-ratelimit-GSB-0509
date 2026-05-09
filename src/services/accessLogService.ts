import { getPrismaClient } from '../prisma/client';
import { AccessLogEntry } from '../types';

const logQueue: AccessLogEntry[] = [];
const FLUSH_INTERVAL = 1000;
const MAX_BATCH_SIZE = 100;

let flushTimer: NodeJS.Timeout | null = null;

export class AccessLogService {
  
  async logAccess(entry: AccessLogEntry): Promise<void> {
    logQueue.push(entry);
    
    if (logQueue.length >= MAX_BATCH_SIZE) {
      await this.flush();
    }
  }
  
  private async flush(): Promise<void> {
    if (logQueue.length === 0) return;
    
    const entries = logQueue.splice(0, logQueue.length);
    
    try {
      const prisma = getPrismaClient();
      await prisma.accessLog.createMany({
        data: entries
      });
    } catch (error) {
      console.error('Failed to flush access logs:', error);
      logQueue.unshift(...entries);
    }
  }
  
  startPeriodicFlush(): void {
    if (flushTimer) return;
    
    flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, FLUSH_INTERVAL);
  }
  
  stopPeriodicFlush(): void {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }
  
  async flushAll(): Promise<void> {
    await this.flush();
  }
}

export const accessLogService = new AccessLogService();
