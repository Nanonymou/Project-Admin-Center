/**
 * Receivables aging utilities — shared logic for bucketing invoices by age and
 * computing weighted average age. Kept project-agnostic.
 */
export type AgingBucket = "0-30" | "31-60" | "61-90" | ">90";

export const AGING_BUCKETS: AgingBucket[] = ["0-30", "31-60", "61-90", ">90"];

export const AGING_BUCKET_COLOR: Record<AgingBucket, string> = {
  "0-30": "hsl(142 71% 45%)",
  "31-60": "hsl(199 89% 48%)",
  "61-90": "hsl(38 92% 50%)",
  ">90": "hsl(0 84% 60%)",
};

/** Map a number of days outstanding to its aging bucket. */
export function bucketForDays(days: number): AgingBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return ">90";
}

/** Representative age (days) for a bucket, used to weight averages. */
export function bucketMidpoint(bucket: AgingBucket): number {
  switch (bucket) {
    case "0-30":
      return 15;
    case "31-60":
      return 45;
    case "61-90":
      return 75;
    default:
      return 110;
  }
}

/** Days between a due date and a reference date (positive = overdue). */
export function daysOverdue(dueDate: Date, ref = new Date()): number {
  const a = new Date(ref);
  a.setHours(0, 0, 0, 0);
  const b = new Date(dueDate);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Amount-weighted average age (days) across aged items. */
export function weightedAverageAge(items: { agingBucket: AgingBucket; amount: number }[]): number {
  let weighted = 0;
  let total = 0;
  for (const it of items) {
    weighted += bucketMidpoint(it.agingBucket) * it.amount;
    total += it.amount;
  }
  return total > 0 ? weighted / total : 0;
}

export type AgingSummary = {
  totalAmount: number;
  totalCount: number;
  byBucket: Record<AgingBucket, { count: number; amount: number }>;
  weightedAge: number;
};

/** Summarize a set of aged items into per-bucket totals + weighted age. */
export function summarizeAging(items: { agingBucket: AgingBucket; amount: number }[]): AgingSummary {
  const byBucket: AgingSummary["byBucket"] = {
    "0-30": { count: 0, amount: 0 },
    "31-60": { count: 0, amount: 0 },
    "61-90": { count: 0, amount: 0 },
    ">90": { count: 0, amount: 0 },
  };
  let totalAmount = 0;
  for (const it of items) {
    byBucket[it.agingBucket].count += 1;
    byBucket[it.agingBucket].amount += it.amount;
    totalAmount += it.amount;
  }
  return { totalAmount, totalCount: items.length, byBucket, weightedAge: weightedAverageAge(items) };
}
