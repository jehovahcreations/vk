const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "vk_training",
  password: String(process.env.DB_PASSWORD || ""),
  port: Number(process.env.DB_PORT || 5432),
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS commission_payouts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        beneficiary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_in_paise INTEGER NOT NULL,
        paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT,
        created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        is_voided BOOLEAN NOT NULL DEFAULT FALSE,
        voided_at TIMESTAMPTZ,
        voided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT commission_payouts_amount_check CHECK (amount_in_paise > 0)
      )
    `);

    await client.query(`
      ALTER TABLE commission_payouts
      ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS voided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS commission_payout_audits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        payout_id UUID NOT NULL REFERENCES commission_payouts(id) ON DELETE CASCADE,
        action_type VARCHAR(16) NOT NULL,
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT commission_payout_audits_action_type_check CHECK (action_type IN ('created', 'updated', 'voided'))
      )
    `);

    await client.query(
      "CREATE INDEX IF NOT EXISTS commission_payouts_beneficiary_idx ON commission_payouts (beneficiary_user_id)"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS commission_payouts_paid_at_idx ON commission_payouts (paid_at DESC)"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS commission_payouts_is_voided_idx ON commission_payouts (is_voided)"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS commission_payout_audits_payout_idx ON commission_payout_audits (payout_id)"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS commission_payout_audits_created_at_idx ON commission_payout_audits (created_at DESC)"
    );

    await client.query(
      "DROP TRIGGER IF EXISTS set_commission_payouts_updated_at ON commission_payouts"
    );
    await client.query(`
      CREATE TRIGGER set_commission_payouts_updated_at
      BEFORE UPDATE ON commission_payouts
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);

    await client.query("COMMIT");
    console.log("Migration complete: commission payout management is ready.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
