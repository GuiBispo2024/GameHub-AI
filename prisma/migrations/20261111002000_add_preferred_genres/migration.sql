-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "preferredGenres" TEXT[] DEFAULT ARRAY[]::TEXT[];
