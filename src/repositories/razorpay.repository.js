const pool = require("../config/db");

async function createRazorpayOrder({
  purchaseOrderId,
  razorpayOrderId,
  amountInPaise,
  currency,
  status,
  receipt,
  rawResponse,
  client
}) {
  const runner = client || pool;
  const result = await runner.query(
    `INSERT INTO razorpay_orders (
      purchase_order_id,
      razorpay_order_id,
      amount_in_paise,
      currency,
      status,
      receipt,
      raw_response
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *`,
    [purchaseOrderId, razorpayOrderId, amountInPaise, currency, status, receipt, rawResponse]
  );
  return result.rows[0];
}

module.exports = {
  createRazorpayOrder
};
