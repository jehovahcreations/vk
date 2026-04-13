const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vk_training',
  password: String(process.env.DB_PASSWORD || ''),
  port: Number(process.env.DB_PORT || 5432),
});

const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";

async function seedAdmin() {
  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const existing = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [adminEmail]
    );

    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, is_reseller, is_active, is_verified)
         VALUES ($1, $2, $3, 'admin', false, true, true)`,
        ["Default Admin", adminEmail, passwordHash]
      );
    }
    console.log("Admin seed complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin().catch((error) => {
  console.error("Admin seed failed:", error);
  process.exit(1);
});
