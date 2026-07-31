import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || "";

const parseSslConfig = (url: string) => {
  const mode = (
    process.env.DATABASE_SSL_MODE ||
    process.env.DATABASE_SSL ||
    ""
  )
    .toLowerCase()
    .trim();

  if (mode === "disable" || mode === "false" || mode === "0" || mode === "off") {
    return undefined;
  }

  if (mode === "require" || mode === "true" || mode === "1" || mode === "on") {
    return "require" as const;
  }

  const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");
  return isLocalhost ? undefined : ("require" as const);
};

function createDb() {
  if (!databaseUrl || !databaseUrl.startsWith("postgres")) {
    throw new Error(
      "Missing or invalid DATABASE_URL. Set a valid PostgreSQL connection string in your .env file.\n" +
        "Example: DATABASE_URL='postgresql://user:password@host:port/database'"
    );
  }
  const sql = postgres(databaseUrl, {
    // Vercel scales by creating function instances. Keeping a single client
    // per instance prevents those instances from exhausting Supavisor's
    // client limit during traffic spikes.
    max: 1,
    idle_timeout: 20,
    ssl: parseSslConfig(databaseUrl),
    // Supabase's transaction pooler (the correct endpoint for Vercel
    // serverless functions) does not support PostgreSQL prepared statements.
    prepare: false,
  });
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | undefined;
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = createDb();
    }
    return Reflect.get(_db, prop, receiver);
  },
});

export * from "./schema";
