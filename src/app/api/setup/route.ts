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
import { seedAppUsers } from "@/db/seed-app-users";

/**
 * TEMPORARY one-shot database setup endpoint.
 *
 * Applies pending schema migrations + seeds initial data on the production (Neon)
 * database from within Vercel. Open it once with the token, then this file is
 * removed. Migrations are applied statement-by-statement over the app's (pooled)
 * Neon connection in autocommit, tracked in `__setup_applied` so it is idempotent,
 * resumable, and picks up newly added migration files (e.g. login accounts).
 *
 * Steps:
 *   ?step=migrate  → apply pending migrations
 *   ?step=seed     → roles/master data + login accounts + sample transactions
 *   ?step=check    → report status (no auth header needed)
 *   (no step/all)  → migrate + seed
 *
 * DELETE THIS ROUTE after setup succeeds.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SETUP_TOKEN = "pac-setup-65d2cbec9841faf9d3";

const IGNORABLE_CODES = new Set(["42P07", "42710", "42701", "42P06", "42P16", "23505"]);

type MigrateResult = {
  totalFiles: number;
  alreadyApplied: number;
  appliedThisCall: number;
  remaining: number;
  done: boolean;
};

async function runMigrate(limit: number): Promise<MigrateResult> {
  const url = resolveDatabaseUrl()!;
  const pooled = url.includes("-pooler.") || /[?&]pgbouncer=true/.test(url);
  const client = postgres(url, { max: 1, ssl: "require", prepare: !pooled });

  const dir = path.join(process.cwd(), "drizzle");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  try {
    await client.unsafe(
      "create table if not exists __setup_applied (file text primary key, applied_at timestamptz default now())",
    );
    const doneRows = (await client.unsafe("select file from __setup_applied")) as unknown as Array<{ file: string }>;
    const doneSet = new Set(doneRows.map((r) => r.file));

    const pending = files.filter((f) => !doneSet.has(f));
    const batch = pending.slice(0, Math.max(1, limit));

    for (const file of batch) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      const statements = content.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        try {
          await client.unsafe(stmt);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code && IGNORABLE_CODES.has(code)) continue;
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Migrasi gagal di ${file} [${code ?? "?"}]: ${msg}`);
        }
      }
      await client.unsafe("insert into __setup_applied (file) values ($1) on conflict do nothing", [file]);
    }

    const remaining = pending.length - batch.length;
    return {
      totalFiles: files.length,
      alreadyApplied: doneSet.size,
      appliedThisCall: batch.length,
      remaining,
      done: remaining === 0,
    };
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
        error: "Connection string database tidak ditemukan. Pastikan DATABASE_URL diisi di Value, lalu Redeploy.",
        dbEnvVarsPresent: databaseishEnvKeys(),
      },
      { status: 400 },
    );
  }

  const step = (sp.get("step") ?? "all").toLowerCase();

  if (step === "check") {
    try {
      const q = async (text: string) => {
        const r = await db.execute(sql.raw(text));
        return Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0);
      };
      const publicTables = await q("select count(*)::int as n from information_schema.tables where table_schema='public'");
      const roles = publicTables > 0 ? await q("select count(*)::int as n from roles") : 0;
      const transactions = publicTables > 0 ? await q("select count(*)::int as n from daily_transactions") : 0;
      const loginAccounts = publicTables > 0 ? await q("select count(*)::int as n from app_users").catch(() => 0) : 0;
      const ready = publicTables > 0 && roles > 0 && loginAccounts > 0;
      return NextResponse.json({
        ok: true,
        step: "check",
        ready,
        publicTables,
        rows: { roles, daily_transactions: transactions, app_users: loginAccounts },
        message: ready
          ? "DB Neon AKTIF, berisi data & akun login. Aman untuk hapus /api/setup."
          : loginAccounts === 0
            ? "Akun login belum ada — jalankan ?step=migrate lalu ?step=seed."
            : "Belum lengkap — jalankan ?step=migrate lalu ?step=seed.",
      });
    } catch (err) {
      return NextResponse.json(
        { ok: false, step: "check", error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  const doMigrate = step === "all" || step === "migrate";
  const doSeed = step === "all" || step === "seed";

  const daysRaw = Number(sp.get("days"));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 90) : 14;
  const includeTx = sp.get("tx") !== "0";
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 76) : 20;

  const steps: Record<string, unknown> = {};
  let migrateDone = true;
  try {
    if (doMigrate) {
      const m = await runMigrate(limit);
      steps.migrate = m;
      migrateDone = m.done;
    }

    if (doSeed) {
      steps.roles = await seedRoles();
      steps.masterCategories = await seedMasterCategories();
      steps.masterTimeframes = await seedMasterTimeframes();
      steps.masterLocks = await seedMasterLocks();
      steps.appUsers = await seedAppUsers();

      if (includeTx) {
        const existing = await db.execute(sql`select count(*)::int as n from daily_transactions`);
        const count = Number((existing as unknown as Array<{ n: number }>)[0]?.n ?? 0);
        steps.transactions = count === 0 ? await seedDatabase({ days }) : `dilewati — sudah ada ${count} transaksi`;
      } else {
        steps.transactions = "dilewati (tx=0)";
      }
    }

    const tables = await db.execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema='public'`,
    );
    const tableCount = Number((tables as unknown as Array<{ n: number }>)[0]?.n ?? 0);

    const migrateMsg = migrateDone
      ? "Migrasi selesai. Lanjut buka ?step=seed untuk mengisi data."
      : "Sebagian migrasi terpasang. BUKA LAGI link ?step=migrate yang sama sampai remaining = 0.";

    return NextResponse.json({
      ok: true,
      step,
      publicTables: tableCount,
      steps,
      message:
        step === "migrate"
          ? migrateMsg
          : step === "seed"
            ? "Seed selesai. Buka ?step=check untuk memastikan ready:true."
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
