const express = require("express");
const requireAdmin = require("../middlewares/requireAdmin");
const paymentSettingsController = require("../controllers/paymentSettings.controller");

const router = express.Router();

router.get("/payment-settings", requireAdmin, paymentSettingsController.renderSettings);
router.post("/payment-settings", requireAdmin, paymentSettingsController.handleSave);
router.post("/payment-settings/test", requireAdmin, paymentSettingsController.handleTestConnection);

module.exports = router;
