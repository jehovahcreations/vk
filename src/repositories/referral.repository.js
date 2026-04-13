const pool = require("../config/db");

async function findByCode(code) {
  const result = await pool.query(
    "SELECT * FROM admin_referral_codes WHERE code = $1 LIMIT 1",
    [code]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await pool.query(
    "SELECT * FROM admin_referral_codes WHERE id = $1",
    [id]
  );
  return result.rows[0];
}

async function createReferral({ code, name, description }) {
  const result = await pool.query(
    `INSERT INTO admin_referral_codes (code, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [code, name, description]
  );
  return result.rows[0];
}

async function updateReferral({ id, name, description }) {
  const result = await pool.query(
    `UPDATE admin_referral_codes
     SET name = $2, description = $3
     WHERE id = $1
     RETURNING *`,
    [id, name, description]
  );
  return result.rows[0];
}

async function toggleReferral(id) {
  const result = await pool.query(
    `UPDATE admin_referral_codes
     SET is_active = NOT is_active
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0];
}

async function listReferrals({ search, status }) {
  const values = [];
  const conditions = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(code ILIKE $${values.length} OR name ILIKE $${values.length})`);
  }

  if (status === "active") {
    conditions.push("is_active = true");
  }

  if (status === "inactive") {
    conditions.push("is_active = false");
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      admin_referral_codes.*,
      COUNT(users.id) AS total_users,
      COALESCE(SUM(CASE WHEN users.is_active THEN 1 ELSE 0 END), 0) AS active_users
    FROM admin_referral_codes
    LEFT JOIN users ON users.admin_referral_id = admin_referral_codes.id
    ${whereClause}
    GROUP BY admin_referral_codes.id
    ORDER BY admin_referral_codes.created_at DESC
  `;

  const result = await pool.query(query, values);
  return result.rows;
}

async function getReferralStats() {
  const result = await pool.query(
    `SELECT
      COUNT(*) AS total_codes,
      SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS active_codes
     FROM admin_referral_codes`
  );

  const usersResult = await pool.query(
    "SELECT COUNT(*) AS total_users FROM users WHERE admin_referral_id IS NOT NULL"
  );

  return {
    total_codes: Number(result.rows[0]?.total_codes || 0),
    active_codes: Number(result.rows[0]?.active_codes || 0),
    total_users: Number(usersResult.rows[0]?.total_users || 0)
  };
}

module.exports = {
  findByCode,
  findById,
  createReferral,
  updateReferral,
  toggleReferral,
  listReferrals,
  getReferralStats
};
