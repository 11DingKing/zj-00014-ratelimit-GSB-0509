export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  
  databaseUrl: process.env.DATABASE_URL!,
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || ''
  },
  
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123456'
  },
  
  swagger: {
    title: process.env.SWAGGER_TITLE || '统一限流与配额服务',
    description: process.env.SWAGGER_DESCRIPTION || '为其他服务提供统一限流与配额管理',
    version: process.env.SWAGGER_VERSION || '1.0.0'
  },
  
  policyCacheTtl: 1000,
  
  policyUpdateChannel: 'policy:update'
};
