import Router from "@koa/router";
import { basicAuth } from "../middleware/auth";
import { policyManager } from "../services/policyManager";
import { metricsService } from "../services/metricsService";
import { resetService } from "../services/resetService";
import { getPrismaClient } from "../prisma/client";

const router = new Router({
  prefix: "/admin",
});

router.use(basicAuth);

/**
 * @swagger
 * /admin/policies:
 *   get:
 *     summary: 获取所有策略
 *     tags: [策略管理]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: 策略列表
 *   post:
 *     summary: 创建策略
 *     tags: [策略管理]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - strategyType
 *               - limit
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               consumerId:
 *                 type: string
 *               strategyType:
 *                 type: string
 *                 enum: [FIXED_WINDOW, SLIDING_WINDOW, TOKEN_BUCKET, LEAKY_BUCKET, MONTHLY_QUOTA, DAILY_QUOTA]
 *               matchConsumer:
 *                 type: boolean
 *               matchApi:
 *                 type: boolean
 *               matchUserId:
 *                 type: boolean
 *               matchIp:
 *                 type: boolean
 *               matchCustom:
 *                 type: boolean
 *               apiPattern:
 *                 type: string
 *               userIdPattern:
 *                 type: string
 *               ipPattern:
 *                 type: string
 *               customKey:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               limit:
 *                 type: integer
 *               windowSizeMs:
 *                 type: integer
 *               capacity:
 *                 type: integer
 *               refillRatePerMs:
 *                 type: number
 *               burst:
 *                 type: integer
 *               leakRatePerMs:
 *                 type: number
 *               quotaType:
 *                 type: string
 *                 enum: [MONTHLY, DAILY]
 *               quotaLimit:
 *                 type: integer
 *               onlyQuota:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get("/policies", async (ctx) => {
  const prisma = getPrismaClient();
  const policies = await prisma.policy.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
  ctx.body = policies;
});

router.post("/policies", async (ctx) => {
  const data = ctx.request.body as any;
  const policy = await policyManager.createPolicy(data);
  ctx.status = 201;
  ctx.body = policy;
});

/**
 * @swagger
 * /admin/policies/{id}:
 *   get:
 *     summary: 获取单个策略
 *     tags: [策略管理]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 策略详情
 *       404:
 *         description: 策略不存在
 *   put:
 *     summary: 更新策略
 *     tags: [策略管理]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     summary: 删除策略
 *     tags: [策略管理]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: 删除成功
 */
router.get("/policies/:id", async (ctx) => {
  const policy = await policyManager.getPolicyById(ctx.params.id);
  if (!policy) {
    ctx.status = 404;
    ctx.body = { error: "Policy not found" };
    return;
  }
  ctx.body = policy;
});

router.put("/policies/:id", async (ctx) => {
  const data = ctx.request.body as any;
  try {
    const policy = await policyManager.updatePolicy(ctx.params.id, data);
    ctx.body = policy;
  } catch (error) {
    ctx.status = 404;
    ctx.body = { error: "Policy not found" };
  }
});

router.delete("/policies/:id", async (ctx) => {
  try {
    await policyManager.deletePolicy(ctx.params.id);
    ctx.status = 204;
  } catch (error) {
    ctx.status = 404;
    ctx.body = { error: "Policy not found" };
  }
});

/**
 * @swagger
 * /admin/usage:
 *   get:
 *     summary: 获取使用量统计
 *     tags: [统计分析]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: consumer
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *     responses:
 *       200:
 *         description: 使用量统计
 */
router.get("/usage", async (ctx) => {
  const consumer = ctx.query.consumer as string;
  const days = parseInt((ctx.query.days as string) || "7", 10);

  if (!consumer) {
    ctx.status = 400;
    ctx.body = { error: "consumer is required" };
    return;
  }

  const usage = await metricsService.getUsage(consumer, days);
  ctx.body = usage;
});

