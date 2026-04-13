const Razorpay = require("razorpay");
const env = require("./env");
const paymentSettingsService = require("../services/paymentSettings.service");

async function getSettings() {
  const settings = await paymentSettingsService.getSettingsWithSecrets();
  if (settings) {
    return settings;
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn("Razorpay keys are not set. Payments will fail.");
  }

  return {
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
    webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET,
    environment: process.env.RAZORPAY_ENV || "test",
    is_active: true
  };
}

async function getRazorpayClient() {
  const settings = await getSettings();
  return new Razorpay({
    key_id: settings.key_id,
    key_secret: settings.key_secret
  });
}

async function getPublicKeyId() {
  const settings = await getSettings();
  return settings.key_id;
}

async function getWebhookSecret() {
  const settings = await getSettings();
  return settings.webhook_secret;
}

module.exports = {
  getRazorpayClient,
  getPublicKeyId,
  getWebhookSecret,
  envName: process.env.RAZORPAY_ENV || "test",
  appBaseUrl: process.env.APP_BASE_URL || env.appUrl
};
