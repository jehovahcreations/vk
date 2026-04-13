const pool = require("../config/db");

let schemaInitPromise = null;

async function ensureAffiliateLinkSchema() {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS affiliate_video_links (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          public_code VARCHAR(32) NOT NULL,
          markup_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT affiliate_video_links_markup_check CHECK (markup_percent >= 0 AND markup_percent <= 100)
        )`
      );

      await pool.query(
        `CREATE TABLE IF NOT EXISTS affiliate_link_visits (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          affiliate_link_id UUID NOT NULL REFERENCES affiliate_video_links(id) ON DELETE CASCADE,
          visitor_ip VARCHAR(64),
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
      );

      await pool.query(
        `ALTER TABLE purchase_orders
          ADD COLUMN IF NOT EXISTS affiliate_link_id UUID,
          ADD COLUMN IF NOT EXISTS base_amount_in_paise INTEGER,
          ADD COLUMN IF NOT EXISTS markup_amount_in_paise INTEGER NOT NULL DEFAULT 0`
      );

      await pool.query(
        `ALTER TABLE purchase_orders
          DROP CONSTRAINT IF EXISTS purchase_orders_affiliate_link_id_fkey,
          ADD CONSTRAINT purchase_orders_affiliate_link_id_fkey
          FOREIGN KEY (affiliate_link_id) REFERENCES affiliate_video_links(id) ON DELETE SET NULL`
      );

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS affiliate_video_links_public_code_unique
         ON affiliate_video_links (public_code)`
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS affiliate_video_links_owner_idx
         ON affiliate_video_links (owner_user_id)`
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS affiliate_video_links_product_idx
         ON affiliate_video_links (product_id)`
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS affiliate_link_visits_link_idx
         ON affiliate_link_visits (affiliate_link_id)`
      );
    })().catch((error) => {
      schemaInitPromise = null;
      throw error;
    });
  }

  return schemaInitPromise;
}

async function findByPublicCode(publicCode) {
  await ensureAffiliateLinkSchema();
  const result = await pool.query(
    `SELECT
      avl.*,
      p.title AS product_title,
      p.slug AS product_slug,
      p.description AS product_description,
      p.thumbnail_url AS product_thumbnail,
      p.price_in_paise AS product_price_in_paise,
      p.currency AS product_currency,
      p.is_active AS product_is_active,
      u.full_name AS owner_name,
      u.affiliate_code AS owner_affiliate_code
     FROM affiliate_video_links avl
     JOIN products p ON p.id = avl.product_id
     JOIN users u ON u.id = avl.owner_user_id
     WHERE avl.public_code = $1
     LIMIT 1`,
    [publicCode]
  );
  return result.rows[0];
}

