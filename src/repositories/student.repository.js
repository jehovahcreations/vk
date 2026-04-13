const pool = require("../config/db");

async function listStudents({ search, status }) {
  const values = [];
  const conditions = ["role = 'student'"];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(full_name ILIKE $${values.length} OR email ILIKE $${values.length} OR phone ILIKE $${values.length})`
    );
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
     FROM users
     ${whereClause}
     ORDER BY created_at DESC`,
    values
  );

  return result.rows;
}

async function findById(id) {
  const result = await pool.query(
    "SELECT * FROM users WHERE id = $1 AND role = 'student'",
    [id]
  );
  return result.rows[0];
}

async function createStudent(student) {
  const query = `
    INSERT INTO users (
      full_name,
      email,
      phone,
      password_hash,
      role,
      is_reseller,
      affiliate_code,
      referred_by_user_id,
      referral_type,
      admin_referral_id,
      commission_percent,
      is_active,
      is_verified,
      profile_image
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING *
  `;

  const values = [
    student.full_name,
    student.email,
    student.phone,
    student.password_hash,
    student.role,
    student.is_reseller,
    student.affiliate_code,
    student.referred_by_user_id,
    student.referral_type,
    student.admin_referral_id,
    student.commission_percent,
    student.is_active,
    student.is_verified,
    student.profile_image
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function updateStudent({ id, full_name, email, phone, is_reseller, is_active, commission_percent }) {
  const result = await pool.query(
    `UPDATE users
     SET full_name = $2,
         email = $3,
         phone = $4,
         is_reseller = $5,
         is_active = $6,
         commission_percent = $7
     WHERE id = $1 AND role = 'student'
     RETURNING *`,
    [id, full_name, email, phone, is_reseller, is_active, commission_percent]
  );

  return result.rows[0];
}

async function toggleStudent(id) {
  const result = await pool.query(
    `UPDATE users
     SET is_active = NOT is_active
     WHERE id = $1 AND role = 'student'
     RETURNING *`,
    [id]
  );
  return result.rows[0];
}

module.exports = {
  listStudents,
  findById,
  createStudent,
  updateStudent,
  toggleStudent
};
