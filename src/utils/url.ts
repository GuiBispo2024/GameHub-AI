export function isSafeHttpUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSafeHttpUrl(rawUrl?: string | null): string | null {
  if (!isSafeHttpUrl(rawUrl)) return null;
  return rawUrl!.trim();
}
