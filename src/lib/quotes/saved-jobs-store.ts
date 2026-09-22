import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { savedJobItems, savedJobs, type SavedJob } from "../db/schema";
import {
  itemsForJob,
  jobKey,
  jobTotal,
  matchJob,
  normalizeJobName,
  type SavedJobItemInput,
  type SavedJobSummary,
} from "./saved-jobs";

/** DB side of §6.8 saved jobs. Matching/shaping logic is in ./saved-jobs.ts. */

/** Plenty for a trade; keeps the list message and the classifier prompt small. */
const LOAD_LIMIT = 50;

export type SavedJobWithItems = SavedJob & { items: SavedJobItemInput[] };

/** Summaries for the chat list and the settings screen, most-used first. */
export async function listSavedJobs(
  userId: string,
  limit = LOAD_LIMIT,
): Promise<SavedJobSummary[]> {
  const rows = await db
    .select({
      id: savedJobs.id,
      name: savedJobs.name,
      key: savedJobs.key,
      itemCount: sql<number>`count(${savedJobItems.id})::int`,
      total: sql<number>`coalesce(sum(${savedJobItems.quantity} * ${savedJobItems.unitPrice}), 0)::float8`,
    })
    .from(savedJobs)
    .leftJoin(savedJobItems, eq(savedJobItems.jobId, savedJobs.id))
    .where(eq(savedJobs.userId, userId))
    .groupBy(savedJobs.id)
    .orderBy(desc(savedJobs.timesUsed), desc(savedJobs.lastUsedAt), asc(savedJobs.name))
    .limit(limit);
  return rows;
}

/**
 * Every job with its items, for the settings screen. Two queries rather than
 * one per job - a professional with 20 saved jobs should not cost 21 round
 * trips to Neon on page load.
 */
export async function listSavedJobsWithItems(
  userId: string,
  limit = LOAD_LIMIT,
): Promise<{ id: string; name: string; items: SavedJobItemInput[] }[]> {
  const jobs = await db
    .select({ id: savedJobs.id, name: savedJobs.name })
    .from(savedJobs)
    .where(eq(savedJobs.userId, userId))
    .orderBy(desc(savedJobs.timesUsed), desc(savedJobs.lastUsedAt), asc(savedJobs.name))
    .limit(limit);
  if (!jobs.length) return [];

  const rows = await db
    .select({
      jobId: savedJobItems.jobId,
      description: savedJobItems.description,
      quantity: savedJobItems.quantity,
      unit: savedJobItems.unit,
      unitPrice: savedJobItems.unitPrice,
    })
    .from(savedJobItems)
    .where(
      inArray(
        savedJobItems.jobId,
        jobs.map((j) => j.id),
      ),
    )
    .orderBy(asc(savedJobItems.position));

  const byJob = new Map<string, SavedJobItemInput[]>();
  for (const r of rows) {
    const list = byJob.get(r.jobId) ?? [];
    list.push({
      description: r.description,
      quantity: r.quantity,
      unit: r.unit,
      unitPrice: r.unitPrice,
    });
    byJob.set(r.jobId, list);
  }
  return jobs.map((j) => ({ id: j.id, name: j.name, items: byJob.get(j.id) ?? [] }));
}

export async function getSavedJob(
  userId: string,
  jobId: string,
): Promise<SavedJobWithItems | null> {
  const [job] = await db
    .select()
    .from(savedJobs)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.id, jobId)))
    .limit(1);
  if (!job) return null;
  return { ...job, items: await loadJobItems(job.id) };
}

async function loadJobItems(jobId: string): Promise<SavedJobItemInput[]> {
  return db
    .select({
      description: savedJobItems.description,
      quantity: savedJobItems.quantity,
      unit: savedJobItems.unit,
      unitPrice: savedJobItems.unitPrice,
    })
    .from(savedJobItems)
    .where(eq(savedJobItems.jobId, jobId))
    .orderBy(asc(savedJobItems.position));
}

