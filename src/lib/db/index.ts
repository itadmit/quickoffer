import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Neon's HTTP driver only talks to Neon. For a local Postgres (dev/tests) use node-postgres.
  const host = new URL(url).hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return drizzlePg(url, { schema }) as unknown as Db;
  }
  return drizzleNeon(neon(url), { schema });
}

// Lazy singleton so importing the module never throws at build time.
let _db: Db | undefined;
export const db = new Proxy({} as Db, {
  get(_t, prop) {
    _db ??= createDb();
    return Reflect.get(_db, prop);
  },
});

export { schema };
