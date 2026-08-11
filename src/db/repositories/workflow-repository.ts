import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  masterWorkflows,
  workflowActivities,
  type MasterWorkflow,
  type WorkflowActivity,
} from "@/db/schema";

export type WorkflowActivityInput = {
  orderIndex: number;
  name: string;
  slaDays: number;
  pic?: string | null;
};

export type SaveWorkflowInput = {
  projectCode: string;
  locationId: string;
  subjectType: string;
  code: string;
  name: string;
  activities: WorkflowActivityInput[];
  createdBy?: string;
};

/**
 * List workflows for a site with their activities. Repository Pattern: all DB
 * access to master_workflows / workflow_activities flows through this module.
 */
export async function listWorkflowsForSite(
  locationId: string,
): Promise<(MasterWorkflow & { activities: WorkflowActivity[] })[]> {
  const flows = await db
    .select()
    .from(masterWorkflows)
    .where(eq(masterWorkflows.locationId, locationId))
    .orderBy(asc(masterWorkflows.subjectType));

  const out: (MasterWorkflow & { activities: WorkflowActivity[] })[] = [];
  for (const wf of flows) {
    const acts = await db
      .select()
      .from(workflowActivities)
      .where(eq(workflowActivities.workflowId, wf.id))
      .orderBy(asc(workflowActivities.orderIndex));
    out.push({ ...wf, activities: acts });
  }
  return out;
}

/**
 * Save a confirmed workflow: upsert the workflow row for (locationId,
 * subjectType), then replace its activities atomically. Returns the workflow id.
 */
export async function saveWorkflow(input: SaveWorkflowInput): Promise<string> {
  return db.transaction(async (tx) => {
    // Upsert the workflow by its unique (location_id, subject_type) key.
    const [wf] = await tx
      .insert(masterWorkflows)
      .values({
        projectCode: input.projectCode,
        locationId: input.locationId,
        subjectType: input.subjectType,
        code: input.code,
        name: input.name,
        active: true,
        createdBy: input.createdBy,
      })
      .onConflictDoUpdate({
        target: [masterWorkflows.locationId, masterWorkflows.subjectType],
        set: { code: input.code, name: input.name, active: true, updatedAt: new Date() },
      })
      .returning({ id: masterWorkflows.id });

    // Replace activities: clear existing, then insert the confirmed set.
    await tx.delete(workflowActivities).where(eq(workflowActivities.workflowId, wf.id));
    if (input.activities.length > 0) {
      await tx.insert(workflowActivities).values(
        input.activities.map((a) => ({
          workflowId: wf.id,
          orderIndex: a.orderIndex,
          name: a.name,
          slaDays: a.slaDays,
          pic: a.pic ?? null,
          createdBy: input.createdBy,
        })),
      );
    }
    return wf.id;
  });
}

/** Toggle a workflow's active flag for a site + subject. */
export async function setWorkflowActive(
  locationId: string,
  subjectType: string,
  active: boolean,
): Promise<void> {
  await db
    .update(masterWorkflows)
    .set({ active, updatedAt: new Date() })
    .where(
      and(eq(masterWorkflows.locationId, locationId), eq(masterWorkflows.subjectType, subjectType)),
    );
}
