import Koa from "koa";
import bodyParser from "koa-bodyparser";
import Router from "@koa/router";
import { koaSwagger } from "koa2-swagger-ui";
import { config } from "./config";
import { swaggerSpec } from "./swagger";
import checkRoutes from "./routes/check";
import adminRoutes from "./routes/admin";
import { accessLogService } from "./services/accessLogService";
import { getPrismaClient, closePrisma } from "./prisma/client";
import { getRedisClient, closeRedis } from "./redis/client";
import { startGrpcServer } from "./grpc/server";

const app = new Koa();
const router = new Router();

app.use(
  bodyParser({
    enableTypes: ["json"],
    jsonLimit: "1mb",
  }),
);

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error("Error:", error);
    ctx.status = 500;
    ctx.body = { error: "Internal Server Error" };
  }
});

router.get("/health", (ctx) => {
  ctx.body = { status: "ok" };
});

router.get("/api-docs.json", (ctx) => {
  ctx.body = swaggerSpec;
});

router.use("/check", checkRoutes.routes(), checkRoutes.allowedMethods());

app.use(router.routes());
app.use(router.allowedMethods());
app.use(adminRoutes.routes());
app.use(adminRoutes.allowedMethods());

app.use(
  koaSwagger({
    routePrefix: "/api/docs",
    swaggerOptions: {
      url: "/api-docs.json",
    },
  }),
);

async function startServer() {
  try {
    await getPrismaClient().$connect();
    console.log("Database connected");

    await getRedisClient().ping();
    console.log("Redis connected");

    accessLogService.startPeriodicFlush();

    const server = app.listen(config.port, () => {
      console.log(`HTTP server running on port ${config.port}`);
      console.log(`API Docs: http://localhost:${config.port}/api/docs`);
      console.log(`Health check: http://localhost:${config.port}/health`);
    });

    const grpcServer = await startGrpcServer();

    const shutdown = async () => {
      console.log("Shutting down...");

      accessLogService.stopPeriodicFlush();
      await accessLogService.flushAll();

      await closePrisma();
      await closeRedis();

      grpcServer.forceShutdown();
      console.log("gRPC server closed");

      server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
