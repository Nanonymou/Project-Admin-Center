import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
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
 * Runs the Drizzle migrations + seeds the initial data on the production (Neon)
 * database from within Vercel — where the database is reachable. Open it once in
 * the browser with the token, then this file is removed.
 *
 * Split into steps to stay within the serverless time limit:
 *   ?step=migrate  → create tables only (uses a DIRECT, non-pooled connection —
 *                    running migrations through Neon's PgBouncer pooler can hang)
 *   ?step=seed     → seed roles/master data + sample transactions (?days=, ?tx=0)
 *   (no step/all)  → both, for small databases
 *
 * Idempotent: migrations are tracked; seeds upsert; sample transactions only
 * seed when the table is empty. Safe to re-open if a call times out — it resumes.
 *
 * DELETE THIS ROUTE after setup succeeds.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SETUP_TOKEN = "pac-setup-65d2cbec9841faf9d3";

/** Neon's direct (session-mode) host is the pooled host without `-pooler`. */
function toDirectUrl(url: string): string {
  return url.replace("-pooler.", ".");
}

async function runMigrate(): Promise<string> {
  const directUrl = toDirectUrl(resolveDatabaseUrl()!);
  // Dedicated short-lived client on the DIRECT endpoint for reliable DDL.
  const client = postgres(directUrl, { max: 1, ssl: "require", prepare: false });
  try {
    await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    return "ok";
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
  }
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
          "Connection string database tidak ditemukan. Pastikan connection string ada di kolom VALUE variabel DATABASE_URL (bukan Note), aktif untuk Production, lalu Redeploy.",
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

    const done = step === "all" && tableCount > 0;
    return NextResponse.json({
      ok: true,
      step,
      publicTables: tableCount,
      steps,
      message: done
        ? "Database Neon siap. Hapus endpoint /api/setup ini sekarang."
        : step === "migrate"
          ? "Migrasi selesai. Lanjut buka ?step=seed untuk mengisi data."
          : "Selesai.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        step,
        error: err instanceof Error ? err.message : String(err),
        steps,
        hint: "Jika timeout, buka bertahap: ?step=migrate lalu ?step=seed. Migrasi memakai koneksi direct (tanpa -pooler).",
      },
      { status: 500 },
    );
  }
}
