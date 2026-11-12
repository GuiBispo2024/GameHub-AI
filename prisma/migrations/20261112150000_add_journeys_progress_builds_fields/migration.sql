-- Incremental non-destructive migration for Task 6:
-- Gameplay Journeys, Chronological Progress Logs, and Character Builds

-- 1. GameplayJourney enhancements
ALTER TABLE "gameplay_journeys"
  ADD COLUMN IF NOT EXISTS "characterName" TEXT,
  ADD COLUMN IF NOT EXISTS "currentObjective" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "gameplay_journeys_userGameId_isActive_idx"
  ON "gameplay_journeys"("userGameId", "isActive");

-- Partial unique index guaranteeing at most one active journey per UserGame
-- Protects against concurrent activation race conditions at database level
CREATE UNIQUE INDEX IF NOT EXISTS "gameplay_journeys_one_active_per_user_game_idx"
  ON "gameplay_journeys"("userGameId")
  WHERE "isActive" = true;

-- 2. ProgressLog enhancements (optional areaName, questName, nullable completionPercent)
ALTER TABLE "progress_logs"
  ADD COLUMN IF NOT EXISTS "areaName" TEXT,
  ADD COLUMN IF NOT EXISTS "questName" TEXT,
  ADD COLUMN IF NOT EXISTS "completionPercent" INTEGER;

DROP INDEX IF EXISTS "progress_logs_journeyId_idx";
CREATE INDEX IF NOT EXISTS "progress_logs_journeyId_loggedAt_idx"
  ON "progress_logs"("journeyId", "loggedAt");

ALTER TABLE "progress_logs"
  DROP CONSTRAINT IF EXISTS "progress_logs_journeyId_fkey";
ALTER TABLE "progress_logs"
  ADD CONSTRAINT "progress_logs_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "gameplay_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. GameBuild enhancements (relational link to GameplayJourney)
ALTER TABLE "game_builds"
  ADD COLUMN IF NOT EXISTS "journeyId" TEXT;

CREATE INDEX IF NOT EXISTS "game_builds_journeyId_idx"
  ON "game_builds"("journeyId");

ALTER TABLE "game_builds"
  ADD CONSTRAINT "game_builds_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "gameplay_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
