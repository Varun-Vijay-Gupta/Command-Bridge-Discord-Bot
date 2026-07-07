-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'COMPLETED', 'DEFERRED', 'FAILED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordServer" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "ownerId" TEXT,
    "botChannelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandRule" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "responseTemplate" TEXT,
    "mirrorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoTagEnabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionLog" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "serverId" TEXT,
    "commandName" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "channelId" TEXT,
    "status" "InteractionStatus" NOT NULL DEFAULT 'RECEIVED',
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiSummary" TEXT,
    "processingMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InteractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailureLog" (
    "id" TEXT NOT NULL,
    "interactionLogId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "stackTrace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "mirrorWebhookUrl" TEXT,
    "mirrorWebhookType" TEXT,
    "aiProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordServer_guildId_key" ON "DiscordServer"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "CommandRule_serverId_commandName_key" ON "CommandRule"("serverId", "commandName");

-- CreateIndex
CREATE UNIQUE INDEX "InteractionLog_interactionId_key" ON "InteractionLog"("interactionId");

-- AddForeignKey
ALTER TABLE "DiscordServer" ADD CONSTRAINT "DiscordServer_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandRule" ADD CONSTRAINT "CommandRule_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "DiscordServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionLog" ADD CONSTRAINT "InteractionLog_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "DiscordServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailureLog" ADD CONSTRAINT "FailureLog_interactionLogId_fkey" FOREIGN KEY ("interactionLogId") REFERENCES "InteractionLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
