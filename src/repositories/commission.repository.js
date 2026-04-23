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
      `WITH commission_totals AS (
         SELECT
           COALESCE(SUM(commission_amount_in_paise), 0) AS total_earnings_in_paise,
           COALESCE(SUM(CASE WHEN status = 'credited' THEN commission_amount_in_paise ELSE 0 END), 0) AS credited_earnings_in_paise,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount_in_paise ELSE 0 END), 0) AS pending_earnings_in_paise,
           COALESCE(COUNT(*), 0) AS total_commissions
         FROM referral_commissions
         WHERE beneficiary_user_id = $1
       ),
       payout_totals AS (
         SELECT COALESCE(SUM(amount_in_paise), 0) AS paid_out_in_paise
         FROM commission_payouts
         WHERE beneficiary_user_id = $1
           AND is_voided = false
       )
       SELECT
         commission_totals.total_earnings_in_paise,
         commission_totals.credited_earnings_in_paise,
         commission_totals.pending_earnings_in_paise,
         commission_totals.total_commissions,
         payout_totals.paid_out_in_paise,
         GREATEST(commission_totals.credited_earnings_in_paise - payout_totals.paid_out_in_paise, 0) AS available_balance_in_paise
       FROM commission_totals
       CROSS JOIN payout_totals`,
      [userId]
    );

    return result.rows[0];
  } catch (error) {
    if (isMissingCommissionSchemaError(error)) {
      return {
        total_earnings_in_paise: 0,
        credited_earnings_in_paise: 0,
        pending_earnings_in_paise: 0,
        total_commissions: 0,
        paid_out_in_paise: 0,
        available_balance_in_paise: 0
      };
    }
    throw error;
  }
}

async function listUserPayouts(userId) {
  try {
    const result = await pool.query(
      `SELECT
        cp.*,
        admin_user.full_name AS created_by_name,
        admin_user.email AS created_by_email
       FROM commission_payouts cp
       LEFT JOIN users admin_user ON admin_user.id = cp.created_by_user_id
       WHERE cp.beneficiary_user_id = $1
         AND cp.is_voided = false
       ORDER BY cp.paid_at DESC, cp.created_at DESC`,
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
      `WITH commission_totals AS (
         SELECT
           COALESCE(COUNT(*), 0) AS total_commissions,
           COALESCE(SUM(commission_amount_in_paise), 0) AS total_commission_amount_in_paise,
           COALESCE(COUNT(DISTINCT beneficiary_user_id), 0) AS total_beneficiaries,
           COALESCE(SUM(CASE WHEN status = 'credited' THEN commission_amount_in_paise ELSE 0 END), 0) AS total_credited_in_paise,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount_in_paise ELSE 0 END), 0) AS total_pending_in_paise
         FROM referral_commissions
       ),
       payout_totals AS (
         SELECT COALESCE(SUM(amount_in_paise), 0) AS total_paid_out_in_paise
         FROM commission_payouts
         WHERE is_voided = false
       )
       SELECT
         commission_totals.total_commissions,
         commission_totals.total_commission_amount_in_paise,
         commission_totals.total_beneficiaries,
         commission_totals.total_credited_in_paise,
         commission_totals.total_pending_in_paise,
         payout_totals.total_paid_out_in_paise,
         GREATEST(commission_totals.total_credited_in_paise - payout_totals.total_paid_out_in_paise, 0) AS total_available_balance_in_paise
       FROM commission_totals
       CROSS JOIN payout_totals`
    );

    return result.rows[0];
  } catch (error) {
    if (isMissingCommissionSchemaError(error)) {
      return {
        total_commissions: 0,
        total_commission_amount_in_paise: 0,
        total_beneficiaries: 0,
        total_credited_in_paise: 0,
        total_pending_in_paise: 0,
        total_paid_out_in_paise: 0,
        total_available_balance_in_paise: 0
      };
    }
    throw error;
  }
}

