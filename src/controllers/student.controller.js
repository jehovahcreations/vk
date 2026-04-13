const videoService = require("../services/video.service");
const commissionService = require("../services/commission.service");
const categoryService = require("../services/category.service");
const affiliateService = require("../services/affiliate.service");
const affiliateLinkService = require("../services/affiliateLink.service");
const { addFlash } = require("../utils/flashMessages");

async function renderDashboard(req, res) {
  const search = req.query.search || "";
  const videos = await videoService.listActiveVideos({ search });
  res.render("student-dashboard", {
    studentName: req.session.user.full_name,
    videos,
    filters: { search }
  });
}

async function renderAffiliate(req, res) {
  const appOrigin = `${req.protocol}://${req.get("host")}`;
  try {
    const [data, videos, links] = await Promise.all([
      affiliateService.getAffiliateDashboard({
        userId: req.session.user.id,
        appOrigin
      }),
      videoService.listActiveVideos({ search: "" }),
      affiliateLinkService.listUserAffiliateLinks(req.session.user.id, appOrigin)
    ]);

    res.render("affiliate", {
      ...data,
      videos,
      links
    });
  } catch (error) {
    addFlash(req, "error", "Affiliate data is partially unavailable. Showing available details.");
    const videos = await videoService.listActiveVideos({ search: "" }).catch(() => []);
    const promoCode = req.session?.user?.affiliate_code || "-";
    return res.render("affiliate", {
      stats: {
        totalEarningsInPaise: 0,
        totalReferrals: 0,
        activeToday: 0,
        conversionRate: 0,
        nextPayoutInPaise: 0
      },
      wallet: {
        availableInPaise: 0,
        pendingInPaise: 0
      },
      referral: {
        promoCode,
        referralLink: promoCode !== "-" ? `${appOrigin}/register?ref=${encodeURIComponent(promoCode)}` : "",
        commissionPercent: 0,
        tier: "Starter"
      },
      analytics: {
        paidOrders: 0,
        totalSalesInPaise: 0
      },
      recentReferrals: [],
      videos,
      links: []
    });
  }
}

async function handleCreateAffiliateLink(req, res) {
  try {
    await affiliateLinkService.createUserAffiliateLink({
      ownerUserId: req.session.user.id,
      productId: req.body.product_id,
      markupPercent: req.body.markup_percent
    });
    addFlash(req, "success", "Public affiliate link created.");
  } catch (error) {
    if (error && error.code === "42P01") {
      addFlash(req, "error", "Affiliate link tables are not migrated yet. Please apply latest database schema.");
    } else {
      addFlash(req, "error", error.message || "Unable to create affiliate link.");
    }
  }
  return res.redirect("/student/affiliate");
}

async function handleToggleAffiliateLink(req, res) {
  try {
    const updated = await affiliateLinkService.toggleUserAffiliateLink({
      linkId: req.params.id,
      ownerUserId: req.session.user.id
    });
    if (!updated) {
      addFlash(req, "error", "Affiliate link not found.");
    } else {
      addFlash(req, "success", "Affiliate link status updated.");
    }
  } catch (error) {
    addFlash(req, "error", "Unable to update affiliate link.");
  }
  return res.redirect("/student/affiliate");
}

  async function renderEarnings(req, res) {
    const earnings = await commissionService.getUserEarnings(req.session.user.id);
    res.render("student/earnings", earnings);
}

async function renderCategories(req, res) {
  const search = req.query.search || "";
  const categories = await categoryService.listCategories({
    search,
    status: "active"
  });

  res.render("student/categories", {
    categories,
    filters: { search }
  });
}

function renderContinueWatching(req, res) {
  res.render("student/continue-watching");
}

function renderProfile(req, res) {
  res.render("student/profile", { student: req.session.user });
}

module.exports = {
  renderDashboard,
  renderAffiliate,
  handleCreateAffiliateLink,
  handleToggleAffiliateLink,
  renderEarnings,
  renderCategories,
  renderContinueWatching,
  renderProfile
};
