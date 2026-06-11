import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  // Lazy: reading DATABASE_URL at query time (not import time) keeps a missing
  // env var from crashing `next build` and lets route handlers catch it.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

let _db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  _db ??= createDb();
  return _db;
}
