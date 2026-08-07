import { db } from "@/db";
import {
  dailyTransactionLines,
  dailyTransactions,
  type NewDailyTransaction,
  type NewDailyTransactionLine,
} from "@/db/schema";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getCostCategories } from "@/lib/mock/cost-config";
import { getTaxConfig } from "@/lib/mock/tax-config";

export type SeedOptions = {
  /** Number of trailing days to generate (default 60). */
  days?: number;
  /** Deterministic base seed for reproducible data (default 42). */
  seed?: number;
};

export type SeedResult = {
  sites: number;
  days: number;
  headers: number;
  lines: number;
};

/** Deterministic pseudo-random in [0,1) from an integer seed. */
function rng(seed: number): number {
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Seed deterministic sample daily transactions (sales + cost) for every site so
 * the Dashboard Margin charts have data to render. Config-driven: categories,
 * prices, and tax come from each project's configuration keyed by project code —
 * no project-specific branches. Idempotent per run only in the sense that it
 * always appends a fresh window; callers should truncate first if they want a
 * clean slate.
 */
export async function seedDatabase(opts: SeedOptions = {}): Promise<SeedResult> {
  const days = opts.days ?? 60;
  const base = opts.seed ?? 42;

  const headers: NewDailyTransaction[] = [];
  // Lines are keyed to their header by array index alignment after insert, so we
  // stage them per-header and stitch ids once the headers are returned.
  const stagedLines: NewDailyTransactionLine[][] = [];

  let counter = 0;
  for (const site of SITE_KPI) {
    const services = getServiceCategories(site.projectCode);
    const costs = getCostCategories(site.projectCode);
    const tax = getTaxConfig(site.projectCode);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const trxDate = iso(d);

      // --- Sales header + lines ---
      const salesLines: NewDailyTransactionLine[] = [];
      let salesSubtotal = 0;
      for (const cat of services) {
        counter += 1;
        const qty = Math.round(20 + rng(base + counter) * 180);
        const amount = qty * cat.defaultPrice;
        const signed = cat.deduction ? -amount : amount;
        salesSubtotal += signed;
        salesLines.push({
          transactionId: "", // filled after header insert
          projectId: site.projectCode,
          locationId: site.locationId,
          categoryKey: cat.key,
          label: cat.label,
          qty: qty.toFixed(3),
          unitPrice: cat.defaultPrice.toFixed(2),
          amount: amount.toFixed(2),
          isDeduction: Boolean(cat.deduction),
        });
      }
      const salesTax = round2(salesSubtotal * tax.rate);
      headers.push({
        projectId: site.projectCode,
        locationId: site.locationId,
        kind: "sales",
        trxDate,
        status: "approved",
        subtotal: round2(salesSubtotal).toFixed(2),
        tax: salesTax.toFixed(2),
        total: round2(salesSubtotal + salesTax).toFixed(2),
        createdBy: "seed",
      });
      stagedLines.push(salesLines);

      // --- Cost header + lines (~40-52% of sales) ---
      const costLines: NewDailyTransactionLine[] = [];
      const costFactor = 0.4 + rng(base + counter + 7) * 0.12;
      let costSubtotal = 0;
      for (const cat of costs) {
        counter += 1;
        const amount = round2((salesSubtotal * costFactor) / costs.length * (0.6 + rng(base + counter) * 0.8));
        costSubtotal += amount;
        costLines.push({
          transactionId: "",
          projectId: site.projectCode,
          locationId: site.locationId,
          categoryKey: cat.key,
          label: cat.label,
          qty: "1",
          unitPrice: amount.toFixed(2),
          amount: amount.toFixed(2),
          isDeduction: false,
        });
      }
      headers.push({
        projectId: site.projectCode,
        locationId: site.locationId,
        kind: "cost",
        trxDate,
        status: "approved",
        subtotal: round2(costSubtotal).toFixed(2),
        tax: "0.00",
        total: round2(costSubtotal).toFixed(2),
        createdBy: "seed",
      });
      stagedLines.push(costLines);
    }
  }

  // Insert headers, then attach ids to their staged lines and insert in bulk.
  const insertedHeaders = await db.insert(dailyTransactions).values(headers).returning({ id: dailyTransactions.id });

  const allLines: NewDailyTransactionLine[] = [];
  insertedHeaders.forEach((h, idx) => {
    for (const line of stagedLines[idx]) allLines.push({ ...line, transactionId: h.id });
  });
  if (allLines.length) {
    // Chunk to keep the insert under parameter limits.
    const CHUNK = 500;
    for (let i = 0; i < allLines.length; i += CHUNK) {
      await db.insert(dailyTransactionLines).values(allLines.slice(i, i + CHUNK));
    }
  }

  return { sites: SITE_KPI.length, days, headers: headers.length, lines: allLines.length };
}
