const paymentService = require("../services/payment.service");
const webhookService = require("../services/webhook.service");
const refundService = require("../services/refund.service");
const commissionService = require("../services/commission.service");
const affiliateLinkService = require("../services/affiliateLink.service");
const { addFlash } = require("../utils/flashMessages");

function escapeCsv(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function renderPayments(req, res) {
  const payments = await paymentService.listPayments();
  res.render("admin/payments/index", { payments });
}

async function renderPaymentDetail(req, res) {
  const payment = await paymentService.getPaymentDetail(req.params.id);
  if (!payment) {
    return res.redirect("/admin/payments");
  }
  return res.render("admin/payments/show", { payment });
}

async function renderCommissions(req, res) {
  const report = await commissionService.getAdminCommissionReport({
    search: req.query.search || "",
    payoutStatus: req.query.payout_status || "active",
    beneficiaryUserId: req.query.beneficiary_user_id || ""
  });
  res.render("admin/commissions/index", report);
}

async function handleCommissionPayout(req, res) {
  try {
    await commissionService.createManualPayout({
      beneficiaryUserId: req.body.beneficiary_user_id,
      amountInInr: req.body.amount_in_inr,
      notes: req.body.notes,
      paidAt: req.body.paid_at,
      createdByUserId: req.session?.user?.id || null
    });
    addFlash(req, "success", "Commission payout recorded successfully.");
  } catch (error) {
    addFlash(req, "error", error.message || "Unable to record commission payout.");
  }
  return res.redirect("/admin/commissions");
}

async function handleUpdateCommissionPayout(req, res) {
  try {
    await commissionService.updateManualPayout({
      payoutId: req.params.id,
      amountInInr: req.body.amount_in_inr,
      notes: req.body.notes,
      paidAt: req.body.paid_at,
      updatedByUserId: req.session?.user?.id || null
    });
    addFlash(req, "success", "Commission payout updated.");
  } catch (error) {
    addFlash(req, "error", error.message || "Unable to update commission payout.");
  }
  return res.redirect("/admin/commissions");
}

async function handleDeleteCommissionPayout(req, res) {
  try {
    await commissionService.voidManualPayout({
      payoutId: req.params.id,
      voidedByUserId: req.session?.user?.id || null
    });
    addFlash(req, "success", "Commission payout deleted.");
  } catch (error) {
    addFlash(req, "error", error.message || "Unable to delete commission payout.");
  }
  return res.redirect("/admin/commissions");
}

async function exportCommissionPayoutsCsv(req, res) {
  const rows = await commissionService.getPayoutExportRows({
    search: req.query.search || "",
    payoutStatus: req.query.payout_status || "all",
    beneficiaryUserId: req.query.beneficiary_user_id || ""
  });

  const headers = [
    "payout_id",
    "beneficiary_name",
    "beneficiary_email",
    "amount_in_inr",
    "paid_at",
    "status",
    "created_by",
    "notes"
  ];

  const csvRows = [headers.join(",")];
  rows.forEach((item) => {
    csvRows.push([
      escapeCsv(item.id),
      escapeCsv(item.beneficiary_name),
      escapeCsv(item.beneficiary_email),
      escapeCsv((Number(item.amount_in_paise || 0) / 100).toFixed(2)),
      escapeCsv(new Date(item.paid_at || item.created_at).toISOString()),
      escapeCsv(item.is_voided ? "voided" : "active"),
      escapeCsv(item.created_by_name || "Admin"),
      escapeCsv(item.notes || "")
    ].join(","));
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=commission-payouts-${Date.now()}.csv`);
  return res.send(csvRows.join("\n"));
}

async function renderAffiliateLinks(req, res) {
  try {
    const report = await affiliateLinkService.getAdminAffiliateLinkReport();
    res.render("admin/affiliate-links/index", report);
  } catch (error) {
    res.render("admin/affiliate-links/index", {
      stats: {
        totalLinks: 0,
        activeLinks: 0,
        totalClicks: 0,
        totalPaidOrders: 0,
        totalPaidAmountInPaise: 0
      },
      links: []
    });
  }
}

async function renderWebhooks(req, res) {
  const webhooks = await webhookService.listWebhooks();
  res.render("admin/webhooks/index", { webhooks });
}

async function renderRefunds(req, res) {
  const refunds = await refundService.listRefunds();
  res.render("admin/refunds/index", { refunds });
}

async function approveRefund(req, res) {
  await refundService.approveRefund(req.params.id);
  res.redirect("/admin/refunds");
}

async function rejectRefund(req, res) {
  await refundService.rejectRefund(req.params.id);
  res.redirect("/admin/refunds");
}

module.exports = {
  renderPayments,
  renderPaymentDetail,
  renderCommissions,
  handleCommissionPayout,
  handleUpdateCommissionPayout,
  handleDeleteCommissionPayout,
  exportCommissionPayoutsCsv,
  renderAffiliateLinks,
  renderWebhooks,
  renderRefunds,
  approveRefund,
  rejectRefund
};
