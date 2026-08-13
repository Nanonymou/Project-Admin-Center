import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./connection-url";

/**
 * Database client (Drizzle ORM over postgres.js).
 *
 * Frontend-first: this module is import-safe even without a database. The
 * `DATABASE_URL` falls back to a localhost string so `next build` and any page
 * that never issues a query keep working. `postgres()` is *lazy* — it opens no
 * socket until the first query — so importing `db` costs nothing.
 *
 * On Vercel the production database is **Neon** (serverless PostgreSQL). The
 * connection is configured automatically from the URL so it "just works":
 *   - **SSL** is required by Neon. We enable it whenever the URL isn't an
 *     obvious localhost, and always honour an explicit `sslmode=` in the URL.
 *   - **Pooled connections** (Neon's `-pooler` host, backed by PgBouncer in
 *     transaction mode) don't support prepared statements, so `prepare` is
 *     turned off for them — otherwise queries error with
 *     "prepared statement ... does not exist".
 *   - **`max: 1`** keeps the per-invocation connection count low, which suits
 *     Vercel's serverless model where many short-lived instances each open
 *     their own pool.
 */

const connectionString =
  resolveDatabaseUrl() ?? "postgres://localhost:5432/project_admin_center";

/** True for local/loopback hosts where SSL should stay off by default. */
function isLocalHost(url: string): boolean {
  return /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || /\/\/(localhost|127\.0\.0\.1)[:/]/.test(url);
}

/** Neon (and most managed Postgres) route pooled traffic through a `-pooler` host. */
function isPooled(url: string): boolean {
  return url.includes("-pooler.") || /[?&]pgbouncer=true/.test(url);
}

const useSsl = !isLocalHost(connectionString);

const client = postgres(connectionString, {
  max: 1,
  // Neon requires TLS. postgres.js also reads `sslmode=` from the URL; setting
  // this covers URLs that omit it. Left off for localhost so local dev needs no
  // certificate.
  ssl: useSsl ? "require" : false,
  // PgBouncer transaction pooling can't keep prepared statements across
  // queries — disable them on pooled URLs to avoid runtime errors.
  prepare: !isPooled(connectionString),
});

export const db = drizzle(client, { schema });
export * from "./schema";
