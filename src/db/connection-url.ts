/**
 * Resolve the database connection string from the environment.
 *
 * Vercel + Neon expose the URL under different names depending on how it was
 * wired: a manual `DATABASE_URL`, or the Neon/Vercel Storage integration which
 * provisions `POSTGRES_URL`, `DATABASE_URL_UNPOOLED`, etc. We check the common
 * names in order so the app connects regardless of which one is present.
 */
const CANDIDATE_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL",
] as const;

/** First non-empty connection string among the known env var names, or undefined. */
export function resolveDatabaseUrl(): string | undefined {
  for (const key of CANDIDATE_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

/** Which of the known DB env var names are currently set (names only, no values). */
export function presentDbEnvKeys(): string[] {
  return CANDIDATE_ENV_KEYS.filter((k) => Boolean(process.env[k] && process.env[k]!.trim()));
}

/** All env var names that look database-related — for diagnostics (names only). */
export function databaseishEnvKeys(): string[] {
  return Object.keys(process.env)
    .filter((k) => /(DATABASE|POSTGRES|NEON|PG)/i.test(k))
    .sort();
}
