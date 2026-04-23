CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(32),
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'student',
  is_reseller BOOLEAN NOT NULL DEFAULT FALSE,
  affiliate_code VARCHAR(16),
  referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referral_type VARCHAR(16),
  admin_referral_id UUID,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  profile_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'student')),
  CONSTRAINT users_referral_type_check CHECK (referral_type IN ('admin', 'student') OR referral_type IS NULL),
  CONSTRAINT users_commission_percent_check CHECK (commission_percent >= 0 AND commission_percent <= 100)
);

CREATE TABLE IF NOT EXISTS admin_referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(16) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(16) NOT NULL,
  title VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  price_in_paise INTEGER NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_type_check CHECK (type IN ('video', 'course', 'plan'))
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(140) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  amount_in_paise INTEGER NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  internal_status VARCHAR(16) NOT NULL DEFAULT 'created',
  referral_type VARCHAR(16),
  referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_referral_id UUID REFERENCES admin_referral_codes(id) ON DELETE SET NULL,
  notes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_orders_status_check CHECK (internal_status IN ('created','pending','paid','failed','cancelled','refunded')),
  CONSTRAINT purchase_orders_referral_type_check CHECK (referral_type IN ('admin','student','direct') OR referral_type IS NULL)
);

CREATE TABLE IF NOT EXISTS razorpay_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  razorpay_order_id VARCHAR(120) NOT NULL,
  amount_in_paise INTEGER NOT NULL,
  currency VARCHAR(8) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'created',
  receipt VARCHAR(64),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  razorpay_order_id VARCHAR(120),
  razorpay_payment_id VARCHAR(120),
  payment_method VARCHAR(32),
  amount_in_paise INTEGER NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status VARCHAR(16) NOT NULL DEFAULT 'created',
  razorpay_signature VARCHAR(256),
  verified_at TIMESTAMPTZ,
  raw_callback_payload JSONB,
  raw_webhook_payload JSONB,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_status_check CHECK (status IN ('created','authorized','captured','failed','refunded'))
);

CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  access_status VARCHAR(16) NOT NULL DEFAULT 'active',
  access_start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_purchases_status_check CHECK (access_status IN ('active','expired','revoked'))
);

CREATE TABLE IF NOT EXISTS affiliate_video_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  public_code VARCHAR(32) NOT NULL,
  markup_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT affiliate_video_links_markup_check CHECK (markup_percent >= 0 AND markup_percent <= 100)
);

CREATE TABLE IF NOT EXISTS affiliate_link_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_link_id UUID NOT NULL REFERENCES affiliate_video_links(id) ON DELETE CASCADE,
  visitor_ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beneficiary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  commission_percent NUMERIC(5,2) NOT NULL,
  commission_amount_in_paise INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'credited',
  notes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_commissions_percent_check CHECK (commission_percent >= 0 AND commission_percent <= 100),
  CONSTRAINT referral_commissions_amount_check CHECK (commission_amount_in_paise >= 0),
  CONSTRAINT referral_commissions_status_check CHECK (status IN ('pending','credited','reversed'))
);

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
);

