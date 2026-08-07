import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "postgres://localhost:5432/project_admin_center";

// `postgres()` is lazy — it does not open a connection until the first query,
// so importing this module is safe even without a running database.
const client = postgres(connectionString, { max: 1 });

export const db = drizzle(client, { schema });
export * from "./schema";
