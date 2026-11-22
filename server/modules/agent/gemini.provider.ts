import { Content, FunctionDeclaration, GoogleGenAI, Part, ThinkingLevel } from '@google/genai';
import { ENV } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  AIGenerateParams,
  AIGenerateResult,
  AIProvider,
  AIProviderError,
  AIToolExecutionTrace,
  AIUsageMetadata,
} from './ai.provider';
import { canonicalizeArgs } from './tools/tools.registry';

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  fallbackModel?: string | null;
  timeoutMs?: number;
  maxOutputTokens?: number;
}

const DEFAULT_MAX_TOOL_ROUNDS = 4;
const DEFAULT_MAX_TOOL_CALLS = 6;

export class GeminiProvider implements AIProvider {
  readonly providerName = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fallbackModel: string | null;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxOutputTokens: number;
  private client: GoogleGenAI | null = null;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = (options.apiKey ?? ENV.GEMINI_API_KEY ?? '').trim();
    this.model =
      (options.model ?? ENV.GEMINI_MODEL ?? 'gemini-4-hydrogen').trim() ||
      'gemini-4-hydrogen';
    const rawFallback =
      options.fallbackModel === undefined
        ? ENV.GEMINI_FALLBACK_MODEL
        : options.fallbackModel;
    this.fallbackModel =
      rawFallback && rawFallback.trim() && rawFallback.trim() !== this.model
        ? rawFallback.trim()
        : null;
    this.defaultTimeoutMs = options.timeoutMs ?? ENV.GEMINI_TIMEOUT_MS ?? 25000;
    this.defaultMaxOutputTokens =
      options.maxOutputTokens ?? ENV.GEMINI_MAX_OUTPUT_TOKENS ?? 1200;
  }

  private getClient(): GoogleGenAI {
    if (!this.apiKey) {
      throw new AIProviderError(
        'O serviço de IA (Gemini API) não está configurado no servidor.',
        503,
        'AI_NOT_CONFIGURED'
      );
    }

    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }

    return this.client;
  }

  private buildContents(params: AIGenerateParams): Content[] {
    const contents: Content[] = params.history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    contents.push({
      role: 'user',
      parts: [{ text: params.userMessage }],
    });

    return contents;
  }

  private sanitizeProviderErrorMessage(err: unknown): string {
    const raw =
      err instanceof Error
        ? err.message
        : String(err || 'Erro desconhecido no provedor de IA.');
    return raw
      .replace(/key=[A-Za-z0-9_\-]+/gi, 'key=[REDACTED]')
      .replace(/AIza[0-9A-Za-z\-_]{10,}/g, '[REDACTED_API_KEY]')
      .slice(0, 260);
  }

  private mergeUsage(
    current: AIUsageMetadata | undefined,
    next: any
  ): AIUsageMetadata | undefined {
    if (!next) return current;
    const promptTokens = (current?.promptTokens ?? 0) + (next.promptTokenCount ?? 0);
    const candidatesTokens = (current?.candidatesTokens ?? 0) + (next.candidatesTokenCount ?? 0);
    const totalTokens = (current?.totalTokens ?? 0) + (next.totalTokenCount ?? 0);
    return {
      promptTokens: promptTokens || undefined,
      candidatesTokens: candidatesTokens || undefined,
      totalTokens: totalTokens || undefined,
    };
  }

  private buildModelConfig(
    modelName: string,
    systemInstruction: string,
    maxOutputTokens: number,
    tools?: FunctionDeclaration[]
  ): Record<string, unknown> {
    const isGemini4 = modelName.toLowerCase().startsWith('gemini-4');
    const config: Record<string, unknown> = {
      systemInstruction,
      maxOutputTokens,
    };

    if (isGemini4) {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.LOW,
      };
    }

    if (tools && tools.length > 0) {
      config.tools = [{ functionDeclarations: tools }];
    }

    return config;
  }

  private isTransientProviderFailure(err: any, safeMsg: string, status: number): boolean {
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
      return true;
    }
    return /rate limit|quota|resource_exhausted|unavailable|high demand|overloaded|internal|econnreset|etimedout|fetch failed|network/i.test(
      safeMsg
    );
  }

  private async invokeSingleGenerateContent(
    client: GoogleGenAI,
    modelName: string,
    contents: Content[],
    config: Record<string, unknown>,
    timeoutMs: number
  ) {
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(
              new AIProviderError(
                'O assistente demorou mais do que o esperado para responder. Tente novamente em instantes.',
                504,
                'AI_TIMEOUT'
              )
            );
          }, timeoutMs);
        });

        return await Promise.race([
          client.models.generateContent({
            model: modelName,
            contents,
            config: config as any,
          }),
          timeoutPromise,
        ]);
      } catch (err: any) {
        if (err instanceof AIProviderError) {
          throw err;
        }

        const safeMsg = this.sanitizeProviderErrorMessage(err);
        const status = typeof err?.status === 'number' ? err.status : 0;
        const canRetry =
          attempt < maxAttempts && this.isTransientProviderFailure(err, safeMsg, status);

        if (canRetry) {
          logger.warn('[GeminiProvider] Falha transitória na API Gemini, executando retry', {
            model: modelName,
            attempt,
            status: status || undefined,
            reason: safeMsg,
          });
          await new Promise((resolve) => setTimeout(resolve, 650 * attempt));
          continue;
        }

        logger.error('[GeminiProvider] Falha ao gerar resposta', {
          model: modelName,
          status: status || undefined,
          reason: safeMsg,
        });

        if (status === 429 || /rate limit|quota|resource_exhausted/i.test(safeMsg)) {
          throw new AIProviderError(
            'Limite temporário de requisições ao serviço de IA atingido. Aguarde alguns instantes e tente novamente.',
            503,
            'AI_RATE_LIMITED'
          );
        }

        if (status === 408 || status === 504 || /timeout|deadline_exceeded|aborted/i.test(safeMsg)) {
          throw new AIProviderError(
            'Tempo limite excedido ao consultar o serviço de IA.',
            504,
            'AI_TIMEOUT'
          );
        }

        throw new AIProviderError(
          'Não foi possível obter uma resposta do assistente no momento. Tente novamente em instantes.',
          502,
          'AI_PROVIDER_ERROR'
        );
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
      }
    }

    throw new AIProviderError(
      'Não foi possível obter uma resposta do assistente no momento. Tente novamente em instantes.',
      502,
      'AI_PROVIDER_ERROR'
    );
  }

  private async callModelWithToolLoop(
    client: GoogleGenAI,
    modelName: string,
    contents: Content[],
    params: AIGenerateParams,
    maxOutputTokens: number,
    timeoutMs: number,
    toolExecutions: AIToolExecutionTrace[],
    seenSignatures: Map<string, number>
  ): Promise<AIGenerateResult> {
    const maxRounds = Math.min(Math.max(1, params.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS), 6);
    const maxCalls = Math.min(Math.max(1, params.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS), 10);

    let accumulatedUsage: AIUsageMetadata | undefined;
    let totalToolCalls = 0;

    for (let round = 0; round <= maxRounds; round++) {
      const canOfferTools =
        Boolean(params.tools && params.tools.length > 0 && params.onToolCall) &&
        round < maxRounds &&
        totalToolCalls < maxCalls;

      const config = this.buildModelConfig(
        modelName,
        params.systemInstruction,
        maxOutputTokens,
        canOfferTools ? params.tools : undefined
      );

      const perRoundTimeout = Math.max(8000, timeoutMs);
      const response = await this.invokeSingleGenerateContent(
        client,
        modelName,
        contents,
        config,
        perRoundTimeout
      );

      accumulatedUsage = this.mergeUsage(accumulatedUsage, response.usageMetadata);

      const functionCalls = response.functionCalls;
      if (!functionCalls || functionCalls.length === 0) {
        const text = (response.text || '').trim();
        if (!text) {
          throw new AIProviderError(
            'O modelo de IA retornou uma resposta vazia. Reformule sua pergunta e tente novamente.',
            502,
            'AI_EMPTY_RESPONSE'
          );
        }

        const finishReason = response.candidates?.[0]?.finishReason;
        return {
          text,
          model: modelName,
          finishReason: finishReason ? String(finishReason) : undefined,
          usage: accumulatedUsage,
          toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
        };
      }

      if (!params.onToolCall) {
        throw new AIProviderError(
          'O modelo solicitou execução de ferramenta, mas o executor não está disponível.',
          500,
          'AI_PROVIDER_ERROR'
        );
      }

      // Preserve the exact candidate Content (including thoughtSignature & functionCall parts)
      const candidateContent = response.candidates?.[0]?.content;
      if (candidateContent) {
        contents.push(candidateContent);
      } else {
        contents.push({
          role: 'model',
          parts: functionCalls.map((fc) => ({ functionCall: fc })),
        });
      }

      const functionResponseParts: Part[] = [];

      for (const fc of functionCalls) {
        const toolName = (fc.name || '').trim();
        const rawArgs =
          fc.args && typeof fc.args === 'object' && !Array.isArray(fc.args)
            ? (fc.args as Record<string, unknown>)
            : {};

        totalToolCalls++;
        if (totalToolCalls > maxCalls) {
          toolExecutions.push({
            name: toolName || 'unknown',
            accessType: 'READ',
            status: 'REJECTED',
            errorCode: 'TOOL_CALL_LIMIT_EXCEEDED',
          });
          functionResponseParts.push({
            functionResponse: {
              id: fc.id,
              name: toolName,
              response: {
                status: 'error',
                code: 'TOOL_CALL_LIMIT_EXCEEDED',
                message:
                  'Limite máximo de chamadas de ferramentas atingido nesta interação. Formule a resposta final com os dados já obtidos.',
              },
            },
          });
          continue;
        }

        const signature = `${toolName}:${JSON.stringify(canonicalizeArgs(rawArgs))}`;
        const repeatCount = (seenSignatures.get(signature) ?? 0) + 1;
        seenSignatures.set(signature, repeatCount);

        if (repeatCount > 1) {
          toolExecutions.push({
            name: toolName || 'unknown',
            accessType: 'READ',
            status: 'REJECTED',
            errorCode: 'TOOL_LOOP_PREVENTED',
          });
          functionResponseParts.push({
            functionResponse: {
              id: fc.id,
              name: toolName,
              response: {
                status: 'error',
                code: 'TOOL_LOOP_PREVENTED',
                message:
                  'Chamada idêntica repetida bloqueada para evitar loop. Utilize os dados já recebidos para responder ao usuário.',
              },
            },
          });
          continue;
        }

        const outcome = await params.onToolCall({
          id: fc.id,
          name: toolName,
          args: rawArgs,
        });
        toolExecutions.push(outcome.trace);

        functionResponseParts.push({
          functionResponse: {
            id: fc.id,
            name: toolName,
            response: outcome.response,
          },
        });
      }

      contents.push({
        role: 'user',
        parts: functionResponseParts,
      });
    }

    throw new AIProviderError(
      'O agente excedeu o limite de iterações com ferramentas sem produzir uma resposta final.',
      502,
      'AI_EMPTY_RESPONSE'
    );
  }

  async generateReply(params: AIGenerateParams): Promise<AIGenerateResult> {
    const client = this.getClient();
    const totalTimeoutMs = params.timeoutMs ?? this.defaultTimeoutMs;
    const maxOutputTokens = params.maxOutputTokens ?? this.defaultMaxOutputTokens;
    const contents = this.buildContents(params);

    const primaryTimeoutMs = this.fallbackModel
      ? Math.max(8000, Math.floor(totalTimeoutMs * 0.65))
      : totalTimeoutMs;

    const toolExecutions: AIToolExecutionTrace[] = [];
    const seenSignatures = new Map<string, number>();

    try {
      return await this.callModelWithToolLoop(
        client,
        this.model,
        contents,
        params,
        maxOutputTokens,
        primaryTimeoutMs,
        toolExecutions,
        seenSignatures
      );
    } catch (primaryErr: any) {
      const canFallback =
        this.fallbackModel &&
        primaryErr instanceof AIProviderError &&
        (primaryErr.code === 'AI_TIMEOUT' ||
          primaryErr.code === 'AI_RATE_LIMITED' ||
          primaryErr.code === 'AI_PROVIDER_ERROR');

      if (!canFallback) {
        throw primaryErr;
      }

      logger.warn(
        '[GeminiProvider] Acionando modelo fallback após indisponibilidade temporária do modelo primário',
        {
          primaryModel: this.model,
          fallbackModel: this.fallbackModel,
          reasonCode: primaryErr.code,
          completedToolCallsBeforeFallback: toolExecutions.length,
        }
      );

      const remainingTimeout = Math.max(8000, totalTimeoutMs - primaryTimeoutMs + 5000);
      // Continues with the exact current `contents` so already-executed tools/proposals are never re-run
      return this.callModelWithToolLoop(
        client,
        this.fallbackModel!,
        contents,
        params,
        maxOutputTokens,
        remainingTimeout,
        toolExecutions,
        seenSignatures
      );
    }
  }
}
