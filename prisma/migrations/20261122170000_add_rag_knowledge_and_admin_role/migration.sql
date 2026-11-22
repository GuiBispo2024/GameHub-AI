-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "game_guides" ADD COLUMN     "contentType" TEXT NOT NULL DEFAULT 'GUIDE',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'pt-BR',
ADD COLUMN     "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "progressionOrder" INTEGER,
ADD COLUMN     "regionOrChapter" TEXT,
ADD COLUMN     "sourceLicense" TEXT NOT NULL DEFAULT 'AUTHORIZED_CURATED',
ADD COLUMN     "sourceName" TEXT NOT NULL DEFAULT 'GameHub Editorial',
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "game_guide_chunks" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "spoilerLevel" "SpoilerLevel" NOT NULL DEFAULT 'CURRENT_CHAPTER',
    "regionOrChapter" TEXT,
    "progressionOrder" INTEGER,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_guide_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_guide_chunks_gameId_spoilerLevel_idx" ON "game_guide_chunks"("gameId", "spoilerLevel");

-- CreateIndex
CREATE INDEX "game_guide_chunks_gameId_progressionOrder_idx" ON "game_guide_chunks"("gameId", "progressionOrder");

-- CreateIndex
CREATE INDEX "game_guide_chunks_guideId_idx" ON "game_guide_chunks"("guideId");

-- CreateIndex
CREATE UNIQUE INDEX "game_guide_chunks_guideId_chunkIndex_key" ON "game_guide_chunks"("guideId", "chunkIndex");

-- CreateIndex
CREATE INDEX "game_guides_gameId_spoilerLevel_isActive_idx" ON "game_guides"("gameId", "spoilerLevel", "isActive");

-- CreateIndex (PostgreSQL native Full-Text Search GIN index for RAG retrieval)
CREATE INDEX IF NOT EXISTS "game_guide_chunks_fts_gin_idx"
  ON "game_guide_chunks"
  USING GIN (to_tsvector('simple', coalesce("heading", '') || ' ' || "content"));

-- AddForeignKey
ALTER TABLE "game_guide_chunks" ADD CONSTRAINT "game_guide_chunks_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "game_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_guide_chunks" ADD CONSTRAINT "game_guide_chunks_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
