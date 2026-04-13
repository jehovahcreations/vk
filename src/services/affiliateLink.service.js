const crypto = require("crypto");
const productRepository = require("../repositories/product.repository");
const affiliateLinkRepository = require("../repositories/affiliateLink.repository");

function parseMarkupPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    const error = new Error("Markup must be between 0 and 100.");
    error.code = "MARKUP_INVALID";
    throw error;
  }
  return Number(num.toFixed(2));
}

function computeAmounts(basePriceInPaise, markupPercent) {
  const markupAmount = Math.round((basePriceInPaise * markupPercent) / 100);
  return {
    baseAmountInPaise: basePriceInPaise,
    markupAmountInPaise: markupAmount,
    finalAmountInPaise: basePriceInPaise + markupAmount
  };
}

function generatePublicCode() {
  return crypto.randomBytes(6).toString("base64url").toUpperCase();
}

async function generateUniquePublicCode() {
  let code = generatePublicCode();
  let existing = await affiliateLinkRepository.findByPublicCode(code);
  while (existing) {
    code = generatePublicCode();
    existing = await affiliateLinkRepository.findByPublicCode(code);
  }
  return code;
}

async function createUserAffiliateLink({ ownerUserId, productId, markupPercent }) {
  const product = await productRepository.findById(productId);
  if (!product || product.type !== "video" || !product.is_active) {
    const error = new Error("Active video not found.");
    error.code = "PRODUCT_INVALID";
    throw error;
  }

  const parsedMarkup = parseMarkupPercent(markupPercent);
  const publicCode = await generateUniquePublicCode();

  return affiliateLinkRepository.createAffiliateLink({
    ownerUserId,
    productId: product.id,
    publicCode,
    markupPercent: parsedMarkup
  });
}

async function listUserAffiliateLinks(ownerUserId, appOrigin) {
  const links = await affiliateLinkRepository.listUserLinks(ownerUserId);
  return links.map((item) => ({
    ...item,
    public_url: `${appOrigin}/offer/${encodeURIComponent(item.public_code)}`
  }));
}

async function toggleUserAffiliateLink({ linkId, ownerUserId }) {
  return affiliateLinkRepository.toggleUserLink({ linkId, ownerUserId });
}

async function getPublicOffer(publicCode, req) {
  const link = await affiliateLinkRepository.findByPublicCode(publicCode);
  if (!link || !link.is_active || !link.product_is_active) {
    return null;
  }

  await affiliateLinkRepository.createLinkVisit({
    affiliateLinkId: link.id,
    visitorIp: req.ip,
    userAgent: req.get("user-agent")
  });

  const amounts = computeAmounts(Number(link.product_price_in_paise || 0), Number(link.markup_percent || 0));
  return {
    link,
    amounts
  };
}

async function resolveOfferForCheckout({ publicCode, productId, buyerUserId }) {
  if (!publicCode) {
    return null;
  }

  const link = await affiliateLinkRepository.findByPublicCode(publicCode);
  if (!link || !link.is_active || !link.product_is_active) {
    const error = new Error("Affiliate offer link is invalid or inactive.");
    error.code = "AFFILIATE_LINK_INVALID";
    throw error;
  }

  if (String(link.product_id) !== String(productId)) {
    const error = new Error("Offer link does not match this video.");
    error.code = "AFFILIATE_LINK_PRODUCT_MISMATCH";
    throw error;
  }

  if (String(link.owner_user_id) === String(buyerUserId)) {
    const error = new Error("You cannot buy your own affiliate offer.");
    error.code = "AFFILIATE_SELF_PURCHASE";
    throw error;
  }

  const amounts = computeAmounts(Number(link.product_price_in_paise || 0), Number(link.markup_percent || 0));

  return {
    affiliateLinkId: link.id,
    referredByUserId: link.owner_user_id,
    referralType: "student",
    adminReferralId: null,
    ...amounts,
    markupPercent: Number(link.markup_percent || 0)
  };
}

async function getAdminAffiliateLinkReport() {
  const [stats, links] = await Promise.all([
    affiliateLinkRepository.getAdminLinksStats(),
    affiliateLinkRepository.listAdminLinksReport()
  ]);

  return {
    stats: {
      totalLinks: Number(stats.total_links || 0),
      activeLinks: Number(stats.active_links || 0),
      totalClicks: Number(stats.total_clicks || 0),
      totalPaidOrders: Number(stats.total_paid_orders || 0),
      totalPaidAmountInPaise: Number(stats.total_paid_amount_in_paise || 0)
    },
    links
  };
}

module.exports = {
  createUserAffiliateLink,
  listUserAffiliateLinks,
  toggleUserAffiliateLink,
  getPublicOffer,
  resolveOfferForCheckout,
  getAdminAffiliateLinkReport
};