/**
 * Save (or overwrite) a job. Overwriting on a name collision is deliberate:
 * re-saving after a price change is the natural way to update, and a second
 * "התקנת מזגן" with stale prices would be worse than no history (§6.8).
 *
 * Returns `replaced` so the chat can say which of the two happened.
 */
export async function saveJob(
  userId: string,
  rawName: string,
  items: { description: string; quantity: number; unit: string; unitPrice: number }[],
): Promise<{ job: SavedJob; items: SavedJobItemInput[]; replaced: boolean } | null> {
  const name = normalizeJobName(rawName);
  const key = jobKey(name);
  const rows = itemsForJob(items);
  if (!name || !key || !rows.length) return null;

  const [existing] = await db
    .select()
    .from(savedJobs)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.key, key)))
    .limit(1);

  let job: SavedJob;
  if (existing) {
    [job] = await db
      .update(savedJobs)
      .set({ name, updatedAt: new Date() })
      .where(eq(savedJobs.id, existing.id))
      .returning();
    await db.delete(savedJobItems).where(eq(savedJobItems.jobId, job.id));
  } else {
    [job] = await db.insert(savedJobs).values({ userId, name, key }).returning();
  }

  await db.insert(savedJobItems).values(
    rows.map((it, i) => ({
      jobId: job.id,
      position: i,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
    })),
  );

  return { job, items: rows, replaced: !!existing };
}

/** Resolve what the professional said to a job, and load its items. */
export async function findSavedJob(
  userId: string,
  spoken: string,
): Promise<SavedJobWithItems | null> {
  const jobs = await db
    .select({ id: savedJobs.id, name: savedJobs.name, key: savedJobs.key })
    .from(savedJobs)
    .where(eq(savedJobs.userId, userId));
  const hit = matchJob(jobs, spoken);
  if (!hit) return null;
  return getSavedJob(userId, hit.id);
}

/** One use, counted when a quote is actually started from the job. */
export async function markJobUsed(jobId: string): Promise<void> {
  await db
    .update(savedJobs)
    .set({ timesUsed: sql`${savedJobs.timesUsed} + 1`, lastUsedAt: new Date() })
    .where(eq(savedJobs.id, jobId));
}

export async function renameSavedJob(
  userId: string,
  jobId: string,
  rawName: string,
): Promise<boolean> {
  const name = normalizeJobName(rawName);
  const key = jobKey(name);
  if (!name || !key) return false;
  // A rename that collides with another job would break the unique key.
  const [clash] = await db
    .select({ id: savedJobs.id })
    .from(savedJobs)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.key, key)))
    .limit(1);
  if (clash && clash.id !== jobId) return false;
  const updated = await db
    .update(savedJobs)
    .set({ name, key, updatedAt: new Date() })
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.id, jobId)))
    .returning({ id: savedJobs.id });
  return updated.length > 0;
}

export async function replaceJobItems(
  userId: string,
  jobId: string,
  items: { description: string; quantity: number; unit: string; unitPrice: number }[],
): Promise<boolean> {
  const rows = itemsForJob(items);
  if (!rows.length) return false;
  const [job] = await db
    .select({ id: savedJobs.id })
    .from(savedJobs)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.id, jobId)))
    .limit(1);
  if (!job) return false;
  await db.delete(savedJobItems).where(eq(savedJobItems.jobId, jobId));
  await db.insert(savedJobItems).values(
    rows.map((it, i) => ({
      jobId,
      position: i,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
    })),
  );
  await db.update(savedJobs).set({ updatedAt: new Date() }).where(eq(savedJobs.id, jobId));
  return true;
}

export async function deleteSavedJob(userId: string, jobId: string): Promise<void> {
  await db.delete(savedJobs).where(and(eq(savedJobs.userId, userId), eq(savedJobs.id, jobId)));
}

export { jobTotal };
