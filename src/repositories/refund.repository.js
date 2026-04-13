const pool = require("../config/db");

async function listRefunds() {
  const result = await pool.query(
    `SELECT refunds.*, payments.razorpay_payment_id, users.full_name AS student_name
     FROM refunds
     LEFT JOIN payments ON payments.id = refunds.payment_id
     LEFT JOIN purchase_orders ON purchase_orders.id = refunds.purchase_order_id
     LEFT JOIN users ON users.id = purchase_orders.user_id
     ORDER BY refunds.created_at DESC`
  );
  return result.rows;
}

async function updateRefundStatus(id, status) {
  const result = await pool.query(
    "UPDATE refunds SET status = $2 WHERE id = $1 RETURNING *",
    [id, status]
  );
  return result.rows[0];
}

module.exports = {
  listRefunds,
  updateRefundStatus
};