CREATE TABLE IF NOT EXISTS commission_payout_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_id UUID NOT NULL REFERENCES commission_payouts(id) ON DELETE CASCADE,
  action_type VARCHAR(16) NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commission_payout_audits_action_type_check CHECK (action_type IN ('created', 'updated', 'voided'))
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  event_id VARCHAR(120),
  event_type VARCHAR(120) NOT NULL,
  signature VARCHAR(256),
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  amount_in_paise INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  reason TEXT,
  provider_refund_id VARCHAR(120),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  key_id VARCHAR(120) NOT NULL,
  key_secret_encrypted TEXT NOT NULL,
  webhook_secret_encrypted TEXT NOT NULL,
  environment VARCHAR(16) NOT NULL DEFAULT 'test',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_settings_env_check CHECK (environment IN ('test', 'live'))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_affiliate_code_unique ON users (affiliate_code) WHERE affiliate_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_referral_codes_code_unique ON admin_referral_codes (code);
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON products (slug);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_unique ON categories (slug);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique ON categories (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS razorpay_orders_order_id_unique ON razorpay_orders (razorpay_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_payment_unique ON payments (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_event_id_unique ON webhook_events (event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_purchases_order_unique ON user_purchases (purchase_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_video_links_public_code_unique ON affiliate_video_links (public_code);
CREATE UNIQUE INDEX IF NOT EXISTS referral_commissions_order_beneficiary_unique ON referral_commissions (purchase_order_id, beneficiary_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS payment_settings_provider_unique ON payment_settings (provider);

CREATE INDEX IF NOT EXISTS purchase_orders_user_id_idx ON purchase_orders (user_id);
CREATE INDEX IF NOT EXISTS purchase_orders_product_id_idx ON purchase_orders (product_id);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON purchase_orders (internal_status);
CREATE INDEX IF NOT EXISTS razorpay_orders_purchase_order_idx ON razorpay_orders (purchase_order_id);
CREATE INDEX IF NOT EXISTS payments_purchase_order_idx ON payments (purchase_order_id);
CREATE INDEX IF NOT EXISTS user_purchases_user_idx ON user_purchases (user_id);
CREATE INDEX IF NOT EXISTS affiliate_video_links_owner_idx ON affiliate_video_links (owner_user_id);
CREATE INDEX IF NOT EXISTS affiliate_video_links_product_idx ON affiliate_video_links (product_id);
CREATE INDEX IF NOT EXISTS affiliate_link_visits_link_idx ON affiliate_link_visits (affiliate_link_id);
CREATE INDEX IF NOT EXISTS referral_commissions_beneficiary_idx ON referral_commissions (beneficiary_user_id);
CREATE INDEX IF NOT EXISTS referral_commissions_created_at_idx ON referral_commissions (created_at DESC);
CREATE INDEX IF NOT EXISTS commission_payouts_beneficiary_idx ON commission_payouts (beneficiary_user_id);
CREATE INDEX IF NOT EXISTS commission_payouts_paid_at_idx ON commission_payouts (paid_at DESC);
CREATE INDEX IF NOT EXISTS commission_payouts_is_voided_idx ON commission_payouts (is_voided);
CREATE INDEX IF NOT EXISTS commission_payout_audits_payout_idx ON commission_payout_audits (payout_id);
CREATE INDEX IF NOT EXISTS commission_payout_audits_created_at_idx ON commission_payout_audits (created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_events_processed_idx ON webhook_events (processed);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_type VARCHAR(16),
  ADD COLUMN IF NOT EXISTS admin_referral_id UUID,
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_referral_type_check,
  ADD CONSTRAINT users_referral_type_check CHECK (referral_type IN ('admin', 'student') OR referral_type IS NULL);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_commission_percent_check,
  ADD CONSTRAINT users_commission_percent_check CHECK (commission_percent >= 0 AND commission_percent <= 100);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_admin_referral_id_fkey,
  ADD CONSTRAINT users_admin_referral_id_fkey FOREIGN KEY (admin_referral_id) REFERENCES admin_referral_codes(id) ON DELETE SET NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id UUID,
  DROP CONSTRAINT IF EXISTS products_category_id_fkey,
  ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS affiliate_link_id UUID,
  ADD COLUMN IF NOT EXISTS base_amount_in_paise INTEGER,
  ADD COLUMN IF NOT EXISTS markup_amount_in_paise INTEGER NOT NULL DEFAULT 0;

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_affiliate_link_id_fkey,
  ADD CONSTRAINT purchase_orders_affiliate_link_id_fkey FOREIGN KEY (affiliate_link_id) REFERENCES affiliate_video_links(id) ON DELETE SET NULL;

ALTER TABLE purchase_orders
  ALTER COLUMN base_amount_in_paise SET DEFAULT NULL;

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_markup_amount_check,
  ADD CONSTRAINT purchase_orders_markup_amount_check CHECK (markup_amount_in_paise >= 0);

ALTER TABLE commission_payouts
  ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens (expires_at);

CREATE TABLE IF NOT EXISTS login_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  identifier VARCHAR(255),
  ip_address VARCHAR(64),
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_categories_updated_at ON categories;
CREATE TRIGGER set_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_referral_commissions_updated_at ON referral_commissions;
CREATE TRIGGER set_referral_commissions_updated_at
BEFORE UPDATE ON referral_commissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_commission_payouts_updated_at ON commission_payouts;
CREATE TRIGGER set_commission_payouts_updated_at
BEFORE UPDATE ON commission_payouts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_affiliate_video_links_updated_at ON affiliate_video_links;
CREATE TRIGGER set_affiliate_video_links_updated_at
BEFORE UPDATE ON affiliate_video_links
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
