const paymentService = require("../services/payment.service");
const webhookService = require("../services/webhook.service");
const refundService = require("../services/refund.service");
const commissionService = require("../services/commission.service");
const affiliateLinkService = require("../services/affiliateLink.service");

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
  const report = await commissionService.getAdminCommissionReport();
  res.render("admin/commissions/index", report);
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
  renderAffiliateLinks,
  renderWebhooks,
  renderRefunds,
  approveRefund,
  rejectRefund
};
