import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../config/database";

const migrationsDir = path.resolve(__dirname, "../migrations");

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    "SELECT filename FROM migrations ORDER BY id ASC"
  );
  return new Set(result.rows.map((row) => row.filename));
}

async function run(): Promise<void> {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  for (const file of files) {
    if (executed.has(file)) {
      console.log(`Skipping ${file} (already executed)`);
      continue;
    }

    const migrationPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(migrationPath, "utf8");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied migration ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("Migrations completed.");
}

run()
  .catch((error) => {
    console.error("Migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
