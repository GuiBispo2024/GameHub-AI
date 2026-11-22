import net from 'net';

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i,
  /^metadata\.google\.internal$/i,
];

function isPrivateOrLoopbackIPv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}

function isPrivateOrLoopbackIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7 ULA
  if (normalized.startsWith('fe80:')) return true; // fe80::/10 link-local
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.slice('::ffff:'.length);
    if (net.isIPv4(v4)) {
      return isPrivateOrLoopbackIPv4(v4);
    }
  }
  return false;
}

/**
 * Strictly validates an external source URL for stored metadata and prevents SSRF / XSS schemes.
 * Allows only public http/https URLs without credentials or private/loopback/metadata IP targets.
 */
export function validateSafeSourceUrl(rawUrl: string | null | undefined): string | null {
  if (rawUrl === undefined || rawUrl === null) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('URL da fonte inválida. Informe uma URL HTTP/HTTPS bem formada.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Protocolo de URL não permitido. Utilize apenas http:// ou https://.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs com credenciais embutidas não são permitidas.');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) {
    throw new Error('Host da URL inválido.');
  }

  for (const pattern of PRIVATE_HOSTNAME_PATTERNS) {
    if (pattern.test(host)) {
      throw new Error('Host interno ou reservado não permitido como URL de fonte.');
    }
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4 && isPrivateOrLoopbackIPv4(host)) {
    throw new Error('Endereços IP privados ou de loopback não são permitidos como fonte.');
  }
  if (ipVersion === 6 && isPrivateOrLoopbackIPv6(host)) {
    throw new Error('Endereços IPv6 privados ou de loopback não são permitidos como fonte.');
  }

  return parsed.toString();
}

const PROMPT_DELIMITER_REGEX =
  /<\/?(system_rules|system_instruction|user_context|game_context|journey_context|authorized_library_data|user_input|tool_output|retrieved_knowledge_data|knowledge_chunk)[^>]*>/gi;

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|the\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+|the\s+)?(previous|prior|above)\s+instructions?/gi,
  /reveal\s+(the\s+)?system\s+prompt/gi,
  /you\s+are\s+now\s+(in\s+)?(developer|admin|unrestricted|jailbreak)\s+mode/gi,
  /override\s+(spoiler|security)\s+(policy|rules?)/gi,
];

/**
 * Sanitizes guide content and retrieved text chunks against XSS payloads, scripts,
 * control characters, and XML delimiter breakout / prompt-injection attempts.
 */
export function sanitizeKnowledgeText(
  rawText: string | null | undefined,
  maxLength = 100000
): string {
  if (!rawText) return '';

  let clean = rawText
    // Strip ASCII control characters except tab/newline/carriage-return
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    // Strip active script/style/iframe blocks completely
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, ' ')
    // Neutralize inline JS handlers and script URIs
    .replace(/on[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript\s*:/gi, '[uri_removida]:')
    .replace(/data\s*:\s*text\/html/gi, '[uri_removida]:')
    // Neutralize sandbox XML delimiter breakouts
    .replace(PROMPT_DELIMITER_REGEX, '[delimitador_removido]');

  for (const pattern of INJECTION_PATTERNS) {
    clean = clean.replace(pattern, '[trecho_instrucional_ignorado]');
  }

  return clean.trim().slice(0, maxLength);
}

/**
 * Neutralizes prompt-injection payloads specifically when assembling retrieved snippets for the LLM.
 */
export function sanitizeChunkForPrompt(rawText: string, maxLength = 950): string {
  return sanitizeKnowledgeText(rawText, maxLength).replace(/\s+/g, ' ').trim();
}

/**
 * Removes accents/diacritics and normalizes text for reliable matching across pt-BR & EN terms.
 */
export function normalizeSearchText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
