const pool = require("../config/db");

async function listVideos({ search, status }) {
  const values = [];
  const conditions = ["type = 'video'"];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(title ILIKE $${values.length} OR slug ILIKE $${values.length})`);
  }

  if (status === "active") {
    conditions.push("is_active = true");
  }

  if (status === "inactive") {
    conditions.push("is_active = false");
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT products.*, categories.name AS category_name, categories.slug AS category_slug
     FROM products
     LEFT JOIN categories ON categories.id = products.category_id
     ${whereClause}
     ORDER BY created_at DESC`,
    values
  );

  return result.rows;
}

async function findById(id) {
  const result = await pool.query(
    "SELECT * FROM products WHERE id = $1 AND type = 'video'",
    [id]
  );
  return result.rows[0];
}

async function findBySlug(slug) {
  const result = await pool.query(
    "SELECT * FROM products WHERE slug = $1 LIMIT 1",
    [slug]
  );
  return result.rows[0];
}

async function findActiveBySlug(slug) {
  const result = await pool.query(
    "SELECT * FROM products WHERE slug = $1 AND type = 'video' AND is_active = true LIMIT 1",
    [slug]
  );
  return result.rows[0];
}

async function listActiveVideos({ search }) {
  const values = [];
  const conditions = ["products.type = 'video'", "products.is_active = true"];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(
      products.title ILIKE $${values.length}
      OR products.slug ILIKE $${values.length}
      OR categories.name ILIKE $${values.length}
      OR categories.slug ILIKE $${values.length}
    )`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const result = await pool.query(
    `SELECT products.*, categories.name AS category_name, categories.slug AS category_slug
     FROM products
     LEFT JOIN categories ON categories.id = products.category_id
     ${whereClause}
     ORDER BY created_at DESC`,
    values
  );

  return result.rows;
}

async function findBySlugExcludingId(slug, id) {
  const result = await pool.query(
    "SELECT * FROM products WHERE slug = $1 AND id <> $2 LIMIT 1",
    [slug, id]
  );
  return result.rows[0];
}

async function createVideo(video) {
  const result = await pool.query(
    `INSERT INTO products (
      type,
      title,
      slug,
      description,
      thumbnail_url,
      price_in_paise,
      currency,
      is_active,
      category_id,
      metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *`,
    [
      "video",
      video.title,
      video.slug,
      video.description,
      video.thumbnail_url,
      video.price_in_paise,
      video.currency,
      video.is_active,
      video.category_id,
      video.metadata
    ]
  );

  return result.rows[0];
}

async function updateVideo(video) {
  const result = await pool.query(
    `UPDATE products
     SET title = $2,
         slug = $3,
         description = $4,
         thumbnail_url = $5,
         price_in_paise = $6,
         currency = $7,
         is_active = $8,
         category_id = $9,
         metadata = $10
     WHERE id = $1 AND type = 'video'
     RETURNING *`,
    [
      video.id,
      video.title,
      video.slug,
      video.description,
      video.thumbnail_url,
      video.price_in_paise,
      video.currency,
      video.is_active,
      video.category_id,
      video.metadata
    ]
  );

  return result.rows[0];
}

async function toggleVideo(id) {
  const result = await pool.query(
    `UPDATE products
     SET is_active = NOT is_active
     WHERE id = $1 AND type = 'video'
     RETURNING *`,
    [id]
  );

  return result.rows[0];
}

module.exports = {
  listVideos,
  findById,
  findBySlug,
  findActiveBySlug,
  listActiveVideos,
  findBySlugExcludingId,
  createVideo,
  updateVideo,
  toggleVideo
};
