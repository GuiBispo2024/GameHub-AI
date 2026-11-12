import rateLimit, { Options } from 'express-rate-limit';

export function createAuthLimiter(overrides?: Partial<Options>) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 login/register requests per 15 minutes
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
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
