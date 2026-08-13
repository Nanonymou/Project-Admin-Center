import fs from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { db } from "@/db";
import { resolveDatabaseUrl, databaseishEnvKeys } from "@/db/connection-url";
import { seedDatabase } from "@/db/seed";
import { seedMasterCategories, seedMasterTimeframes } from "@/db/seed-master";
import { seedRoles } from "@/db/seed-roles";
import { seedMasterLocks } from "@/db/seed-master-locks";

/**
 * TEMPORARY one-shot database setup endpoint.
 *
 * Applies the schema + seeds initial data on the production (Neon) database from
 * within Vercel. Open it once with the token, then this file is removed.
 *
 * Migrations are applied statement-by-statement over the app's (pooled) Neon
 * connection — the same one the seeds use and which is proven reachable — in
 * autocommit, WITHOUT the Drizzle migrator. This avoids the migrator stalling
 * over PgBouncer and keeps each round-trip small so it finishes fast. Errors
 * meaning "object already exists" are ignored, so the step is idempotent and
 * resumable.
 *
 * Steps (to stay within the serverless time limit):
 *   ?step=migrate  → create tables/types/indexes
 *   ?step=seed     → roles/master data + sample transactions (?days=, ?tx=0)
 *   (no step/all)  → both
 *
 * DELETE THIS ROUTE after setup succeeds.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SETUP_TOKEN = "pac-setup-65d2cbec9841faf9d3";

/** Postgres error codes that mean "already there" — safe to ignore for idempotency. */
const IGNORABLE_CODES = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object (type, constraint, etc.)
  "42701", // duplicate_column
  "42P06", // duplicate_schema
  "42P16", // invalid_table_definition (e.g. constraint already exists variants)
  "23505", // unique_violation (re-insert of an enum/label row)
]);

type MigrateResult = { applied: number; skipped: number; files: number };

async function runMigrate(): Promise<MigrateResult> {
  const url = resolveDatabaseUrl()!;
  const pooled = url.includes("-pooler.") || /[?&]pgbouncer=true/.test(url);
  // Raw postgres.js client (not Drizzle) so SQLSTATE codes and error messages
  // come through clean — Drizzle's wrapper hides the real cause.
  const client = postgres(url, { max: 1, ssl: "require", prepare: !pooled });

  const dir = path.join(process.cwd(), "drizzle");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let applied = 0;
  let skipped = 0;
  try {
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      const statements = content
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        try {
          await client.unsafe(stmt);
          applied++;
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code && IGNORABLE_CODES.has(code)) {
            skipped++;
            continue;
          }
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Migrasi gagal di ${file} [${code ?? "?"}]: ${msg}`);
        }
      }
    }
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
  }
  return { applied, skipped, files: files.length };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("key") !== SETUP_TOKEN) {
    return NextResponse.json({ ok: false, error: "Token setup salah atau tidak ada (?key=...)." }, { status: 401 });
  }

  if (!resolveDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Connection string database tidak ditemukan. Pastikan ada di kolom VALUE variabel DATABASE_URL (bukan Note), aktif untuk Production, lalu Redeploy.",
        dbEnvVarsPresent: databaseishEnvKeys(),
      },
      { status: 400 },
    );
  }

  const step = (sp.get("step") ?? "all").toLowerCase();
  const doMigrate = step === "all" || step === "migrate";
  const doSeed = step === "all" || step === "seed";

  const daysRaw = Number(sp.get("days"));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 90) : 14;
  const includeTx = sp.get("tx") !== "0";

  const steps: Record<string, unknown> = {};
  try {
    if (doMigrate) {
      steps.migrate = await runMigrate();
    }

    if (doSeed) {
      steps.roles = await seedRoles();
      steps.masterCategories = await seedMasterCategories();
      steps.masterTimeframes = await seedMasterTimeframes();
      steps.masterLocks = await seedMasterLocks();

      if (includeTx) {
        const existing = await db.execute(sql`select count(*)::int as n from daily_transactions`);
        const count = Number((existing as unknown as Array<{ n: number }>)[0]?.n ?? 0);
        steps.transactions =
          count === 0 ? await seedDatabase({ days }) : `dilewati — sudah ada ${count} transaksi`;
      } else {
        steps.transactions = "dilewati (tx=0)";
      }
    }

    const tables = await db.execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema='public'`,
    );
    const tableCount = Number((tables as unknown as Array<{ n: number }>)[0]?.n ?? 0);

    return NextResponse.json({
      ok: true,
      step,
      publicTables: tableCount,
      steps,
      message:
        step === "migrate"
          ? "Migrasi selesai. Lanjut buka ?step=seed untuk mengisi data."
          : step === "seed"
            ? "Seed selesai. Cek /api/dashboard — source harus 'db'. Lalu minta hapus /api/setup."
            : "Database Neon siap. Hapus endpoint /api/setup ini sekarang.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        step,
        error: err instanceof Error ? err.message : String(err),
        steps,
        hint: "Buka bertahap: ?step=migrate dulu (aman diulang), lalu ?step=seed.",
      },
      { status: 500 },
    );
  }
}
