import rateLimit, { Options, ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

function extractClientIp(req: Request): string {
  const forwarded = req.headers.forwarded;
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    const match = forwarded.match(/for=(?:"([^"]+)"|([^;,\s]+))/i);
    const rawFor = match?.[1] || match?.[2];
    if (rawFor && !rawFor.startsWith('_') && rawFor.toLowerCase() !== 'unknown') {
      if (rawFor.startsWith('[')) {
        const endBracket = rawFor.indexOf(']');
        if (endBracket > 1) {
          return rawFor.slice(1, endBracket);
        }
      }
      const colonCount = (rawFor.match(/:/g) || []).length;
      if (colonCount === 1) {
        return rawFor.split(':')[0];
      }
      return rawFor;
    }
  }

  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

export function createAuthLimiter(overrides?: Partial<Options>) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 login/register requests per 15 minutes
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    keyGenerator: (req: Request) => {
      const clientIp =
        req.ip && req.ip !== req.socket?.remoteAddress ? req.ip : extractClientIp(req);
      return ipKeyGenerator(clientIp);
    },
    skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMIT,
    message: {
      status: 'error',
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas tentativas de autenticação a partir deste endereço IP. Tente novamente mais tarde.',
    },
    ...overrides,
  });
}

export const authLimiter = createAuthLimiter();

export function createAgentLimiter(overrides?: Partial<Options>) {
  return rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 25, // Limit each authenticated user/IP to 25 AI chat requests per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const authUserId = (req as any).user?.id;
      if (authUserId) {
        return `agent-user:${authUserId}`;
      }
      const clientIp =
        req.ip && req.ip !== req.socket?.remoteAddress ? req.ip : extractClientIp(req);
      return `agent-ip:${ipKeyGenerator(clientIp)}`;
    },
    skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_AGENT_RATE_LIMIT,
    message: {
      status: 'error',
      code: 'AGENT_RATE_LIMITED',
      message: 'Você atingiu o limite temporário de mensagens para o GameAgent. Aguarde alguns instantes.',
    },
    ...overrides,
  });
}

export const agentLimiter = createAgentLimiter();
