const referralService = require("../services/referral.service");
const { addFlash } = require("../utils/flashMessages");

async function renderList(req, res) {
  const search = req.query.search || "";
  const status = req.query.status || "";

  const [referrals, stats] = await Promise.all([
    referralService.listReferrals({ search, status }),
    referralService.getReferralStats()
  ]);

  res.render("admin-referrals", {
    referrals,
    stats,
    filters: { search, status }
  });
}

function renderNew(req, res) {
  res.render("admin-referral-form", {
    pageTitle: "Create Referral Code",
    action: "/admin/referrals",
    referral: { code: "", name: "", description: "" },
    submitLabel: "Create referral"
  });
}

async function renderEdit(req, res) {
  const referral = await referralService.getReferralById(req.params.id);
  if (!referral) {
    addFlash(req, "error", "Referral code not found.");
    return res.redirect("/admin/referrals");
  }
  return res.render("admin-referral-form", {
    pageTitle: "Edit Referral Code",
    action: `/admin/referrals/${referral.id}/update`,
    referral,
    submitLabel: "Update referral"
  });
}

async function handleCreate(req, res) {
  if (!req.body.name || req.body.name.trim().length < 2) {
    addFlash(req, "error", "Campaign name is required.");
    return res.render("admin-referral-form", {
      pageTitle: "Create Referral Code",
      action: "/admin/referrals",
      referral: {
        code: req.body.code || "",
        name: req.body.name || "",
        description: req.body.description || ""
      },
      submitLabel: "Create referral"
    });
  }
  try {
    await referralService.createReferral({
      code: req.body.code?.trim() || "",
      name: req.body.name?.trim(),
      description: req.body.description?.trim()
    });
    addFlash(req, "success", "Referral code created.");
    return res.redirect("/admin/referrals");
  } catch (error) {
    addFlash(req, "error", error.message || "Failed to create referral.");
    return res.render("admin-referral-form", {
      pageTitle: "Create Referral Code",
      action: "/admin/referrals",
      referral: {
        code: req.body.code || "",
        name: req.body.name || "",
        description: req.body.description || ""
      },
      submitLabel: "Create referral"
    });
  }
}

async function handleUpdate(req, res) {
  if (!req.body.name || req.body.name.trim().length < 2) {
    addFlash(req, "error", "Campaign name is required.");
    return res.redirect(`/admin/referrals/${req.params.id}/edit`);
  }
  try {
    await referralService.updateReferral({
      id: req.params.id,
      name: req.body.name?.trim(),
      description: req.body.description?.trim()
    });
    addFlash(req, "success", "Referral updated.");
    return res.redirect("/admin/referrals");
  } catch (error) {
    addFlash(req, "error", "Failed to update referral.");
    return res.redirect(`/admin/referrals/${req.params.id}/edit`);
  }
}

async function handleToggle(req, res) {
  try {
    await referralService.toggleReferral(req.params.id);
    addFlash(req, "success", "Referral status updated.");
  } catch (error) {
    addFlash(req, "error", "Failed to update referral status.");
  }
  return res.redirect("/admin/referrals");
}

module.exports = {
  renderList,
  renderNew,
  renderEdit,
  handleCreate,
  handleUpdate,
  handleToggle
};
