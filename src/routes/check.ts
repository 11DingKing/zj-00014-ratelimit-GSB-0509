import Router from '@koa/router';
import { checkService } from '../services/checkService';
import { CheckRequest } from '../types';

const router = new Router();

/**
 * @swagger
 * /check:
 *   post:
 *     summary: 检查限流和配额
 *     tags: [限流检查]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consumer
 *               - api
 *             properties:
 *               consumer:
 *                 type: string
 *                 description: 消费者ID
 *               api:
 *                 type: string
 *                 description: API路径
 *               userId:
 *                 type: string
 *                 description: 用户ID
 *               ip:
 *                 type: string
 *                 description: IP地址
 *               custom:
 *                 type: string
 *                 description: 自定义键
 *               weight:
 *                 type: integer
 *                 description: 请求权重，默认1
 *     responses:
 *       200:
 *         description: 检查结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 allowed:
 *                   type: boolean
 *                   description: 是否允许通过
 *                 remaining:
 *                   type: integer
 *                   description: 剩余配额/令牌数
 *                 resetAt:
 *                   type: integer
 *                   description: 重置时间戳(ms)
 *                 reason:
 *                   type: string
 *                   description: 拒绝原因
 */
router.post('/', async (ctx) => {
  const body = ctx.request.body as CheckRequest;
  
  if (!body.consumer || !body.api) {
    ctx.status = 400;
    ctx.body = { error: 'consumer and api are required' };
    return;
  }
  
  const result = await checkService.check(body);
  ctx.body = result;
});

export default router;
