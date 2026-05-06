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
  const result = await runner.query(
    "UPDATE purchase_orders SET internal_status = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
    [id, status]
  );
  return result.rows[0] || null;
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

async function findLatestOrderForUserProductWithRazorpay({ userId, productId }) {
  const result = await pool.query(
    `SELECT
       purchase_orders.*,
       razorpay_orders.razorpay_order_id
     FROM purchase_orders
     JOIN razorpay_orders ON razorpay_orders.purchase_order_id = purchase_orders.id
     WHERE purchase_orders.user_id = $1
       AND purchase_orders.product_id = $2
     ORDER BY purchase_orders.created_at DESC
     LIMIT 1`,
    [userId, productId]
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
  const result = await runner.query(
    `INSERT INTO user_purchases (user_id, product_id, purchase_order_id, payment_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [userId, productId, purchaseOrderId, paymentId]
  );
  return result.rows[0] || null;
}

async function listUserPurchasedVideos(userId) {
  const result = await pool.query(
    `SELECT
        COALESCE(user_purchases.id, purchase_orders.id) AS id,
        COALESCE(user_purchases.access_status, 'active') AS access_status,
        COALESCE(user_purchases.created_at, purchase_orders.created_at) AS created_at,
        products.title,
        products.slug,
        products.thumbnail_url,
        products.price_in_paise,
        products.currency
     FROM purchase_orders
     JOIN products ON products.id = purchase_orders.product_id
     LEFT JOIN user_purchases ON user_purchases.purchase_order_id = purchase_orders.id
     WHERE purchase_orders.user_id = $1
       AND products.type = 'video'
       AND purchase_orders.internal_status = 'paid'
     ORDER BY COALESCE(user_purchases.created_at, purchase_orders.created_at) DESC`,
    [userId]
  );
  return result.rows;
}

async function hasActivePurchaseForProduct({ userId, productId }) {
  const result = await pool.query(
    `SELECT 1 FROM (
       SELECT 1
       FROM user_purchases
       WHERE user_id = $1
         AND product_id = $2
         AND access_status = 'active'
         AND (access_end_at IS NULL OR access_end_at > NOW())

       UNION ALL

       SELECT 1
       FROM purchase_orders
       WHERE user_id = $1
         AND product_id = $2
         AND internal_status = 'paid'
     ) access
     LIMIT 1`,
    [userId, productId]
  );

  return result.rowCount > 0;
}

async function findLatestPaidVideoForUser(userId) {
  const result = await pool.query(
    `SELECT products.slug
     FROM purchase_orders
     JOIN products ON products.id = purchase_orders.product_id
     WHERE purchase_orders.user_id = $1
       AND purchase_orders.internal_status = 'paid'
       AND products.type = 'video'
     ORDER BY purchase_orders.created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0];
}

async function listRecentUnpaidVideoOrdersForUser(userId, limit = 5) {
  const result = await pool.query(
    `SELECT
       purchase_orders.*,
       razorpay_orders.razorpay_order_id
     FROM purchase_orders
     JOIN products ON products.id = purchase_orders.product_id
     JOIN razorpay_orders ON razorpay_orders.purchase_order_id = purchase_orders.id
     WHERE purchase_orders.user_id = $1
       AND purchase_orders.internal_status IN ('created', 'pending')
       AND products.type = 'video'
     ORDER BY purchase_orders.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

async function listUserActivePurchasedProductIds(userId) {
  const result = await pool.query(
    `SELECT product_id
     FROM user_purchases
     WHERE user_id = $1
       AND access_status = 'active'
       AND (access_end_at IS NULL OR access_end_at > NOW())

     UNION

     SELECT product_id
     FROM purchase_orders
     WHERE user_id = $1
       AND internal_status = 'paid'`,
    [userId]
  );

  return result.rows.map((row) => row.product_id);
}

module.exports = {
  createPurchaseOrder,
  updateOrderStatus,
  findById,
  findByRazorpayOrderId,
  findLatestOrderForUserProductWithRazorpay,
  listOrders,
  createUserPurchase,
  listUserPurchasedVideos,
  hasActivePurchaseForProduct,
  findLatestPaidVideoForUser,
  listRecentUnpaidVideoOrdersForUser,
  listUserActivePurchasedProductIds
};
