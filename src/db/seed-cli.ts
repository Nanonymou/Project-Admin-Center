import { seedDatabase } from "@/db/seed";

/**
 * CLI entry for `npm run db:seed`. Usage: `npm run db:seed -- [days]`.
 * Requires DATABASE_URL to point at a reachable database.
 */
async function main() {
  const days = Number(process.argv[2]);
  const result = await seedDatabase({ days: Number.isFinite(days) && days > 0 ? days : undefined });
  // eslint-disable-next-line no-console
  console.log("Seed complete:", result);
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
