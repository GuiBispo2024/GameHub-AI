import { prisma } from './prisma';

let roleColumnAvailable: boolean | null = null;
let roleCheckedAt = 0;

let knowledgeTableAvailable: boolean | null = null;
let knowledgeCheckedAt = 0;

const RECHECK_FALSE_TTL_MS = 30_000;

/**
 * Checks whether the `users.role` column (added in migration 20261122170000) exists
 * in the currently connected database, preventing P2022 errors on unmigrated environments
 * while preserving full RBAC on migrated environments.
 */
export async function hasUserRoleColumn(): Promise<boolean> {
  if (roleColumnAvailable === true) return true;
  if (roleColumnAvailable === false && Date.now() - roleCheckedAt < RECHECK_FALSE_TTL_MS) {
    return false;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'role'
      ) AS "exists"
    `;
    const exists = Boolean(rows?.[0]?.exists);
    roleColumnAvailable = exists;
    roleCheckedAt = Date.now();
    return exists;
  } catch {
    return false;
  }
}

/**
 * Checks whether the RAG `game_guide_chunks` table exists in the connected database.
 */
export async function hasKnowledgeTables(): Promise<boolean> {
  if (knowledgeTableAvailable === true) return true;
  if (knowledgeTableAvailable === false && Date.now() - knowledgeCheckedAt < RECHECK_FALSE_TTL_MS) {
    return false;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'game_guide_chunks'
      ) AS "exists"
    `;
    const exists = Boolean(rows?.[0]?.exists);
    knowledgeTableAvailable = exists;
    knowledgeCheckedAt = Date.now();
    return exists;
  } catch {
    return false;
  }
}
