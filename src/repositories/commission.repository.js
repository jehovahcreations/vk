const pool = require("../config/db");

function isMissingCommissionSchemaError(error) {
  return error && (error.code === "42P01" || error.code === "42703");
}

async function creditCommissionForPaidOrder({ purchaseOrderId, paymentId, client }) {
  const runner = client || pool;
  try {
    const result = await runner.query(
      `INSERT INTO referral_commissions (
        beneficiary_user_id,
        buyer_user_id,
        purchase_order_id,
        payment_id,
        product_id,
        commission_percent,
        commission_amount_in_paise,
        status,
        notes
      )
      SELECT
        upline.id,
        po.user_id,
        po.id,
        $2,
        po.product_id,
        COALESCE(upline.commission_percent, 0),
        ROUND((po.amount_in_paise * COALESCE(upline.commission_percent, 0)) / 100.0)::INTEGER,
        'credited',
        jsonb_build_object('source', 'purchase_payment')
      FROM purchase_orders po
      JOIN users upline ON upline.id = po.referred_by_user_id
      WHERE po.id = $1
        AND po.internal_status = 'paid'
        AND po.referral_type = 'student'
        AND po.referred_by_user_id IS NOT NULL
        AND COALESCE(upline.commission_percent, 0) > 0
      ON CONFLICT (purchase_order_id, beneficiary_user_id)
      DO UPDATE SET
        payment_id = EXCLUDED.payment_id,
        commission_percent = EXCLUDED.commission_percent,
        commission_amount_in_paise = EXCLUDED.commission_amount_in_paise,
        status = 'credited',
        updated_at = NOW()
      RETURNING *`,
      [purchaseOrderId, paymentId]
    );

    return result.rows[0] || null;
  } catch (error) {
    if (isMissingCommissionSchemaError(error)) {
      return null;
    }
    throw error;
  }
}

async function getUserEarningsSummary(userId) {
  try {
    const result = await pool.query(
      `SELECT
        COALESCE(SUM(commission_amount_in_paise), 0) AS total_earnings_in_paise,
        COALESCE(SUM(CASE WHEN status = 'credited' THEN commission_amount_in_paise ELSE 0 END), 0) AS credited_earnings_in_paise,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount_in_paise ELSE 0 END), 0) AS pending_earnings_in_paise,
        COALESCE(COUNT(*), 0) AS total_commissions
       FROM referral_commissions
       WHERE beneficiary_user_id = $1`,
      [userId]
    );

    return result.rows[0];
  } catch (error) {
    if (isMissingCommissionSchemaError(error)) {
      return {
        total_earnings_in_paise: 0,
        credited_earnings_in_paise: 0,
        pending_earnings_in_paise: 0,
        total_commissions: 0
      };
    }
    throw error;
  }
}

async function listUserCommissions(userId) {
  try {
    const result = await pool.query(
      `SELECT
        rc.*,
        buyer.full_name AS buyer_name,
        buyer.email AS buyer_email,
        products.title AS product_title,
        products.slug AS product_slug
       FROM referral_commissions rc
       JOIN users buyer ON buyer.id = rc.buyer_user_id
       LEFT JOIN products ON products.id = rc.product_id
       WHERE rc.beneficiary_user_id = $1
       ORDER BY rc.created_at DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    if (isMissingCommissionSchemaError(error)) {
      return [];
    }
    throw error;
  }
}

async function getAdminCommissionStats() {
  try {
    const result = await pool.query(
      `SELECT
        COALESCE(COUNT(*), 0) AS total_commissions,
        COALESCE(SUM(commission_amount_in_paise), 0) AS total_commission_amount_in_paise,
        COALESCE(COUNT(DISTINCT beneficiary_user_id), 0) AS total_beneficiaries
       FROM referral_commissions`
    );

    return result.rows[0];
  } catch (error) {
    if (isMissingCommissionSchemaError(error)) {
      return {
        total_commissions: 0,
        total_commission_amount_in_paise: 0,
        total_beneficiaries: 0
      };
    }
    throw error;
  }
}

async function listAllCommissions() {
  try {
    const result = await pool.query(
      `SELECT
        rc.*,
        beneficiary.full_name AS beneficiary_name,
        beneficiary.email AS beneficiary_email,
        buyer.full_name AS buyer_name,
        buyer.email AS buyer_email,
        products.title AS product_title,
        products.slug AS product_slug
       FROM referral_commissions rc
       JOIN users beneficiary ON beneficiary.id = rc.beneficiary_user_id
       JOIN users buyer ON buyer.id = rc.buyer_user_id
       LEFT JOIN products ON products.id = rc.product_id
       ORDER BY rc.created_at DESC`
    );

    return result.rows;
  } catch (error) {
    if (isMissingCommissionSchemaError(error)) {
      return [];
    }
    throw error;
  }
}

module.exports = {
  creditCommissionForPaidOrder,
  getUserEarningsSummary,
  listUserCommissions,
  getAdminCommissionStats,
  listAllCommissions
};
