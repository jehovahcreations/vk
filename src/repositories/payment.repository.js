const pool = require("../config/db");

async function createPayment({
  purchaseOrderId,
  razorpayOrderId,
  razorpayPaymentId,
  amountInPaise,
  currency,
  status,
  paymentMethod,
  razorpaySignature,
  rawCallbackPayload,
  rawWebhookPayload,
  verifiedAt,
  client
}) {
  const runner = client || pool;
  const result = await runner.query(
    `INSERT INTO payments (
      purchase_order_id,
      razorpay_order_id,
      razorpay_payment_id,
      amount_in_paise,
      currency,
      status,
      payment_method,
      razorpay_signature,
      raw_callback_payload,
      raw_webhook_payload,
      verified_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *`,
    [
      purchaseOrderId,
      razorpayOrderId,
      razorpayPaymentId,
      amountInPaise,
      currency,
      status,
      paymentMethod,
      razorpaySignature,
      rawCallbackPayload,
      rawWebhookPayload,
      verifiedAt
    ]
  );
  return result.rows[0];
}

async function findByRazorpayPaymentId(paymentId) {
  const result = await pool.query(
    "SELECT * FROM payments WHERE razorpay_payment_id = $1 LIMIT 1",
    [paymentId]
  );
  return result.rows[0];
}

async function findByRazorpayPaymentIdForUpdate(paymentId, client) {
  const runner = client || pool;
  const result = await runner.query(
    "SELECT * FROM payments WHERE razorpay_payment_id = $1 LIMIT 1 FOR UPDATE",
    [paymentId]
  );
  return result.rows[0];
}

async function findByOrderId(orderId) {
  const result = await pool.query("SELECT * FROM payments WHERE purchase_order_id = $1", [orderId]);
  return result.rows[0];
}

async function updatePaymentStatus({ id, status, verifiedAt, rawWebhookPayload, failureReason, client }) {
  const runner = client || pool;
  const result = await runner.query(
    `UPDATE payments
     SET status = $2,
         verified_at = COALESCE($3, verified_at),
         raw_webhook_payload = COALESCE($4, raw_webhook_payload),
         failure_reason = COALESCE($5, failure_reason)
     WHERE id = $1
     RETURNING *`,
    [id, status, verifiedAt, rawWebhookPayload, failureReason]
  );
  return result.rows[0];
}

async function listPayments() {
  const result = await pool.query(
    `SELECT payments.*, purchase_orders.internal_status, users.full_name AS student_name, products.title AS product_title
     FROM payments
     JOIN purchase_orders ON purchase_orders.id = payments.purchase_order_id
     JOIN users ON users.id = purchase_orders.user_id
     JOIN products ON products.id = purchase_orders.product_id
     ORDER BY payments.created_at DESC`
  );
  return result.rows;
}

async function findPaymentDetail(id) {
  const result = await pool.query(
    `SELECT payments.*, purchase_orders.internal_status, purchase_orders.referral_type,
            users.full_name AS student_name, users.email AS student_email,
            products.title AS product_title, products.type AS product_type
     FROM payments
     JOIN purchase_orders ON purchase_orders.id = payments.purchase_order_id
     JOIN users ON users.id = purchase_orders.user_id
     JOIN products ON products.id = purchase_orders.product_id
     WHERE payments.id = $1`,
    [id]
  );
  return result.rows[0];
}

module.exports = {
  createPayment,
  findByRazorpayPaymentId,
  findByRazorpayPaymentIdForUpdate,
  findByOrderId,
  updatePaymentStatus,
  listPayments,
  findPaymentDetail
};
