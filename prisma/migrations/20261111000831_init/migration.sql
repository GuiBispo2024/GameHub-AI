-- CreateEnum
CREATE TYPE "LibraryStatus" AS ENUM ('BACKLOG', 'PLAYING', 'COMPLETED', 'ON_HOLD', 'DROPPED');

-- CreateEnum
CREATE TYPE "SpoilerLevel" AS ENUM ('STRICT_NO_SPOILERS', 'CURRENT_CHAPTER', 'MID_GAME_SAFE', 'FULL_UNRESTRICTED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "defaultSpoilerLevel" "SpoilerLevel" NOT NULL DEFAULT 'CURRENT_CHAPTER',
    "preferredPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "overlayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overlayHotkey" TEXT NOT NULL DEFAULT 'Alt+G',
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "igdbId" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "storyline" TEXT,
    "coverUrl" TEXT,
    "backdropUrl" TEXT,
    "rating" DOUBLE PRECISION,
    "releaseDate" TIMESTAMP(3),
    "genres" TEXT[],
    "platforms" TEXT[],
    "developer" TEXT,
    "publisher" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_games" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" "LibraryStatus" NOT NULL DEFAULT 'BACKLOG',
    "rating" INTEGER,
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "hoursPlayed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "review" TEXT,
    "personalNotes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "currentChapter" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gameplay_journeys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userGameId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "playstyle" TEXT,
    "currentChapter" TEXT,
    "currentLevel" INTEGER,
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "playtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gameplay_journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userGameId" TEXT NOT NULL,
    "journeyId" TEXT,
    "chapterOrCheckpoint" TEXT NOT NULL,
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "hoursPlayedAtPoint" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "playerLevelAtPoint" INTEGER,
    "notes" TEXT,
    "screenshotUrl" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_builds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "playstyle" TEXT,
    "attributes" JSONB NOT NULL,
    "equipment" JSONB NOT NULL,
    "tips" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "journeyId" TEXT,
    "title" TEXT NOT NULL,
    "spoilerLevel" "SpoilerLevel" NOT NULL DEFAULT 'CURRENT_CHAPTER',
    "userProgress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "isSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companion_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_guides" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "spoilerLevel" "SpoilerLevel" NOT NULL DEFAULT 'CURRENT_CHAPTER',
    "targetChapter" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_guides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "games_igdbId_key" ON "games"("igdbId");

-- CreateIndex
CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");

-- CreateIndex
CREATE INDEX "games_slug_idx" ON "games"("slug");

-- CreateIndex
CREATE INDEX "games_name_idx" ON "games"("name");

-- CreateIndex
CREATE INDEX "user_games_userId_status_idx" ON "user_games"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_games_userId_gameId_key" ON "user_games"("userId", "gameId");

-- CreateIndex
CREATE INDEX "gameplay_journeys_userId_gameId_idx" ON "gameplay_journeys"("userId", "gameId");

-- CreateIndex
CREATE INDEX "gameplay_journeys_userGameId_idx" ON "gameplay_journeys"("userGameId");

-- CreateIndex
CREATE INDEX "progress_logs_userGameId_loggedAt_idx" ON "progress_logs"("userGameId", "loggedAt");

-- CreateIndex
CREATE INDEX "progress_logs_journeyId_idx" ON "progress_logs"("journeyId");

-- CreateIndex
CREATE INDEX "game_builds_gameId_playstyle_idx" ON "game_builds"("gameId", "playstyle");

-- CreateIndex
CREATE INDEX "game_builds_userId_idx" ON "game_builds"("userId");

-- CreateIndex
CREATE INDEX "companion_sessions_userId_gameId_idx" ON "companion_sessions"("userId", "gameId");

-- CreateIndex
CREATE INDEX "companion_sessions_journeyId_idx" ON "companion_sessions"("journeyId");

-- CreateIndex
CREATE INDEX "companion_messages_sessionId_createdAt_idx" ON "companion_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "game_guides_gameId_category_idx" ON "game_guides"("gameId", "category");

-- CreateIndex
CREATE INDEX "game_guides_authorId_idx" ON "game_guides"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "game_guides_gameId_slug_key" ON "game_guides"("gameId", "slug");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gameplay_journeys" ADD CONSTRAINT "gameplay_journeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gameplay_journeys" ADD CONSTRAINT "gameplay_journeys_userGameId_fkey" FOREIGN KEY ("userGameId") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gameplay_journeys" ADD CONSTRAINT "gameplay_journeys_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_userGameId_fkey" FOREIGN KEY ("userGameId") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "gameplay_journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_builds" ADD CONSTRAINT "game_builds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_builds" ADD CONSTRAINT "game_builds_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_sessions" ADD CONSTRAINT "companion_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_sessions" ADD CONSTRAINT "companion_sessions_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_sessions" ADD CONSTRAINT "companion_sessions_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "gameplay_journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_messages" ADD CONSTRAINT "companion_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "companion_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_guides" ADD CONSTRAINT "game_guides_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_guides" ADD CONSTRAINT "game_guides_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
