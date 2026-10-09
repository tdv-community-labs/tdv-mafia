/**
 * Resilient Gemini API Key Pool Resolver
 *
 * Discovers and aggregates Gemini API keys from:
 * 1. GEMINI_API_KEYS (comma-separated list)
 * 2. GEMINI_API_KEY (single primary key)
 * 3. GEMINI_API_KEY_1 through GEMINI_API_KEY_10 (numbered keys)
 */

export function getGeminiApiKeyPool(): string[] {
  const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;
  const keys: string[] = [];

  const raw = env.GEMINI_API_KEYS || env.GEMINI_API_KEY;
  if (raw) {
    for (const item of raw.split(',')) {
      const trimmed = item.trim();
      if (trimmed && !keys.includes(trimmed)) {
        keys.push(trimmed);
      }
    }
  }

  for (let i = 1; i <= 10; i++) {
    const k = env[`GEMINI_API_KEY_${i}`]?.trim();
    if (k && !keys.includes(k)) {
      keys.push(k);
    }
  }

  return keys;
}
