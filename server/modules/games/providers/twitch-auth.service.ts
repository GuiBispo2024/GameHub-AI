import { ENV } from '../../../config/env';
import { logger } from '../../../utils/logger';

export interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class TwitchAuthService {
  private static cachedToken: string | null = null;
  private static tokenExpiresAt: number = 0;
  private static tokenFetchPromise: Promise<string> | null = null;

  /**
   * Clears the current in-memory token cache (useful for testing or on 401 recovery)
   */
  static clearCache(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
    this.tokenFetchPromise = null;
  }

  /**
   * Sets a manual mock token (for testing environments)
   */
  static setMockToken(token: string, expiresInMs: number = 3600000): void {
    this.cachedToken = token;
    this.tokenExpiresAt = Date.now() + expiresInMs;
  }

  /**
   * Returns a valid Twitch OAuth access token for IGDB requests.
   * Caches token in memory and renews automatically before expiration.
   * Concurrency-safe: duplicate simultaneous calls share the same in-flight Promise.
   */
  static async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Safety buffer: consider expired 60 seconds before actual Twitch expiration
    const safetyBufferMs = 60 * 1000;

    if (this.cachedToken && this.tokenExpiresAt - now > safetyBufferMs) {
      return this.cachedToken;
    }

    // If a request is already in-flight, return the existing promise
    if (this.tokenFetchPromise) {
      return this.tokenFetchPromise;
    }

    this.tokenFetchPromise = this.fetchNewToken();

    try {
      const token = await this.tokenFetchPromise;
      return token;
    } finally {
      this.tokenFetchPromise = null;
    }
  }

  /**
   * Fetches a new access token from Twitch OAuth2 Client Credentials endpoint
   */
  private static async fetchNewToken(): Promise<string> {
    const clientId = (ENV.TWITCH_CLIENT_ID || process.env.TWITCH_CLIENT_ID || '').trim();
    const clientSecret = (ENV.TWITCH_CLIENT_SECRET || process.env.TWITCH_CLIENT_SECRET || '').trim();

    if (!clientId || !clientSecret) {
      logger.error('Credenciais Twitch (TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET) não configuradas.');
      const err: any = new Error(
        'Integração Twitch/IGDB indisponível: Credenciais TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET não configuradas no ambiente.'
      );
      err.statusCode = 503;
      err.code = 'TWITCH_CONFIG_MISSING';
      throw err;
    }

    try {
      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        }).toString(),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Falha na autenticação Twitch OAuth (${response.status}): status=${response.status}`);
        const err: any = new Error(
          `Falha ao autenticar com Twitch OAuth para acesso à IGDB (HTTP ${response.status}).`
        );
        err.statusCode = 502;
        err.code = 'TWITCH_AUTH_FAILED';
        throw err;
      }

      const data: TwitchTokenResponse = await response.json();

      if (!data.access_token) {
        throw new Error('Resposta de autenticação Twitch não continha access_token.');
      }

      this.cachedToken = data.access_token;
      // expires_in is in seconds
      this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

      logger.info('Token Twitch OAuth para IGDB obtido e armazenado em cache com sucesso.');
      return this.cachedToken;
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        const timeoutErr: any = new Error('Tempo limite esgotado ao contatar serviço de autenticação Twitch.');
        timeoutErr.statusCode = 504;
        timeoutErr.code = 'TWITCH_TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    }
  }
}
