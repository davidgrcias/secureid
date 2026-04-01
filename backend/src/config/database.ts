import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { env } from "./env";

function shouldUseSsl(): boolean {
  if (env.DATABASE_SSL_MODE === "disable") {
    return false;
  }

  if (env.DATABASE_SSL_MODE === "require") {
    return true;
  }

  return /(supabase\.co|neon\.tech|render\.com|railway\.app|rds\.amazonaws\.com)/i.test(
    env.DATABASE_URL
  );
}

const useSsl = shouldUseSsl();

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function verifyDatabaseConnection(): Promise<void> {
  await query("SELECT 1");
}
