const express = require("express");
const requireAdmin = require("../middlewares/requireAdmin");
const adminPaymentController = require("../controllers/admin.payment.controller");

const router = express.Router();

router.use(requireAdmin);
router.get("/payments", adminPaymentController.renderPayments);
router.get("/payments/:id", adminPaymentController.renderPaymentDetail);
router.get("/commissions", adminPaymentController.renderCommissions);
router.get("/commissions/payouts/export", adminPaymentController.exportCommissionPayoutsCsv);
router.post("/commissions/payouts", adminPaymentController.handleCommissionPayout);
router.post("/commissions/payouts/:id/update", adminPaymentController.handleUpdateCommissionPayout);
router.post("/commissions/payouts/:id/delete", adminPaymentController.handleDeleteCommissionPayout);
router.get("/affiliate-links", adminPaymentController.renderAffiliateLinks);
router.get("/webhooks", adminPaymentController.renderWebhooks);
router.get("/refunds", adminPaymentController.renderRefunds);
router.post("/refunds/:id/approve", adminPaymentController.approveRefund);
router.post("/refunds/:id/reject", adminPaymentController.rejectRefund);

module.exports = router;
