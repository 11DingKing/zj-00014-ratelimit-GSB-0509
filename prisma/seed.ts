import { PrismaClient, StrategyType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始 seed 数据...');
  
  const existingConsumer = await prisma.consumer.findUnique({
    where: { apiKey: 'demo' }
  });
  
  if (existingConsumer) {
    console.log('Consumer 已存在，跳过创建');
  } else {
    const consumer = await prisma.consumer.create({
      data: {
        apiKey: 'demo',
        secret: 'demo',
        name: 'Demo Consumer'
      }
    });
    console.log(`创建 Consumer: ${consumer.apiKey}`);
    
    await prisma.policy.createMany({
      data: [
        {
          name: 'Demo Token Bucket Policy',
          description: '测试令牌桶策略，每分钟 100 个请求',
          consumerId: consumer.id,
          strategyType: StrategyType.TOKEN_BUCKET,
          matchConsumer: true,
          matchApi: true,
          apiPattern: '*',
          enabled: true,
          limit: 100,
          capacity: 100,
          refillRatePerMs: 100 / 60000
        },
        {
          name: 'Demo Monthly Quota Policy',
          description: '测试月度配额策略，每月 10000 次',
          consumerId: consumer.id,
          strategyType: StrategyType.MONTHLY_QUOTA,
          matchConsumer: true,
          matchApi: true,
          apiPattern: '*',
          enabled: true,
          limit: 10000,
          quotaLimit: 10000
        }
      ]
    });
    console.log('创建 2 个策略完成');
  }
  
  console.log('Seed 完成!');
  console.log('');
  console.log('测试命令:');
  console.log('curl -X POST http://localhost:13014/check \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"consumer": "demo", "api": "/test"}\'');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