async function createAffiliateLink({ ownerUserId, productId, publicCode, markupPercent }) {
  await ensureAffiliateLinkSchema();
  const result = await pool.query(
    `INSERT INTO affiliate_video_links (owner_user_id, product_id, public_code, markup_percent)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ownerUserId, productId, publicCode, markupPercent]
  );
  return result.rows[0];
}

async function listUserLinks(ownerUserId) {
  await ensureAffiliateLinkSchema();
  const result = await pool.query(
    `SELECT
      avl.*,
      p.title AS product_title,
      p.slug AS product_slug,
      p.price_in_paise AS base_price_in_paise,
      COALESCE(v.clicks, 0)::INTEGER AS total_clicks,
      COALESCE(o.paid_orders, 0)::INTEGER AS paid_orders,
      COALESCE(o.paid_amount_in_paise, 0)::BIGINT AS paid_amount_in_paise
     FROM affiliate_video_links avl
     JOIN products p ON p.id = avl.product_id
     LEFT JOIN (
       SELECT affiliate_link_id, COUNT(*) AS clicks
       FROM affiliate_link_visits
       GROUP BY affiliate_link_id
     ) v ON v.affiliate_link_id = avl.id
     LEFT JOIN (
       SELECT affiliate_link_id, COUNT(*) AS paid_orders, SUM(amount_in_paise) AS paid_amount_in_paise
       FROM purchase_orders
       WHERE internal_status = 'paid'
       GROUP BY affiliate_link_id
     ) o ON o.affiliate_link_id = avl.id
     WHERE avl.owner_user_id = $1
     ORDER BY avl.created_at DESC`,
    [ownerUserId]
  );
  return result.rows;
}

async function toggleUserLink({ linkId, ownerUserId }) {
  await ensureAffiliateLinkSchema();
  const result = await pool.query(
    `UPDATE affiliate_video_links
     SET is_active = NOT is_active
     WHERE id = $1 AND owner_user_id = $2
     RETURNING *`,
    [linkId, ownerUserId]
  );
  return result.rows[0];
}

async function createLinkVisit({ affiliateLinkId, visitorIp, userAgent }) {
  await ensureAffiliateLinkSchema();
  await pool.query(
    `INSERT INTO affiliate_link_visits (affiliate_link_id, visitor_ip, user_agent)
     VALUES ($1, $2, $3)`,
    [affiliateLinkId, visitorIp || null, userAgent || null]
  );
}

async function listAdminLinksReport() {
  await ensureAffiliateLinkSchema();
  const result = await pool.query(
    `SELECT
      avl.*,
      owner.full_name AS owner_name,
      owner.email AS owner_email,
      p.title AS product_title,
      p.slug AS product_slug,
      COALESCE(v.clicks, 0)::INTEGER AS total_clicks,
      COALESCE(o.paid_orders, 0)::INTEGER AS paid_orders,
      COALESCE(o.paid_amount_in_paise, 0)::BIGINT AS paid_amount_in_paise
     FROM affiliate_video_links avl
     JOIN users owner ON owner.id = avl.owner_user_id
     JOIN products p ON p.id = avl.product_id
     LEFT JOIN (
       SELECT affiliate_link_id, COUNT(*) AS clicks
       FROM affiliate_link_visits
       GROUP BY affiliate_link_id
     ) v ON v.affiliate_link_id = avl.id
     LEFT JOIN (
       SELECT affiliate_link_id, COUNT(*) AS paid_orders, SUM(amount_in_paise) AS paid_amount_in_paise
       FROM purchase_orders
       WHERE internal_status = 'paid'
       GROUP BY affiliate_link_id
     ) o ON o.affiliate_link_id = avl.id
     ORDER BY avl.created_at DESC`
  );

  return result.rows;
}

async function getAdminLinksStats() {
  await ensureAffiliateLinkSchema();
  const result = await pool.query(
    `SELECT
      COUNT(*)::INTEGER AS total_links,
      SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::INTEGER AS active_links
     FROM affiliate_video_links`
  );

  const revenueResult = await pool.query(
    `SELECT
      COALESCE(SUM(amount_in_paise), 0)::BIGINT AS total_paid_amount_in_paise,
      COALESCE(COUNT(*), 0)::INTEGER AS total_paid_orders
     FROM purchase_orders
     WHERE affiliate_link_id IS NOT NULL
       AND internal_status = 'paid'`
  );

  const clicksResult = await pool.query(
    `SELECT COALESCE(COUNT(*), 0)::INTEGER AS total_clicks
     FROM affiliate_link_visits`
  );

  return {
    total_links: Number(result.rows[0]?.total_links || 0),
    active_links: Number(result.rows[0]?.active_links || 0),
    total_paid_amount_in_paise: Number(revenueResult.rows[0]?.total_paid_amount_in_paise || 0),
    total_paid_orders: Number(revenueResult.rows[0]?.total_paid_orders || 0),
    total_clicks: Number(clicksResult.rows[0]?.total_clicks || 0)
  };
}

module.exports = {
  findByPublicCode,
  createAffiliateLink,
  listUserLinks,
  toggleUserLink,
  createLinkVisit,
  listAdminLinksReport,
  getAdminLinksStats
};
