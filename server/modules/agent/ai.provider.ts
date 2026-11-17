import { FunctionDeclaration } from '@google/genai';

export type AIMessageRole = 'user' | 'model';

export interface AIConversationMessage {
  role: AIMessageRole;
  content: string;
}

export interface AIToolCallInvocation {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AIToolExecutionTrace {
  name: string;
  accessType: 'READ' | 'WRITE';
  status: 'EXECUTED' | 'PENDING_CONFIRMATION' | 'REJECTED' | 'FAILED';
  durationMs?: number;
  errorCode?: string;
}

export interface AIGenerateParams {
  systemInstruction: string;
  history: AIConversationMessage[];
  userMessage: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  tools?: FunctionDeclaration[];
  onToolCall?: (call: AIToolCallInvocation) => Promise<{
    response: Record<string, unknown>;
    trace: AIToolExecutionTrace;
  }>;
  maxToolRounds?: number;
  maxToolCalls?: number;
}

export interface AIUsageMetadata {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
}

export interface AIGenerateResult {
  text: string;
  model: string;
  usage?: AIUsageMetadata;
  finishReason?: string;
  toolExecutions?: AIToolExecutionTrace[];
}

export type AIProviderErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_EMPTY_RESPONSE'
  | 'AI_PROVIDER_ERROR';

export class AIProviderError extends Error {
  statusCode: number;
  code: AIProviderErrorCode;

  constructor(message: string, statusCode: number, code: AIProviderErrorCode) {
    super(message);
    this.name = 'AIProviderError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface AIProvider {
  readonly providerName: string;
  generateReply(params: AIGenerateParams): Promise<AIGenerateResult>;
}
