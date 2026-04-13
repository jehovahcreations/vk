const paymentSettingsRepository = require("../repositories/paymentSettings.repository");
const { encrypt, decrypt } = require("../utils/encryption");

async function getActiveSettings() {
  const settings = await paymentSettingsRepository.getByProvider("razorpay");
  if (!settings) {
    return null;
  }
  return {
    id: settings.id,
    provider: settings.provider,
    key_id: settings.key_id,
    environment: settings.environment,
    is_active: settings.is_active,
    created_at: settings.created_at,
    updated_at: settings.updated_at
  };
}

async function getSettingsWithSecrets() {
  const settings = await paymentSettingsRepository.getByProvider("razorpay");
  if (!settings) {
    return null;
  }
  return {
    ...settings,
    key_secret: decrypt(settings.key_secret_encrypted),
    webhook_secret: decrypt(settings.webhook_secret_encrypted)
  };
}

async function saveSettings({ keyId, keySecret, webhookSecret, environment, isActive }) {
  const existing = await paymentSettingsRepository.getByProvider("razorpay");

  const keySecretEncrypted = keySecret
    ? encrypt(keySecret)
    : existing?.key_secret_encrypted;
  const webhookSecretEncrypted = webhookSecret
    ? encrypt(webhookSecret)
    : existing?.webhook_secret_encrypted;

  if (!keySecretEncrypted || !webhookSecretEncrypted) {
    const error = new Error("Key secret and webhook secret are required.");
    error.code = "SECRETS_REQUIRED";
    throw error;
  }

  return paymentSettingsRepository.upsertSettings({
    provider: "razorpay",
    keyId,
    keySecretEncrypted,
    webhookSecretEncrypted,
    environment,
    isActive
  });
}

module.exports = {
  getActiveSettings,
  getSettingsWithSecrets,
  saveSettings
};
