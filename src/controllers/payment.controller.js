const purchaseService = require("../services/purchase.service");
const paymentService = require("../services/payment.service");
const productRepository = require("../repositories/product.repository");
const affiliateLinkService = require("../services/affiliateLink.service");
const { getPublicKeyId, appBaseUrl } = require("../config/razorpay");
const { formatINR } = require("../utils/currency");
const { addFlash } = require("../utils/flashMessages");

async function renderCheckout(req, res) {
  const product = await productRepository.findBySlug(req.params.slug);
  if (!product) {
    addFlash(req, "error", "Product not found.");
    return res.redirect("/student/dashboard");
  }

  const hasAccess = await purchaseService.hasActivePurchaseForProduct({
    userId: req.session.user.id,
    productId: product.id
  });
  if (hasAccess) {
    addFlash(req, "success", "You already have access to this video.");
    return res.redirect(`/videos/${product.slug}`);
  }

  const offerCode = req.query.offer || "";
  let offerPreview = null;
  if (offerCode) {
    try {
      offerPreview = await affiliateLinkService.resolveOfferForCheckout({
        publicCode: offerCode,
        productId: product.id,
        buyerUserId: req.session.user.id
      });
    } catch (error) {
      addFlash(req, "error", error.message || "Affiliate offer is invalid.");
      return res.redirect(`/student/products/${product.slug}/checkout`);
    }
  }

  const payableAmount = offerPreview ? offerPreview.finalAmountInPaise : product.price_in_paise;

  const keyId = await getPublicKeyId();

  res.render("student/checkout", {
    product,
    priceFormatted: formatINR(payableAmount),
    offerCode,
    offerPreview,
    razorpayKeyId: keyId,
    appBaseUrl
  });
}

async function createOrder(req, res) {
  try {
    const settings = await require("../services/paymentSettings.service").getActiveSettings();
    if (!settings || !settings.is_active) {
      return res.status(400).json({ error: "Payments are currently disabled." });
    }
    const { order, product, razorpayOrder } = await purchaseService.createPurchaseOrder({
      userId: req.session.user.id,
      productSlug: req.body.slug,
      affiliateOfferCode: req.body.offerCode || null
    });

    return res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      purchaseOrderId: order.id,
      product: {
        title: product.title,
        description: product.description
      }
    });
  } catch (error) {
    const message =
      error?.error?.description ||
      error?.description ||
      error?.message ||
      "Unable to create order";
    console.error("Create order failed:", error);
    return res.status(400).json({ error: message });
  }
}

async function verifyPayment(req, res) {
  try {
    const settings = await require("../services/paymentSettings.service").getSettingsWithSecrets();
    const keySecret = settings?.key_secret || process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(400).json({
        error: "Payment verification not configured",
        redirectUrl: "/student/payments/failed"
      });
    }
    const { order } = await paymentService.verifyPayment({
      orderId: req.body.razorpay_order_id,
      paymentId: req.body.razorpay_payment_id,
      signature: req.body.razorpay_signature,
      keySecret
    });
    const product = await productRepository.findById(order.product_id);
    const successUrl = product?.slug
      ? `/student/payments/success?video=${encodeURIComponent(product.slug)}`
      : "/student/payments/success";

    return res.json({ redirectUrl: successUrl });
  } catch (error) {
    console.error("Payment verification failed:", {
      message: error.message,
      code: error.code,
      orderId: req.body?.razorpay_order_id,
      paymentId: req.body?.razorpay_payment_id
    });

    return res.status(400).json({
      error: error.message || "Payment verification failed",
      redirectUrl: "/student/payments/failed"
    });
  }
}

async function renderSuccess(req, res) {
  const videoSlug = typeof req.query.video === "string" ? req.query.video : "";
  let redirectUrl = videoSlug ? `/videos/${encodeURIComponent(videoSlug)}` : "";

  if (!redirectUrl) {
    const latestVideo = await purchaseService.findLatestPaidVideoForUser(req.session.user.id);
    redirectUrl = latestVideo?.slug
      ? `/videos/${encodeURIComponent(latestVideo.slug)}`
      : "/student/purchases";
  }

  res.render("student/payment-success", { redirectUrl });
}

function renderFailed(req, res) {
  res.render("student/payment-failed");
}

async function renderPurchases(req, res) {
  try {
    await paymentService.reconcileRecentCapturedVideoPaymentsForUser(req.session.user.id);
  } catch (error) {
    console.error("Recent payment reconciliation failed:", {
      message: error.message,
      userId: req.session.user.id
    });
  }

  const videos = await purchaseService.listUserPurchasedVideos(req.session.user.id);
  res.render("student/purchases", { videos });
}

async function renderTransactions(req, res) {
  res.render("student/transactions");
}

module.exports = {
  renderCheckout,
  createOrder,
  verifyPayment,
  renderSuccess,
  renderFailed,
  renderPurchases,
  renderTransactions
};