async function listBeneficiaryBalances({ search = "" } = {}) {
  try {
    const values = [];
    let searchClause = "";

    if (search && search.trim()) {
      values.push(`%${search.trim()}%`);
      searchClause = `WHERE (users.full_name ILIKE $${values.length} OR users.email ILIKE $${values.length})`;
    }

    const result = await pool.query(
      `WITH credited AS (
         SELECT beneficiary_user_id, COALESCE(SUM(commission_amount_in_paise), 0) AS credited_in_paise
         FROM referral_commissions
         WHERE status = 'credited'
         GROUP BY beneficiary_user_id
       ),
       pending AS (
         SELECT beneficiary_user_id, COALESCE(SUM(commission_amount_in_paise), 0) AS pending_in_paise
         FROM referral_commissions
         WHERE status = 'pending'
         GROUP BY beneficiary_user_id
       ),
       paid_out AS (
         SELECT beneficiary_user_id, COALESCE(SUM(amount_in_paise), 0) AS paid_out_in_paise
         FROM commission_payouts
         WHERE is_voided = false
         GROUP BY beneficiary_user_id
       )
       SELECT
         users.id AS beneficiary_user_id,
         users.full_name AS beneficiary_name,
         users.email AS beneficiary_email,
         COALESCE(credited.credited_in_paise, 0) AS credited_in_paise,
         COALESCE(pending.pending_in_paise, 0) AS pending_in_paise,
         COALESCE(paid_out.paid_out_in_paise, 0) AS paid_out_in_paise,
         GREATEST(COALESCE(credited.credited_in_paise, 0) - COALESCE(paid_out.paid_out_in_paise, 0), 0) AS available_balance_in_paise
       FROM users
       LEFT JOIN credited ON credited.beneficiary_user_id = users.id
       LEFT JOIN pending ON pending.beneficiary_user_id = users.id
       LEFT JOIN paid_out ON paid_out.beneficiary_user_id = users.id
       WHERE users.role = 'student'
       ${searchClause ? `AND ${searchClause.replace(/^WHERE\s+/i, "")}` : ""}
       ORDER BY available_balance_in_paise DESC, users.full_name ASC`
      ,
      values
    );

    return result.rows;
  } catch (error) {
    if (isMissingCommissionSchemaError(error)) {
      return [];
    }
    throw error;
  }
}

