const paymentSettingsService = require("../services/paymentSettings.service");
const { getRazorpayClient } = require("../config/razorpay");
const { addFlash } = require("../utils/flashMessages");

async function renderSettings(req, res) {
  const settings = await paymentSettingsService.getSettingsWithSecrets();
  res.render("admin/payment-settings", {
    settings: settings || {
      provider: "razorpay",
      key_id: "",
      key_secret: "",
      webhook_secret: "",
      environment: "test",
      is_active: false,
      updated_at: null
    }
  });
}

async function handleSave(req, res) {
  const { key_id, key_secret, webhook_secret, environment } = req.body;
  const isActive = Boolean(req.body.is_active);

  if (!key_id || key_id.trim().length < 5) {
    addFlash(req, "error", "Key ID is required.");
    return res.redirect("/admin/payment-settings");
  }
  if (!environment || !["test", "live"].includes(environment)) {
    addFlash(req, "error", "Invalid environment.");
    return res.redirect("/admin/payment-settings");
  }

  try {
    await paymentSettingsService.saveSettings({
      keyId: key_id.trim(),
      keySecret: key_secret?.trim(),
      webhookSecret: webhook_secret?.trim(),
      environment,
      isActive
    });
    addFlash(req, "success", "Payment settings updated.");
    return res.redirect("/admin/payment-settings");
  } catch (error) {
    addFlash(req, "error", error.message || "Failed to save settings.");
    return res.redirect("/admin/payment-settings");
  }
}

module.exports = {
  renderSettings,
  handleSave,
  handleTestConnection
};

async function handleTestConnection(req, res) {
  try {
    const client = await getRazorpayClient();
    await client.orders.all({ count: 1 });
    addFlash(req, "success", "Razorpay connection successful.");
  } catch (error) {
    addFlash(req, "error", "Failed to connect to Razorpay. Check credentials.");
  }
  return res.redirect("/admin/payment-settings");
}
