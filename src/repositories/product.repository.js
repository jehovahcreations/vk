const pool = require("../config/db");

async function findBySlug(slug) {
  const result = await pool.query(
    "SELECT * FROM products WHERE slug = $1 AND is_active = true LIMIT 1",
    [slug]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
  return result.rows[0];
}

module.exports = {
  findBySlug,
  findById
};
