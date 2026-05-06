const pool = require("../config/db");
const productRepository = require("../repositories/product.repository");
const userRepository = require("../repositories/user.repository");
const purchaseRepository = require("../repositories/purchase.repository");
const razorpayRepository = require("../repositories/razorpay.repository");
const razorpayService = require("./razorpay.service");
const affiliateLinkService = require("./affiliateLink.service");

async function createPurchaseOrder({ userId, productSlug, affiliateOfferCode = null }) {
  const product = await productRepository.findBySlug(productSlug);
  if (!product) {
    const error = new Error("Product not found.");
    error.code = "PRODUCT_NOT_FOUND";
    throw error;
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    const error = new Error("User not found.");
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const offer = await affiliateLinkService.resolveOfferForCheckout({
    publicCode: affiliateOfferCode,
    productId: product.id,
    buyerUserId: user.id
  });

  const orderAmountInPaise = offer ? offer.finalAmountInPaise : product.price_in_paise;
  const referralType = offer ? "student" : (user.referral_type || "direct");
  const referredByUserId = offer ? offer.referredByUserId : (user.referred_by_user_id || null);
  const adminReferralId = offer ? null : (user.admin_referral_id || null);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = await purchaseRepository.createPurchaseOrder({
      userId: user.id,
      productId: product.id,
      amountInPaise: orderAmountInPaise,
      currency: product.currency,
      referralType,
      referredByUserId,
      adminReferralId,
      affiliateLinkId: offer?.affiliateLinkId || null,
      baseAmountInPaise: offer ? offer.baseAmountInPaise : product.price_in_paise,
      markupAmountInPaise: offer ? offer.markupAmountInPaise : 0,
      notes: {
        product_type: product.type,
        affiliate_offer_code: affiliateOfferCode || null,
        markup_percent: offer?.markupPercent || 0
      },
      client
    });

    const receipt = `ord_${order.id.replace(/-/g, "").slice(0, 30)}`;
    const razorpayOrder = await razorpayService.createOrder({
      amountInPaise: order.amount_in_paise,
      currency: order.currency,
      receipt,
      notes: { purchase_order_id: order.id, product_id: product.id }
    });

    await razorpayRepository.createRazorpayOrder({
      purchaseOrderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amountInPaise: order.amount_in_paise,
      currency: order.currency,
      status: razorpayOrder.status,
      receipt,
      rawResponse: razorpayOrder,
      client
    });

    await client.query("COMMIT");
    return { order, product, razorpayOrder };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createPurchaseOrder,
  listUserPurchasedVideos: (userId) => purchaseRepository.listUserPurchasedVideos(userId),
  hasActivePurchaseForProduct: ({ userId, productId }) =>
    purchaseRepository.hasActivePurchaseForProduct({ userId, productId }),
  findLatestPaidVideoForUser: (userId) => purchaseRepository.findLatestPaidVideoForUser(userId),
  listUserActivePurchasedProductIds: (userId) =>
    purchaseRepository.listUserActivePurchasedProductIds(userId)
};
