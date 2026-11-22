import { FunctionDeclaration } from '@google/genai';
import { z } from 'zod';
import { KnowledgeRetrievalResult } from '../../knowledge/knowledge.types';
import { AgentModeValue, SpoilerLevelValue } from '../agent.types';

export type ToolAccessType = 'READ' | 'WRITE';

export interface ToolExecutionContext {
  userId: string;
  mode: AgentModeValue;
  sessionId?: string;
  activeGameId?: string | null;
  activeJourneyId?: string | null;
  spoilerLevel?: SpoilerLevelValue;
  onKnowledgeRetrieved?: (result: KnowledgeRetrievalResult) => void;
}

export interface WriteProposalPreview {
  summary: string;
  resolvedArgs: Record<string, unknown>;
  preview: Record<string, unknown>;
}

export interface AgentToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  accessType: ToolAccessType;
  allowedModes: AgentModeValue[];
  requiresOwnershipCheck: boolean;
  declaration: FunctionDeclaration;
  schema: z.ZodType<TInput>;
  prepareProposal?: (args: TInput, ctx: ToolExecutionContext) => Promise<WriteProposalPreview>;
  execute: (args: TInput, ctx: ToolExecutionContext) => Promise<TOutput>;
}

export function createToolError(message: string, statusCode: number, code: string) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Truncates long strings in tool responses so model context remains compact and safe.
 */
export function truncateText(value: string | null | undefined, maxLength = 280): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1)}…`;
}

/**
 * Strips potentially dangerous control chars and caps payload size returned to the LLM.
 */
export function compactToolResultForModel(result: unknown, maxBytes = 12000): Record<string, unknown> {
  const obj =
    result && typeof result === 'object' && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : { data: result };

  const serialized = JSON.stringify(obj);
  if (Buffer.byteLength(serialized, 'utf8') <= maxBytes) {
    return obj;
  }

  return {
    truncated: true,
    note: 'Resultado reduzido para caber no limite de contexto.',
    preview: serialized.slice(0, Math.max(500, maxBytes - 200)),
  };
}
