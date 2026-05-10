CREATE TABLE "Whitelist" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Whitelist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Whitelist_resource_subject_key" ON "Whitelist"("resource", "subject");

CREATE INDEX "Whitelist_resource_idx" ON "Whitelist"("resource");

CREATE INDEX "Whitelist_subject_idx" ON "Whitelist"("subject");
