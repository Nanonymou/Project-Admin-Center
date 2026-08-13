import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "@/db";
import { seedDatabase } from "@/db/seed";
import { seedMasterCategories, seedMasterTimeframes } from "@/db/seed-master";
import { seedRoles } from "@/db/seed-roles";
import { seedMasterLocks } from "@/db/seed-master-locks";

/**
 * TEMPORARY one-shot database setup endpoint.
 *
 * Purpose: run the Drizzle migrations + seed the initial data on the production
 * (Neon) database from within Vercel — where the database is reachable — without
 * the operator needing a local CLI. Open it once in the browser with the token,
 * then this file is removed.
 *
 * Guarded by a fixed token (`?key=`), served over HTTPS, and safe to re-run:
 * migrations are tracked (idempotent) and the seeds upsert; the sample-
 * transaction seed only runs when the table is still empty.
 *
 * DELETE THIS ROUTE after setup succeeds.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SETUP_TOKEN = "pac-setup-65d2cbec9841faf9d3";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== SETUP_TOKEN) {
    return NextResponse.json({ ok: false, error: "Token setup salah atau tidak ada (?key=...)." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL belum diset di Environment Variables Vercel." },
      { status: 400 },
    );
  }

  // Optional: number of trailing days of sample transactions (default 30, max 90).
  const daysRaw = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 90) : 30;

  const steps: Record<string, unknown> = {};
  try {
    // 1) Migrate — creates all tables (idempotent; tracked in __drizzle_migrations).
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    steps.migrate = "ok";

    // 2) Idempotent seeds (upsert).
    steps.roles = await seedRoles();
    steps.masterCategories = await seedMasterCategories();
    steps.masterTimeframes = await seedMasterTimeframes();
    steps.masterLocks = await seedMasterLocks();

    // 3) Sample transactions — only when the table is still empty (append-only seed).
    const existing = await db.execute(sql`select count(*)::int as n from daily_transactions`);
    const count = Number((existing as unknown as Array<{ n: number }>)[0]?.n ?? 0);
    if (count === 0) {
      steps.transactions = await seedDatabase({ days });
    } else {
      steps.transactions = `dilewati — sudah ada ${count} transaksi`;
    }

    // Report the schema size so the operator can confirm.
    const tables = await db.execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema='public'`,
    );
    const tableCount = Number((tables as unknown as Array<{ n: number }>)[0]?.n ?? 0);

    return NextResponse.json({
      ok: true,
      message: "Database Neon siap. Tabel dibuat & data awal terisi. Hapus endpoint /api/setup ini sekarang.",
      publicTables: tableCount,
      steps,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        steps,
        hint: "Cek DATABASE_URL (pakai string pooled Neon, diakhiri ?sslmode=require).",
      },
      { status: 500 },
    );
  }
}
