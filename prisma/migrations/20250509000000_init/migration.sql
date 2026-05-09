-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('FIXED_WINDOW', 'SLIDING_WINDOW', 'TOKEN_BUCKET', 'LEAKY_BUCKET', 'MONTHLY_QUOTA', 'DAILY_QUOTA');

-- CreateEnum
CREATE TYPE "QuotaType" AS ENUM ('MONTHLY', 'DAILY');

-- CreateTable
CREATE TABLE "Consumer" (
    "id" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consumer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "consumerId" TEXT,
    "strategyType" "StrategyType" NOT NULL,
    "matchConsumer" BOOLEAN NOT NULL DEFAULT false,
    "matchApi" BOOLEAN NOT NULL DEFAULT false,
    "matchUserId" BOOLEAN NOT NULL DEFAULT false,
    "matchIp" BOOLEAN NOT NULL DEFAULT false,
    "matchCustom" BOOLEAN NOT NULL DEFAULT false,
    "apiPattern" TEXT,
    "userIdPattern" TEXT,
    "ipPattern" TEXT,
    "customKey" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit" INTEGER NOT NULL,
    "windowSizeMs" INTEGER,
    "capacity" INTEGER,
    "refillRatePerMs" DOUBLE PRECISION,
    "burst" INTEGER,
    "leakRatePerMs" DOUBLE PRECISION,
    "quotaType" "QuotaType",
    "quotaLimit" INTEGER,
    "onlyQuota" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "api" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "custom" TEXT,
    "allowed" BOOLEAN NOT NULL,
    "reason" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_apiKey_key" ON "Consumer"("apiKey");

-- CreateIndex
CREATE INDEX "AccessLog_consumerId_createdAt_idx" ON "AccessLog"("consumerId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;