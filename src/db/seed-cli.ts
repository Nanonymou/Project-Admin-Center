import { seedDatabase } from "@/db/seed";
import { seedMasterCategories } from "@/db/seed-master";

/**
 * CLI entry for `npm run db:seed`. Usage: `npm run db:seed -- [days]`.
 * Seeds the master price list and sample daily transactions.
 * Requires DATABASE_URL to point at a reachable database.
 */
async function main() {
  const days = Number(process.argv[2]);
  // Optional comma-separated project filter, e.g. `npm run db:seed -- 60 PHKT`.
  const projectCodes = (process.argv[3] ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const master = await seedMasterCategories();
  const result = await seedDatabase({
    days: Number.isFinite(days) && days > 0 ? days : undefined,
    projectCodes: projectCodes.length ? projectCodes : undefined,
  });
  // eslint-disable-next-line no-console
  console.log("Seed complete:", { master, ...result });
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
