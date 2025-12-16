-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "role" TEXT,
    "stats" JSONB,
    "inventory" TEXT[],
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "currentNodeId" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "maxSize" INTEGER NOT NULL DEFAULT 4,
    "leaderId" TEXT NOT NULL,
    "storyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'forming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMember" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "partyRole" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinigameState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinigameState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "odId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "currentNodeId" TEXT NOT NULL,
    "choices" TEXT[],
    "flags" JSONB NOT NULL DEFAULT '{}',
    "checkpoints" TEXT[],
    "inventory" TEXT[],
    "resources" JSONB NOT NULL DEFAULT '{}',
    "partyRole" TEXT,
    "activeChannelId" TEXT,
    "activeMessageId" TEXT,
    "activeMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoiceLock" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoiceLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timerId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArcState" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "splitNodeId" TEXT NOT NULL,
    "mergeNodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArcState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveArc" (
    "id" TEXT NOT NULL,
    "arcStateId" TEXT NOT NULL,
    "arcId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "entryNodeId" TEXT NOT NULL,
    "currentNodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isSoloArc" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveArc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArcPlayer" (
    "id" TEXT NOT NULL,
    "activeArcId" TEXT NOT NULL,
    "odId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArcPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeVote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NodeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombatState" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CombatState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE INDEX "UserProgress_userId_idx" ON "UserProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_storyId_key" ON "UserProgress"("userId", "storyId");

-- CreateIndex
CREATE UNIQUE INDEX "Party_code_key" ON "Party"("code");

-- CreateIndex
CREATE INDEX "PartyMember_partyId_idx" ON "PartyMember"("partyId");

-- CreateIndex
CREATE INDEX "PartyMember_userId_idx" ON "PartyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMember_partyId_userId_key" ON "PartyMember"("partyId", "userId");

-- CreateIndex
CREATE INDEX "MinigameState_userId_idx" ON "MinigameState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MinigameState_userId_storyId_nodeId_key" ON "MinigameState"("userId", "storyId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_odId_key" ON "GameSession"("odId");

-- CreateIndex
CREATE INDEX "GameSession_odId_idx" ON "GameSession"("odId");

-- CreateIndex
CREATE INDEX "ChoiceLock_sessionId_idx" ON "ChoiceLock"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChoiceLock_sessionId_nodeId_choiceId_key" ON "ChoiceLock"("sessionId", "nodeId", "choiceId");

-- CreateIndex
CREATE INDEX "Vote_sessionId_idx" ON "Vote"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_sessionId_nodeId_key" ON "Vote"("sessionId", "nodeId");

-- CreateIndex
CREATE INDEX "Timer_sessionId_idx" ON "Timer"("sessionId");

-- CreateIndex
CREATE INDEX "Timer_expiresAt_idx" ON "Timer"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Timer_sessionId_timerId_key" ON "Timer"("sessionId", "timerId");

-- CreateIndex
CREATE UNIQUE INDEX "ArcState_partyId_key" ON "ArcState"("partyId");

-- CreateIndex
CREATE INDEX "ArcState_partyId_idx" ON "ArcState"("partyId");

-- CreateIndex
CREATE INDEX "ActiveArc_arcStateId_idx" ON "ActiveArc"("arcStateId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveArc_arcStateId_arcId_key" ON "ActiveArc"("arcStateId", "arcId");

-- CreateIndex
CREATE INDEX "ArcPlayer_activeArcId_idx" ON "ArcPlayer"("activeArcId");

-- CreateIndex
CREATE INDEX "ArcPlayer_odId_idx" ON "ArcPlayer"("odId");

-- CreateIndex
CREATE UNIQUE INDEX "ArcPlayer_activeArcId_odId_key" ON "ArcPlayer"("activeArcId", "odId");

-- CreateIndex
CREATE INDEX "NodeVote_sessionId_nodeId_idx" ON "NodeVote"("sessionId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeVote_sessionId_nodeId_playerId_key" ON "NodeVote"("sessionId", "nodeId", "playerId");

-- CreateIndex
CREATE INDEX "CombatState_sessionId_idx" ON "CombatState"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CombatState_sessionId_nodeId_key" ON "CombatState"("sessionId", "nodeId");

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoiceLock" ADD CONSTRAINT "ChoiceLock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timer" ADD CONSTRAINT "Timer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveArc" ADD CONSTRAINT "ActiveArc_arcStateId_fkey" FOREIGN KEY ("arcStateId") REFERENCES "ArcState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcPlayer" ADD CONSTRAINT "ArcPlayer_activeArcId_fkey" FOREIGN KEY ("activeArcId") REFERENCES "ActiveArc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
