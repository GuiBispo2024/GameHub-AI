import { FunctionDeclaration } from '@google/genai';
import { createHash } from 'crypto';
import { ZodError } from 'zod';
import { AgentModeValue } from '../agent.types';
import { createAddGameToLibraryTool } from './add-game-to-library.tool';
import { createGetGameBuildsTool } from './get-game-builds.tool';
import { createGetJourneyContextTool } from './get-journey-context.tool';
import { createGetUserLibraryTool } from './get-user-library.tool';
import { createGetUserPreferencesTool } from './get-user-preferences.tool';
import { createSearchGamesTool } from './search-games.tool';
import {
  AgentToolDefinition,
  ToolExecutionContext,
  WriteProposalPreview,
  compactToolResultForModel,
  createToolError,
} from './tools.types';
import { createUpdateGameProgressTool } from './update-game-progress.tool';

export function canonicalizeArgs(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeArgs);
  }
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const val = (value as Record<string, unknown>)[key];
      if (val !== undefined) {
        sorted[key] = canonicalizeArgs(val);
      }
    }
    return sorted;
  }
  return value;
}

export function computeActionArgsHash(
  userId: string,
  toolName: string,
  validatedArgs: Record<string, unknown>
): string {
  const payload = JSON.stringify({
    userId,
    toolName,
    args: canonicalizeArgs(validatedArgs),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export class ToolsRegistry {
  private readonly toolsMap = new Map<string, AgentToolDefinition>();

  constructor(tools?: AgentToolDefinition[]) {
    const initialTools = tools ?? [
      createSearchGamesTool(),
      createGetUserLibraryTool(),
      createGetUserPreferencesTool(),
      createGetJourneyContextTool(),
      createGetGameBuildsTool(),
      createAddGameToLibraryTool(),
      createUpdateGameProgressTool(),
    ];

    for (const tool of initialTools) {
      this.register(tool);
    }
  }

  register(tool: AgentToolDefinition): void {
    this.toolsMap.set(tool.name, tool);
  }

  hasTool(name: string): boolean {
    return this.toolsMap.has(name);
  }

  getTool(name: string): AgentToolDefinition | undefined {
    return this.toolsMap.get(name);
  }

  listTools(mode?: AgentModeValue): AgentToolDefinition[] {
    const all = Array.from(this.toolsMap.values());
    if (!mode) return all;
    return all.filter((tool) => tool.allowedModes.includes(mode));
  }

  getToolNames(mode?: AgentModeValue): string[] {
    return this.listTools(mode).map((t) => t.name);
  }

  getFunctionDeclarations(mode?: AgentModeValue): FunctionDeclaration[] {
    return this.listTools(mode).map((t) => t.declaration);
  }

  /**
   * Validates tool name against allowlist and validates arguments strictly with Zod.
   * Explicitly rejects any injected userId from model arguments.
   */
  validateAndParseArgs(name: string, rawArgs: unknown): {
    tool: AgentToolDefinition;
    validatedArgs: Record<string, unknown>;
  } {
    const tool = this.toolsMap.get(name);
    if (!tool) {
      throw createToolError(
        `Ferramenta "${name}" não reconhecida ou não permitida.`,
        400,
        'UNKNOWN_TOOL'
      );
    }

    const candidateObj =
      rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
        ? { ...(rawArgs as Record<string, unknown>) }
        : {};

    if ('userId' in candidateObj) {
      throw createToolError(
        'Parâmetro "userId" não é permitido nas chamadas de ferramentas.',
        400,
        'FORBIDDEN_TOOL_PARAMETER'
      );
    }

    try {
      const parsed = tool.schema.parse(candidateObj);
      return {
        tool,
        validatedArgs: (parsed ?? {}) as Record<string, unknown>,
      };
    } catch (err) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0]?.message || 'Parâmetros inválidos para a ferramenta.';
        throw createToolError(firstIssue, 400, 'TOOL_VALIDATION_ERROR');
      }
      throw err;
    }
  }

  async executeReadTool(
    name: string,
    rawArgs: unknown,
    ctx: ToolExecutionContext
  ): Promise<Record<string, unknown>> {
    const { tool, validatedArgs } = this.validateAndParseArgs(name, rawArgs);

    if (!tool.allowedModes.includes(ctx.mode)) {
      throw createToolError(
        `A ferramenta "${name}" não está disponível no modo ${ctx.mode}.`,
        403,
        'TOOL_MODE_NOT_ALLOWED'
      );
    }

    if (tool.accessType !== 'READ') {
      throw createToolError(
        `A ferramenta "${name}" é de escrita e exige confirmação explícita do usuário.`,
        403,
        'WRITE_TOOL_REQUIRES_CONFIRMATION'
      );
    }

    const rawResult = await tool.execute(validatedArgs, ctx);
    return compactToolResultForModel(rawResult);
  }

  async prepareWriteProposal(
    name: string,
    rawArgs: unknown,
    ctx: ToolExecutionContext
  ): Promise<{
    tool: AgentToolDefinition;
    validatedArgs: Record<string, unknown>;
    proposal: WriteProposalPreview;
    argsHash: string;
  }> {
    const { tool, validatedArgs } = this.validateAndParseArgs(name, rawArgs);

    if (!tool.allowedModes.includes(ctx.mode)) {
      throw createToolError(
        `A ferramenta "${name}" não está disponível no modo ${ctx.mode}.`,
        403,
        'TOOL_MODE_NOT_ALLOWED'
      );
    }

    if (tool.accessType !== 'WRITE' || !tool.prepareProposal) {
      throw createToolError(
        `A ferramenta "${name}" não suporta fluxo de proposta confirmável.`,
        400,
        'INVALID_WRITE_TOOL'
      );
    }

    const proposal = await tool.prepareProposal(validatedArgs, ctx);
    // Re-validate resolvedArgs so stored proposal arguments always satisfy the strict Zod schema
    const revalidated = tool.schema.parse(proposal.resolvedArgs) as Record<string, unknown>;
    const argsHash = computeActionArgsHash(ctx.userId, tool.name, revalidated);

    return {
      tool,
      validatedArgs: revalidated,
      proposal,
      argsHash,
    };
  }

  async executeConfirmedWriteTool(
    name: string,
    validatedArgs: Record<string, unknown>,
    expectedArgsHash: string,
    ctx: ToolExecutionContext
  ): Promise<Record<string, unknown>> {
    const { tool, validatedArgs: parsedArgs } = this.validateAndParseArgs(name, validatedArgs);

    if (tool.accessType !== 'WRITE') {
      throw createToolError(`A ferramenta "${name}" não é uma ferramenta de escrita.`, 400, 'INVALID_WRITE_TOOL');
    }

    const computedHash = computeActionArgsHash(ctx.userId, tool.name, parsedArgs);
    if (computedHash !== expectedArgsHash) {
      throw createToolError(
        'Os parâmetros da ação foram adulterados ou não correspondem à proposta aprovada.',
        409,
        'ACTION_INTEGRITY_MISMATCH'
      );
    }

    const result = await tool.execute(parsedArgs, ctx);
    return compactToolResultForModel(result);
  }
}

export const defaultToolsRegistry = new ToolsRegistry();