/**
 * @swagger
 * /admin/reset:
 *   post:
 *     summary: 强制重置计数
 *     tags: [运维操作]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *                 description: Redis key 或 key 前缀
 *               pattern:
 *                 type: string
 *                 description: Redis key 模式（使用通配符）
 *               policyId:
 *                 type: string
 *                 description: 策略ID
 *               consumerId:
 *                 type: string
 *                 description: 消费者ID
 *     responses:
 *       200:
 *         description: 重置结果
 */
router.post("/reset", async (ctx) => {
  const body = ctx.request.body as any;

  if (body.key) {
    const success = await resetService.resetKey(body.key);
    ctx.body = { success, key: body.key };
  } else if (body.pattern) {
    const count = await resetService.resetByPattern(body.pattern);
    ctx.body = { count, pattern: body.pattern };
  } else if (body.policyId) {
    const count = await resetService.resetPolicy(body.policyId);
    ctx.body = { count, policyId: body.policyId };
  } else if (body.consumerId) {
    const count = await resetService.resetConsumer(body.consumerId);
    ctx.body = { count, consumerId: body.consumerId };
  } else {
    ctx.status = 400;
    ctx.body = { error: "key, pattern, policyId, or consumerId is required" };
  }
});

/**
 * @swagger
 * /admin/metrics:
 *   get:
 *     summary: 获取性能指标
 *     tags: [统计分析]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: 性能指标
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 p50LatencyMs:
 *                   type: integer
 *                 p95LatencyMs:
 *                   type: integer
 *                 p99LatencyMs:
 *                   type: integer
 *                 qps:
 *                   type: number
 *                 rejectionRate:
 *                   type: number
 *                 totalRequests:
 *                   type: integer
 *                 rejectedRequests:
 *                   type: integer
 */
router.get("/metrics", async (ctx) => {
  const metrics = await metricsService.getMetrics();
  ctx.body = metrics;
});

/**
 * @swagger
 * /admin/whitelist:
 *   get:
 *     summary: 获取白名单列表
 *     tags: [白名单管理]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: 按资源过滤
 *     responses:
 *       200:
 *         description: 白名单列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   resource:
 *                     type: string
 *                   subject:
 *                     type: string
 *                   reason:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *   post:
 *     summary: 添加白名单规则
 *     tags: [白名单管理]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resource
 *               - subject
 *             properties:
 *               resource:
 *                 type: string
 *                 description: 资源标识（如 consumer ID）
 *               subject:
 *                 type: string
 *                 description: 主体标识（如 API 路径），支持通配符 *
 *               reason:
 *                 type: string
 *                 description: 白名单原因
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 resource:
 *                   type: string
 *                 subject:
 *                   type: string
 *                 reason:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 */
router.get("/whitelist", async (ctx) => {
  const resource = ctx.query.resource as string | undefined;
  const entries = await policyManager.getWhitelistEntries(resource);
  ctx.body = entries;
});

router.post("/whitelist", async (ctx) => {
  const data = ctx.request.body as any;

  if (!data.resource || !data.subject) {
    ctx.status = 400;
    ctx.body = { error: "resource and subject are required" };
    return;
  }

  try {
    const entry = await policyManager.addWhitelist({
      resource: data.resource,
      subject: data.subject,
      reason: data.reason,
    });
    ctx.status = 201;
    ctx.body = entry;
  } catch (error: any) {
    if (error.code === "P2002") {
      ctx.status = 409;
      ctx.body = {
        error: "Whitelist entry already exists for this resource and subject",
      };
    } else {
      throw error;
    }
  }
});

/**
 * @swagger
 * /admin/whitelist/{id}:
 *   delete:
 *     summary: 删除白名单规则
 *     tags: [白名单管理]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: 删除成功
 *       404:
 *         description: 白名单规则不存在
 */
router.delete("/whitelist/:id", async (ctx) => {
  try {
    await policyManager.deleteWhitelist(ctx.params.id);
    ctx.status = 204;
  } catch (error) {
    ctx.status = 404;
    ctx.body = { error: "Whitelist entry not found" };
  }
});

export default router;
