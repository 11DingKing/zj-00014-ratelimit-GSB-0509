-- CreateTable
CREATE TABLE "Whitelist" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Whitelist_resource_subject_idx" ON "Whitelist"("resource", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "Whitelist_resource_subject_key" ON "Whitelist"("resource", "subject");
