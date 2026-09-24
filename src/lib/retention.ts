import { sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { inboundMessages, outboundMessages, processingRuns } from "./db/schema";

/**
 * The three log tables have no natural end. Every message in and out is a row,
 * and `inbound_messages.raw`, `outbound_messages.ibot_response` and
 * `processing_runs.raw_llm_output` are each a JSONB blob - so at a few hundred
 * quotes a day they outgrow every other table in the database and keep going.
 *
 * Ninety days is well past the point where any of it is still useful for
 * support or debugging, and `processing_runs.transcript` holds what the
 * professional said about their customer, which is not something to keep
 * forever by accident.
 *
 * Quotes, their items and their events are the product's own history and are
 * never touched here.
 */
export const RETENTION_DAYS = 90;

/**
 * Bounded per table per run, so one neglected month cannot make a tick run
 * past its 60 second budget. At a tick every five minutes this still clears
 * far more than a day can produce.
 */
const BATCH = 500;

/**
 * Deleted by `ctid` so the bound is a real LIMIT: plain `delete where at < x`
 * has no limit in Postgres, and these tables have three different primary key
 * shapes between them.
 */
async function purgeBatch(table: SQL, cutoff: Date): Promise<number> {
  const result = await db.execute<{ n: number }>(sql`
    delete from ${table}
    where ctid in (select ctid from ${table} where "at" < ${cutoff} limit ${BATCH})
    returning 1 as n
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows;
  return Array.isArray(rows) ? rows.length : 0;
}

export type PurgeResult = { inbound: number; outbound: number; runs: number };

export async function purgeOldLogs(now = new Date()): Promise<PurgeResult> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000);
  // Sequential on purpose: the tick has one database connection budget and
  // nothing downstream is waiting on this.
  const inbound = await purgeBatch(sql`${inboundMessages}`, cutoff);
  const outbound = await purgeBatch(sql`${outboundMessages}`, cutoff);
  const runs = await purgeBatch(sql`${processingRuns}`, cutoff);
  return { inbound, outbound, runs };
}
