import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { masterAreas, type MasterArea, type NewMasterArea } from "@/db/schema";

/** List master sales areas for a site. */
export async function listMasterAreas(projectId: string, locationId: string): Promise<MasterArea[]> {
  return db
    .select()
    .from(masterAreas)
    .where(and(eq(masterAreas.projectId, projectId), eq(masterAreas.locationId, locationId)))
    .orderBy(asc(masterAreas.areaCode));
}

/** Upsert a master area by (projectId, locationId, areaCode). */
export async function upsertMasterArea(values: NewMasterArea): Promise<void> {
  await db
    .insert(masterAreas)
    .values(values)
    .onConflictDoUpdate({
      target: [masterAreas.projectId, masterAreas.locationId, masterAreas.areaCode],
      set: { name: values.name, active: true, updatedAt: new Date() },
    });
}
