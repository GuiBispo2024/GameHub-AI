-- CreateEnum
CREATE TYPE "AgentActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXECUTED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "agent_action_proposals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "toolName" TEXT NOT NULL,
    "validatedArgs" JSONB NOT NULL,
    "argsHash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "preview" JSONB,
    "status" "AgentActionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "executionResult" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_action_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_action_proposals_userId_status_idx" ON "agent_action_proposals"("userId", "status");

-- CreateIndex
CREATE INDEX "agent_action_proposals_sessionId_createdAt_idx" ON "agent_action_proposals"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "agent_action_proposals_expiresAt_idx" ON "agent_action_proposals"("expiresAt");

-- CreateUniqueIndex (DB-level idempotency guarantee for clientRequestId under concurrent requests)
CREATE UNIQUE INDEX IF NOT EXISTS "companion_messages_sessionId_role_clientRequestId_key"
  ON "companion_messages"("sessionId", "role", "clientRequestId")
  WHERE "clientRequestId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "agent_action_proposals" ADD CONSTRAINT "agent_action_proposals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_action_proposals" ADD CONSTRAINT "agent_action_proposals_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "companion_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
