const pool = require("../config/db");

async function getByProvider(provider = "razorpay") {
  const result = await pool.query(
    "SELECT * FROM payment_settings WHERE provider = $1 LIMIT 1",
    [provider]
  );
  return result.rows[0];
}

async function upsertSettings({
  provider,
  keyId,
  keySecretEncrypted,
  webhookSecretEncrypted,
  environment,
  isActive
}) {
  const result = await pool.query(
    `INSERT INTO payment_settings (
      provider,
      key_id,
      key_secret_encrypted,
      webhook_secret_encrypted,
      environment,
      is_active
    ) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (provider)
    DO UPDATE SET
      key_id = EXCLUDED.key_id,
      key_secret_encrypted = EXCLUDED.key_secret_encrypted,
      webhook_secret_encrypted = EXCLUDED.webhook_secret_encrypted,
      environment = EXCLUDED.environment,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING *`,
    [provider, keyId, keySecretEncrypted, webhookSecretEncrypted, environment, isActive]
  );
  return result.rows[0];
}

module.exports = {
  getByProvider,
  upsertSettings
};
