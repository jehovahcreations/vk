const pool = require("../config/db");

async function findByEmailOrPhone(identifier) {
  const query = `
    SELECT * FROM users
    WHERE LOWER(email) = LOWER($1)
       OR phone = $1
    LIMIT 1
  `;
  const result = await pool.query(query, [identifier]);
  return result.rows[0];
}

async function findByEmail(email) {
  const result = await pool.query(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [email]
  );
  return result.rows[0];
}

async function findByPhone(phone) {
  const result = await pool.query("SELECT * FROM users WHERE phone = $1 LIMIT 1", [phone]);
  return result.rows[0];
}

async function findByEmailExcludingId(email, id) {
  const result = await pool.query(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1",
    [email, id]
  );
  return result.rows[0];
}

async function findByPhoneExcludingId(phone, id) {
  const result = await pool.query(
    "SELECT * FROM users WHERE phone = $1 AND id <> $2 LIMIT 1",
    [phone, id]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0];
}

async function findByAffiliateCode(code) {
  const result = await pool.query(
    "SELECT * FROM users WHERE affiliate_code = $1 LIMIT 1",
    [code]
  );
  return result.rows[0];
}

async function createUser(user) {
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
      is_active,
      is_verified,
      profile_image
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *
  `;
  const values = [
    user.full_name,
    user.email,
    user.phone,
    user.password_hash,
    user.role,
    user.is_reseller,
    user.affiliate_code,
    user.referred_by_user_id,
    user.referral_type,
    user.admin_referral_id,
    user.is_active,
    user.is_verified,
    user.profile_image
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function updatePassword(userId, passwordHash) {
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
}

module.exports = {
  findByEmailOrPhone,
  findByEmail,
  findByPhone,
  findByEmailExcludingId,
  findByPhoneExcludingId,
  findById,
  findByAffiliateCode,
  createUser,
  updatePassword
};