async function listRecentPayouts({ limit = 20, search = "", status = "active", beneficiaryUserId = "" } = {}) {
  try {
    const values = [];
    const conditions = [];

    if (status === "active") {
      conditions.push("cp.is_voided = false");
    } else if (status === "voided") {
      conditions.push("cp.is_voided = true");
    }

    if (beneficiaryUserId) {
      values.push(beneficiaryUserId);
      conditions.push(`cp.beneficiary_user_id = $${values.length}`);
    }

    if (search && search.trim()) {
      values.push(`%${search.trim()}%`);
      conditions.push(`(beneficiary.full_name ILIKE $${values.length} OR beneficiary.email ILIKE $${values.length})`);
    }

    values.push(limit);
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
        cp.*,
        beneficiary.full_name AS beneficiary_name,
        beneficiary.email AS beneficiary_email,
        admin_user.full_name AS created_by_name,
        admin_user.email AS created_by_email
       FROM commission_payouts cp
       JOIN users beneficiary ON beneficiary.id = cp.beneficiary_user_id
       LEFT JOIN users admin_user ON admin_user.id = cp.created_by_user_id
       ${whereClause}
       ORDER BY cp.paid_at DESC, cp.created_at DESC
       LIMIT $${values.length}`,
      values
    );

    return result.rows;
  } catch (error) {
    if (isMissingCommissionSchemaError(error)) {
      return [];
    }
    throw error;
  }
}

async function getAvailableBalanceForUser({ beneficiaryUserId, excludePayoutId = null, client }) {
  const runner = client || pool;
  try {
    const values = [beneficiaryUserId];
    let payoutFilter = "";
    if (excludePayoutId) {
      values.push(excludePayoutId);
      payoutFilter = `AND id <> $${values.length}`;
    }

    const result = await runner.query(
      `WITH credited AS (
         SELECT COALESCE(SUM(commission_amount_in_paise), 0) AS credited_in_paise
         FROM referral_commissions
         WHERE beneficiary_user_id = $1
           AND status = 'credited'
       ),
       paid_out AS (
         SELECT COALESCE(SUM(amount_in_paise), 0) AS paid_out_in_paise
         FROM commission_payouts
         WHERE beneficiary_user_id = $1
           AND is_voided = false
           ${payoutFilter}
       )
       SELECT GREATEST(credited.credited_in_paise - paid_out.paid_out_in_paise, 0) AS available_balance_in_paise
       FROM credited
       CROSS JOIN paid_out`,
      values
    );

    return Number(result.rows[0]?.available_balance_in_paise || 0);
  } catch (error) {
    if (isMissingCommissionSchemaError(error)) {
      return 0;
    }
    throw error;
  }
}

async function createManualPayout({ beneficiaryUserId, amountInPaise, notes, paidAt, createdByUserId, client }) {
  const runner = client || pool;
  const result = await runner.query(
    `INSERT INTO commission_payouts (
      beneficiary_user_id,
      amount_in_paise,
      notes,
      paid_at,
      created_by_user_id,
      updated_by_user_id
    ) VALUES ($1, $2, NULLIF($3, ''), $4, $5, $5)
    RETURNING *`,
    [beneficiaryUserId, amountInPaise, notes || "", paidAt || new Date(), createdByUserId || null]
  );

  return result.rows[0] || null;
}

async function getPayoutById({ payoutId, client, includeVoided = true }) {
  const runner = client || pool;
  const values = [payoutId];
  const voidedClause = includeVoided ? "" : "AND cp.is_voided = false";
  const result = await runner.query(
    `SELECT cp.*
     FROM commission_payouts cp
     WHERE cp.id = $1
       ${voidedClause}
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

async function updateManualPayout({ payoutId, amountInPaise, notes, paidAt, updatedByUserId, client }) {
  const runner = client || pool;
  const result = await runner.query(
    `UPDATE commission_payouts
     SET amount_in_paise = $2,
         notes = NULLIF($3, ''),
         paid_at = $4,
         updated_by_user_id = $5
     WHERE id = $1
       AND is_voided = false
     RETURNING *`,
    [payoutId, amountInPaise, notes || "", paidAt || new Date(), updatedByUserId || null]
  );
  return result.rows[0] || null;
}

async function voidManualPayout({ payoutId, voidedByUserId, client }) {
  const runner = client || pool;
  const result = await runner.query(
    `UPDATE commission_payouts
     SET is_voided = true,
         voided_at = NOW(),
         voided_by_user_id = $2,
         updated_by_user_id = $2
     WHERE id = $1
       AND is_voided = false
     RETURNING *`,
    [payoutId, voidedByUserId || null]
  );
  return result.rows[0] || null;
}

async function createPayoutAudit({ payoutId, actionType, actorUserId, payload, client }) {
  const runner = client || pool;
  await runner.query(
    `INSERT INTO commission_payout_audits (
      payout_id,
      action_type,
      actor_user_id,
      payload
    ) VALUES ($1, $2, $3, $4)`,
    [payoutId, actionType, actorUserId || null, payload || {}]
  );
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
  listUserPayouts,
  listUserCommissions,
  getAdminCommissionStats,
  listBeneficiaryBalances,
  listRecentPayouts,
  listAllCommissions,
  getAvailableBalanceForUser,
  createManualPayout,
  getPayoutById,
  updateManualPayout,
  voidManualPayout,
  createPayoutAudit
};
