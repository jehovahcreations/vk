const pool = require("../config/db");

function isMissingCommissionTable(error) {
  return error && error.code === "42P01";
}

async function getReferralCounts(userId) {
  const result = await pool.query(
    `SELECT
      COUNT(*)::INTEGER AS total_referrals,
      SUM(CASE WHEN created_at::date = CURRENT_DATE THEN 1 ELSE 0 END)::INTEGER AS active_today
     FROM users
     WHERE referred_by_user_id = $1`,
    [userId]
  );

  return {
    totalReferrals: Number(result.rows[0]?.total_referrals || 0),
    activeToday: Number(result.rows[0]?.active_today || 0)
  };
}

async function getPaidReferralCount(userId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT buyer_user_id)::INTEGER AS paid_referrals
       FROM referral_commissions
       WHERE beneficiary_user_id = $1
         AND status IN ('credited', 'pending')`,
      [userId]
    );

    return Number(result.rows[0]?.paid_referrals || 0);
  } catch (error) {
    if (isMissingCommissionTable(error)) {
      return 0;
    }
    throw error;
  }
}

async function getReferralSalesStats(userId) {
  const result = await pool.query(
    `SELECT
      COUNT(*)::INTEGER AS paid_orders,
      COALESCE(SUM(amount_in_paise), 0)::BIGINT AS total_sales_in_paise
     FROM purchase_orders
     WHERE referred_by_user_id = $1
       AND internal_status = 'paid'`,
    [userId]
  );

  return {
    paidOrders: Number(result.rows[0]?.paid_orders || 0),
    totalSalesInPaise: Number(result.rows[0]?.total_sales_in_paise || 0)
  };
}

async function listRecentReferrals(userId, limit = 5) {
  const result = await pool.query(
    `SELECT
      users.id,
      users.full_name,
      users.email,
      users.created_at,
      COALESCE(COUNT(user_purchases.id), 0)::INTEGER AS purchases_count
     FROM users
     LEFT JOIN user_purchases ON user_purchases.user_id = users.id
     WHERE users.referred_by_user_id = $1
     GROUP BY users.id
     ORDER BY users.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

module.exports = {
  getReferralCounts,
  getPaidReferralCount,
  getReferralSalesStats,
  listRecentReferrals
};
