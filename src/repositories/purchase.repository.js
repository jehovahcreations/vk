const pool = require("../config/db");

async function createPurchaseOrder({
  userId,
  productId,
  amountInPaise,
  currency,
  referralType,
  referredByUserId,
  adminReferralId,
  affiliateLinkId,
  baseAmountInPaise,
  markupAmountInPaise,
  notes,
  client
}) {
  const runner = client || pool;
  const result = await runner.query(
    `INSERT INTO purchase_orders (
      user_id,
      product_id,
      amount_in_paise,
      currency,
      internal_status,
      referral_type,
      referred_by_user_id,
      admin_referral_id,
      affiliate_link_id,
      base_amount_in_paise,
      markup_amount_in_paise,
      notes
    ) VALUES ($1,$2,$3,$4,'created',$5,$6,$7,$8,$9,$10,$11)
    RETURNING *`,
    [
      userId,
      productId,
      amountInPaise,
      currency,
      referralType,
      referredByUserId,
      adminReferralId,
      affiliateLinkId || null,
      baseAmountInPaise || amountInPaise,
      markupAmountInPaise || 0,
      notes
    ]
  );
  return result.rows[0];
}

async function updateOrderStatus(id, status, client) {
  const runner = client || pool;
  await runner.query(
    "UPDATE purchase_orders SET internal_status = $2 WHERE id = $1",
    [id, status]
  );
}

async function findById(id) {
  const result = await pool.query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
  return result.rows[0];
}

async function findByRazorpayOrderId(razorpayOrderId) {
  const result = await pool.query(
    `SELECT purchase_orders.*
     FROM purchase_orders
     JOIN razorpay_orders ON razorpay_orders.purchase_order_id = purchase_orders.id
     WHERE razorpay_orders.razorpay_order_id = $1
     LIMIT 1`,
    [razorpayOrderId]
  );
  return result.rows[0];
}

async function listOrders() {
  const result = await pool.query(
    `SELECT purchase_orders.*, users.full_name AS student_name, products.title AS product_title
     FROM purchase_orders
     JOIN users ON users.id = purchase_orders.user_id
     JOIN products ON products.id = purchase_orders.product_id
     ORDER BY purchase_orders.created_at DESC`
  );
  return result.rows;
}

async function createUserPurchase({ userId, productId, purchaseOrderId, paymentId, client }) {
  const runner = client || pool;
  await runner.query(
    `INSERT INTO user_purchases (user_id, product_id, purchase_order_id, payment_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [userId, productId, purchaseOrderId, paymentId]
  );
}

async function listUserPurchasedVideos(userId) {
  const result = await pool.query(
    `SELECT
        user_purchases.id,
        user_purchases.access_status,
        user_purchases.created_at,
        products.title,
        products.slug,
        products.thumbnail_url,
        products.price_in_paise,
        products.currency
     FROM user_purchases
     JOIN products ON products.id = user_purchases.product_id
     WHERE user_purchases.user_id = $1
       AND products.type = 'video'
     ORDER BY user_purchases.created_at DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = {
  createPurchaseOrder,
  updateOrderStatus,
  findById,
  findByRazorpayOrderId,
  listOrders,
  createUserPurchase,
  listUserPurchasedVideos
};
