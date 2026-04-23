const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "vk_training",
  password: String(process.env.DB_PASSWORD || ""),
  port: Number(process.env.DB_PORT || 5432),
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    `);

    await client.query(`
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_commission_percent_check,
      ADD CONSTRAINT users_commission_percent_check
      CHECK (commission_percent >= 0 AND commission_percent <= 100)
    `);

    await client.query("COMMIT");
    console.log("Migration complete: users.commission_percent is ready.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();