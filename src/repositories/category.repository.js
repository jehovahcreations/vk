const pool = require("../config/db");

async function listCategories({ search, status }) {
  const values = [];
  const conditions = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(name ILIKE $${values.length} OR slug ILIKE $${values.length})`);
  }

  if (status === "active") {
    conditions.push("is_active = true");
  }

  if (status === "inactive") {
    conditions.push("is_active = false");
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT *
     FROM categories
     ${whereClause}
     ORDER BY created_at DESC`,
    values
  );

  return result.rows;
}

async function findById(id) {
  const result = await pool.query("SELECT * FROM categories WHERE id = $1", [id]);
  return result.rows[0];
}

async function findBySlug(slug) {
  const result = await pool.query("SELECT * FROM categories WHERE slug = $1", [slug]);
  return result.rows[0];
}

async function findBySlugExcludingId(slug, id) {
  const result = await pool.query(
    "SELECT * FROM categories WHERE slug = $1 AND id <> $2",
    [slug, id]
  );
  return result.rows[0];
}

async function createCategory({ name, slug, description }) {
  const result = await pool.query(
    `INSERT INTO categories (name, slug, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, slug, description]
  );
  return result.rows[0];
}

async function updateCategory({ id, name, slug, description }) {
  const result = await pool.query(
    `UPDATE categories
     SET name = $2, slug = $3, description = $4
     WHERE id = $1
     RETURNING *`,
    [id, name, slug, description]
  );
  return result.rows[0];
}

async function toggleCategory(id) {
  const result = await pool.query(
    `UPDATE categories
     SET is_active = NOT is_active
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0];
}

module.exports = {
  listCategories,
  findById,
  findBySlug,
  findBySlugExcludingId,
  createCategory,
  updateCategory,
  toggleCategory
};
